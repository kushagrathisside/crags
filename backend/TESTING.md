# CRAGS Backend Testing

This backend now uses a PostgreSQL-backed pytest suite instead of the old
SQLite harness. That change matters because scheduling and analytics depend on
PostgreSQL range behavior (`TSRANGE`, overlap queries, `lower()/upper()`), so
the previous in-memory test setup no longer matched production behavior.

## Current suite

The suite currently collects **39 tests** across:

- `tests/test_iam.py`
- `tests/test_resources.py`
- `tests/test_scheduling.py`
- `tests/test_api.py`
- `tests/test_integration.py`

Coverage focus:

- IAM authentication, lookup, serialization, and role helpers
- system CRUD plus resource-capacity safety checks
- booking creation, approval routing, conflicts, availability, and cancellation
- mounted API smoke coverage for analytics, billing, health, maintenance,
  policies, templates, waitlist, and webhooks
- cross-module flows for billing, analytics, templates, waitlist, and webhooks
- mapper regression coverage for SQLAlchemy relationship configuration

## Requirements

The suite expects a reachable PostgreSQL database. By default the runner uses:

```bash
postgresql+psycopg://crags:crags@127.0.0.1:5433/crags
```

You can override that with:

```bash
export CRAGS_TEST_DATABASE_URL=postgresql+psycopg://user:pass@host:port/dbname
```

For local development with the repo’s Compose stack:

```bash
docker compose up -d postgres
```

## Quick start

From `backend/`:

```bash
./run_tests.sh
./run_tests.sh -u
./run_tests.sh -i
./run_tests.sh -c
make test
make test-unit
make test-integration
make test-coverage
```

The runner sets:

```bash
PYTHONPATH=src
CRAGS_TEST_DATABASE_URL=${CRAGS_TEST_DATABASE_URL:-postgresql+psycopg://crags:crags@127.0.0.1:5433/crags}
```

## Test model

The session fixture creates a **temporary PostgreSQL schema per test run** and
creates tables there with SQLAlchemy metadata. Each test runs inside a wrapped
transaction with nested savepoints, so service code can call `commit()` while
the test still rolls back cleanly afterward.

That gives us:

- production-compatible PostgreSQL behavior
- isolation between tests
- no destructive writes to the shared development schema

## Useful commands

```bash
PYTHONPATH=src ./.venv/bin/python -m pytest
PYTHONPATH=src ./.venv/bin/python -m pytest -m unit
PYTHONPATH=src ./.venv/bin/python -m pytest -m integration
PYTHONPATH=src ./.venv/bin/python -m pytest tests/test_api.py
PYTHONPATH=src ./.venv/bin/python -m pytest --collect-only -q
```

## Notes

- The old SQLite-only fixture set was intentionally replaced because it could
  not exercise the current scheduling model correctly.
- The suite includes a mapper smoke test to catch stale relationship strings
  like the earlier `UserModel` reference in scheduling.
- If the database is unreachable, collection will succeed but execution will
  fail during fixture setup. Start PostgreSQL first or point
  `CRAGS_TEST_DATABASE_URL` at an existing test database.
