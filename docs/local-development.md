# Local Development

The project is Docker-first. Use Docker Compose for the normal full-stack local
environment, because that path includes PostgreSQL, migrations, backend startup,
frontend serving, proxying, and health checks.

## Prerequisites

- Docker Desktop or Docker Engine
- Docker Compose v2 via `docker compose`, or the legacy `docker-compose` binary
- At least 4 GB of memory available to Docker
- Optional for backend-only work: `uv`
- Optional for frontend-only work: Node.js and npm

On WSL, enable Docker Desktop integration for the distro that contains this
repository.

## One-Time Setup

From the repository root:

```bash
cp .env.example .env
```

Edit `.env` before regular use:

- Set `JWT_SECRET_KEY` to a unique local value.
- Set `SUPERADMIN_PASSWORD` to a secure value.
- Keep `DATABASE_URL` pointed at the Compose service host `postgres` when using
  Docker Compose.

The default host ports are:

| Variable | Default | Service |
| --- | --- | --- |
| `POSTGRES_PORT` | `5432` | PostgreSQL |
| `BACKEND_PORT` | `8000` | FastAPI |
| `FRONTEND_PORT` | `5173` | React app served by Nginx |

## Run The Full Stack

From the repository root:

```bash
docker-compose up --build
```

Detached mode:

```bash
docker-compose up --build -d
```

Access the app at `http://localhost:5173`. The backend OpenAPI UI is available
at `http://localhost:8000/docs`.

## Login

On backend startup, CRAGS bootstraps a super admin user if
`SUPERADMIN_PASSWORD` is non-empty.

Use the values from `.env`:

- Username: `SUPERADMIN_USERNAME`
- Password: `SUPERADMIN_PASSWORD`

The bootstrap also creates or reuses `SUPERADMIN_GROUP_NAME`.

## Docker Compose Actions

```bash
docker-compose up --build                         # Build and start in foreground
docker-compose up --build -d                      # Build and start detached
docker-compose logs -f                            # Follow service logs
docker-compose ps                                 # Show service status
docker-compose down --remove-orphans              # Stop and remove containers
docker-compose down --remove-orphans --volumes    # Stop stack and remove database volume
```

`reset` deletes the PostgreSQL Docker volume for this project.

## Backend-Only Development

Use this path when you already have PostgreSQL available locally and want a
reloading FastAPI process outside Docker:

```bash
cd backend
uv sync
export DATABASE_URL=postgresql+psycopg://crags:crags@localhost:5432/crags
export PYTHONPATH=src
uv run alembic upgrade head
uv run uvicorn crags.main:app --reload --app-dir src --host 0.0.0.0 --port 8000
```

The backend reads settings from environment variables and from `.env` according
to `pydantic-settings`.

## Frontend-Only Development

Start the backend first, then run Vite:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server listens on `0.0.0.0:5173` and proxies `/api` requests to
`http://localhost:8000`.

The frontend API client defaults to `/api/v1`. Override with
`VITE_API_BASE_URL` when needed.

## Migrations

Docker Compose runs migrations automatically through the `migrate` service.

For local backend-only work:

```bash
cd backend
uv run alembic upgrade head
```

Create a new migration after model changes:

```bash
cd backend
uv run alembic revision --autogenerate -m "describe change"
```

Review generated migrations before applying them, especially PostgreSQL enum,
range, and index changes.

## Useful Checks

Backend:

```bash
cd backend
uv run pytest
uv run ruff check .
uv run black --check .
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

There is no single repo-level test command at the moment.
