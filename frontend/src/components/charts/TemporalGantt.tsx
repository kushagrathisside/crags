import { useMemo, useState } from "react"
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material"
import { formatUtc } from "../../lib/time"
import type { BookingRecord, BookingRequest, ComputeSystem, TimelineZoom } from "../../types/crags"

type RowBooking = BookingRecord & { isRequested?: boolean }

type Props = {
  systems: ComputeSystem[]
  bookings: BookingRecord[]
  requestedBooking: BookingRequest | null
  selectedSystemId: number | null
  startUtcIso: string
  endUtcIso: string
  onWindowSelect?: (params: { systemId: number; startUtcIso: string; endUtcIso: string }) => void
}

const ROW_HEIGHT = 86
const VIRTUAL_HEIGHT = 360

function overlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

function pickZoomDuration(zoom: TimelineZoom): number {
  if (zoom === "hour") {
    return 6 * 60 * 60 * 1000
  }

  if (zoom === "day") {
    return 48 * 60 * 60 * 1000
  }

  return 14 * 24 * 60 * 60 * 1000
}

function pickSegmentCount(zoom: TimelineZoom): number {
  if (zoom === "hour") {
    return 24
  }

  if (zoom === "day") {
    return 48
  }

  return 56
}

function styleForBooking(booking: RowBooking): {
  backgroundColor: string
  borderStyle: "solid" | "dashed"
  borderColor: string
  backgroundImage?: string
} {
  if (booking.status === "PREEMPTED") {
    return {
      backgroundColor: "rgba(255, 235, 238, 0.9)",
      borderStyle: "solid",
      borderColor: "#d32f2f",
      backgroundImage:
        "repeating-linear-gradient(135deg, rgba(211,47,47,0.18) 0, rgba(211,47,47,0.18) 6px, transparent 6px, transparent 12px)",
    }
  }

  if (booking.access_type === "BACKGROUND") {
    return {
      backgroundColor: "rgba(66, 165, 245, 0.16)",
      borderStyle: "dashed",
      borderColor: "#1976d2",
    }
  }

  return {
    backgroundColor: booking.isRequested ? "rgba(46,125,50,0.22)" : "rgba(25, 118, 210, 0.28)",
    borderStyle: "solid",
    borderColor: booking.isRequested ? "#2e7d32" : "#145da0",
  }
}

