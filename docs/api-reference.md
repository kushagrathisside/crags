# API Reference

The backend serves REST endpoints from the FastAPI app. With default local
ports, the base URL is `http://localhost:8000`.

Interactive OpenAPI docs are available at `http://localhost:8000/docs` when
the backend is running. All application endpoints are under `/api/v1`.

## Authentication

```http
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/users/me
```

Login sets an HTTP-only session cookie. Non-browser clients may also use
`Authorization: Bearer <token>`. See [Auth Service](./auth-service.md) for
full details.

---

## System Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/healthz` | None | Backend + scheduler health. |
| `GET` | `/api/v1/systems/` | Any | List all compute systems. |
| `POST` | `/api/v1/systems/` | Admin | Register a compute system. |
| `PATCH` | `/api/v1/systems/{id}` | Admin | Update system fields or status. |
| `DELETE` | `/api/v1/systems/{id}` | Admin | Set system OFFLINE (soft delete). |

**Create / update payload fields:**

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Unique system name. |
| `system_type` | `CPU` \| `GPU` \| `HYBRID` | |
| `cpu_cores` | integer | |
| `ram_gb` | integer | |
| `gpu_units` | integer | |
| `vram_gb` | integer | |
| `status` | `ACTIVE` \| `MAINTENANCE` \| `OFFLINE` | |
| `health_check_url` | string (optional) | HTTP endpoint for automatic health pings. |

---

## Booking Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/bookings/systems/{id}/availability` | Any | Available resources in a time window. |
| `GET` | `/api/v1/bookings/` | Scoped | List bookings (paginated). |
| `GET` | `/api/v1/bookings/{id}` | Scoped | Fetch one booking. |
| `POST` | `/api/v1/bookings/` | Any | Create a booking. May return `REQUESTED` if policy requires approval. |
| `PATCH` | `/api/v1/bookings/{id}/cancel` | Owner / Admin | Cancel a `REQUESTED` or `CONFIRMED` booking. |
| `PATCH` | `/api/v1/bookings/{id}/approve` | Admin | Approve a `REQUESTED` booking → `CONFIRMED`. |
| `PATCH` | `/api/v1/bookings/{id}/reject` | Admin | Reject a `REQUESTED` booking → `CANCELLED`. |
| `PATCH` | `/api/v1/bookings/{id}/extend` | Owner / Admin | Push `end_time` forward (capacity-checked). |
| `PATCH` | `/api/v1/bookings/{id}/resize` | Owner / Admin | Change `req_cpu/gpu/ram/vram` (capacity-checked). |

### Booking list query parameters

| Parameter | Type | Notes |
|-----------|------|-------|
| `system_id` | integer | |
| `user_id` | integer | Admins only for other users. |
| `status` | string | e.g. `REQUESTED`, `CONFIRMED`. |
| `academic_category` | string | |
| `start_time` | ISO datetime | |
| `end_time` | ISO datetime | |
| `limit` | integer (1–1000) | Default 200. |
| `offset` | integer | Default 0. |

### Create booking payload

```json
{
  "system_id": 1,
  "start_time": "2026-06-01T09:00:00Z",
  "end_time": "2026-06-01T17:00:00Z",
  "req_cpu": 8,
  "req_gpu": 2,
  "req_ram": 64,
  "req_vram": 32,
  "access_type": "BACKGROUND",
  "academic_category": "Research",
  "project_title": "LLM fine-tune",
  "expected_deliverable": "Checkpoint + eval report",
  "objective": "Benchmark new LoRA adapter on vision tasks."
}
```

`access_type`: `FOREGROUND` (preempts background jobs) or `BACKGROUND`.

**If a booking policy routes the request to approval**, the response status
field is `REQUESTED` instead of `CONFIRMED`. Admins then call `/approve` or
`/reject`.

### Reject payload

```json
{ "reason": "Resource request exceeds project allocation." }
```

### Extend payload

```json
{ "new_end_time": "2026-06-01T21:00:00Z" }
```

### Resize payload (all fields optional)

```json
{ "req_cpu": 4, "req_gpu": 1, "req_ram": 32, "req_vram": 16 }
```

### Conflict response (HTTP 409)

```json
{
  "detail": "GPU capacity exceeded",
  "reason": "CAPACITY_EXCEEDED",
  "resource": "GPU",
  "shortage": 1,
  "overlap_window": { "start_time": "...", "end_time": "..." },
  "conflicting_booking_ids": [12, 13],
  "recommended_fixes": ["Reduce GPU request", "Choose another window"]
}
```

