# Running CRAGS Locally

This guide runs CRAGS directly with Docker Compose commands. `run.sh` is not
required.

## What Gets Started

`docker-compose.yml` starts:

- `postgres`: PostgreSQL database with persistent volume
- `migrate`: one-shot Alembic migration job (`alembic upgrade head`)
- `backend`: FastAPI API service
- `frontend`: React app served by Nginx, with `/api` proxied to backend

## Prerequisites

- Docker Desktop or Docker Engine
- Docker Compose
- At least 4 GB RAM available for Docker

This machine currently has legacy Compose available as `docker-compose`. If your
machine has Compose v2, replace `docker-compose` in the commands below with
`docker compose`.

Check your Compose command:

```bash
docker-compose version
docker compose version
```

Use whichever one works.

## One-Time Project Setup

From the repository root:

```bash
cp .env.example .env
```

Open `.env` and set at least:

- `JWT_SECRET_KEY` to a unique local value
- `SUPERADMIN_PASSWORD` to a secure password

Keep this Docker Compose database URL when running the full stack:

```text
DATABASE_URL=postgresql+psycopg://crags:crags@postgres:5432/crags
```

Default ports:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`
- Health endpoint: `http://localhost:8000/healthz`

## Proxy Setup For This Network

There are two separate proxy paths:

- Docker daemon proxy: needed for pulling base images from Docker Hub.
- Docker build proxy: needed inside image builds for `pip install`, `uv sync`,
  and `npm ci`.

Do not commit proxy passwords to tracked files. Use shell exports, or keep them
only in local `.env`, which is ignored by git.

### 1. Docker Daemon Proxy For Image Pulls

Use this when image pulls fail with errors like `TLS handshake timeout` while
pulling `postgres`, `python`, `node`, or `nginx`.

```bash
read -rsp "Proxy password: " PROXY_PASS
echo
PROXY_URL="http://{username}:${PROXY_PASS}@172.31.2.4:8080"

sudo mkdir -p /etc/systemd/system/docker.service.d
sudo sh -c "cat > /etc/systemd/system/docker.service.d/http-proxy.conf" <<EOF
[Service]
Environment="HTTP_PROXY=${PROXY_URL}"
Environment="HTTPS_PROXY=${PROXY_URL}"
Environment="NO_PROXY=localhost,127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
docker pull postgres:15.8-alpine
```

Check whether Docker has proxy values:

```bash
systemctl show docker --property=Environment
docker info | grep -i proxy
```

Remove the daemon proxy later:

```bash
sudo rm -f /etc/systemd/system/docker.service.d/http-proxy.conf
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 2. Docker Build Proxy For PyPI And npm

Use this when the build reaches `RUN pip install`, `RUN uv sync`, or
`RUN npm ci` and then times out.

Run these exports in the same shell where you run `docker-compose`:

```bash
read -rsp "Proxy password: " PROXY_PASS
echo
export HTTP_PROXY="http://{username}:${PROXY_PASS}@172.31.2.4:8080"
export HTTPS_PROXY="${HTTP_PROXY}"
export NO_PROXY="localhost,127.0.0.1,::1,postgres,backend,frontend"
export http_proxy="${HTTP_PROXY}"
export https_proxy="${HTTPS_PROXY}"
export no_proxy="${NO_PROXY}"
```

`docker-compose.yml` passes these values into backend and frontend image builds
as build arguments.

To keep the proxy for future shells, add the same variables to your local `.env`
file. Do not add them to `.env.example`.

## Start The Full Project

Foreground mode:

```bash
docker-compose up --build
```

Detached mode:

```bash
docker-compose up --build -d
```

If you use Compose v2:

```bash
docker compose up --build
docker compose up --build -d
```

## Login

At backend startup, CRAGS bootstraps a super admin user from `.env`:

- Username: value of `SUPERADMIN_USERNAME` in `.env` (default: `superadmin`)
- Password: value of `SUPERADMIN_PASSWORD` in `.env` (default: `change-me`)

Use these credentials on the login screen.

## Day-To-Day Operations

Show service status:

```bash
docker-compose ps
```

Tail logs:

```bash
docker-compose logs -f
```

Tail one service:

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f migrate
docker-compose logs -f postgres
```

Stop stack:

```bash
docker-compose down --remove-orphans
```

Stop and wipe database volume:

```bash
docker-compose down --remove-orphans --volumes
```

Rebuild images without starting:

```bash
docker-compose build
```

Rebuild one image:

```bash
docker-compose build backend
docker-compose build frontend
```

Force a clean rebuild after proxy or dependency trouble:

```bash
docker-compose build --no-cache backend
docker-compose build --no-cache frontend
docker-compose up --build
```

## After Code Changes

If backend or frontend code changed:

```bash
docker-compose up --build
```

If only runtime `.env` values changed:

```bash
docker-compose down --remove-orphans
docker-compose up --build
```

## Dependency Updates

Backend lockfile:

```bash
cd backend
uv lock
cd ..
docker-compose build --no-cache backend
docker-compose up --build
```

Frontend lockfile:

```bash
cd frontend
npm install
cd ..
docker-compose build --no-cache frontend
docker-compose up --build
```

## Troubleshooting

### Docker command not found

Install Docker Desktop or Docker Engine and ensure `docker` is in your shell
`PATH`.

### Compose command not found

Install Docker Compose v2 or legacy `docker-compose`.

On this machine, `docker compose` is not available but `docker-compose` is
available, so use:

```bash
docker-compose up --build
```

### Docker Hub pull times out

Configure the Docker daemon proxy from "Docker Daemon Proxy For Image Pulls",
then retry:

```bash
docker pull postgres:15.8-alpine
docker-compose up --build
```

### PyPI or npm install times out during image build

Export the build proxy variables from "Docker Build Proxy For PyPI And npm",
then rebuild:

```bash
docker-compose build --no-cache backend
docker-compose build --no-cache frontend
docker-compose up --build
```

For the specific backend failure:

```text
RUN pip install --no-cache-dir uv==0.8.4
ReadTimeoutError("HTTPSConnectionPool(host='pypi.org', port=443) ...")
```

the build proxy exports are the required part.

### WSL says Docker is not found

Enable Docker Desktop WSL integration for your current distro, or install and
start Docker Engine inside WSL.

### Port already in use

Change ports in `.env`:

- `POSTGRES_PORT`
- `BACKEND_PORT`
- `FRONTEND_PORT`

Then restart:

```bash
docker-compose down --remove-orphans
docker-compose up --build
```

### Login fails for super admin

Confirm `SUPERADMIN_PASSWORD` in `.env` is set and restart:

```bash
docker-compose down --remove-orphans
docker-compose up --build
```

If the existing database already has old credentials and you want a clean local
bootstrap:

```bash
docker-compose down --remove-orphans --volumes
docker-compose up --build
```

## Optional: Run Backend Without Docker

Use this only when PostgreSQL is already running locally on the host:

```bash
cd backend
uv sync
export DATABASE_URL=postgresql+psycopg://crags:crags@localhost:5432/crags
export PYTHONPATH=src
uv run alembic upgrade head
uv run uvicorn crags.main:app --reload --app-dir src --host 0.0.0.0 --port 8000
```
