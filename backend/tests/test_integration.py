"""Cross-module integration checks for the current backend feature set."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

pytestmark = pytest.mark.integration


def test_booking_cost_and_analytics_flow(client, admin_auth_headers, member_auth_headers, compute_system):
    cost_response = client.put(
        f"/api/v1/billing/costs/{compute_system.id}",
        headers=admin_auth_headers,
        json={
            "cpu_core_hour_rate": "1.5000",
            "gpu_hour_rate": "4.0000",
            "ram_gb_hour_rate": "0.1000",
            "vram_gb_hour_rate": "0.0500",
            "currency": "USD",
        },
    )
    assert cost_response.status_code == 200

    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=10)
    end = start + timedelta(hours=2)
    booking_response = client.post(
        "/api/v1/bookings/",
        headers=member_auth_headers,
        json={
            "system_id": compute_system.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "req_cpu": 4,
            "req_gpu": 1,
            "req_ram": 8,
            "req_vram": 4,
            "access_type": "FOREGROUND",
            "academic_category": "research",
            "project_title": "Billing Flow",
            "expected_deliverable": "summary",
            "objective": "exercise billing and analytics",
        },
    )
    assert booking_response.status_code == 200
    booking_id = booking_response.json()["id"]

    booking_cost = client.get(
        f"/api/v1/billing/bookings/{booking_id}/cost",
        headers=member_auth_headers,
    )
    assert booking_cost.status_code == 200
    assert Decimal(booking_cost.json()["total_cost"]) == Decimal("22.0000")

    analytics = client.get(
        "/api/v1/analytics",
        headers=member_auth_headers,
        params={
            "from_time": (start - timedelta(hours=1)).isoformat(),
            "to_time": (end + timedelta(hours=1)).isoformat(),
        },
    )
    assert analytics.status_code == 200
    assert analytics.json()["total_bookings"] >= 1


def test_templates_waitlist_and_webhooks_persist_and_list(
    client,
    admin_auth_headers,
    member_auth_headers,
    compute_system,
):
    template_create = client.post(
        "/api/v1/templates",
        headers=member_auth_headers,
        json={
            "name": "integration-template",
            "system_id": compute_system.id,
            "req_cpu": 2,
            "req_gpu": 1,
            "req_ram": 8,
            "req_vram": 8,
            "duration_hours": 4,
            "access_type": "FOREGROUND",
        },
    )
    assert template_create.status_code == 201

    waitlist_create = client.post(
        "/api/v1/waitlist",
        headers=member_auth_headers,
        json={
            "system_id": compute_system.id,
            "req_cpu": 2,
            "req_gpu": 0,
            "req_ram": 8,
            "req_vram": 0,
            "duration_hours": 2,
            "access_type": "FOREGROUND",
        },
    )
    assert waitlist_create.status_code == 201

    webhook_create = client.post(
        "/api/v1/webhooks",
        headers=admin_auth_headers,
        json={
            "name": "integration-webhook",
            "url": "https://example.com/crags-webhook",
            "events": ["booking.created", "booking.cancelled"],
        },
    )
    assert webhook_create.status_code == 201

    template_list = client.get("/api/v1/templates", headers=member_auth_headers)
    waitlist_list = client.get("/api/v1/waitlist", headers=member_auth_headers)
    webhook_list = client.get("/api/v1/webhooks", headers=admin_auth_headers)

    assert any(item["name"] == "integration-template" for item in template_list.json())
    assert any(item["id"] == waitlist_create.json()["id"] for item in waitlist_list.json())
    assert any(item["name"] == "integration-webhook" for item in webhook_list.json())