Known `reason` values: `CAPACITY_EXCEEDED`, `PREEMPTION_INSUFFICIENT`,
`GROUP_CONCURRENT_QUOTA_EXCEEDED`, `GROUP_MONTHLY_QUOTA_EXCEEDED`, `INVALID_TRANSITION`.

---

## IAM Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/iam/groups` | Admin | List all groups. |
| `POST` | `/api/v1/iam/groups` | Admin | Create a group. |
| `PATCH` | `/api/v1/iam/groups/{id}` | Admin | Update group name or quotas. |
| `GET` | `/api/v1/iam/users` | Admin | List users. |
| `POST` | `/api/v1/iam/users` | Admin | Create a user. |
| `PATCH` | `/api/v1/iam/users/{id}` | Admin | Update user settings. |
| `GET` | `/api/v1/groups/{id}/members` | Group lead / Admin | List group members. |
| `GET` | `/api/v1/groups/{id}/usage` | Group lead / Admin | Monthly usage summary (`?month=YYYY-MM`). |

Group quota fields: `concurrent_cpu_quota`, `concurrent_gpu_quota`, `concurrent_ram_quota`,
`concurrent_vram_quota`, `monthly_cpu_hours_quota`, `monthly_gpu_hours_quota`,
`monthly_ram_gb_hours_quota`, `monthly_vram_gb_hours_quota`. Use `null` for unlimited.

---

## Audit Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/audit/` | Admin | List audit events (paginated, filtered). |
| `GET` | `/api/v1/audit/actions` | Admin | List all valid audit action enum values. |
| `GET` | `/api/v1/audit/export.csv` | Admin | Download filtered audit log as CSV. |

### Audit query parameters

| Parameter | Type | Notes |
|-----------|------|-------|
| `limit` | integer (1–1000) | Default 200. |
| `offset` | integer | Default 0. |
| `table_name` | string | Filter by table. |
| `action` | string | e.g. `BOOKING_APPROVED`. |
| `user_id` | integer | |
| `from_time` | ISO datetime | Inclusive lower bound on timestamp. |
| `to_time` | ISO datetime | Inclusive upper bound on timestamp. |

The CSV export accepts the same filters and returns a `text/csv` response.

---

## Policy Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/policies` | Any | List all policies. |
| `POST` | `/api/v1/policies` | Admin | Create a policy. |
| `GET` | `/api/v1/policies/{id}` | Any | Fetch one policy. |
| `PATCH` | `/api/v1/policies/{id}` | Admin | Update a policy. |
| `DELETE` | `/api/v1/policies/{id}` | Admin | Delete a policy. |

### Policy payload fields

| Field | Type | Effect |
|-------|------|--------|
| `name` | string | Unique policy name. |
| `max_duration_hours` | integer \| null | Hard limit on booking length. Exceeded → 422. |
| `max_advance_days` | integer \| null | Hard limit on how far ahead to book. |
| `max_concurrent_bookings` | integer \| null | Hard limit on active bookings per user. |
| `approval_required_above_gpu` | integer \| null | Route to REQUESTED if `req_gpu` exceeds this. |
| `approval_required_above_cpu` | integer \| null | Route to REQUESTED if `req_cpu` exceeds this. |
| `approval_required_above_ram_gb` | integer \| null | Route to REQUESTED if `req_ram` exceeds this. |
| `approval_required_above_hours` | integer \| null | Route to REQUESTED if duration exceeds this. |
| `always_require_approval` | boolean | Always route to REQUESTED regardless of resources. |
| `group_id` | integer \| null | Scope policy to a specific group (null = global). |
| `is_default` | boolean | Use as fallback when no group-scoped policy matches. |

---

## Maintenance Window Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/maintenance` | Any | List maintenance windows. Optional `?system_id=`. |
| `POST` | `/api/v1/maintenance` | Admin | Schedule a maintenance window. |
| `DELETE` | `/api/v1/maintenance/{id}` | Admin | Delete a maintenance window. |

### Create maintenance window payload

```json
{
  "system_id": 2,
  "start_time": "2026-06-10T02:00:00Z",
  "end_time": "2026-06-10T06:00:00Z",
  "reason": "Kernel upgrade and GPU driver update"
}
```

When a window becomes active, the reconciler sets the system to `MAINTENANCE`
and cancels any overlapping `CONFIRMED` or `REQUESTED` bookings. When it ends,
the system returns to `ACTIVE` (unless the health monitor reports it as `DOWN`).

---