export function TemporalGantt({
  systems,
  bookings,
  requestedBooking,
  selectedSystemId,
  startUtcIso,
  endUtcIso,
  onWindowSelect,
}: Props) {
  const [zoom, setZoom] = useState<TimelineZoom>("day")
  const [focusSystem, setFocusSystem] = useState<number | "all">("all")
  const [scrollTop, setScrollTop] = useState(0)

  const baseStart = new Date(startUtcIso).getTime()
  const baseEnd = new Date(endUtcIso).getTime()
  const hasValidBase = Number.isFinite(baseStart) && Number.isFinite(baseEnd) && baseEnd > baseStart

  const view = useMemo(() => {
    const durationMs = pickZoomDuration(zoom)
    const now = Date.now()
    const center = hasValidBase ? Math.floor((baseStart + baseEnd) / 2) : now

    const viewStart = center - durationMs / 2
    const viewEnd = center + durationMs / 2
    const segmentCount = pickSegmentCount(zoom)
    const segmentSize = (viewEnd - viewStart) / segmentCount

    return {
      zoom,
      viewStart,
      viewEnd,
      segmentCount,
      segmentSize,
      windowDurationMs: hasValidBase ? baseEnd - baseStart : 2 * 60 * 60 * 1000,
    }
  }, [zoom, hasValidBase, baseStart, baseEnd])

  const requestedOverlay = useMemo<RowBooking[]>(() => {
    if (!requestedBooking) {
      return []
    }

    return [
      {
        id: -1,
        system_id: requestedBooking.system_id,
        start_time: requestedBooking.start_time,
        end_time: requestedBooking.end_time,
        req_cpu: requestedBooking.req_cpu,
        req_gpu: requestedBooking.req_gpu,
        req_ram: requestedBooking.req_ram,
        req_vram: requestedBooking.req_vram,
        access_type: requestedBooking.access_type,
        academic_category: requestedBooking.academic_category,
        project_title: requestedBooking.project_title || "Requested booking",
        expected_deliverable: requestedBooking.expected_deliverable,
        objective: requestedBooking.objective,
        status: "REQUESTED",
        user_id: 0,
        isRequested: true,
      },
    ]
  }, [requestedBooking])

  const merged = useMemo(() => [...bookings, ...requestedOverlay], [bookings, requestedOverlay])

  const visibleSystems = useMemo(() => {
    if (focusSystem !== "all") {
      return systems.filter((system) => system.id === focusSystem)
    }

    return systems
  }, [systems, focusSystem])

  const usageBySystem = useMemo(() => {
    const store = new Map<number, Array<{ cpuPct: number; gpuPct: number; hasConflict: boolean; start: number; end: number }>>()

    for (const system of visibleSystems) {
      const relevant = merged.filter((booking) => booking.system_id === system.id)
      const rows: Array<{ cpuPct: number; gpuPct: number; hasConflict: boolean; start: number; end: number }> = []

      for (let segment = 0; segment < view.segmentCount; segment += 1) {
        const segmentStart = view.viewStart + segment * view.segmentSize
        const segmentEnd = segmentStart + view.segmentSize

        let cpu = 0
        let gpu = 0
        let ram = 0
        let vram = 0

        for (const booking of relevant) {
          const bookingStart = new Date(booking.start_time).getTime()
          const bookingEnd = new Date(booking.end_time).getTime()

          if (!Number.isFinite(bookingStart) || !Number.isFinite(bookingEnd)) {
            continue
          }

          if (!overlap(segmentStart, segmentEnd, bookingStart, bookingEnd)) {
            continue
          }

          cpu += booking.req_cpu
          gpu += booking.req_gpu
          ram += booking.req_ram
          vram += booking.req_vram
        }

        const cpuPct = Math.min(220, (cpu / Math.max(1, system.cpu_cores)) * 100)
        const gpuPct = Math.min(220, (gpu / Math.max(1, system.gpu_units || 1)) * 100)
        const hasConflict =
          cpu > system.cpu_cores ||
          gpu > system.gpu_units ||
          ram > system.ram_gb ||
          vram > system.vram_gb

        rows.push({
          cpuPct,
          gpuPct,
          hasConflict,
          start: segmentStart,
          end: segmentEnd,
        })
      }

      store.set(system.id, rows)
    }

    return store
  }, [visibleSystems, merged, view.segmentCount, view.segmentSize, view.viewStart])

  const nowLeftPct = ((Date.now() - view.viewStart) / (view.viewEnd - view.viewStart)) * 100
  const showNow = nowLeftPct >= 0 && nowLeftPct <= 100

  const totalRows = visibleSystems.length
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 3)
  const endIndex = Math.min(totalRows, Math.ceil((scrollTop + VIRTUAL_HEIGHT) / ROW_HEIGHT) + 3)
  const virtualRows = visibleSystems.slice(startIndex, endIndex)

  if (!systems.length) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6">Resource Timeline</Typography>
          <Typography color="text.secondary">No systems available to render timeline.</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} mb={1.5} gap={1}>
          <Box>
            <Typography variant="h6">Resource Timeline</Typography>
            <Typography variant="body2" color="text.secondary">
              Multi-system temporal map with capacity overlays and conflict shading.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButtonGroup
              size="small"
              value={zoom}
              exclusive
              onChange={(_, value: TimelineZoom | null) => {
                if (value) {
                  setZoom(value)
                }
              }}
            >
              <ToggleButton value="hour">Hour</ToggleButton>
              <ToggleButton value="day">Day</ToggleButton>
              <ToggleButton value="week">Week</ToggleButton>
            </ToggleButtonGroup>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="focus-system-label">System Focus</InputLabel>
              <Select
                labelId="focus-system-label"
                label="System Focus"
                value={focusSystem}
                onChange={(event) => {
                  const next = event.target.value
                  setFocusSystem(next === "all" ? "all" : Number(next))
                }}
              >
                <MenuItem value="all">All systems</MenuItem>
                {systems.map((system) => (
                  <MenuItem key={system.id} value={system.id}>
                    {system.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>

        <Typography variant="caption" color="text.secondary" display="block" mb={1.25}>
          View: {formatUtc(new Date(view.viewStart).toISOString())} to {formatUtc(new Date(view.viewEnd).toISOString())}
        </Typography>

        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            position: "relative",
            height: VIRTUAL_HEIGHT,
            overflowY: "auto",
            bgcolor: "#fbfcff",
          }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <Box sx={{ height: totalRows * ROW_HEIGHT, position: "relative" }}>
            {virtualRows.map((system, index) => {
              const absoluteIndex = startIndex + index
              const top = absoluteIndex * ROW_HEIGHT

              const systemBookings = merged.filter((booking) => {
                if (booking.system_id !== system.id) {
                  return false
                }

                const bookingStart = new Date(booking.start_time).getTime()
                const bookingEnd = new Date(booking.end_time).getTime()

                if (!Number.isFinite(bookingStart) || !Number.isFinite(bookingEnd)) {
                  return false
                }

                return overlap(view.viewStart, view.viewEnd, bookingStart, bookingEnd)
              })

              const usageCells = usageBySystem.get(system.id) ?? []

              return (
                <Box
                  key={system.id}
                  sx={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top,
                    height: ROW_HEIGHT,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: selectedSystemId === system.id ? "rgba(20,93,160,0.06)" : "transparent",
                  }}
                >
                  <Box sx={{ position: "absolute", left: 8, top: 8, width: 182 }}>
                    <Typography variant="caption" fontWeight={700}>
                      {system.name}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {system.cpu_cores} CPU · {system.gpu_units} GPU
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      position: "absolute",
                      left: 200,
                      right: 10,
                      top: 6,
                      bottom: 8,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      bgcolor: "white",
                      overflow: "hidden",
                    }}
                  >
                    {usageCells.map((cell, cellIndex) => {
                      const left = (cellIndex / usageCells.length) * 100
                      const width = 100 / usageCells.length

                      return (
                        <Tooltip
                          key={`${system.id}-${cellIndex}`}
                          title={
                            <Box>
                              <Typography variant="caption" display="block">
                                {formatUtc(new Date(cell.start).toISOString())}
                              </Typography>
                              <Typography variant="caption" display="block">
                                CPU {cell.cpuPct.toFixed(0)}% · GPU {cell.gpuPct.toFixed(0)}%
                              </Typography>
                              <Typography variant="caption" display="block">
                                {cell.hasConflict ? "Conflict segment" : "Within capacity"}
                              </Typography>
                            </Box>
                          }
                          arrow
                        >
                          <Box
                            onClick={() => {
                              if (!onWindowSelect) {
                                return
                              }

                              const start = cell.start
                              const end = start + view.windowDurationMs

                              onWindowSelect({
                                systemId: system.id,
                                startUtcIso: new Date(start).toISOString(),
                                endUtcIso: new Date(end).toISOString(),
                              })
                            }}
                            sx={{
                              position: "absolute",
                              left: `${left}%`,
                              top: 0,
                              width: `${width}%`,
                              bottom: 0,
                              cursor: onWindowSelect ? "pointer" : "default",
                              bgcolor: cell.hasConflict ? "rgba(211,47,47,0.12)" : "transparent",
                            }}
                          >
                            <Box
                              sx={{
                                position: "absolute",
                                left: 1,
                                right: 1,
                                bottom: 1,
                                display: "grid",
                                gridTemplateRows: "1fr 1fr",
                                gap: 0.2,
                                height: 13,
                              }}
                            >
                              <Box sx={{ bgcolor: "rgba(20,93,160,0.25)", transformOrigin: "left center", transform: `scaleY(${Math.min(1, cell.cpuPct / 100)})` }} />
                              <Box sx={{ bgcolor: "rgba(46,125,50,0.25)", transformOrigin: "left center", transform: `scaleY(${Math.min(1, cell.gpuPct / 100)})` }} />
                            </Box>
                          </Box>
                        </Tooltip>
                      )
                    })}

                    {systemBookings.map((booking) => {
                      const bookingStart = new Date(booking.start_time).getTime()
                      const bookingEnd = new Date(booking.end_time).getTime()

                      const left = ((bookingStart - view.viewStart) / (view.viewEnd - view.viewStart)) * 100
                      const width = ((bookingEnd - bookingStart) / (view.viewEnd - view.viewStart)) * 100
                      const style = styleForBooking(booking)

                      return (
                        <Tooltip
                          key={`${system.id}-${booking.id}-${booking.status}`}
                          title={
                            <Box>
                              <Typography variant="caption" display="block">
                                {booking.project_title || `Booking ${booking.id}`}
                              </Typography>
                              <Typography variant="caption" display="block">
                                {booking.access_type} · {booking.status}
                              </Typography>
                              <Typography variant="caption" display="block">
                                CPU {booking.req_cpu} · GPU {booking.req_gpu} · RAM {booking.req_ram} · VRAM {booking.req_vram}
                              </Typography>
                              <Typography variant="caption" display="block">
                                {formatUtc(booking.start_time)} → {formatUtc(booking.end_time)}
                              </Typography>
                            </Box>
                          }
                          arrow
                        >
                          <Box
                            sx={{
                              position: "absolute",
                              left: `${Math.max(0, left)}%`,
                              top: 8,
                              width: `${Math.max(width, 1)}%`,
                              height: 24,
                              borderRadius: 1,
                              border: "1px",
                              borderStyle: style.borderStyle,
                              borderColor: style.borderColor,
                              backgroundColor: style.backgroundColor,
                              backgroundImage: style.backgroundImage,
                              display: "flex",
                              alignItems: "center",
                              px: 0.5,
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#1f2a33",
                            }}
                          >
                            {booking.project_title || `#${booking.id}`}
                          </Box>
                        </Tooltip>
                      )
                    })}

                    {showNow ? (
                      <Box
                        sx={{
                          position: "absolute",
                          left: `${nowLeftPct}%`,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          bgcolor: "error.main",
                          zIndex: 10,
                        }}
                      />
                    ) : null}
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Box>

        <Stack direction="row" spacing={1} mt={1.25} flexWrap="wrap">
          <Chip size="small" label="FOREGROUND: solid" variant="outlined" />
          <Chip size="small" label="BACKGROUND: dashed" variant="outlined" />
          <Chip size="small" label="PREEMPTED: red striped" variant="outlined" />
          <Chip size="small" label="Conflict segments: red overlay" variant="outlined" color="error" />
        </Stack>
      </CardContent>
    </Card>
  )
}
