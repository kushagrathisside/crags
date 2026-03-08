from sqlalchemy.orm import Session
from psycopg.types.range import Range

from crags.modules.scheduling.models import Booking
from crags.modules.resources.models import ComputeSystem
from crags.modules.audit.models import AuditLog
from datetime import datetime

def create_booking(db: Session, data, user_id):

    requested_range = Range(data.start_time, data.end_time)

    # Lock system row to prevent concurrent modifications
    system = db.query(ComputeSystem).filter(
        ComputeSystem.id == data.system_id
    ).with_for_update().first()

    # Find overlapping bookings
    overlapping = db.query(Booking).filter(
        Booking.system_id == data.system_id,
        Booking.booking_period.op("&&")(requested_range),
        Booking.status == "CONFIRMED"
    ).all()

    used_cpu = sum(b.req_cpu for b in overlapping)
    used_gpu = sum(b.req_gpu for b in overlapping)
    used_ram = sum(b.req_ram for b in overlapping)
    used_vram = sum(b.req_vram for b in overlapping)

    if used_cpu + data.req_cpu > system.cpu_cores:
        raise ValueError("CPU capacity exceeded")

    if used_gpu + data.req_gpu > system.gpu_units:
        if data.access_type == "FOREGROUND":

            freed_gpu = preempt_background_jobs(
                db,
                data.system_id,
                data.req_gpu,
                requested_range
            )

            if used_gpu - freed_gpu + data.req_gpu > system.gpu_units:
                raise ValueError("Insufficient GPU even after preemption")

        else:
            raise ValueError("GPU capacity exceeded")

    if used_ram + data.req_ram > system.ram_gb:
        raise ValueError("RAM capacity exceeded")

    if used_vram + data.req_vram > system.vram_gb:
        raise ValueError("VRAM capacity exceeded")

    booking = Booking(
        system_id=data.system_id,
        user_id=user_id,
        booking_period=requested_range,
        req_cpu=data.req_cpu,
        req_gpu=data.req_gpu,
        req_ram=data.req_ram,
        req_vram=data.req_vram,
        access_type=data.access_type,
        academic_category=data.academic_category,
        project_title=data.project_title,
        expected_deliverable=data.expected_deliverable,
        objective=data.objective,
        status="CONFIRMED"
    )

    db.add(booking)
    db.commit()
    db.refresh(booking)

    return booking


def check_availability(db: Session, system_id, start_time, end_time):

    requested_range = Range(start_time, end_time)

    system = db.query(ComputeSystem).filter(
        ComputeSystem.id == system_id
    ).first()

    bookings = db.query(Booking).filter(
        Booking.system_id == system_id,
        Booking.booking_period.op("&&")(requested_range)
    ).all()

    used_cpu = sum(b.req_cpu for b in bookings)
    used_gpu = sum(b.req_gpu for b in bookings)
    used_ram = sum(b.req_ram for b in bookings)
    used_vram = sum(b.req_vram for b in bookings)

    return {
        "cpu_available": system.cpu_cores - used_cpu,
        "gpu_available": system.gpu_units - used_gpu,
        "ram_available": system.ram_gb - used_ram,
        "vram_available": system.vram_gb - used_vram,
    }


def preempt_background_jobs(db, system_id, required_gpu, time_range):

    overlapping = db.query(Booking).filter(
        Booking.system_id == system_id,
        Booking.booking_period.op("&&")(time_range),
        Booking.status == "CONFIRMED",
        Booking.access_type == "BACKGROUND"
    ).all()

    freed_gpu = 0

    for job in overlapping:

        job.status = "PREEMPTED"
        freed_gpu += job.req_gpu

        log = AuditLog(
            table_name="bookings",
            record_id=job.id,
            action="PREEMPTED",
            timestamp=datetime.utcnow(),
            user_id=job.user_id
        )

        db.add(log)

        if freed_gpu >= required_gpu:
            break

    db.commit()

    return freed_gpu