# Architecture

CRAGS is a full-stack scheduling and governance application built around a
FastAPI API, PostgreSQL, Alembic migrations, and a React frontend.

## Service Topology

`docker-compose.yml` defines four services:

| Service | Purpose |
|---------|---------|
| `postgres` | PostgreSQL 15 database with a persistent Docker volume. |
| `migrate` | One-shot Alembic job that runs `alembic upgrade head`. |
| `backend` | FastAPI API process on port 8000 with APScheduler background worker. |
| `frontend` | Nginx serving the built React app and proxying `/api` to the backend. |

Startup ordering is health-gated: PostgreSQL must be healthy before migrations,
migrations must complete before the API starts.

## Backend Layout

The backend source lives under `backend/src/crags`.

| Path | Responsibility |
|------|---------------|
| `main.py` | FastAPI app setup, CORS, `/healthz`, super-admin bootstrap, scheduler wiring. |
| `api/router.py` | Composes all module routers into one FastAPI router. |
| `core/config.py` | Environment-backed settings (pydantic-settings). |
| `core/security.py` | Password hashing and JWT token helpers. |
| `db/` | SQLAlchemy base, session factory, and connection pool. |
| `modules/iam/` | Users, groups, roles, login, quotas, RBAC dependencies. |
| `modules/resources/` | Compute system registration and inventory. |
| `modules/scheduling/` | Booking lifecycle: create, cancel, approve, reject, extend, resize, preemption. |
| `modules/audit/` | Audit log model, listing, filtering, and CSV export. |
| `modules/notifications/` | SMTP email delivery and templates. |
| `modules/policies/` | Booking policy CRUD and enforcement (duration, concurrency, approval thresholds). |
| `modules/maintenance/` | Scheduled maintenance windows; auto-transitions systems to MAINTENANCE. |
| `modules/waitlist/` | Waitlist queue; promotes entries to bookings when capacity frees. |
| `modules/analytics/` | Usage breakdown per user/group/system; CSV export. |
| `modules/webhooks/` | HMAC-signed HTTP webhook delivery on booking events. |
| `modules/billing/` | Per-system cost rates; booking cost calculation and user summaries. |
| `modules/templates/` | Saved booking configuration templates per user. |
| `modules/health/` | HTTP health checks for compute systems; auto-MAINTENANCE on failure. |

### Reconciler Loop

`main.py` registers a single APScheduler interval job (`reconcile_bookings`) that
runs every `RECONCILE_INTERVAL_MINUTES` (default 5) and calls, in order:

1. `scheduling.cron.reconcile_bookings` — expire/complete stale bookings, SKIP LOCKED.
2. `maintenance.service.apply_maintenance_transitions` — activate/deactivate windows.
3. `waitlist.service.promote_eligible` — convert WAITING entries to CONFIRMED bookings.
4. `health.service.run_health_checks` — ping `health_check_url` on each system; auto-transition status.

## Frontend Layout

The frontend source lives under `frontend/src`.

| Path | Responsibility |
|------|---------------|
| `App.tsx` | Authenticated router; role-gated routes via `RequireRole`. |
| `main.tsx` | React root with QueryClient, BrowserRouter, AppThemeProvider. |
| `api/client.ts` | Axios instance with 401-auto-refresh interceptor. |
| `api/cragsApi.ts` | Typed wrappers for all backend endpoints. |
| `hooks/` | React Query hooks for auth, systems, bookings, audit, availability, and mutations. |
| `context/ThemeContext.tsx` | Dark/light mode with localStorage persistence. |
| `theme/index.ts` | MUI theme factory (`buildTheme`); Space Grotesk + JetBrains Mono fonts. |
| `pages/` | One file per route: Dashboard, Scheduler, Systems, Monitoring, Analytics, Team, Login. |
| `components/layout/` | AppShell, Sidebar (collapsible), TopBar. |
| `components/forms/` | Booking request form, system registration form. |
| `components/panels/` | Mission control, audit trail, booking lifecycle, system inventory, approval queue, waitlist, maintenance windows, booking actions. |
| `components/charts/` | Resource constraint chart, temporal Gantt. |
| `types/crags.ts` | Shared TypeScript types for all entities. |
| `utils/` | Local booking simulation helpers. |

### Frontend Routes

| Route | Access | Page |
|-------|--------|------|
| `/` | Any authenticated | Dashboard (mission control) |
| `/scheduler` | Any authenticated | Booking request, Gantt, waitlist, modify bookings |
| `/systems` | RESOURCE_ADMIN, SUPER_ADMIN | System inventory, registration, maintenance windows |
| `/monitoring` | GROUP_LEAD+ | Approval queue, audit trail, booking lifecycle |
| `/analytics` | GROUP_LEAD+ | Usage charts, group table, CSV export |
| `/team` | RESOURCE_ADMIN, SUPER_ADMIN | Team management |
| `/login` | Public | Login form |

## Data Model

### Core tables (original)

| Table | Purpose |
|-------|---------|
| `compute_systems` | Named compute systems with CPU, RAM, GPU, VRAM, type, status, and health fields. |
| `groups` | Research groups with concurrent and monthly resource quotas. |
| `users` | Local users with role, group membership, password hash, and activity state. |
| `bookings` | Resource requests over a PostgreSQL `TSRANGE` booking period; includes approval fields. |
| `audit_logs` | All system events with action, record_id, user_id, and timestamp. |

### New tables (added in recent release)

