import type { BookingRecord, BookingRequest, ComputeSystem } from "../types/crags"

export type SimulationViolationType = "capacity" | "time" | "policy"

export type SimulationViolation = {
  type: SimulationViolationType
  resource?: "CPU" | "GPU" | "RAM" | "VRAM"
  message: string
}

export type PreemptionImpact = {
  booking_id: number
  system_id: number
  project_title: string
  freed_gpu: number
  start_time: string
  end_time: string
}

export type ProjectedUsage = {
  before: {
    cpu: number
    gpu: number
    ram: number
    vram: number
  }
  after: {
    cpu: number
    gpu: number
    ram: number
    vram: number
  }
  capacity: {
    cpu: number
    gpu: number
    ram: number
    vram: number
  }
}

export type SimulationResult = {
  feasible: boolean
  violations: SimulationViolation[]
  preemptions: PreemptionImpact[]
  projected_usage: ProjectedUsage
}

type Capacity = Pick<ComputeSystem, "cpu_cores" | "gpu_units" | "ram_gb" | "vram_gb" | "id">

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = new Date(aStart).getTime()
  const aE = new Date(aEnd).getTime()
  const bS = new Date(bStart).getTime()
  const bE = new Date(bEnd).getTime()

  if ([aS, aE, bS, bE].some(Number.isNaN)) {
    return false
  }

  return aS < bE && bS < aE
}

export function simulateBooking(
  existingBookings: BookingRecord[],
  systemCapacity: Capacity,
  requestedBooking: BookingRequest,
): SimulationResult {
  const violations: SimulationViolation[] = []
  const preemptions: PreemptionImpact[] = []

  if (requestedBooking.system_id !== systemCapacity.id) {
    return {
      feasible: false,
      violations: [
        {
          type: "policy",
          message: "Requested system does not match selected system capacity context.",
        },
      ],
      preemptions,
      projected_usage: {
        before: { cpu: 0, gpu: 0, ram: 0, vram: 0 },
        after: {
          cpu: requestedBooking.req_cpu,
          gpu: requestedBooking.req_gpu,
          ram: requestedBooking.req_ram,
          vram: requestedBooking.req_vram,
        },
        capacity: {
          cpu: systemCapacity.cpu_cores,
          gpu: systemCapacity.gpu_units,
          ram: systemCapacity.ram_gb,
          vram: systemCapacity.vram_gb,
        },
      },
    }
  }

  const overlapsOnSameSystem = existingBookings.filter((booking) => {
    if (booking.system_id !== requestedBooking.system_id) {
      return false
    }

    if (booking.status === "CANCELLED" || booking.status === "COMPLETED" || booking.status === "EXPIRED") {
      return false
    }

    return overlaps(booking.start_time, booking.end_time, requestedBooking.start_time, requestedBooking.end_time)
  })

  const before = overlapsOnSameSystem.reduce(
    (acc, booking) => {
      acc.cpu += booking.req_cpu
      acc.gpu += booking.req_gpu
      acc.ram += booking.req_ram
      acc.vram += booking.req_vram
      return acc
    },
    { cpu: 0, gpu: 0, ram: 0, vram: 0 },
  )

  let afterGpu = before.gpu + requestedBooking.req_gpu

  if (afterGpu > systemCapacity.gpu_units && requestedBooking.access_type === "FOREGROUND") {
    const background = overlapsOnSameSystem
      .filter((booking) => booking.access_type === "BACKGROUND" && booking.status === "CONFIRMED")
      .sort((left, right) => right.req_gpu - left.req_gpu)

    let gpuToFree = afterGpu - systemCapacity.gpu_units

    for (const booking of background) {
      if (gpuToFree <= 0) {
        break
      }

      gpuToFree -= booking.req_gpu
      afterGpu -= booking.req_gpu

      preemptions.push({
        booking_id: booking.id,
        system_id: booking.system_id,
        project_title: booking.project_title,
        freed_gpu: booking.req_gpu,
        start_time: booking.start_time,
        end_time: booking.end_time,
      })
    }
  }

  const after = {
    cpu: before.cpu + requestedBooking.req_cpu,
    gpu: afterGpu,
    ram: before.ram + requestedBooking.req_ram,
    vram: before.vram + requestedBooking.req_vram,
  }

  if (after.cpu > systemCapacity.cpu_cores) {
    violations.push({
      type: "capacity",
      resource: "CPU",
      message: `CPU exceeds capacity by ${after.cpu - systemCapacity.cpu_cores}.`,
    })
  }

  if (after.gpu > systemCapacity.gpu_units) {
    violations.push({
      type: requestedBooking.access_type === "BACKGROUND" ? "policy" : "capacity",
      resource: "GPU",
      message:
        requestedBooking.access_type === "BACKGROUND"
          ? "BACKGROUND request cannot preempt; GPU remains over capacity."
          : `GPU exceeds capacity by ${after.gpu - systemCapacity.gpu_units}.`,
    })
  }

  if (after.ram > systemCapacity.ram_gb) {
    violations.push({
      type: "capacity",
      resource: "RAM",
      message: `RAM exceeds capacity by ${after.ram - systemCapacity.ram_gb} GB.`,
    })
  }

  if (after.vram > systemCapacity.vram_gb) {
    violations.push({
      type: "capacity",
      resource: "VRAM",
      message: `VRAM exceeds capacity by ${after.vram - systemCapacity.vram_gb} GB.`,
    })
  }

  if (new Date(requestedBooking.end_time) <= new Date(requestedBooking.start_time)) {
    violations.push({
      type: "time",
      message: "Invalid booking window: end must be after start.",
    })
  }

  return {
    feasible: violations.length === 0,
    violations,
    preemptions,
    projected_usage: {
      before,
      after,
      capacity: {
        cpu: systemCapacity.cpu_cores,
        gpu: systemCapacity.gpu_units,
        ram: systemCapacity.ram_gb,
        vram: systemCapacity.vram_gb,
      },
    },
  }
}
