# CRAGS

## Compute Resource Allocation and Governance System

CRAGS is a platform designed to manage, schedule, and audit institutional compute resources such as GPU servers, CPU clusters, and other shared computational infrastructure.

The system enables research groups to reserve compute resources while maintaining fairness, transparency, and governance over resource consumption.

CRAGS provides:

* A scheduling system for shared compute infrastructure
* Resource booking with conflict prevention
* Foreground and background execution prioritization
* Governance and auditing mechanisms for resource usage
* A web-based interface for managing systems and bookings

The project is designed for academic environments where multiple research groups share limited compute resources.

---

# 1. System Architecture

CRAGS follows a modern web architecture.

```id="y1q0n6"
Frontend (React + Vite)
        │
        ▼
Backend API (FastAPI)
        │
        ▼
Database (PostgreSQL)
```

### Frontend

The frontend provides the user interface through which users can:

* View compute systems
* Schedule bookings
* Monitor resource allocations
* Interact with governance features

### Backend

The backend implements the core scheduling and governance logic.

Responsibilities include:

* resource management
* scheduling conflict prevention
* authentication and authorization
* audit tracking

### Database

PostgreSQL stores:

* system definitions
* booking records
* user and group information
* audit logs
* scheduling constraints

---

# 2. Repository Structure

```id="8o5z1x"
crags/
│
├── backend/        FastAPI backend service
│
├── frontend/       React web application
│
├── docker-compose.yml
│
├── LICENSE
└── README.md
```

---

# 3. Backend Overview

Backend technology stack:

| Component     | Technology |
| ------------- | ---------- |
| API framework | FastAPI    |
| Language      | Python     |
| Database      | PostgreSQL |
| ORM           | SQLAlchemy |
| Migrations    | Alembic    |

Backend modules include:

```id="ohg6ng"
IAM          Authentication and identity management
Resources    Compute system management
Scheduling   Resource booking engine
Audit        Resource usage tracking
```

Detailed backend documentation is available in:

```
backend/README.md
```

---

# 4. Frontend Overview

Frontend technology stack:

| Component       | Technology |
| --------------- | ---------- |
| Framework       | React      |
| Language        | TypeScript |
| Build tool      | Vite       |
| Package manager | npm        |

The frontend provides:

* system inventory interface
* booking interface
* scheduling visualization
* governance dashboards

Detailed frontend documentation is available in:

```
frontend/README.md
```

---

# 5. Setup Instructions

This section explains how to run CRAGS locally for development.

---

# 5.1 Prerequisites

Ensure the following software is installed.

### Required

* Python 3.10+
* Node.js (18+ recommended)
* npm
* PostgreSQL

### Optional

* Docker
* DBeaver (for database inspection)

---

# 5.2 Clone Repository

```id="u2u3q6"
git clone <repository-url>
cd crags
```

---

# 5.3 Database Setup

Create a PostgreSQL database and user.

Example:

```id="dy0qzn"
CREATE USER crags_user WITH PASSWORD 'strongpassword';
CREATE DATABASE crags_db OWNER crags_user;
```

Update backend database configuration accordingly.

---

# 5.4 Backend Setup

Navigate to the backend directory.

```id="j6v6av"
cd backend
```

Create virtual environment.

```id="e8c7f6"
python -m venv venv
source venv/bin/activate
```

Install dependencies.

```id="s3zjkn"
pip install -e .
```

---

# 5.5 Run Database Migrations

Apply all schema migrations.

```id="fj43b3"
alembic upgrade head
```

---

# 5.6 Start Backend Server

Run the backend service.

```id="7ihk1q"
./run.sh
```

or

```id="6d1grd"
uvicorn src.crags.main:app --reload
```

The backend API will be available at:

```id="r6n7s3"
http://localhost:8000
```

API documentation:

```id="h35h5m"
http://localhost:8000/docs
```

---

# 5.7 Frontend Setup

Navigate to the frontend directory.

```id="3p2q7x"
cd ../frontend
```

Install dependencies.

```id="ydsuhg"
npm install
```

---

# 5.8 Run Frontend Development Server

Start the frontend.

```id="0m4fqs"
npm run dev
```

The application will be available at:

```id="1hkgx9"
http://localhost:5173
```

---

# 6. Development Workflow

Recommended development process:

1. Start PostgreSQL
2. Run backend server
3. Run frontend development server
4. Implement features in backend modules
5. Connect frontend components to APIs
6. Validate through browser

---

# 7. Scheduling System Design

CRAGS scheduling engine ensures:

* bookings cannot overlap improperly
* compute capacity limits are respected
* foreground tasks can preempt eligible background tasks

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
