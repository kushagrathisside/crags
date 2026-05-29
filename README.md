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
- **Password**: Value from `SUPERADMIN_PASSWORD` in `.env` (default: `change-me`)

## Acknowledgements

CRAGS was built with assistance from two AI systems, each playing a distinct role:

- **OpenAI Codex** — responsible for the initial architecture and the bulk of the implementation: backend modules, data models, scheduling logic, migrations, and the original frontend structure. The foundation of this project is Codex's work.
- **Anthropic Claude** — contributed refinements in a later session: the authentication layer, Redis caching, frontend redesign (design system, Gantt dashboard), bug fixes, and documentation cleanup.

Both tools were used under the direction of the project author, who designed the system, defined requirements, and made all architectural decisions.

## License

See [LICENSE](./LICENSE)

