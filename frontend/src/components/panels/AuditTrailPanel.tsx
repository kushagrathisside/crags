import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material"
import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatUtc } from "../../lib/time"
import type { AuditEvent, BookingRecord } from "../../types/crags"

type Props = {
  events: AuditEvent[]
  bookings: BookingRecord[]
  loading: boolean
  endpointMissing: boolean
  errorMessage: string | null
}

function durationHours(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0
  }

  return (end - start) / (60 * 60 * 1000)
}

export function AuditTrailPanel({ events, bookings, loading, endpointMissing, errorMessage }: Props) {
  const [windowFilter, setWindowFilter] = useState<"weekly" | "monthly">("weekly")
  const [selectedGroup, setSelectedGroup] = useState<string>("all")
  const [selectedBookingId, setSelectedBookingId] = useState<number | "all">("all")

  const now = Date.now()
  const lookbackMs = windowFilter === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
  const threshold = now - lookbackMs

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const start = new Date(booking.start_time).getTime()
      return Number.isFinite(start) && start >= threshold
    })
  }, [bookings, threshold])

  const usageByGroup = useMemo(() => {
    const aggregate = new Map<string, { group: string; cpuHours: number; gpuHours: number; preemptions: number }>()

    for (const booking of filteredBookings) {
      const group = booking.academic_category || "Uncategorized"
      const hours = durationHours(booking.start_time, booking.end_time)

      if (!aggregate.has(group)) {
        aggregate.set(group, { group, cpuHours: 0, gpuHours: 0, preemptions: 0 })
      }

      const entry = aggregate.get(group)
      if (!entry) {
        continue
      }

      entry.cpuHours += hours * booking.req_cpu
      entry.gpuHours += hours * booking.req_gpu
      if (booking.status === "PREEMPTED") {
        entry.preemptions += 1
      }
    }

    return Array.from(aggregate.values()).sort((left, right) => right.gpuHours - left.gpuHours)
  }, [filteredBookings])

  const fgBgUsage = useMemo(() => {
    const foreground = filteredBookings
      .filter((booking) => booking.access_type === "FOREGROUND")
      .reduce((sum, booking) => sum + durationHours(booking.start_time, booking.end_time), 0)

    const background = filteredBookings
      .filter((booking) => booking.access_type === "BACKGROUND")
      .reduce((sum, booking) => sum + durationHours(booking.start_time, booking.end_time), 0)

    return [
      { name: "FOREGROUND", value: Number(foreground.toFixed(2)) },
      { name: "BACKGROUND", value: Number(background.toFixed(2)) },
    ]
  }, [filteredBookings])

  const groupOptions = ["all", ...new Set(usageByGroup.map((entry) => entry.group))]

  const drillBookings = filteredBookings.filter((booking) => {
    if (selectedGroup !== "all" && booking.academic_category !== selectedGroup) {
      return false
    }

    if (selectedBookingId !== "all" && booking.id !== selectedBookingId) {
      return false
    }

    return true
  })

  const drillEvents = events
    .filter((event) => {
      if (selectedBookingId !== "all") {
        return event.record_id === selectedBookingId || event.booking_id === selectedBookingId
      }

      return true
    })
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())

  const exportCsv = () => {
    const rows = [
      ["group", "booking_id", "project_title", "status", "start_time", "end_time", "cpu", "gpu", "ram", "vram"],
      ...drillBookings.map((booking) => [
        booking.academic_category,
        booking.id,
        booking.project_title,
        booking.status,
        booking.start_time,
        booking.end_time,
        booking.req_cpu,
        booking.req_gpu,
        booking.req_ram,
        booking.req_vram,
      ]),
    ]

    const csv = rows.map((row) => row.map((item) => `"${String(item).replaceAll('"', '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `crags-governance-${windowFilter}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.8}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Typography variant="h6">Governance Audit & Analytics</Typography>
            <Button variant="outlined" size="small" onClick={exportCsv} disabled={!drillBookings.length}>
              Export CSV
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="audit-window-label">Window</InputLabel>
              <Select
                labelId="audit-window-label"
                label="Window"
                value={windowFilter}
                onChange={(event) => setWindowFilter(event.target.value as "weekly" | "monthly")}
              >
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="audit-group-label">Group</InputLabel>
              <Select
                labelId="audit-group-label"
                label="Group"
                value={selectedGroup}
                onChange={(event) => {
                  setSelectedGroup(event.target.value)
                  setSelectedBookingId("all")
                }}
              >
                {groupOptions.map((group) => (
                  <MenuItem key={group} value={group}>
                    {group}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel id="audit-booking-label">Booking</InputLabel>
              <Select
                labelId="audit-booking-label"
                label="Booking"
                value={selectedBookingId}
                onChange={(event) => setSelectedBookingId(event.target.value === "all" ? "all" : Number(event.target.value))}
              >
                <MenuItem value="all">All bookings</MenuItem>
                {filteredBookings
                  .filter((booking) => selectedGroup === "all" || booking.academic_category === selectedGroup)
                  .map((booking) => (
                    <MenuItem key={booking.id} value={booking.id}>
                      #{booking.id} · {booking.project_title}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Stack>

          {loading ? <Typography color="text.secondary">Loading audit events...</Typography> : null}

          {endpointMissing ? (
            <Alert severity="info">Audit events unavailable for your role or backend; analytics run on booking data only.</Alert>
          ) : null}

          {errorMessage ? <Alert severity="warning">{errorMessage}</Alert> : null}

          {!loading ? (
            <>
              <Box sx={{ height: 230 }}>
                <Typography variant="subtitle2" gutterBottom>
                  CPU-hours / GPU-hours per group
                </Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageByGroup}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="cpuHours" name="CPU-hours" fill="#1976d2" />
                    <Bar dataKey="gpuHours" name="GPU-hours" fill="#2e7d32" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              <Box sx={{ height: 210 }}>
                <Typography variant="subtitle2" gutterBottom>
                  FG vs BG usage (hours)
                </Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Legend />
                    <Pie dataKey="value" data={fgBgUsage} outerRadius={70} fill="#145da0" label />
                  </PieChart>
                </ResponsiveContainer>
              </Box>

              <Box sx={{ height: 210 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preemption counts by group
                </Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageByGroup}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="preemptions" name="Preemptions" fill="#d32f2f" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              <Typography variant="subtitle2">Drill-down Event Timeline</Typography>
              {drillEvents.length ? (
                <List dense>
                  {drillEvents.slice(0, 20).map((event) => (
                    <ListItem key={`${event.id}-${event.timestamp}`} disableGutters>
                      <ListItemText
                        primary={`${event.action} on ${event.table_name} #${event.record_id}`}
                        secondary={`${formatUtc(event.timestamp)} · user ${event.user_id}`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary">No events for selected drill-down.</Typography>
              )}
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )
}
