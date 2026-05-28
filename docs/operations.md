# Operations

This guide covers the project-standard local operations flow. For most day to
day work, use Docker Compose directly from the repository root.

## Runbook

Start in foreground:

```bash
docker-compose up --build
```

Start detached:

```bash
docker-compose up --build -d
```

Show service status:

```bash
docker-compose ps
```

Tail logs:

```bash
docker-compose logs -f
```

Stop services:

```bash
docker-compose down --remove-orphans
```

Reset containers and database volume:

```bash
docker-compose down --remove-orphans --volumes
```

After the volume reset, run `docker-compose up --build` to recreate the
database, rerun migrations, and seed the super admin.

## Health Checks

Backend health:

```bash
curl http://localhost:8000/healthz
```

Expected response:

```json
{
  "status": "ok"
}
```

The Compose backend health check also calls this endpoint before dependent
services continue.

## Environment Variables

Local defaults are defined in `.env.example`.

| Variable | Purpose | Default |
| --- | --- | --- |
| `POSTGRES_PORT` | Host port mapped to PostgreSQL. | `5432` |
| `BACKEND_PORT` | Host port mapped to FastAPI. | `8000` |
| `FRONTEND_PORT` | Host port mapped to Nginx frontend. | `5173` |
| `POSTGRES_DB` | Database name. | `crags` |
| `POSTGRES_USER` | Database user. | `crags` |
| `POSTGRES_PASSWORD` | Database password. | `crags` |
| `DATABASE_URL` | SQLAlchemy database URL. | Compose URL using host `postgres` |
| `JWT_SECRET_KEY` | Secret used to sign JWTs. | `change-me-local-dev-secret` |
| `JWT_ALGORITHM` | JWT signing algorithm. | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Auth session lifetime. | `60` |
| `FRONTEND_ORIGINS` | Comma-separated CORS origins. | `http://localhost:5173` |
| `AUTH_COOKIE_NAME` | Session cookie name. | `crags_session` |
| `AUTH_COOKIE_SECURE` | Restrict cookie to HTTPS. | `false` |
| `AUTH_COOKIE_SAMESITE` | Cookie SameSite policy. | `lax` |
| `AUTH_COOKIE_DOMAIN` | Optional cookie domain. | unset |
| `SUPERADMIN_USERNAME` | Bootstrapped admin username. | `superadmin` |
| `SUPERADMIN_EMAIL` | Bootstrapped admin email. | `superadmin@crags.local` |
| `SUPERADMIN_PASSWORD` | Bootstrapped admin password. | `change-me` |
| `SUPERADMIN_GROUP_NAME` | Bootstrapped admin group. | `platform-admins` |
| `REDIS_URL` | Optional Redis connection string. Enables distributed login rate limiting and the response cache. When unset, both fall back to an in-process implementation (single-replica only). Example: `redis://redis:6379/0` | unset |
| `RECONCILE_INTERVAL_MINUTES` | How often the background reconciler runs (booking expiry, waitlist promotion, health checks). | `5` |
| `AUDIT_RETAIN_DAYS` | Audit log rows older than this are pruned by the reconciler. | `90` |

For non-local deployments, use a strong `JWT_SECRET_KEY`, set
`AUTH_COOKIE_SECURE=true` behind HTTPS, and configure `FRONTEND_ORIGINS` to the
actual frontend origin.

## Redis (Rate Limiting and Cache)

Redis is **optional**. Without it the application runs correctly using in-process
fallbacks, but those fallbacks are single-replica only and reset on restart.

Add Redis to `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
```

Then set in `.env`:

```
REDIS_URL=redis://redis:6379/0
```

With Redis configured:

| Feature | Behaviour |
|---------|-----------|
| Login rate limiter | Counters survive restarts; works across multiple API replicas. |
| Response cache | `GET /systems/`, `GET /policies`, `GET /billing/costs` served from Redis for their TTL (60 s / 300 s / 300 s). Invalidated automatically on writes. |

Without Redis, both features fall back to in-memory and log a notice at startup:

```
Cache: in-memory (set REDIS_URL for distributed mode)
Rate limiter: in-memory (set REDIS_URL for distributed mode)
```

## Migrations

Migrations are stored in `backend/migrations/versions`.

The Compose workflow runs:

```bash
alembic upgrade head
```

inside the `migrate` service before the API starts.

For manual migration work:

```bash
cd backend
uv run alembic upgrade head
uv run alembic current
uv run alembic history
```

When adding model changes, generate a migration, inspect it, then apply it:

```bash
cd backend
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head
```

## Super Admin Bootstrap

On backend startup, `ensure_super_admin` runs once through the FastAPI startup
hook.

If `SUPERADMIN_PASSWORD` is blank, no bootstrap user is created. If it is set,
the backend creates or updates the configured super admin and ensures that user
belongs to `SUPERADMIN_GROUP_NAME`.

Changing the password for an existing bootstrapped user is not automatic unless
the user has no stored password hash. Use the IAM APIs or admin UI to rotate an
existing user's password.

## Troubleshooting

### Docker command not found

Install Docker Desktop or Docker Engine and ensure `docker` is on your shell
`PATH`.

### Compose plugin not available

Install Docker Compose v2, or install the legacy `docker-compose` binary.

### Port already in use

Change the relevant host port in `.env`:

- `POSTGRES_PORT`
- `BACKEND_PORT`
- `FRONTEND_PORT`

Then restart:

```bash
docker-compose down --remove-orphans
docker-compose up --build
```

### Login fails for the super admin

Confirm that `.env` contains a non-empty `SUPERADMIN_PASSWORD`. Then restart the
backend:

```bash
docker-compose down --remove-orphans
docker-compose up --build
```

If the database already contains the user and you need a clean bootstrap, use:

```bash
docker-compose down --remove-orphans --volumes
docker-compose up --build
```

### Migrations fail at startup

Inspect migration logs:

```bash
docker-compose logs -f
```

Common causes are an invalid `DATABASE_URL`, stale local volumes, or a migration
that needs manual review before it can run against existing data.

### Frontend cannot reach API

In Docker, Nginx proxies `/api/` to the `backend` Compose service. In Vite
development, `frontend/vite.config.ts` proxies `/api` to `http://localhost:8000`.

Check that the backend is healthy and that the frontend is using the expected
API base URL.