## Waitlist Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/waitlist` | Scoped | List waitlist entries (admins see all; others see own). |
| `POST` | `/api/v1/waitlist` | Any | Join the waitlist for a system. |
| `DELETE` | `/api/v1/waitlist/{id}` | Owner / Admin | Cancel a waitlist entry. |

### Join payload

```json
{
  "system_id": 1,
  "req_cpu": 8,
  "req_gpu": 2,
  "req_ram": 64,
  "req_vram": 32,
  "duration_hours": 6,
  "access_type": "FOREGROUND",
  "academic_category": "Research",
  "project_title": "Fine-tune run"
}
```

The reconciler calls `promote_eligible()` on every tick. When a `WAITING` entry
fits current capacity, it creates a `CONFIRMED` booking and sets the entry
status to `PROMOTED`.

---

## Analytics Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/analytics` | GROUP_LEAD+ | Usage breakdown for a time window. |
| `GET` | `/api/v1/analytics/export.csv` | GROUP_LEAD+ | Download usage breakdown as CSV. |

### Query parameters

| Parameter | Type | Default |
|-----------|------|---------|
| `from_time` | ISO datetime | 30 days ago |
| `to_time` | ISO datetime | now |

### Response structure

```json
{
  "from_time": "...",
  "to_time": "...",
  "total_bookings": 142,
  "total_cpu_hours": 1280.5,
  "total_gpu_hours": 348.0,
  "total_ram_gb_hours": 81920.0,
  "total_vram_gb_hours": 11136.0,
  "per_user": [
    { "user_id": 3, "username": "alice", "cpu_hours": 128, "gpu_hours": 48, "ram_gb_hours": 8192, "vram_gb_hours": 1536, "booking_count": 5 }
  ],
  "per_group": [ ... ],
  "per_system": [
    { "system_id": 1, "system_name": "gpu-cluster-a", "cpu_utilization_pct": 62.5, "gpu_utilization_pct": 87.0, "ram_utilization_pct": 40.0, "vram_utilization_pct": 55.0, "booking_count": 22, "active_hours": 156.0 }
  ]
}
```

---

## Webhook Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/webhooks` | Admin | List webhooks. |
| `POST` | `/api/v1/webhooks` | Admin | Create a webhook. |
| `GET` | `/api/v1/webhooks/{id}` | Admin | Fetch one webhook. |
| `PATCH` | `/api/v1/webhooks/{id}` | Admin | Update webhook fields. |
| `DELETE` | `/api/v1/webhooks/{id}` | Admin | Delete a webhook. |

### Create payload

```json
{
  "name": "CI notification",
  "url": "https://hooks.example.com/crags",
  "events": ["BOOKING_APPROVED", "BOOKING_REJECTED", "BOOKING_PREEMPTED"],
  "secret": "my-hmac-secret",
  "active": true
}
```

Use `"events": ["*"]` to subscribe to all events. The backend signs each
request with `X-CRAGS-Signature: sha256=<hmac-hex>` using the configured secret.

---

## Billing Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/billing/costs` | Any | List per-system cost rates. |
| `PUT` | `/api/v1/billing/costs/{system_id}` | Admin | Upsert cost rates for a system. |
| `GET` | `/api/v1/billing/bookings/{id}/cost` | Any | Calculate cost for one booking. |
| `GET` | `/api/v1/billing/summary` | Admin | Per-user cost totals (optional `from_time` / `to_time`). |

### Cost rate payload

```json
{
  "cpu_core_hour_rate": 0.02,
  "gpu_hour_rate": 0.50,
  "ram_gb_hour_rate": 0.005,
  "vram_gb_hour_rate": 0.01,
  "currency": "USD"
}
```

---

## Template Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/templates` | Scoped | List templates (admins see all; others see own). |
| `POST` | `/api/v1/templates` | Any | Save a booking template. |
| `GET` | `/api/v1/templates/{id}` | Owner / Admin | Fetch one template. |
| `PATCH` | `/api/v1/templates/{id}` | Owner / Admin | Update a template. |
| `DELETE` | `/api/v1/templates/{id}` | Owner / Admin | Delete a template. |

Template fields mirror `BookingCreate` but with `duration_hours` (integer) instead
of `start_time`/`end_time`, plus an optional `name` (max 100 chars).

---

## System Health Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/health` | Any | List health status for all systems (or `?system_id=`). |
| `POST` | `/api/v1/health/run-checks` | Any | Trigger health checks immediately. |

The reconciler runs health checks automatically on every tick. Results are also
stored in `last_health_check_at` and `last_health_status` on each compute system.
