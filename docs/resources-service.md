# Resources Service

This document covers the compute system registry: data model, API endpoints, RBAC, status enforcement, audit trail, and database schema.

## Table of Contents

1. [Overview](#overview)
2. [Data Model](#data-model)
3. [API Endpoints](#api-endpoints)
4. [RBAC](#rbac)
5. [SystemStatus Enforcement](#systemstatus-enforcement)
6. [Capacity Guard on Update](#capacity-guard-on-update)
7. [Audit Trail](#audit-trail)
8. [Database Schema](#database-schema)

---

## Overview

The Resources service manages the inventory of compute systems that users can book. It tracks hardware capacity, availability status, and exposes CRUD endpoints for administrators. All booking requests validate that the target system is `ACTIVE` before proceeding.

---

## Data Model

### `SystemType`

```python
class SystemType(enum.Enum):
    CPU    = "CPU"
    GPU    = "GPU"
    HYBRID = "HYBRID"
```

### `SystemStatus`

```python
class SystemStatus(enum.Enum):
    ACTIVE      = "ACTIVE"       # accepts new bookings
    MAINTENANCE = "MAINTENANCE"  # temporarily unavailable, blocked from new bookings
    OFFLINE     = "OFFLINE"      # decommissioned (soft-deleted), blocked from new bookings
```

### `ComputeSystem`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `name` | VARCHAR UNIQUE | Human-readable identifier |
| `system_type` | ENUM(SystemType) | `CPU`, `GPU`, or `HYBRID` |
| `cpu_cores` | INTEGER | Total CPU cores |
| `ram_gb` | INTEGER | Total RAM in GB |
| `gpu_units` | INTEGER | Total GPU count |
| `vram_gb` | INTEGER | Total VRAM in GB |
| `status` | ENUM(SystemStatus) | Defaults to `ACTIVE` |
| `health_check_url` | TEXT (nullable) | HTTP endpoint pinged by the health monitor on every reconciler tick |
| `last_health_check_at` | DATETIME (nullable) | Timestamp of the most recent health check |
| `last_health_status` | VARCHAR(20) (nullable) | `UP`, `DOWN`, or `SKIP` |

---

## API Endpoints

All endpoints are under `/api/v1/systems/`.

---

### `GET /api/v1/systems/`

List all registered systems. Any authenticated user may call this.

**Caching:** The unfiltered response (`status` query param omitted) is cached for **60 seconds** using the application-level Redis or in-memory cache. Any write to a system (POST, PATCH, DELETE) or a health-check status transition busts the cache immediately. Filtered queries (`?status=ACTIVE` etc.) always hit the database directly.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | `ACTIVE` \| `MAINTENANCE` \| `OFFLINE` | Filter by status. Omit to return all. |

**Response `200`**

```json
[
  {
    "id": 1,
    "name": "gpu-cluster-01",
    "system_type": "GPU",
    "cpu_cores": 64,
    "ram_gb": 512,
    "gpu_units": 8,
    "vram_gb": 640,
    "status": "ACTIVE"
  }
]
```

---

### `GET /api/v1/systems/{system_id}`

Fetch a single system by ID. Any authenticated user may call this.

**Response `200`** — same shape as a single element from the list endpoint.

**Error `404`** — system not found.

---

### `POST /api/v1/systems/`

Register a new compute system. Requires `RESOURCE_ADMIN` or `SUPER_ADMIN`.

**Request**

```json
{
  "name": "gpu-cluster-02",
  "system_type": "GPU",
  "cpu_cores": 32,
  "ram_gb": 256,
  "gpu_units": 4,
  "vram_gb": 320,
  "status": "ACTIVE"
}
```

`status` is optional and defaults to `ACTIVE`.

`system_type` must be one of `CPU`, `GPU`, `HYBRID`. Invalid values return `422`.

**Response `200`** — the created `SystemResponse`.

**Error `422`** — validation failure (invalid enum value, negative capacity).

---

### `PATCH /api/v1/systems/{system_id}`

Partially update a system. All fields are optional. Requires `RESOURCE_ADMIN` or `SUPER_ADMIN`.

**Request** — include only fields to change.

```json
{
  "status": "MAINTENANCE",
  "gpu_units": 6
}
```

**Response `200`** — updated `SystemResponse`.

**Error `404`** — system not found.

**Error `409`** — capacity reduction rejected because active bookings require more resources. See [Capacity Guard on Update](#capacity-guard-on-update).

---

### `DELETE /api/v1/systems/{system_id}`

Soft-delete a system by setting its status to `OFFLINE`. The system record and all its booking history are retained. Requires `RESOURCE_ADMIN` or `SUPER_ADMIN`.

> This is a soft delete, not a hard row delete. Booking history and foreign keys are preserved.

**Response `200`** — the system with `"status": "OFFLINE"`.

**Error `404`** — system not found.

---

## RBAC

| Capability | MEMBER | GROUP_LEAD | RESOURCE_ADMIN | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|
| List systems | ✓ | ✓ | ✓ | ✓ |
| Get system by ID | ✓ | ✓ | ✓ | ✓ |
| Register system | — | — | ✓ | ✓ |
| Update system | — | — | ✓ | ✓ |
| Decommission system | — | — | ✓ | ✓ |

---

## SystemStatus Enforcement

When a booking is created, `scheduling/service.py` checks the target system's status **before** any capacity math:

```python
if system.status != SystemStatus.ACTIVE:
    raise ValueError(
        f"System '{system.name}' is not available for booking (status: {system.status.value})"
    )
```

This raises `HTTP 409` at the booking endpoint. Setting a system to `MAINTENANCE` or `OFFLINE` immediately blocks all new bookings against it. Existing confirmed bookings are unaffected — cancel them separately if needed.

---

## Capacity Guard on Update

`PATCH /systems/{id}` rejects any capacity reduction that would leave active bookings (`REQUESTED` or `CONFIRMED`) under-resourced:

```
Cannot reduce gpu_units to 2 — active bookings require at least 4
```

The check uses the maximum of each resource field across all active bookings on that system. Reducing capacity is permitted when no active bookings exist, or when the new value is still ≥ the maximum actively booked value.

The update query uses `SELECT ... FOR UPDATE` to prevent a race between a concurrent booking creation and a capacity change.

---

## Audit Trail

Every mutating operation writes a row to `audit_logs`:

| `action` | Trigger |
|----------|---------|
| `SYSTEM_CREATED` | `POST /systems/` |
| `SYSTEM_UPDATED` | `PATCH /systems/{id}` |
| `SYSTEM_DELETED` | `DELETE /systems/{id}` (soft-delete) |

`table_name = "compute_systems"`, `record_id = system.id`, `user_id = actor.id`.

---

## Database Schema

```sql
CREATE TYPE systemtype   AS ENUM ('CPU', 'GPU', 'HYBRID');
CREATE TYPE systemstatus AS ENUM ('ACTIVE', 'MAINTENANCE', 'OFFLINE');

CREATE TABLE compute_systems (
    id                   INTEGER  PRIMARY KEY,
    name                 VARCHAR  UNIQUE,
    system_type          systemtype,
    cpu_cores            INTEGER,
    ram_gb               INTEGER,
    gpu_units            INTEGER,
    vram_gb              INTEGER,
    status               systemstatus,
    health_check_url     TEXT,
    last_health_check_at TIMESTAMPTZ,
    last_health_status   VARCHAR(20)
);
```

The enum types are native PostgreSQL enums created by migration `25c2237342f5`. Health columns were added by migration `d7e8f9a0b1c2`.
