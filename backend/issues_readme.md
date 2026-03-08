# CRAGS Backend Setup Troubleshooting README

*(Docker + PostgreSQL + FastAPI + SQLAlchemy Environment Setup)*

This document lists **common issues encountered during early infrastructure setup** of backend systems using Dockerized PostgreSQL and Python services.
Each issue includes **symptoms and exact commands to fix it**.

---

# 1. Possible Error: `ModuleNotFoundError: No module named 'crags'`

Occurs when Python cannot locate the project package.

### Solution Commands

Run Python modules with the `src` directory added to the module path.

```bash
cd backend
PYTHONPATH=src python -m crags.db.test_connection
```

Run FastAPI correctly:

```bash
cd backend
uvicorn crags.main:app --reload --app-dir src
```

---

# 2. Possible Error: Running Python script inside `src/crags` folder

Running scripts from inside the package breaks module resolution.

### Solution Commands

Always run commands from the backend root.

```bash
cd ~/crags/backend
PYTHONPATH=src python -m crags.db.test_connection
```

---

# 3. Possible Error: `password authentication failed for user`

Occurs when PostgreSQL credentials stored in the database differ from Docker environment variables.

### Solution Commands

Reset database volume.

```bash
docker compose down -v
docker compose up -d
```

---

# 4. Possible Error: Docker container does not exist

Example:

```
Error: No such container: crags_postgres
```

### Solution Commands

Check containers.

```bash
docker ps
```

Start services.

```bash
docker compose up -d
```

---

# 5. Possible Error: Port 5432 already in use

Occurs when another PostgreSQL instance is running.

### Solution Commands

Check port usage.

```bash
sudo lsof -i :5432
```

Stop local PostgreSQL if necessary.

```bash
sudo service postgresql stop
```

Or change Docker port mapping.

---

# 6. Possible Error: Docker Compose warning about `version`

```
the attribute 'version' is obsolete
```

### Solution

Remove the version line from docker-compose.yml.

Incorrect:

```yaml
version: "3.9"
```

Correct:

```yaml
services:
```

---

# 7. Possible Error: Cannot connect to PostgreSQL container

### Solution Commands

Check container status.

```bash
docker ps
```

View logs.

```bash
docker logs crags_postgres
```

Restart container.

```bash
docker restart crags_postgres
```

---

# 8. Possible Error: Database does not exist

Example:

```
FATAL: database "crags" does not exist
```

### Solution Commands

Enter container.

```bash
docker exec -it crags_postgres psql -U crags
```

Create database.

```sql
CREATE DATABASE crags OWNER crags;
```

---

# 9. Possible Error: Role does not exist

Example:

```
FATAL: role "postgres" does not exist
```

Occurs because `POSTGRES_USER` replaced the default user.

### Solution Commands

Login using correct role.

```bash
docker exec -it crags_postgres psql -U crags
```

List roles.

```sql
\du
```

---

# 10. Possible Error: Environment variables not loading

Occurs when `.env` file is missing or incorrect.

### Solution Commands

Verify `.env` file.

```bash
cat backend/.env
```

Example content:

```
DATABASE_URL=postgresql+psycopg://crags:crags@localhost:5432/crags
JWT_SECRET_KEY=dev-secret
```

---

# Essential Commands Reference

---

# 1. Database Initialization

Reset database completely.

```bash
docker compose down -v
docker compose up -d
```

---

# 2. Creating Docker Container

Start services defined in docker-compose.

```bash
docker compose up -d
```

Stop services.

```bash
docker compose down
```

---

# 3. Running Backend Server

Start FastAPI server.

```bash
cd backend
uvicorn crags.main:app --reload --app-dir src
```

---

# 4. Checking Docker Containers

```bash
docker ps
```

Inspect container.

```bash
docker inspect crags_postgres
```

View logs.

```bash
docker logs crags_postgres
```

---

# 5. Checking Database Credentials

Enter database shell.

```bash
docker exec -it crags_postgres psql -U crags -d crags
```

List users.

```sql
\du
```

List databases.

```sql
\l
```

---

# 6. Testing Database from Host

```bash
psql -h localhost -U crags -d crags
```

---

# 7. Testing Database from Python

```bash
cd backend
PYTHONPATH=src python -m crags.db.test_connection
```

---

# 8. Restarting Docker Services

```bash
docker restart crags_postgres
```

Restart all services.

```bash
docker compose restart
```

---

# 9. Removing All Containers and Volumes

Clean reset.

```bash
docker compose down -v
docker system prune
```

---

# 10. Checking Port Usage

```bash
sudo lsof -i :5432
```

---

# Recommended Startup Workflow

```bash
# start containers
docker compose up -d

# run backend
cd backend
uvicorn crags.main:app --reload --app-dir src

# test database
PYTHONPATH=src python -m crags.db.test_connection
```

---

# System Architecture Stack

```
FastAPI API
   ↓
SQLAlchemy ORM
   ↓
psycopg Driver
   ↓
PostgreSQL (Docker)
```

This completes the **infrastructure bootstrap phase** of the CRAGS backend.