| Table | Purpose |
|-------|---------|
| `booking_policies` | Named policy sets: duration limits, concurrency caps, approval thresholds. |
| `maintenance_windows` | Scheduled maintenance windows per system (start_time, end_time, reason). |
| `waitlist_entries` | Queued capacity requests; promoted to bookings by reconciler. |
| `webhooks` | Registered webhook endpoints with event subscriptions and HMAC secret. |
| `system_costs` | Per-system resource hour rates (CPU, GPU, RAM, VRAM). |
| `booking_templates` | Saved booking configurations per user. |

### Booking approval fields (added to `bookings`)

| Column | Type | Purpose |
|--------|------|---------|
| `approved_by` | `integer FK → users.id` | Admin who approved/rejected. |
| `approved_at` | `datetime` | When the approval decision was made. |
| `rejection_reason` | `text` | Reason text for rejected bookings. |

### System health fields (added to `compute_systems`)

| Column | Type | Purpose |
|--------|------|---------|
| `health_check_url` | `text` | HTTP endpoint to ping. |
| `last_health_check_at` | `datetime` | Timestamp of most recent check. |
| `last_health_status` | `varchar(20)` | `UP`, `DOWN`, or `SKIP`. |

Bookings use a GiST index on `booking_period` for efficient overlap queries.

## Database Connection Pool

Configured in `db/session.py` via SQLAlchemy's `create_engine`:

| Setting | Value | Effect |
|---------|-------|--------|
| `pool_size` | 10 | Minimum persistent connections kept open. |
| `max_overflow` | 20 | Extra connections allowed during traffic spikes (30 total max). |
| `pool_pre_ping` | `True` | Validates each connection with `SELECT 1` before use; silently replaces stale ones. |
| `pool_recycle` | 3600 s | Forces connection replacement every hour, preventing server-side timeouts from PgBouncer, RDS idle-client timeouts, or NAT gateway resets. |
| `autocommit` | `False` | All writes require an explicit `db.commit()`. |
| `autoflush` | `False` | ORM changes are not flushed to the DB until commit or an explicit flush. |

Sessions are **request-scoped**: `get_db()` opens one session per HTTP request and closes it in the `finally` block regardless of success or failure. The reconciler sub-tasks each use their own independently managed sessions to prevent state leakage between tasks.

## Caching

CRAGS uses a lightweight two-backend cache (`core/cache.py`) that mirrors the rate-limiter pattern:

| Backend | When active | Storage |
|---------|-------------|---------|
| `_RedisCache` | `REDIS_URL` is set and reachable at startup | JSON in Redis keys with TTL via `SETEX` |
| `_InMemoryCache` | Redis not configured or unreachable | Python dict with monotonic-clock expiry, thread-safe via `threading.Lock` |

The instance is resolved once (double-checked locking) and reused for the lifetime of the process.

### What is cached

| Cache key | TTL | Endpoint | Invalidated by |
|-----------|-----|----------|----------------|
| `crags:cache:systems` | 60 s | `GET /api/v1/systems/` (unfiltered) | POST/PATCH/DELETE `/systems/`, health-check reconciler |
| `crags:cache:policies` | 300 s | `GET /api/v1/policies` | POST/PATCH/DELETE `/policies/{id}` |
| `crags:cache:billing:costs` | 300 s | `GET /api/v1/billing/costs` | `PUT /billing/costs/{system_id}` |

Only the **unfiltered** systems list is cached; queries with `?status=` hit the database directly. Filtered queries are infrequent admin operations where freshness matters.

### Invalidation strategy

Writes call `get_cache().delete(key)` immediately after committing the database transaction. This is **cache-aside with write-invalidation** (not write-through): the next read repopulates the cache from the database. The health-check reconciler automatically busts `crags:cache:systems` whenever it transitions any system's status.

### What is not cached

Booking availability, booking lists, audit logs, and all user-scoped queries are **never cached** — stale reads on booking data would cause incorrect capacity calculations and double-bookings.

The token blacklist lookup (one DB read per authenticated request) is also not cached here. At high request volume, that lookup is the next candidate to move to Redis with a 15-minute TTL matching the access token lifetime.

## Auth and Roles

Authentication is local username/email + password. Successful login sets an
HTTP-only cookie. Bearer token is also accepted for non-browser clients.

| Role | Access |
|------|--------|
| `MEMBER` | Own bookings, scheduler, dashboard. |
| `GROUP_LEAD` | Own bookings + group member bookings, monitoring, analytics. |
| `RESOURCE_ADMIN` | Full booking scope, systems, team management, approval queue. |
| `SUPER_ADMIN` | All of the above plus user/group creation. |

## Policy Engine

When `create_booking` is called, the service resolves the applicable
`BookingPolicy` for the user's group (group-scoped first, then global default).
The policy can:

- **Block** bookings that exceed hard limits (`max_duration_hours`, `max_advance_days`, `max_concurrent_bookings`).
- **Route** bookings to `REQUESTED` (pending admin approval) when resource thresholds are exceeded or `always_require_approval` is set.

Admins approve or reject `REQUESTED` bookings via `PATCH /bookings/{id}/approve`
and `PATCH /bookings/{id}/reject`.

## Webhook Delivery

When booking state changes occur, `webhooks.service.emit_event` is called.
It queries all active webhooks subscribed to the event (or `"*"`), then fires
a HMAC-SHA256-signed HTTP POST in a daemon thread per webhook. The `secret`
field is used to compute `X-CRAGS-Signature: sha256=<hex>` so consumers can
verify authenticity. Delivery is best-effort; failures are logged and
`last_status_code` is recorded.
