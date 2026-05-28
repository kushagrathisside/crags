"""
Analytics & Reporting Service
==============================
Computes resource usage metrics over a requested time window:
  - Per-user CPU/GPU/RAM/VRAM hour breakdown
  - Per-group aggregates
  - Per-system utilization percentages
  - CSV export of any of the above
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from crags.modules.analytics.schemas import (
    AnalyticsSummary,
    GroupUsageEntry,
    ResourceUsageEntry,
    SystemUtilizationEntry,
)
from crags.modules.iam.models import Group, User
from crags.modules.resources.models import ComputeSystem
from crags.modules.scheduling.models import Booking, BookingStatus

TERMINAL_STATUSES = {BookingStatus.CANCELLED, BookingStatus.EXPIRED}


def _overlap_hours(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> float:
    start = max(start_a, start_b)
    end = min(end_a, end_b)
    if end <= start:
        return 0.0
    return (end - start).total_seconds() / 3600


def _bookings_in_window(db: Session, from_time: datetime, to_time: datetime) -> list[Booking]:
    from psycopg.types.range import Range
    from_naive = from_time.astimezone(timezone.utc).replace(tzinfo=None)
    to_naive = to_time.astimezone(timezone.utc).replace(tzinfo=None)
    window = Range(from_naive, to_naive)
    return (
        db.query(Booking)
        .filter(
            Booking.booking_period.op("&&")(window),
            ~Booking.status.in_(TERMINAL_STATUSES),
        )
        .all()
    )


def get_analytics(
    db: Session,
    from_time: datetime,
    to_time: datetime,
) -> AnalyticsSummary:
    from_naive = from_time.astimezone(timezone.utc).replace(tzinfo=None)
    to_naive = to_time.astimezone(timezone.utc).replace(tzinfo=None)

    bookings = _bookings_in_window(db, from_time, to_time)

    users_by_id = {u.id: u for u in db.query(User).all()}
    groups_by_id = {g.id: g for g in db.query(Group).all()}
    systems_by_id = {s.id: s for s in db.query(ComputeSystem).all()}

    user_stats: dict[int, dict] = {}
    group_stats: dict[int, dict] = {}
    system_stats: dict[int, dict] = {}

    total_cpu_h = total_gpu_h = total_ram_h = total_vram_h = 0.0

    for b in bookings:
        period = b.booking_period
        if not period or period.lower is None or period.upper is None:
            continue
        hours = _overlap_hours(period.lower, period.upper, from_naive, to_naive)
        if hours <= 0:
            continue

        cpu_h = hours * b.req_cpu
        gpu_h = hours * b.req_gpu
        ram_h = hours * b.req_ram
        vram_h = hours * b.req_vram
        total_cpu_h += cpu_h
        total_gpu_h += gpu_h
        total_ram_h += ram_h
        total_vram_h += vram_h

        # Per-user
        uid = b.user_id or 0
        if uid not in user_stats:
            user = users_by_id.get(uid)
            user_stats[uid] = {"user_id": uid, "username": user.username if user else None, "cpu_hours": 0.0, "gpu_hours": 0.0, "ram_gb_hours": 0.0, "vram_gb_hours": 0.0, "booking_count": 0}
        user_stats[uid]["cpu_hours"] += cpu_h
        user_stats[uid]["gpu_hours"] += gpu_h
        user_stats[uid]["ram_gb_hours"] += ram_h
        user_stats[uid]["vram_gb_hours"] += vram_h
        user_stats[uid]["booking_count"] += 1

        # Per-group
        user = users_by_id.get(uid)
        gid = user.group_id if user else None
        if gid:
            if gid not in group_stats:
                group = groups_by_id.get(gid)
                group_stats[gid] = {"group_id": gid, "group_name": group.name if group else None, "cpu_hours": 0.0, "gpu_hours": 0.0, "ram_gb_hours": 0.0, "vram_gb_hours": 0.0, "booking_count": 0}
            group_stats[gid]["cpu_hours"] += cpu_h
            group_stats[gid]["gpu_hours"] += gpu_h
            group_stats[gid]["ram_gb_hours"] += ram_h
            group_stats[gid]["vram_gb_hours"] += vram_h
            group_stats[gid]["booking_count"] += 1

        # Per-system
        sid = b.system_id or 0
        if sid not in system_stats:
            system = systems_by_id.get(sid)
            system_stats[sid] = {"system_id": sid, "system_name": system.name if system else str(sid), "system": system, "cpu_hours": 0.0, "gpu_hours": 0.0, "ram_hours": 0.0, "vram_hours": 0.0, "booking_count": 0, "active_hours": 0.0}
        system_stats[sid]["cpu_hours"] += cpu_h
        system_stats[sid]["gpu_hours"] += gpu_h
        system_stats[sid]["ram_hours"] += ram_h
        system_stats[sid]["vram_hours"] += vram_h
        system_stats[sid]["booking_count"] += 1
        system_stats[sid]["active_hours"] += hours

    total_window_hours = (to_naive - from_naive).total_seconds() / 3600

    per_system = []
    for sid, s in system_stats.items():
        sys = s["system"]
        cap_cpu = (sys.cpu_cores or 1) * total_window_hours
        cap_gpu = max(1, sys.gpu_units or 1) * total_window_hours
        cap_ram = (sys.ram_gb or 1) * total_window_hours
        cap_vram = max(1, sys.vram_gb or 1) * total_window_hours
        per_system.append(SystemUtilizationEntry(
            system_id=sid,
            system_name=s["system_name"],
            cpu_utilization_pct=min(100, s["cpu_hours"] / cap_cpu * 100),
            gpu_utilization_pct=min(100, s["gpu_hours"] / cap_gpu * 100),
            ram_utilization_pct=min(100, s["ram_hours"] / cap_ram * 100),
            vram_utilization_pct=min(100, s["vram_hours"] / cap_vram * 100),
            booking_count=s["booking_count"],
            active_hours=s["active_hours"],
        ))

    return AnalyticsSummary(
        from_time=from_time,
        to_time=to_time,
        total_bookings=len(bookings),
        total_cpu_hours=round(total_cpu_h, 2),
        total_gpu_hours=round(total_gpu_h, 2),
        total_ram_gb_hours=round(total_ram_h, 2),
        total_vram_gb_hours=round(total_vram_h, 2),
        per_user=[ResourceUsageEntry(**v) for v in user_stats.values()],
        per_group=[GroupUsageEntry(**v) for v in group_stats.values()],
        per_system=per_system,
    )


def export_analytics_csv(db: Session, from_time: datetime, to_time: datetime) -> str:
    summary = get_analytics(db, from_time, to_time)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["section", "id", "name", "cpu_hours", "gpu_hours", "ram_gb_hours", "vram_gb_hours", "booking_count"])
    for u in summary.per_user:
        writer.writerow(["user", u.user_id, u.username, u.cpu_hours, u.gpu_hours, u.ram_gb_hours, u.vram_gb_hours, u.booking_count])
    for g in summary.per_group:
        writer.writerow(["group", g.group_id, g.group_name, g.cpu_hours, g.gpu_hours, g.ram_gb_hours, g.vram_gb_hours, g.booking_count])
    for s in summary.per_system:
        writer.writerow(["system", s.system_id, s.system_name, round(s.cpu_utilization_pct, 1), round(s.gpu_utilization_pct, 1), round(s.ram_utilization_pct, 1), round(s.vram_utilization_pct, 1), s.booking_count])
    return buf.getvalue()
