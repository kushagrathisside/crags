# CRAGS

**Compute Resource Allocation and Governance System**

CRAGS is a full-stack platform for managing, scheduling, and auditing institutional compute resources (GPUs, CPUs, and shared computational infrastructure). It enables research groups to reserve resources fairly while maintaining transparency and institutional oversight.

## Features

- **Resource Scheduling**: Book GPU/CPU clusters with conflict prevention
- **Fair Allocation**: Enforce group quotas and usage limits
- **Prioritization**: Support foreground and background workload prioritization
- **Governance**: Comprehensive audit logging of all resource decisions
- **User Interface**: Modern web UI for system management and booking
- **Explainable Decisions**: Clear feedback on scheduling conflicts

## Quick Start

### Prerequisites

- Docker and Docker Compose (recommended)
- OR: Python 3.10+, Node.js 18+, PostgreSQL

### Docker (Recommended)

```bash
# Clone and setup environment
git clone https://github.com/kushagrathisside/crags
cd crags
cp .env.example .env

# Edit .env: set JWT_SECRET_KEY and SUPERADMIN_PASSWORD

# Run the full stack
docker compose up --build
```

Access the application at:
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000`
- **API Docs**: `http://localhost:8000/docs`

### Local Development

For detailed local development setup without Docker, see [Local Development](./docs/local-development.md).

## Documentation

| Guide | Purpose |
|-------|---------|
| [Local Development](./docs/local-development.md) | Setup, prerequisites, environment configuration |
| [Architecture](./docs/architecture.md) | System design, backend modules, frontend structure, data model |
| [API Reference](./docs/api-reference.md) | REST endpoints, authentication, request/response formats |
| [Operations](./docs/operations.md) | Docker Compose runbook, health checks, troubleshooting |
| [User Manual](./docs/UserManual.md) | End-user guide for using CRAGS |

## Repository Structure

```
crags/
├── backend/             FastAPI service, SQLAlchemy ORM, Alembic migrations
├── frontend/            React + TypeScript, Vite, UI components and hooks
├── docs/                Project documentation
├── docker-compose.yml   Local orchestration (PostgreSQL, backend, frontend)
├── run.sh               Convenient Docker Compose wrapper
└── README.md            This file
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React, TypeScript, Vite, React Query, MUI |
| **Backend** | FastAPI, Python 3.10+, SQLAlchemy ORM |
| **Database** | PostgreSQL 15 with Alembic migrations |
| **Deployment** | Docker Compose with Nginx reverse proxy |

## Backend Modules

| Module | Responsibility |
|--------|----------------|
| **IAM** | Authentication, users, groups, roles, quotas |
| **Resources** | Compute system registration and inventory |
| **Scheduling** | Booking lifecycle, availability, conflict detection |
| **Audit** | Audit logging and usage tracking |

## Backend Module Documentation

Detailed backend architecture is available in [backend/README_backend.md](./backend/README_backend.md).  
Detailed frontend architecture is available in [frontend/README_frontend.md](./frontend/README_frontend.md).

## Development Workflow

```bash
# Terminal 1: Start the full stack
docker compose up --build

# The application automatically includes PostgreSQL, migrations, backend, and frontend
```

For backend-only or frontend-only development:
- **Backend only**: See [Local Development - Backend](./docs/local-development.md#backend-only)
- **Frontend only**: See [Local Development - Frontend](./docs/local-development.md#frontend-only)

## Common Commands

```bash
# Start full stack in foreground
./run.sh up

# Start detached
./run.sh upd

# View logs
./run.sh logs

# Stop services
./run.sh down

# Reset database
./run.sh reset
```

Or use Docker Compose directly:

```bash
docker compose up --build
docker compose down
docker compose ps
```

## Default Credentials

The system creates a superadmin on startup when `SUPERADMIN_PASSWORD` is set in `.env`:

- **Username**: `superadmin`
- **Email**: `superadmin@crags.local`
- **Password**: Value from `SUPERADMIN_PASSWORD` in `.env`

## License

See [LICENSE](./LICENSE)

The system uses database constraints and scheduling logic to guarantee consistency.

---

# 8. Governance and Auditing

CRAGS provides auditing capabilities for institutional oversight.

The system tracks:

* compute usage
* resource allocation patterns
* booking history
* scheduling conflicts

These records can be used to generate governance reports.

---

# 9. Future Improvements

Planned features include:

* advanced scheduling heuristics
* fairness metrics
* usage dashboards
* cluster integration
* automated reporting
* improved visualization interfaces

---

# 10. Contribution Guidelines

When contributing:

* maintain modular architecture
* document new APIs
* ensure migrations accompany schema changes
* keep frontend API access centralized

---

# 11. License

This project is distributed under the license specified in the repository.

---

# 12. Maintainers

CRAGS Development Team
=======
Docker-first local setup for CRAGS with production-like structure:
- isolated services
- reproducible backend dependencies via `uv.lock`
- migration job before API startup
- health checks and service dependency ordering

## Services

`docker-compose.yml` runs:
- `postgres` (database, persistent volume)
- `migrate` (one-shot Alembic upgrade)
- `backend` (FastAPI)
- `frontend` (Nginx serving built React app + `/api` reverse proxy)

## Quick Start

1. Create local env file:

```bash
cp .env.example .env
```

2. Start everything:

```bash
docker-compose up --build
```

Default URLs:
- Frontend: `http://localhost:5173`
- Backend docs: `http://localhost:8000/docs`

## Common Docker Compose Commands

```bash
docker-compose up --build                         # build + run in foreground
docker-compose up --build -d                      # build + run detached
docker-compose logs -f                            # tail logs
docker-compose ps                                 # service status
docker-compose down --remove-orphans              # stop and remove containers
docker-compose down --remove-orphans --volumes    # stop + remove DB volume
```

If your machine has Compose v2, replace `docker-compose` with `docker compose`.

## Environment

Edit `.env` for local overrides (JWT secret, ports, superadmin bootstrap, etc.).

Important:
- `DATABASE_URL` should target the docker service host `postgres` (not `localhost`) in this stack.
- Change `SUPERADMIN_PASSWORD` from the default before regular use.

## Dependency Management (Backend / UV)

Backend image uses `backend/uv.lock` for reproducible installs.

When backend dependencies change:

```bash
cd backend
uv lock
cd ..
docker-compose build --no-cache backend
docker-compose up --build
```

## Notes

- For local non-Docker frontend dev (`npm run dev`), Vite proxy forwards `/api` to `http://localhost:8000`.
- Alembic now reads `DATABASE_URL` from environment, so migrations work consistently in containers and local shells.

## Detailed Guide

For complete local run instructions, see [`RUNNING.md`](./RUNNING.md).

