# API Reference

The backend serves REST endpoints from the FastAPI app. With default local
ports, the base URL is `http://localhost:8000`.

The versioned application API uses `/api/v1`. Interactive OpenAPI docs are
available at `http://localhost:8000/docs` when the backend is running.

## Authentication

Login returns a session response and sets an HTTP-only cookie. Browser clients
should send credentials with API requests. Non-browser clients may use the same
token as a Bearer token.

```http
POST /api/v1/auth/login
```

Request:

```json
{
  "identifier": "superadmin",
  "password": "change-me"
}
```

`identifier` may be replaced by `username` or `email`.

Response:

```json
{
  "token_type": "cookie",
  "user": {
    "id": 1,
    "username": "superadmin",
    "email": "superadmin@crags.local",
    "role": "SUPER_ADMIN",
    "group_id": 1,
    "group_name": "platform-admins",
    "is_active": true,
    "auth_provider": "local"
  }
}
```

```http
POST /api/v1/auth/logout
GET /api/v1/users/me
```

## System Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/healthz` | None | Backend health check. |
| `GET` | `/api/v1/systems/` | Any user | List compute systems. |
| `POST` | `/api/v1/systems/` | `RESOURCE_ADMIN`, `SUPER_ADMIN` | Register a compute system. |

Create system request:

```json
{
  "name": "gpu-cluster-a",
  "system_type": "HYBRID",
  "cpu_cores": 128,
  "ram_gb": 512,
  "gpu_units": 8,
  "vram_gb": 320
}
```

`system_type` is one of `CPU`, `GPU`, or `HYBRID`.

## Booking Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/bookings/systems/{system_id}/availability` | Any user | Check available resources in a time window. |
| `GET` | `/api/v1/bookings/` | Any user | List bookings in the caller's permission scope. |
| `GET` | `/api/v1/bookings/{booking_id}` | Any user | Fetch one booking if visible to the caller. |
| `POST` | `/api/v1/bookings/` | Any user | Create a booking request. |
| `PATCH` | `/api/v1/bookings/{booking_id}/cancel` | Owner, `RESOURCE_ADMIN`, `SUPER_ADMIN` | Cancel a request or confirmed booking. |

Availability query parameters:

| Parameter | Type | Required |
| --- | --- | --- |
| `start_time` | ISO datetime | Yes |
| `end_time` | ISO datetime | Yes |

Availability response:

```json
{
  "cpu_available": 64,
  "gpu_available": 4,
  "ram_available": 256,
  "vram_available": 160
}
```

Booking list filters:

| Parameter | Type |
| --- | --- |
| `system_id` | integer |
| `user_id` | integer |
| `status` | string |
| `academic_category` | string |
| `start_time` | ISO datetime |
| `end_time` | ISO datetime |

Create booking request:

```json
{
  "system_id": 1,
  "start_time": "2026-05-12T15:00:00Z",
  "end_time": "2026-05-12T18:00:00Z",
  "req_cpu": 8,
  "req_gpu": 1,
  "req_ram": 64,
  "req_vram": 32,
  "access_type": "BACKGROUND",
  "academic_category": "Research",
  "project_title": "Diffusion training run",
  "expected_deliverable": "Model checkpoint and evaluation report",
  "objective": "Train and validate a new baseline model."
}
```

`access_type` is `FOREGROUND` or `BACKGROUND`.

Accepted bookings are returned as `CONFIRMED`. Conflict responses use HTTP
`409` and include explainable scheduling details:

```json
{
  "detail": "GPU capacity exceeded",
  "reason": "CAPACITY_EXCEEDED",
  "resource": "GPU",
  "shortage": 1,
  "overlap_window": {
    "start_time": "2026-05-12T15:00:00",
    "end_time": "2026-05-12T18:00:00"
  },
  "conflicting_booking_ids": [12, 13],
  "recommended_fixes": [
    "Reduce requested resources",
    "Choose another time window"
  ]
}
```

Known conflict reasons include:

- `CAPACITY_EXCEEDED`
- `PREEMPTION_INSUFFICIENT`
- `GROUP_CONCURRENT_QUOTA_EXCEEDED`
- `GROUP_MONTHLY_QUOTA_EXCEEDED`
- `INVALID_TRANSITION`

## IAM Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/groups/{group_id}/members` | Group lead for own group, admins | List group members. |
| `GET` | `/api/v1/groups/{group_id}/usage` | Group lead for own group, admins | Summarize group usage for a month. |
| `GET` | `/api/v1/iam/groups` | `RESOURCE_ADMIN`, `SUPER_ADMIN` | List groups. |
| `POST` | `/api/v1/iam/groups` | `RESOURCE_ADMIN`, `SUPER_ADMIN` | Create a group. |
| `PATCH` | `/api/v1/iam/groups/{group_id}` | `RESOURCE_ADMIN`, `SUPER_ADMIN` | Update group name or quotas. |
| `GET` | `/api/v1/iam/users` | `RESOURCE_ADMIN`, `SUPER_ADMIN` | List users. |
| `POST` | `/api/v1/iam/users` | `RESOURCE_ADMIN`, `SUPER_ADMIN` | Create a user. |
| `PATCH` | `/api/v1/iam/users/{user_id}` | `RESOURCE_ADMIN`, `SUPER_ADMIN` | Update user settings. |

The `month` query parameter for usage is optional and uses `YYYY-MM` format:

```http
GET /api/v1/groups/1/usage?month=2026-05
```

Group quota payload fields:

```json
{
  "group_name": "vision-lab",
  "concurrent_cpu_quota": 64,
  "concurrent_gpu_quota": 4,
  "concurrent_ram_quota": 256,
  "concurrent_vram_quota": 160,
  "monthly_cpu_hours_quota": 10000,
  "monthly_gpu_hours_quota": 500,
  "monthly_ram_gb_hours_quota": 40000,
  "monthly_vram_gb_hours_quota": 20000
}
```

Use `null` for quota fields that should be unlimited.

User roles accepted by the API:

- `MEMBER`
- `GROUP_LEAD`
- `RESOURCE_ADMIN`
- `SUPER_ADMIN`

Only `SUPER_ADMIN` can assign admin roles, change roles, or modify admin users.

## Audit Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/audit/` | `RESOURCE_ADMIN`, `SUPER_ADMIN` | List audit events. |

Query parameters:

| Parameter | Type | Default |
| --- | --- | --- |
| `limit` | integer from 1 to 1000 | `200` |
| `table_name` | string | none |

Response entries include:

```json
{
  "id": 1,
  "table_name": "bookings",
  "record_id": 42,
  "action": "CREATED",
  "timestamp": "2026-05-12T15:10:00",
  "user_id": 1
}
```

