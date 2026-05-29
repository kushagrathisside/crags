import { Alert, Box, Card, CardContent, Chip, Divider, Grid, LinearProgress, Stack, Typography } from "@mui/material"
import type { BookingRecord, ComputeSystem } from "../../types/crags"

type Props = {
  systems: ComputeSystem[]
  bookings: BookingRecord[]
}

function isActiveNow(booking: BookingRecord, nowMs: number): boolean {
  const start = new Date(booking.start_time).getTime()
  const end = new Date(booking.end_time).getTime()

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return false
  }

  if (booking.status === "CANCELLED" || booking.status === "COMPLETED" || booking.status === "EXPIRED") {
    return false
  }

  return start <= nowMs && nowMs < end
}

function overlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

export function MissionControlDashboard({ systems, bookings }: Props) {
  const nowMs = Date.now()
  const activeBookings = bookings.filter((booking) => isActiveNow(booking, nowMs))

  const utilizationBySystem = systems.map((system) => {
    const active = activeBookings.filter((booking) => booking.system_id === system.id)

    const cpu  = active.reduce((sum, b) => sum + b.req_cpu, 0)
    const gpu  = active.reduce((sum, b) => sum + b.req_gpu, 0)
    const ram  = active.reduce((sum, b) => sum + b.req_ram, 0)
    const vram = active.reduce((sum, b) => sum + b.req_vram, 0)

    const cpuPct  = system.cpu_cores ? (cpu  / system.cpu_cores)              * 100 : 0
    const gpuPct  = system.gpu_units ? (gpu  / Math.max(1, system.gpu_units)) * 100 : 0
    const ramPct  = system.ram_gb    ? (ram  / system.ram_gb)                 * 100 : 0
    const vramPct = system.vram_gb   ? (vram / Math.max(1, system.vram_gb))   * 100 : 0

    return { system, cpuPct, gpuPct, ramPct, vramPct, pressurePct: Math.max(cpuPct, gpuPct, ramPct, vramPct) }
  })

  const highGpuAlerts         = utilizationBySystem.filter((e) => e.gpuPct >= 80)
  const preemptionCountBySystem = systems.map((system) => ({
    system,
    preemptions: bookings.filter((b) => b.system_id === system.id && b.status === "PREEMPTED").length,
  }))
  const repeatedPreemptionAlerts = preemptionCountBySystem.filter((e) => e.preemptions >= 3)
  const offlineAlerts = systems.filter((s) => (s as ComputeSystem & { status?: string }).status === "OFFLINE")

  const heatmapCells = systems.flatMap((system) => {
    const hourMs = 60 * 60 * 1000
    return Array.from({ length: 24 }).map((_, hourOffset) => {
      const segStart = nowMs + hourOffset * hourMs
      const segEnd   = segStart + hourMs
      const overlapping = bookings.filter((b) => {
        if (b.system_id !== system.id) return false
        if (b.status === "CANCELLED" || b.status === "COMPLETED" || b.status === "EXPIRED") return false
        const s = new Date(b.start_time).getTime()
        const e = new Date(b.end_time).getTime()
        return Number.isFinite(s) && Number.isFinite(e) && overlap(segStart, segEnd, s, e)
      })
      const gpuLoad = overlapping.reduce((sum, b) => sum + b.req_gpu, 0)
      const gpuPct  = system.gpu_units ? Math.min(1, gpuLoad / Math.max(1, system.gpu_units)) : 0
      return { systemId: system.id, hourOffset, gpuPct }
    })
  })

  const pressureScore = utilizationBySystem.length
    ? Math.round(utilizationBySystem.reduce((sum, e) => sum + e.pressurePct, 0) / utilizationBySystem.length)
    : 0

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Global Mission Control</Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`Systems: ${systems.length}`} color="primary" variant="outlined" />
            <Chip label={`Active bookings: ${activeBookings.length}`} variant="outlined" />
            <Chip
              label={`Resource pressure: ${pressureScore}%`}
              variant="outlined"
              color={pressureScore >= 80 ? "error" : "default"}
            />
          </Stack>

          <Grid container spacing={1.5}>
            {utilizationBySystem.map((entry) => (
              <Grid key={entry.system.id} size={{ xs: 12, md: 6 }}>
                <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1 }}>
                  <Typography variant="subtitle2">{entry.system.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pressure {entry.pressurePct.toFixed(0)}%
                  </Typography>
                  <LinearProgress variant="determinate" value={Math.min(100, entry.pressurePct)} sx={{ mt: 0.6 }} />
                </Box>
              </Grid>
            ))}
          </Grid>

          {highGpuAlerts.length > 0 && (
            <Alert severity="warning">
              High GPU usage on: {highGpuAlerts.map((e) => e.system.name).join(", ")}
            </Alert>
          )}

          {repeatedPreemptionAlerts.length > 0 && (
            <Alert severity="warning">
              Repeated preemptions detected:{" "}
              {repeatedPreemptionAlerts.map((e) => `${e.system.name} (${e.preemptions})`).join(", ")}
            </Alert>
          )}

          {offlineAlerts.length > 0 ? (
            <Alert severity="error">Offline systems: {offlineAlerts.map((s) => s.name).join(", ")}</Alert>
          ) : (
            <Alert severity="info">No offline systems detected.</Alert>
          )}

          <Divider />

          <Typography variant="subtitle2">Utilization Heatmap (Next 24 h · GPU pressure)</Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `160px repeat(24, minmax(12px, 1fr))`,
              gap: 0.3,
              alignItems: "center",
            }}
          >
            {systems.map((system) => (
              <Box key={`row-${system.id}`} sx={{ display: "contents" }}>
                <Typography variant="caption" sx={{ pr: 1 }}>
                  {system.name}
                </Typography>
                {heatmapCells
                  .filter((c) => c.systemId === system.id)
                  .map((cell) => (
                    <Box
                      key={`${system.id}-${cell.hourOffset}`}
                      title={`${system.name} · +${cell.hourOffset}h · ${(cell.gpuPct * 100).toFixed(0)}% GPU`}
                      sx={{
                        height: 10,
                        borderRadius: 0.3,
                        bgcolor: `rgba(211, 47, 47, ${Math.max(0.08, cell.gpuPct)})`,
                      }}
                    />
                  ))}
              </Box>
            ))}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}
