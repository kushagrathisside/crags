CRAGS BACKEND – ALEMBIC SETUP NOTES
Location reference: ~/crags/backend

Purpose:
Enable schema migrations using Alembic so database structure evolves safely with code.

--------------------------------------------------
1. PREREQUISITES
--------------------------------------------------
Location: ~/crags/backend

Virtual environment active:
source .venv/bin/activate

Database must be reachable:
psql -h localhost -U crags -d crags

Expected stack:
FastAPI
SQLAlchemy 2.x
PostgreSQL
Alembic

--------------------------------------------------
2. INITIALIZE ALEMBIC
--------------------------------------------------
Location: ~/crags/backend

Command:
alembic init migrations

Resulting structure:

backend/
├─ alembic.ini
├─ migrations/
│  ├─ env.py
│  ├─ script.py.mako
│  └─ versions/

Purpose:
Alembic manages versioned schema changes.

--------------------------------------------------
3. CONFIGURE DATABASE CONNECTION
--------------------------------------------------
File:
~/crags/backend/alembic.ini

Edit:

sqlalchemy.url = postgresql+psycopg://crags:crags@localhost:5432/crags

--------------------------------------------------
4. REGISTER SQLALCHEMY METADATA
--------------------------------------------------
Problem:
Alembic cannot detect models unless metadata is exposed.

Error seen earlier:

"Can't proceed with --autogenerate option; env.py does not provide MetaData"

Fix:

File:
~/crags/backend/migrations/env.py

Find:

target_metadata = None

Replace with:

from crags.db.base import Base
target_metadata = Base.metadata

--------------------------------------------------
5. DEFINE BASE METADATA
--------------------------------------------------
File:
~/crags/backend/src/crags/db/base.py

Example:

from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

# Import models so Alembic sees them
from crags.modules.resources.models import ComputeSystem

Important rule:
Alembic only sees models imported into Base.metadata.

--------------------------------------------------
6. SET PYTHONPATH FOR PROJECT MODULES
--------------------------------------------------
Location: ~/crags/backend

Command:

export PYTHONPATH=src

Why:
Allows Python to resolve imports like:
crags.modules.resources.models

--------------------------------------------------
7. GENERATE FIRST MIGRATION
--------------------------------------------------
Location: ~/crags/backend

Command:

alembic revision --autogenerate -m "create compute systems table"

Expected output:

Generating migrations/versions/<revision>_create_compute_systems_table.py

--------------------------------------------------
8. APPLY MIGRATION
--------------------------------------------------
Location: ~/crags/backend

Command:

alembic upgrade head

This applies migration to PostgreSQL.

--------------------------------------------------
9. VERIFY TABLE CREATION
--------------------------------------------------
Command:

psql -U crags -d crags

Inside psql:

\dt

Expected tables:

compute_systems
alembic_version

--------------------------------------------------
10. HOW ALEMBIC AUTOGENERATION WORKS
--------------------------------------------------

Models
   ↓
SQLAlchemy Base.metadata
   ↓
Alembic env.py target_metadata
   ↓
Autogeneration diff vs database
   ↓
Migration script generated

If metadata is missing:
Autogenerate fails.

--------------------------------------------------
11. COMMON ISSUES
--------------------------------------------------

Issue:
ModuleNotFoundError: crags

Fix:
export PYTHONPATH=src

---

Issue:
Autogenerate fails

Fix:
Ensure env.py contains:

target_metadata = Base.metadata

---

Issue:
Migration detects no tables

Fix:
Ensure models imported in base.py

--------------------------------------------------
12. DEVELOPMENT WORKFLOW (STANDARD)
--------------------------------------------------

Location: ~/crags/backend

Step 1: Modify models

Step 2: Generate migration
alembic revision --autogenerate -m "message"

Step 3: Apply migration
alembic upgrade head

Step 4: Verify in DB
psql -U crags -d crags

--------------------------------------------------
13. CURRENT STATE OF PROJECT
--------------------------------------------------

Infrastructure:
✔ FastAPI running
✔ PostgreSQL local
✔ SQLAlchemy configured
✔ Alembic initialized
✔ First migration pipeline ready

Next logical steps:

1. Implement ComputeSystem model fully
2. Create User + Group tables
3. Implement Booking model
4. Add tsrange booking intervals
5. Implement availability queries

--------------------------------------------------
END OF DOCUMENT
--------------------------------------------------
