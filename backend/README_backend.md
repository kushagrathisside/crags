# CRAGS Backend

## Compute Resource Allocation and Governance System (CRAGS)

This directory contains the **backend service** for the Compute Resource Allocation and Governance System (CRAGS).

The backend provides the **core scheduling engine, resource management APIs, authentication services, and governance auditing infrastructure** required for managing institutional compute resources.

The service is built using **FastAPI** and **PostgreSQL**, following a modular architecture that separates authentication, resource management, scheduling logic, and audit processing.

---

# 1. System Overview

The backend implements the following major responsibilities:

* Management of compute systems and resources
* Scheduling and booking of compute resources
* Priority-aware foreground and background task handling
* User authentication and group management
* Governance auditing of compute resource usage
* Exposure of REST APIs for frontend interaction

The backend follows a **service-oriented modular design**, allowing independent development and evolution of system modules.

---

# 2. Technology Stack

| Component        | Technology                       |
| ---------------- | -------------------------------- |
| API Framework    | FastAPI                          |
| Language         | Python                           |
| Database         | PostgreSQL                       |
| ORM              | SQLAlchemy                       |
| Migrations       | Alembic                          |
| Authentication   | JWT-based authentication         |
| Task Scheduling  | Python cron / internal scheduler |
| Containerization | Docker (optional)                |

---

# 3. Directory Structure

```text
backend/
│
├── alembic.ini
├── pyproject.toml
├── run.sh
├── main.py
│
├── migrations/
│   ├── env.py
│   └── versions/
│
├── src/
│   └── crags/
│       │
│       ├── main.py
│       │
│       ├── api/
│       │   └── router.py
│       │
│       ├── core/
│       │   ├── config.py
│       │   └── security.py
│       │
│       ├── db/
│       │   ├── base.py
│       │   ├── session.py
│       │   └── test_connection.py
│       │
│       └── modules/
│           │
│           ├── iam/
│           │
│           ├── resources/
│           │
│           ├── scheduling/
│           │
│           └── audit/
```

---

# 4. Core Architecture

The backend is divided into **independent functional modules**.

```text
Frontend
     │
     ▼
FastAPI Router Layer
     │
     ▼
Service Layer
     │
     ▼
Database Layer (SQLAlchemy)
     │
     ▼
PostgreSQL
```

Each module provides:

* Database models
* Business logic services
* API routers
* Request/response schemas

---

# 5. Core Modules

## 5.1 IAM (Identity and Access Management)

Directory:

```
src/crags/modules/iam/
```

Responsibilities:

* User registration and authentication
* Password hashing and validation
* Token-based authentication
* Role and group membership management

Key files:

```
models.py
schemas.py
router.py
service.py
auth_service.py
dependencies.py
```

---

## 5.2 Resources Module

Directory:

```
src/crags/modules/resources/
```

Responsibilities:

* Management of compute systems
* Tracking system capacity
* Registering new compute resources
* Providing system inventory APIs

Example resource types:

* GPU compute nodes
* CPU compute servers
* shared experimental hardware

Key files:

```
models.py
schemas.py
router.py
service.py
```

---

## 5.3 Scheduling Module

Directory:

```
src/crags/modules/scheduling/
```

This module implements the **core compute scheduling engine**.

Responsibilities:

* Booking compute resources
* Preventing scheduling conflicts
* Managing foreground and background access
* Handling resource preemption
* Triggering audit events

Key files:

```
models.py
schemas.py
router.py
service.py
cron.py
```

---

## 5.4 Audit Module

Directory:

```
src/crags/modules/audit/
```

Responsibilities:

* Tracking resource usage
* Logging booking activity
* Generating governance reports
* Supporting institutional oversight

Audit data includes:

* compute consumption
* booking history
* preemption events
* weekly usage summaries

---

# 6. Database Layer

Database logic is centralized in:

```
src/crags/db/
```

Files:

### base.py

Registers all ORM models.

### session.py

Defines SQLAlchemy session management.

### test_connection.py

Used for validating database connectivity.

---

# 7. Database Migrations

The system uses **Alembic** for schema versioning.

Migration scripts are located in:

```
backend/migrations/versions/
```

Example migrations include:

* creation of compute system tables
* creation of bookings table
* creation of IAM tables
* addition of audit infrastructure
* booking period indexing for scheduling efficiency

---

# 8. Running Database Migrations

Apply all migrations:

```bash
alembic upgrade head
```

Create new migration:

```bash
alembic revision --autogenerate -m "migration message"
```

Rollback migration:

```bash
alembic downgrade -1
```

---

# 9. Booking Conflict Prevention

The scheduling system prevents conflicting bookings using database-level mechanisms.

The system uses **PostgreSQL range indexing with GiST indexes** to ensure:

* two bookings cannot overlap for the same system
* scheduling conflicts are detected efficiently

This provides strong guarantees even under concurrent booking requests.

---

# 10. Installation

## Prerequisites

Ensure the following are installed:

* Python 3.10+
* PostgreSQL
* pip
* virtual environment tools

---

## Setup Environment

Navigate to the backend directory:

```bash
cd backend
```

Create virtual environment:

```bash
python -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -e .
```

---

# 11. Running the Backend

Start the development server:

```bash
./run.sh
```

or

```bash
uvicorn src.crags.main:app --reload
```

The API will be available at:

```
http://localhost:8000
```

API documentation is available at:

```
http://localhost:8000/docs
```

---

# 12. Docker Setup (Optional)

If using Docker:

```bash
docker compose up --build
```

This starts:

* PostgreSQL database
* backend service
* optional frontend service

---

# 13. Development Workflow

Typical workflow:

1. Update database models
2. Generate migration
3. Apply migration
4. Implement service logic
5. Expose API endpoint
6. Connect frontend

---

# 14. Logging and Observability

The backend logs:

* booking operations
* authentication activity
* scheduling conflicts
* audit generation

Future improvements may include:

* centralized logging
* monitoring dashboards
* resource utilization analytics

---

# 15. Security Considerations

Security mechanisms implemented:

* hashed password storage
* token-based authentication
* dependency-based authorization
* restricted access to administrative endpoints

Future improvements may include:

* role-based access policies
* audit verification mechanisms
* system-level resource enforcement

---

# 16. Future Extensions

Planned backend improvements include:

* advanced scheduling heuristics
* compute fairness metrics
* governance dashboards
* predictive resource allocation
* integration with compute cluster managers

---

# 17. Contribution Guidelines

When contributing to the backend:

* Maintain modular architecture
* Keep business logic inside service layers
* Avoid database logic inside routers
* Ensure migrations accompany schema changes
* Document new APIs

---

# 18. License

This project is distributed under the license defined in the repository root.

---

# 19. Maintainers

CRAGS Development Team
