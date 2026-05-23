# CRAGS Documentation

CRAGS is the Compute Resource Allocation and Governance System. It provides a
Docker-first full stack app for registering compute systems, requesting resource
bookings, enforcing group policy, and auditing scheduling decisions.

## Start Here

- **New User?** Start with [User Manual](./UserManual.md): how to log in, request bookings, manage your team, and understand resource allocation.
- [Local Development](./local-development.md): run the stack, configure `.env`, and use backend/frontend development commands.
- [Architecture](./architecture.md): service layout, backend modules, frontend structure, auth, data model, and scheduling behavior.
- [API Reference](./api-reference.md): current REST endpoints, request payloads, response shapes, and permission notes.
- [Operations](./operations.md): Docker Compose actions, health checks, migrations, environment variables, and troubleshooting.

## Quick Links

When running with the default Docker workflow:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/healthz`

## Documentation Structure

| Document | Audience | Purpose |
|----------|----------|---------|
| [UserManual.md](./UserManual.md) | End users | How to use CRAGS: login, bookings, team management, audit trail |
| [local-development.md](./local-development.md) | Developers | Set up development environment, run the stack locally |
| [Architecture](./architecture.md) | Developers | System design, service topology, module responsibilities |
| [API Reference](./api-reference.md) | Backend developers | REST endpoints, authentication, request/response formats |
| [Operations](./operations.md) | DevOps / Admins | Docker Compose runbook, health checks, troubleshooting |

## Repository Layout

```text
.
|-- backend/              FastAPI service, SQLAlchemy models, Alembic migrations
|-- frontend/             React, TypeScript, Vite, MUI, React Query
|-- docs/                 Project documentation
|-- docker-compose.yml    Local full-stack orchestration
|-- README.md             Project quick start
`-- RUNNING.md            Detailed local running guide
```

## Project Defaults

The local stack starts PostgreSQL, runs migrations, then starts the FastAPI
backend and the Nginx-served React frontend. The backend seeds a super admin on
startup when `SUPERADMIN_PASSWORD` is set in `.env`.
