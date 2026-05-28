# Authentication Service

This document covers the full authentication and authorization layer added to CRAGS: token lifecycle, refresh flow, token revocation, login rate limiting, password reset, RBAC enforcement, and the frontend integration.

## Table of Contents

1. [Overview](#overview)
2. [Token Model](#token-model)
3. [API Endpoints](#api-endpoints)
4. [RBAC Matrix](#rbac-matrix)
5. [Login Rate Limiting](#login-rate-limiting)
6. [Token Blacklist](#token-blacklist)
7. [Password Reset Flow](#password-reset-flow)
8. [Audit Trail](#audit-trail)
9. [Frontend Integration](#frontend-integration)
10. [Configuration Reference](#configuration-reference)
11. [Database Schema](#database-schema)
12. [Operations](#operations)

---

## Overview

Authentication is local username/email + password. A successful login issues two HTTP-only cookies:

| Cookie | TTL | Purpose |
|--------|-----|---------|
| `crags_session` | 15 minutes | Access token — sent with every API request |
| `crags_refresh` | 7 days | Refresh token — sent only to `POST /api/v1/auth/refresh` |

The short access token TTL limits the blast radius of a stolen cookie. The refresh token lets the frontend obtain a new access token transparently, so users never see a login prompt during a normal session.

Both tokens are JWTs signed with `JWT_SECRET_KEY` using HS256. Every token carries a `jti` (JWT ID, a UUID) used for revocation.

---

## Token Model

### Access token payload

```json
{
  "sub": "1",
  "role": "MEMBER",
  "group_id": 3,
  "type": "access",
  "jti": "d4e5f6a7-...",
  "iat": 1748217600,
  "exp": 1748218500
}
```

### Refresh token payload

```json
{
  "sub": "1",
  "type": "refresh",
  "jti": "a1b2c3d4-...",
  "iat": 1748217600,
  "exp": 1748822400
}
```

### Validation order in `get_current_user`

1. Resolve token from cookie (`crags_session`) or `Authorization: Bearer <token>` header.
2. Decode and verify signature + expiry.
3. Assert `type == "access"` — refresh tokens are rejected.
4. Assert `jti` is present.
5. Check `jti` is not in `token_blacklist`.
6. Load the `User` row; assert `is_active == True`.

---

## API Endpoints

All auth endpoints are under `/api/v1/auth/`. No authentication is required to call them except where noted.

### `POST /api/v1/auth/login`

Authenticate with username/email + password. Issues both cookies.

**Request**

```json
{
  "identifier": "superadmin",
  "password": "change-me"
}
```

`identifier` may be replaced by `username` or `email`.

**Response `200`**

```json
{
  "token_type": "cookie",
  "access_token_expires_at": "2026-05-26T12:15:00Z",
  "user": {
    "id": 1,
    "username": "superadmin",
    "email": "superadmin@crags.local",
    "role": "SUPER_ADMIN",
    "group_id": 1,
    "group_name": "platform-admins",
    "is_active": true,
    "auth_provider": "local",
    "created_at": "2026-05-01T00:00:00Z",
    "last_login": "2026-05-26T12:00:00Z"
  }
}
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `400` | No identifier provided |
| `401` | Wrong credentials |
| `429` | Rate limit exceeded (5 failures in 10 minutes) |

---

### `POST /api/v1/auth/refresh`

Exchange the refresh cookie for a new access + refresh token pair. The old refresh token JTI is blacklisted (token rotation).

The refresh cookie is scoped to this path (`path=/api/v1/auth/refresh`), so browsers only send it to this endpoint.

**Response `200`** — same shape as login.

**Error responses**

| Status | Condition |
|--------|-----------|
| `401` | No refresh cookie, invalid/expired token, or token blacklisted |

---

### `POST /api/v1/auth/logout`

Revoke both cookies. Reads token JTIs from cookies and writes them to `token_blacklist`. Always succeeds even if the access token is already expired — cookies are cleared regardless.

Does **not** require a valid access token (handles the expired-but-wants-to-logout case).

**Response `200`**

```json
{ "ok": true }
```

---

### `POST /api/v1/auth/forgot-password`

Initiate a password reset. Returns a reset token in the response body.

> **Production note:** In a deployed environment, replace the `reset_token` field in the response with an email to the user. The token is only returned directly for development convenience.

**Request**

```json
{ "email": "user@example.com" }
```

**Response `200`** — always 200, even if the email is not registered (prevents user enumeration).

```json
{ "message": "If the email is registered, a reset link has been sent." }
```

The reset link is delivered to the user's email address. In dev mode (`EMAIL_ENABLED=false`) the link is logged to backend stdout instead of sent. The underlying token is valid for `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` (default 60 minutes) and can only be used once.

---

### `POST /api/v1/auth/reset-password`

Set a new password using a reset token.

**Request**

```json
{
  "token": "Xk9mR3...",
  "new_password": "correct-horse-battery-staple"
}
```

`new_password` must be at least 8 characters.

**Response `200`**

```json
{ "message": "Password updated. Please log in with your new password." }
```

**Error `400`** — token invalid, expired, or already used.

---

### `GET /api/v1/users/me`

Returns the current authenticated user. Requires a valid access cookie or Bearer token.

**Response** — `UserResponse` shape (same as the `user` object in login).

---

## RBAC Matrix

Four roles exist. The internal ORM enum value for `RESOURCE_ADMIN` is `ADMIN`; the API always serializes and accepts it as `RESOURCE_ADMIN`.

| Capability | MEMBER | GROUP_LEAD | RESOURCE_ADMIN | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|
| Log in | ✓ | ✓ | ✓ | ✓ |
| View own profile (`/users/me`) | ✓ | ✓ | ✓ | ✓ |
| List compute systems | ✓ | ✓ | ✓ | ✓ |
| Create bookings | ✓ | ✓ | ✓ | ✓ |
| View own bookings | ✓ | ✓ | ✓ | ✓ |
| Cancel own booking | ✓ | ✓ | ✓ | ✓ |
| View group bookings | — | own group | ✓ | ✓ |
| View group members | — | own group | ✓ | ✓ |
| View group usage | — | own group | ✓ | ✓ |
| Cancel any booking | — | — | ✓ | ✓ |
| Register compute systems | — | — | ✓ | ✓ |
| Manage groups (create/update) | — | — | ✓ | ✓ |
| Manage users (create/update) | — | — | ✓ | ✓ |
| View audit log | — | — | ✓ | ✓ |
| Assign / change roles | — | — | — | ✓ |
| Modify admin users | — | — | — | ✓ |

### FastAPI dependency guards

```python
# In iam/dependencies.py
require_admin       = require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])
require_super_admin = require_role([UserRole.SUPER_ADMIN])
own_group_or_admin  = own_group_or_admin()   # factory; used on group endpoints
```

`own_group_or_admin()` passes if the caller is `RESOURCE_ADMIN` or `SUPER_ADMIN`, or if the caller is a `GROUP_LEAD` whose `group_id` matches the `group_id` path parameter.

---

## Login Rate Limiting

Failed login attempts are tracked per identifier (username or email). Successful login clears the counter.

| Parameter | Value |
|-----------|-------|
| Window | 10 minutes (fixed) |
| Max failures before lockout | 5 |
| Lockout response | `HTTP 429` with message `"Too many failed login attempts. Try again in 10 minutes."` |

Two backend implementations share the same interface — resolved once at process startup:

| Backend | Active when |
|---------|-------------|
| `_RedisRateLimiter` | `REDIS_URL` is configured and Redis is reachable |
| `_InMemoryRateLimiter` | No `REDIS_URL` set, or Redis is unreachable at startup |

The Redis backend uses a Lua `INCR + EXPIRE` script for atomic fixed-window counting; counters survive restarts and work correctly across multiple API replicas. The in-memory fallback resets on process restart and is single-replica only.

If Redis is configured but unreachable at startup, the process falls back to in-memory and logs a warning — it does not crash.

---

## Token Blacklist

Revoked JTIs are stored in the `token_blacklist` table. The table schema is:

```
jti        VARCHAR  PRIMARY KEY
expires_at DATETIME NOT NULL
```

An index on `expires_at` supports efficient cleanup.

### When tokens are blacklisted

| Event | Tokens blacklisted |
|-------|--------------------|
| `POST /auth/logout` | Access token + refresh token (both from cookies) |
| `POST /auth/refresh` | Old refresh token (rotation — prevents replay) |

### Cleanup

Expired entries are deleted during every run of `reconcile_bookings` (the scheduled cron task). Since an expired token is already rejected by JWT signature verification, stale blacklist rows are harmless but are pruned to keep the table small.

Manual cleanup:

```python
from crags.modules.iam.service import cleanup_expired_blacklist
cleanup_expired_blacklist(db)
```

---

## Password Reset Flow

```
Client                        Backend                    Database
  │                              │                           │
  ├─ POST /auth/forgot-password ─►                           │
  │   { email }                  │                           │
  │                              ├─ find user by email ─────►│
  │                              ├─ generate token_urlsafe(32)│
  │                              ├─ store SHA-256(token) ────►│ password_reset_tokens
  │                              │   + expires_at (60 min)   │
  │◄─ 200 { reset_token } ───────┤                           │
  │                              │                           │
  │  [user receives token]       │                           │
  │                              │                           │
  ├─ POST /auth/reset-password ──►                           │
  │   { token, new_password }    │                           │
  │                              ├─ SHA-256(token) lookup ──►│
  │                              ├─ validate expiry + used_at│
  │                              ├─ bcrypt(new_password) ────►│ users.hashed_password
  │                              ├─ set used_at = now ───────►│
  │◄─ 200 { message } ───────────┤                           │
```

Security properties:
- The database stores only the SHA-256 hash of the token, never the raw value.
- Tokens are single-use (`used_at` set on consumption).
- Tokens expire after 60 minutes (configurable via `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES`).
- The `forgot-password` endpoint always returns `200` regardless of whether the email exists.

---

## Audit Trail

Every auth event writes a row to `audit_logs`:

| `action` | Trigger | `user_id` |
|----------|---------|-----------|
| `AUTH_LOGIN` | Successful login | Authenticated user |
| `AUTH_FAILURE` | Wrong password | User ID if account exists, `null` if not |
| `AUTH_LOGOUT` | `POST /auth/logout` with a valid access token | User from token |
| `AUTH_REFRESH` | Successful `POST /auth/refresh` | User from refresh token |
| `AUTH_RESET_REQUESTED` | `POST /auth/forgot-password` for a known email | User ID |
| `AUTH_RESET_COMPLETED` | Successful `POST /auth/reset-password` | User ID |

Audit failures are swallowed (logged but not surfaced to the caller) so an audit write error never blocks authentication.

Auth events use `table_name = "auth"` and `record_id = user_id`, consistent with the existing `bookings` audit format.

---

## Frontend Integration

### Auto-refresh interceptor (`api/client.ts`)

The Axios client has a response interceptor that handles `401` responses transparently:

1. Catches any `401` that is not from `/auth/login`, `/auth/refresh`, or `/auth/logout`.
2. If a refresh is already in flight, queues the failed request.
3. Calls `POST /auth/refresh`. If successful, retries all queued requests.
4. If refresh fails (refresh token expired or revoked), dispatches a `crags:session-expired` DOM event and rejects all queued requests.

This means API callers never need to handle token expiry themselves — a failed request is retried once automatically.

### Session expiry hook (`hooks/useSessionExpiry.ts`)

```typescript
const { secondsRemaining, isExpiringSoon } = useSessionExpiry(
  loginResponse.access_token_expires_at,
  () => { /* handle forced logout */ }
)
```

| Property | Description |
|----------|-------------|
| `secondsRemaining` | Seconds until the access token expires (updates every 10 s) |
| `isExpiringSoon` | `true` when ≤ 2 minutes remain — use to show a warning banner |

The hook pre-emptively calls `refreshToken()` when ≤ 60 seconds remain, before the interceptor would need to rescue a failed request.

### Forced logout (`hooks/useLogoutMutation.ts`)

The logout mutation listens for `crags:session-expired` events (dispatched by the interceptor on refresh failure) and clears the React Query cache, which causes the app to return to the login screen.

### Password reset

```typescript
// Request a reset token
const result = await forgotPassword({ email: "user@example.com" })

// Apply the new password
await resetPassword({ token: result.reset_token, new_password: "new-pass-123" })
```

Both functions are in `api/cragsApi.ts`. Wire them to form components as needed.

---

## Configuration Reference

All settings are read from environment variables (and `.env`).

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET_KEY` | `dev-secret` | HMAC secret for signing tokens. **Change before any non-local deployment.** |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access token lifetime in minutes. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime in days. |
| `REFRESH_COOKIE_NAME` | `crags_refresh` | Name of the refresh cookie. |
| `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` | `60` | Reset token validity window. |
| `AUTH_COOKIE_NAME` | `crags_session` | Name of the access token cookie. |
| `AUTH_COOKIE_SECURE` | `false` | Set `true` behind HTTPS. |
| `AUTH_COOKIE_SAMESITE` | `lax` | Cookie SameSite policy. |
| `AUTH_COOKIE_DOMAIN` | unset | Optional cookie domain scope. |

---

## Database Schema

### `token_blacklist`

```sql
CREATE TABLE token_blacklist (
    jti        VARCHAR  PRIMARY KEY,
    expires_at DATETIME NOT NULL
);
CREATE INDEX ix_token_blacklist_expires_at ON token_blacklist (expires_at);
```

### `password_reset_tokens`

```sql
CREATE TABLE password_reset_tokens (
    id         INTEGER  PRIMARY KEY,
    user_id    INTEGER  NOT NULL REFERENCES users(id),
    token_hash VARCHAR  NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at    DATETIME
);
CREATE INDEX ix_password_reset_tokens_user_id ON password_reset_tokens (user_id);
```

Both tables are created by migration `c7d8e9f0a1b2_add_auth_service_tables`.

---

## Operations

### Apply the new migrations

```bash
# Docker Compose (automatic on next up)
docker-compose up --build

# Local backend-only
cd backend
uv run alembic upgrade head
```

Two new migrations will run in order:
1. `b3c4d5e6f7a8` — makes booking resource columns NOT NULL
2. `c7d8e9f0a1b2` — adds `token_blacklist` and `password_reset_tokens`

### Rotate the JWT secret

Rotating `JWT_SECRET_KEY` immediately invalidates all issued tokens (they fail signature verification). Users will be logged out and must re-authenticate.

1. Update `JWT_SECRET_KEY` in `.env`.
2. Restart the backend: `docker-compose restart backend`.
3. Optionally truncate `token_blacklist` since all old JTIs are now unreachable anyway.

### Inspect active blacklist entries

```sql
SELECT jti, expires_at FROM token_blacklist
WHERE expires_at > NOW()
ORDER BY expires_at;
```

### Manually expire a user's sessions

Blacklisting is JTI-based, not user-based. To force a specific user out, either:

- Rotate `JWT_SECRET_KEY` (logs out everyone), or
- Set `users.is_active = false` for the target user — `get_current_user` rejects inactive users on every request even if the token is valid.

```sql
UPDATE users SET is_active = false WHERE username = 'target-user';
```

Re-enable with:

```sql
UPDATE users SET is_active = true WHERE username = 'target-user';
```

### Force a full session cleanup

```bash
# Wipe the blacklist table (safe to do when JWT_SECRET_KEY has been rotated)
docker-compose exec postgres psql -U crags -d crags -c "TRUNCATE token_blacklist;"

# Expire all unused password reset tokens immediately
docker-compose exec postgres psql -U crags -d crags \
  -c "UPDATE password_reset_tokens SET expires_at = NOW() WHERE used_at IS NULL;"
```
