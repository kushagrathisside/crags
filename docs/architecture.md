# Architecture

CRAGS is a full stack scheduling and governance application built around a
FastAPI API, PostgreSQL, Alembic migrations, and a React frontend.

## Service Topology

`docker-compose.yml` defines four services:

| Service | Purpose |
| --- | --- |
| `postgres` | PostgreSQL 15 database with a persistent Docker volume. |
| `migrate` | One-shot Alembic job that runs `alembic upgrade head`. |
| `backend` | FastAPI API process listening on port `8000` in the container. |
| `frontend` | Nginx serving the built React app and proxying `/api` to backend. |

Startup ordering is health-gated: PostgreSQL must be healthy before migrations,
and migrations must complete before the API is considered ready for the
frontend.

## Backend Layout

The backend source lives under `backend/src/crags`.

| Path | Responsibility |
| --- | --- |
| `main.py` | FastAPI app setup, CORS, `/healthz`, super admin bootstrap, router include. |
| `api/router.py` | Composes IAM, systems, bookings, and audit routers. |
| `core/config.py` | Environment-backed settings. |
| `core/security.py` | Password hashing and JWT token helpers. |
| `db/` | SQLAlchemy base, session factory, and connection helpers. |
| `modules/iam/` | Users, groups, roles, login, quotas, and identity dependencies. |
| `modules/resources/` | Compute system registration and inventory. |
| `modules/scheduling/` | Booking lifecycle, availability, conflict checks, quotas, and preemption. |
| `modules/audit/` | Audit log model and listing endpoint. |

## Frontend Layout

The frontend source lives under `frontend/src`.

| Path | Responsibility |
| --- | --- |
| `App.tsx` | Main authenticated application shell and tab composition. |
| `api/` | Axios client and typed CRAGS API calls. |
| `hooks/` | React Query hooks for auth, systems, bookings, audit, and mutations. |
| `components/forms/` | Booking and system registration forms. |
| `components/panels/` | Mission control, audit, lifecycle, inventory, and team management panels. |
| `components/charts/` | Resource constraint chart and temporal booking view. |
| `types/` | Shared frontend TypeScript types. |
| `utils/` | Local booking simulation helpers. |

The frontend uses `VITE_API_BASE_URL` when provided. Otherwise it defaults to
`/api/v1`. In local Vite development, `/api` is proxied to
`http://localhost:8000`; in Docker, Nginx proxies `/api/` to the backend service.

## Data Model

The main database tables are:

| Table | Purpose |
| --- | --- |
| `compute_systems` | Named compute systems with CPU, RAM, GPU, VRAM, type, and status. |
| `groups` | Research or platform groups plus concurrent and monthly quotas. |
| `users` | Local users with role, group membership, password hash, and activity state. |
| `bookings` | Resource requests over a PostgreSQL `TSRANGE` booking period. |
| `audit_logs` | Booking lifecycle and governance events. |

Bookings use a GiST index on `booking_period` for efficient overlap checks.

## Auth And Roles

Authentication is local username/email plus password. Successful login writes an
HTTP-only auth cookie named by `AUTH_COOKIE_NAME`. API clients may also send a
Bearer token because the backend accepts either cookie or bearer credentials.

Public API role names are:

- `MEMBER`
- `GROUP_LEAD`
- `RESOURCE_ADMIN`
- `SUPER_ADMIN`

Internally, the backend SQLAlchemy enum stores resource admins as `ADMIN`; API
serialization maps that internal value to `RESOURCE_ADMIN`.

Access control is enforced with FastAPI dependencies:

| Capability | Allowed roles |
| --- | --- |
| Create systems | `RESOURCE_ADMIN`, `SUPER_ADMIN` |
| List systems | Any authenticated user |
| Manage groups and users | `RESOURCE_ADMIN`, `SUPER_ADMIN` |
| Assign or modify admin roles | `SUPER_ADMIN` |
| View audit events | `RESOURCE_ADMIN`, `SUPER_ADMIN` |
| View group members and usage | Own `GROUP_LEAD`, `RESOURCE_ADMIN`, `SUPER_ADMIN` |
| View bookings | Scoped to self, group, or all depending on role |

## Scheduling Behavior

The scheduler normalizes booking windows to UTC and stores them as PostgreSQL
timestamp ranges. Active capacity checks count bookings in `REQUESTED` and
`CONFIRMED` states.

Booking creation applies checks in this order:

1. Validate the time window and target compute system.
2. Enforce group concurrent quotas when the requester belongs to a group.
3. Enforce monthly group quotas when any monthly quota is configured.
4. Check system CPU, GPU, RAM, and VRAM capacity against overlapping active
   bookings.
5. For `FOREGROUND` GPU requests, attempt to preempt overlapping confirmed
   `BACKGROUND` bookings when GPU capacity is short.
6. Persist the new booking as `CONFIRMED` and record an audit event.

Capacity or quota failures return structured `409` conflict responses with a
machine-readable reason, resource, shortage, conflicting booking IDs when known,
and recommended fixes.

## Booking Lifecycle

Current booking statuses are:

- `REQUESTED`
- `CONFIRMED`
- `PREEMPTED`
- `CANCELLED`
- `COMPLETED`
- `EXPIRED`

New accepted bookings are stored as `CONFIRMED`. Owners and admins can cancel
`REQUESTED` or `CONFIRMED` bookings. GPU preemption marks selected background
bookings as `PREEMPTED` and records audit events.

