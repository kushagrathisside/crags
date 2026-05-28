# CRAGS Documentation

CRAGS is the Compute Resource Allocation and Governance System. It provides a
Docker-first full-stack application for registering compute systems, requesting
resource bookings, enforcing group policy, and auditing scheduling decisions.

## Start Here

- **New User?** → [User Manual](./UserManual.md): login, bookings, waitlist, analytics, and admin tasks.
- [Local Development](./local-development.md): run the stack, configure `.env`, and use backend/frontend dev commands.
- [Architecture](./architecture.md): service layout, backend modules, frontend structure, auth, data model, and scheduling.
- [API Reference](./api-reference.md): all REST endpoints, request payloads, response shapes, and permission notes.
- [Auth Service](./auth-service.md): token model, refresh flow, RBAC matrix, rate limiting, and password reset.
- [Resources Service](./resources-service.md): compute system registry, CRUD, status enforcement, capacity guard, health monitoring, and maintenance windows.
- [Notifications Service](./notifications-service.md): SMTP email delivery, templates, trigger points, and dev mode.
- [Scheduler](./scheduler.md): booking lifecycle, reconcile algorithm, approval workflow, waitlist promotion, SKIP LOCKED concurrency, and scaling notes.
- [Operations](./operations.md): Docker Compose actions, health checks, migrations, environment variables, and troubleshooting.

## Quick Links

| Service | URL |
|---------|-----|
| Frontend | `http://localhost:5173` |
| Backend API | `http://localhost:8000` |
| OpenAPI docs | `http://localhost:8000/docs` |
| Health check | `http://localhost:8000/healthz` |

## Documentation Structure

| Document | Audience | Purpose |
|----------|----------|---------|
| [UserManual.md](./UserManual.md) | End users | Login, bookings, waitlist, analytics, admin queue |
| [local-development.md](./local-development.md) | Developers | Dev environment, stack commands |
| [architecture.md](./architecture.md) | Developers | System design, module map, data model |
| [api-reference.md](./api-reference.md) | Developers | Full REST endpoint reference |
| [auth-service.md](./auth-service.md) | Developers | Token lifecycle, RBAC, rate limiting |
| [resources-service.md](./resources-service.md) | Developers / DevOps | Compute system CRUD, health monitor, maintenance windows |
| [notifications-service.md](./notifications-service.md) | Developers / DevOps | SMTP email, templates, dev mode |
| [scheduler.md](./scheduler.md) | Developers / DevOps | Booking engine, approval, waitlist, preemption |
| [operations.md](./operations.md) | DevOps / Admins | Docker Compose runbook, migrations, troubleshooting |

## Repository Layout

```text
.
├── backend/              FastAPI service, SQLAlchemy models, Alembic migrations
├── frontend/             React, TypeScript, Vite, MUI, React Query
├── docs/                 Project documentation
├── docker-compose.yml    Local full-stack orchestration
└── README.md             Project quick start
```

## New Modules (added in recent release)

| Module | Backend path | Frontend page |
|--------|-------------|---------------|
| Policy Engine | `modules/policies/` | — (server-side enforcement) |
| Booking Approval | `modules/scheduling/` — approve/reject endpoints | Monitoring → Approval Queue |
| Booking Modifications | `modules/scheduling/` — extend/resize endpoints | Scheduler → Modify Booking |
| Maintenance Windows | `modules/maintenance/` | Systems → Maintenance Windows |
| Waitlist / Queue | `modules/waitlist/` | Scheduler → Waitlist |
| Analytics & Reporting | `modules/analytics/` | Analytics page |
| Webhooks | `modules/webhooks/` | — (admin REST only) |
| Audit Export | `modules/audit/` — CSV export | Monitoring |
| Cost / Billing | `modules/billing/` | — (REST only) |
| Booking Templates | `modules/templates/` | — (REST only) |
| System Health Monitor | `modules/health/` | — (auto-runs in reconciler) |
