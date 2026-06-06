# Testing And Quality

This guide documents the runnable checks in the repository and the environment
they expect.

## Backend Tests

The backend suite lives under `backend/tests/` and currently covers API,
IAM, scheduling, resources, and integration flows.

Run from `backend/`:

```bash
PYTHONPATH=src ./.venv/bin/python -m pytest tests -q
```

### Requirements

- PostgreSQL must be reachable.
- If `CRAGS_TEST_DATABASE_URL` is unset, the test fixtures default to:

```text
postgresql+psycopg://crags:crags@127.0.0.1:5433/crags
```

### Practical Notes

- Running tests from the repo root without `PYTHONPATH=src` will fail module
  imports.
- In this environment, local PostgreSQL access from inside the sandbox was
  blocked, but the test suite passed outside the sandbox.

## Frontend Checks

From `frontend/`:

```bash
npm run build
npm run lint
```

Current observed state:

- `npm run build` succeeds.
- `npm run lint` currently reports real issues, mainly React purity rules,
  fast-refresh export constraints, and one explicit `any`.

## Repo-Level Helper

The repository includes `test_all.sh`, which is intended as a convenience
wrapper for backend checks and can be extended further if stricter repo-level
automation is added later.

## What Is Not Covered

- There is no frontend test suite configured in `package.json`.
- There is no CI configuration in this repository snapshot.
- Compose startup validation is operational rather than unit-tested.

## Suggested Developer Workflow

1. Run `docker compose up -d postgres` or the full stack.
2. Run backend tests.
3. Run frontend build.
4. Run frontend lint and address remaining issues before release work.
