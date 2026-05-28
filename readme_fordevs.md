# CRAGS Developer Guide

## Compute Resource Allocation and Governance System

This document provides technical guidance for developers contributing to the CRAGS platform. It describes the architecture, coding conventions, module responsibilities, and development workflow required to extend or maintain the system.

CRAGS is designed as a modular platform for managing shared compute infrastructure in institutional environments.

---

# 1. Development Philosophy

CRAGS is designed with the following engineering principles:

### Modular Architecture

Each functional domain of the system is implemented as a separate module.

### Clear Separation of Concerns

* Routers define API endpoints
* Services implement business logic
* Models define database structure
* Schemas define API request and response validation

### Database-first Scheduling Guarantees

Scheduling correctness is enforced using database-level constraints wherever possible.

### Governance Awareness

Resource allocation decisions are logged and auditable to support institutional oversight.

---

# 2. Backend Architecture

The backend follows a layered architecture.

```
API Router Layer
        │
        ▼
Service Layer
        │
        ▼
Database Models
        │
        ▼
PostgreSQL
```

### Router Layer

Defines HTTP endpoints and request routing.

### Service Layer

Contains business logic such as scheduling validation and resource allocation rules.

### Database Layer

Defines SQLAlchemy ORM models and migrations.

---

# 3. Backend Module Overview

Backend functionality is organized into domain modules located in:

```
backend/src/crags/modules/
```

---

## IAM Module

```
modules/iam/
```

Responsibilities:

* User authentication
* Password hashing
* JWT token generation
* User and group management

Important files:

```
models.py
schemas.py
service.py
router.py
auth_service.py
dependencies.py
```

---

## Resources Module

```
modules/resources/
```

Responsibilities:

* Register compute systems
* Track system specifications
* Provide system inventory APIs

Key operations:

* create compute system
* update system configuration
* list available resources

---

## Scheduling Module

```
modules/scheduling/
```

This module contains the **core scheduling engine**.

Responsibilities:

* resource booking
* conflict detection
* foreground/background task prioritization
* scheduling validation

Key files:

```
models.py
schemas.py
service.py
router.py
cron.py
```

The scheduling module is the most critical component of CRAGS.

---

## Audit Module

```
modules/audit/
```

Responsibilities:

* logging booking activity
* recording preemption events
* generating usage reports
* supporting governance review

Audit data enables institutional oversight of compute resource usage.

---

# 4. Database Design

The system uses PostgreSQL with SQLAlchemy ORM.

Key database entities include:

```
users
groups
compute_systems
bookings
audit_logs
```

---

# 5. Migration System

Database schema changes must be handled through **Alembic migrations**.

Migration files are stored in:

```
backend/migrations/versions/
```

When modifying database models:

1. Update ORM models
2. Generate migration
3. Review migration file
4. Apply migration

Create migration:

```bash
cd backend
uv run alembic revision --autogenerate -m "migration description"
```

Apply migration:

```bash
cd backend
uv run alembic upgrade head
```

---

# 6. Scheduling Engine Principles

The scheduling engine must guarantee:

* resource capacity limits are respected
* bookings do not overlap incorrectly
* priority rules are enforced
* scheduling remains deterministic

Database constraints are used to prevent race conditions.

In particular, PostgreSQL GiST indexes and range constraints may be used to enforce booking exclusivity.

---

# 7. Frontend Architecture

The frontend is a React + TypeScript application located in `frontend/`.

| Technology | Role |
| --- | --- |
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool |
| MUI | Component library |
| Axios | HTTP client |
| React Query | Server state and caching |
| Redux Toolkit | Client-side state |

Key source directories:

```
frontend/src/
├── api/            Axios client and typed CRAGS API functions
├── hooks/          React Query hooks wrapping API functions
├── components/
│   ├── panels/     Full-page panels (dashboard, audit, bookings, team)
│   ├── forms/      Booking and system registration forms
│   ├── charts/     Resource constraint chart and temporal Gantt view
│   ├── layout/     App shell and navigation wrappers
│   └── shared/     Reusable UI primitives
├── types/          Shared TypeScript types for API shapes
└── utils/          Local helpers (booking simulation)
```

All HTTP calls go through `frontend/src/api/client.ts` (Axios instance) and
are exposed as typed functions in `frontend/src/api/cragsApi.ts`. Components
never call Axios directly; they use the React Query hooks in `src/hooks/`.

---

# 8. Adding New Features

When implementing new functionality:

### Step 1 — Identify module

Determine which module owns the functionality.

Examples:

* authentication → IAM module
* system inventory → Resources module
* booking logic → Scheduling module
* governance reporting → Audit module

---

### Step 2 — Define data model

Add or modify ORM models if needed.

---

### Step 3 — Generate migration

Create database migration.

---

### Step 4 — Implement service logic

Add functionality inside the module's `service.py`.

Avoid placing business logic in routers.

---

### Step 5 — Add API endpoint

Expose functionality through `router.py`.

---

### Step 6 — Update frontend API client

Add a typed function in `frontend/src/api/cragsApi.ts`, then expose it through
a React Query hook in `frontend/src/hooks/`.

---

# 9. Coding Conventions

Developers should follow these conventions.

### Python

* use type hints
* follow PEP8 formatting
* keep routers lightweight

### Database

* all schema changes require migrations
* avoid manual database modifications

### API

* maintain RESTful API structure
* return structured JSON responses

---

# 10. Testing Strategy

Recommended testing areas include:

* scheduling conflict detection
* booking validation
* authentication flow
* audit logging

Future work may include automated test suites.

---

# 11. Logging and Observability

The system logs:

* scheduling operations
* authentication events
* system changes
* audit generation

Future improvements may include:

* centralized logging
* metrics collection
* monitoring dashboards

---

# 12. Security Guidelines

Developers must follow these practices:

* never store plaintext passwords
* validate all user input
* restrict administrative operations
* maintain audit trails for critical actions

---

# 13. Deployment Considerations

Production deployment typically includes:

```
Reverse Proxy (Nginx)
        │
Backend API (FastAPI)
        │
PostgreSQL
```

Deployment options include:

* system service deployment
* containerized deployment
* internal institutional infrastructure

---

# 14. Future Development Areas

Potential extensions include:

* compute fairness algorithms
* predictive scheduling
* usage dashboards
* automated governance reporting
* integration with cluster schedulers

---

# 15. Maintainer Notes

CRAGS is intended to support long-term institutional infrastructure. Developers should prioritize:

* maintainability
* correctness of scheduling logic
* transparency of resource governance
* modular system evolution
