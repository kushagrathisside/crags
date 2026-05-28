"""API smoke coverage for the current mounted router surface."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

pytestmark = pytest.mark.integration


def test_healthz_reports_scheduler_state(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["scheduler"]["running"] is True


def test_login_sets_auth_cookie(client, member_user):
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "member", "password": "member12345"},
    )
    assert response.status_code == 200
    assert response.json()["token_type"] == "cookie"
    assert "crags_session=" in response.headers["set-cookie"]


def test_current_user_endpoint_accepts_bearer_token(client, member_auth_headers, member_user):
    response = client.get("/api/v1/users/me", headers=member_auth_headers)
    assert response.status_code == 200
    assert response.json()["username"] == member_user.username


def test_systems_endpoint_requires_authentication(client):
    response = client.get("/api/v1/systems/")
    assert response.status_code == 401


def test_admin_can_create_system(client, admin_auth_headers):
    response = client.post(
        "/api/v1/systems/",
        headers=admin_auth_headers,
        json={
            "name": "api-created-node",
            "system_type": "GPU",
            "cpu_cores": 48,
            "ram_gb": 192,
            "gpu_units": 6,
            "vram_gb": 96,
            "status": "ACTIVE",
        },
    )
    assert response.status_code == 200
    assert response.json()["name"] == "api-created-node"


def test_member_cannot_create_system(client, member_auth_headers):
    response = client.post(
        "/api/v1/systems/",
        headers=member_auth_headers,
        json={
            "name": "forbidden-node",
            "system_type": "CPU",
            "cpu_cores": 16,
            "ram_gb": 64,
            "gpu_units": 0,
            "vram_gb": 0,
            "status": "ACTIVE",
        },
    )
    assert response.status_code == 403


def test_booking_endpoints_smoke(client, member_auth_headers, booking_payload, compute_system):
    create_response = client.post("/api/v1/bookings/", headers=member_auth_headers, json=booking_payload)
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["system_id"] == compute_system.id

    availability_response = client.get(
        f"/api/v1/bookings/systems/{compute_system.id}/availability",
        headers=member_auth_headers,
        params={
            "start_time": booking_payload["start_time"],
            "end_time": booking_payload["end_time"],
        },
    )
    assert availability_response.status_code == 200


@pytest.mark.parametrize(
    ("path", "headers_fixture"),
    [
        ("/api/v1/analytics", "member_auth_headers"),
        ("/api/v1/billing/costs", "member_auth_headers"),
        ("/api/v1/health", "member_auth_headers"),
        ("/api/v1/maintenance", "member_auth_headers"),
        ("/api/v1/policies", "member_auth_headers"),
        ("/api/v1/templates", "member_auth_headers"),
        ("/api/v1/waitlist", "member_auth_headers"),
        ("/api/v1/webhooks", "admin_auth_headers"),
    ],
)
def test_new_module_list_endpoints_are_mounted(client, request, path, headers_fixture):
    headers = request.getfixturevalue(headers_fixture)
    response = client.get(path, headers=headers)
    assert response.status_code == 200


def test_admin_can_create_module_resources(client, admin_auth_headers, member_auth_headers, compute_system):
    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=9)
    end = start + timedelta(hours=3)

    maintenance = client.post(
        "/api/v1/maintenance",
        headers=admin_auth_headers,
        json={
            "system_id": compute_system.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "reason": "firmware upgrade",
        },
    )
    assert maintenance.status_code == 201

    policy = client.post(
        "/api/v1/policies",
        headers=admin_auth_headers,
        json={"name": "api-policy", "always_require_approval": False},
    )
    assert policy.status_code == 201

    webhook = client.post(
        "/api/v1/webhooks",
        headers=admin_auth_headers,
        json={
            "name": "ops-hook",
            "url": "https://example.com/hooks/crags",
            "events": ["booking.created"],
        },
    )
    assert webhook.status_code == 201

    template = client.post(
        "/api/v1/templates",
        headers=member_auth_headers,
        json={
            "name": "baseline-template",
            "system_id": compute_system.id,
            "req_cpu": 8,
            "req_gpu": 1,
            "req_ram": 32,
            "req_vram": 16,
            "duration_hours": 2,
            "access_type": "FOREGROUND",
        },
    )
    assert template.status_code == 201

    waitlist = client.post(
        "/api/v1/waitlist",
        headers=member_auth_headers,
        json={
            "system_id": compute_system.id,
            "req_cpu": 4,
            "req_gpu": 0,
            "req_ram": 16,
            "req_vram": 0,
            "duration_hours": 1,
            "access_type": "FOREGROUND",
        },
    )
    assert waitlist.status_code == 201
