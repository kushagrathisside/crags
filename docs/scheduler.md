# Scheduler

This document covers the background job scheduler: what it does, how it works, configuration, concurrency model, and the scaling roadmap from a single-process deployment to a distributed task queue.

## Table of Contents

1. [Overview](#overview)
2. [Jobs](#jobs)
3. [Reconcile Algorithm](#reconcile-algorithm)
4. [Concurrency and Locking](#concurrency-and-locking)
5. [Lifecycle](#lifecycle)
6. [Health Check](#health-check)
7. [Configuration Reference](#configuration-reference)
8. [Scaling Roadmap](#scaling-roadmap)
9. [Future Algorithm Improvements](#future-algorithm-improvements)
10. [Operations](#operations)

---

## Overview

CRAGS uses [APScheduler](https://apscheduler.readthedocs.io/) (`BackgroundScheduler`) to run periodic maintenance jobs inside the FastAPI process. APScheduler is MIT-licensed; no paid service or external broker is required for the current single-process deployment.

The scheduler starts on application startup, runs a reconciliation job immediately, and then repeats on a configurable interval. It shuts down cleanly when the application exits.

---

## Jobs

### `reconcile_bookings`

| Property | Value |
|----------|-------|
| Trigger | `interval` |
| Default interval | 5 minutes (`RECONCILE_INTERVAL_MINUTES`) |
| First run | Immediately on startup (`next_run_time = now`) |
| Max concurrent instances | 1 (`max_instances=1`) |
| Missed fire behaviour | Coalesce — skip missed fires, run once when back |
| Misfire grace period | 60 seconds |

---

## Reconcile Algorithm

Each invocation of `_run_reconcile()` in `main.py` performs seven steps in order. Each step uses its own database session opened and closed independently to prevent state leakage.

```
Step 1: CONFIRMED  + upper(booking_period) < now  →  COMPLETED
Step 2: REQUESTED  + upper(booking_period) < now  →  EXPIRED
Step 3: DELETE FROM token_blacklist WHERE expires_at < now
Step 4: DELETE FROM audit_logs  WHERE timestamp < now - AUDIT_RETAIN_DAYS
Step 5: maintenance.service.apply_maintenance_transitions
Step 6: waitlist.service.promote_eligible
Step 7: health.service.run_health_checks
```

### Step 1 — COMPLETED

Bookings that were `CONFIRMED` and whose time window has fully elapsed are marked `COMPLETED`. This is the normal terminal state for a booking that ran to completion.

### Step 2 — EXPIRED

Bookings that were `REQUESTED` (pending admin approval) and whose time window has fully elapsed are marked `EXPIRED`. A requested booking can only be confirmed while its window is in the future.

### Step 3 — Token blacklist pruning

Expired JWT entries in `token_blacklist` are deleted. They are already rejected by JWT signature verification, so they are harmless; pruning keeps the table small.

### Step 4 — Audit log retention

Audit rows older than `AUDIT_RETAIN_DAYS` (default 90) are deleted. This bounds unbounded growth of the audit table.

### Step 5 — Maintenance window transitions

`apply_maintenance_transitions` scans `maintenance_windows`:
- Windows whose `start_time ≤ now` and that haven't been applied yet: set the target system to `MAINTENANCE` and cancel any `CONFIRMED` or `REQUESTED` bookings that overlap the window.
- Windows whose `end_time ≤ now` and that are still in effect: restore the system to `ACTIVE` (unless the health monitor reports it as `DOWN`).

### Step 6 — Waitlist promotion

`promote_eligible` scans `WAITING` waitlist entries ordered by priority score (GROUP_LEAD/ADMIN get +10) then creation time. For each entry, it checks whether the requested resources fit the system's current capacity in a window starting from `now` for `duration_hours`. If capacity exists, it creates a `CONFIRMED` booking and marks the entry `PROMOTED`.

### Step 7 — Health checks

`run_health_checks` pings each system's `health_check_url` (if set) with a 5-second timeout:
- `UP` (HTTP 2xx): if the system is in `MAINTENANCE` and no scheduled maintenance window is active, restore it to `ACTIVE`.
- `DOWN` (non-2xx or error): if the system is `ACTIVE`, set it to `MAINTENANCE`.
- `SKIP`: no `health_check_url` configured; system status unchanged.

After any status changes, the `crags:cache:systems` response cache is invalidated.

### Return value

`reconcile_bookings(db)` (Step 1–4) returns a summary dict logged at `INFO` level:

```python
{
    "completed": 3,
    "expired": 1,
    "blacklist_pruned": 12,
    "audit_pruned": 0,
}
```

---

## Concurrency and Locking

### `SELECT ... FOR UPDATE SKIP LOCKED`

Both booking queries (Steps 1 and 2) use `with_for_update(skip_locked=True)`:

```python
db.query(Booking)
  .filter(...)
  .with_for_update(skip_locked=True)
  .all()
```

**Why `FOR UPDATE`:** Prevents a concurrent `create_booking` transaction from reading a row that the reconciler is mid-way through updating, or vice versa.

**Why `SKIP LOCKED`:** If two scheduler instances fire at the same time (e.g. two backend replicas both running `BackgroundScheduler`), the second instance skips any rows already locked by the first rather than blocking. This makes the reconciler safe to run concurrently across replicas without deadlocks or duplicate state transitions.

**Idempotency:** Every state transition is idempotent. Running the same reconciliation twice on the same row produces the same result — the second pass just finds no matching rows.

### Session isolation

`_run_reconcile()` in `main.py` opens a dedicated `SessionLocal()` session for each job execution and closes it in a `finally` block. This session is independent from the request-scoped sessions used by API endpoints.

---

## Lifecycle

```
Application starts
    │
    ├── _check_security_settings()
    ├── ensure_super_admin(db)
    ├── _scheduler.add_job("reconcile_bookings", next_run_time=now)
    └── _scheduler.start()
            │
            ├── Fires immediately (next_run_time=now)
            ├── Fires every RECONCILE_INTERVAL_MINUTES thereafter
            └── ...

Application shuts down (SIGTERM / SIGINT)
    └── _scheduler.shutdown(wait=False)
        └── Running job completes; no new jobs start
```

`wait=False` on shutdown means the application does not block waiting for a job to finish. A running reconciliation will be interrupted at the next DB commit boundary. Because all operations are idempotent, the next startup will safely re-process any rows that were not committed.

---

## Health Check

`GET /healthz` now exposes scheduler state:

```json
{
  "status": "ok",
  "scheduler": {
    "running": true,
    "next_reconcile": "2026-05-26T12:05:00+00:00"
  }
}
```

| Field | Description |
|-------|-------------|
| `scheduler.running` | `true` if the APScheduler instance is active |
| `scheduler.next_reconcile` | ISO timestamp of the next scheduled fire; `null` if the scheduler is not running |

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `RECONCILE_INTERVAL_MINUTES` | `5` | How often `reconcile_bookings` runs, in minutes |
| `AUDIT_RETAIN_DAYS` | `90` | Audit log rows older than this are deleted on each reconcile run |

---

## Scaling Roadmap

### Phase 1 — Current: `BackgroundScheduler` (in-process)

One scheduler instance per process. Correct for single-replica deployments. With `SKIP LOCKED`, two replicas firing simultaneously are safe but wasteful (N-1 extra runs per tick).

```
[Uvicorn process]
    └── BackgroundScheduler thread
            └── reconcile_bookings() every 5 min
```

### Phase 2 — Multi-replica: `SQLAlchemyJobStore`

APScheduler persists job state in the shared database. Only the replica that wins the advisory lock for a given fire time executes the job; others skip it. No new infrastructure required — just a `pyproject.toml` change and scheduler init change.

```python
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

_scheduler = BackgroundScheduler(
    jobstores={"default": SQLAlchemyJobStore(url=settings.DATABASE_URL)},
    job_defaults={"coalesce": True, "max_instances": 1},
)
```

Install: `uv add "apscheduler[sqlalchemy]"` (still MIT, no paid tier).

### Phase 3 — High-scale: Celery + Redis Beat

Separates scheduling (Celery Beat) from execution (Celery Workers). Recommended when you need:

- Dozens of replicas
- Task retries with exponential back-off
- Dead-letter queue for failed jobs
- Task execution history

```
Redis (broker + Beat store)
    │
    Celery Beat ──► fires task every N min
    │
    Celery Workers (pool) ──► one worker picks up the task
    │
    PostgreSQL (CRAGS DB)
```

All components are free and open-source (Celery: MIT; Redis: BSD; redis-py: MIT).

The `reconcile_bookings` function itself does not change across any of these phases — only the scheduler init and the infrastructure change.

---

## Future Algorithm Improvements

| Current limitation | Improvement |
|--------------------|-------------|
| `REQUESTED → EXPIRED` transition not audited | Write `BOOKING_EXPIRED` audit row per expired booking in Step 2 |
| Preemption selects by GPU descending then ID | Priority-weighted score: `score = req_gpu / priority_tier` — lower-priority jobs preempted first |
| No back-fill after preemption | After freeing capacity, scan `REQUESTED` bookings from the same group and auto-confirm those that now fit |
| Monthly quota re-scans all bookings per request | Replace Python-side `sum()` with a single `SELECT SUM(duration * req_cpu) GROUP BY group_id, month` aggregate query |
| `booking_period` scans all rows to find expired | Partial index on `(status, upper(booking_period))` — reconcile only touches relevant rows |

---

## Operations

### Trigger a manual reconcile

```python
# From a Python shell with the DB reachable:
from crags.db.session import SessionLocal
from crags.modules.scheduling.cron import reconcile_bookings

db = SessionLocal()
result = reconcile_bookings(db)
db.close()
print(result)
```

### Change the interval without restart

```python
from crags.main import _scheduler
_scheduler.reschedule_job("reconcile_bookings", trigger="interval", minutes=1)
```

### Pause / resume the scheduler

```python
_scheduler.pause()   # stops firing jobs; does not affect running ones
_scheduler.resume()  # re-enables firing
```

### Check job status

```bash
curl http://localhost:8000/healthz
```
