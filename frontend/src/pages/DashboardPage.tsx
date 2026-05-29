import {
  AssessmentRounded,
  DnsRounded,
  MemoryRounded,
  ScheduleRounded,
  WarningAmberRounded,
} from "@mui/icons-material"
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material"
import { useMemo } from "react"
import { useBookingsQuery } from "../hooks/useBookingsQuery"
import { useCurrentUserQuery } from "../hooks/useCurrentUserQuery"
import { useSystemsQuery } from "../hooks/useSystemsQuery"
import { BRAND, FONT_MONO, statusTone } from "../theme"
import { MissionControlDashboard } from "../components/panels/MissionControlDashboard"
import { TemporalGantt } from "../components/charts/TemporalGantt"
import type { BookingStatus } from "../types/crags"

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
  loading?: boolean
}

function StatCard({ icon, label, value, sub, color = BRAND.blue, loading }: StatCardProps) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "8px",
              background: `${color}14`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: FONT_MONO, display: "block" }}>
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={60} height={28} />
            ) : (
              <Typography variant="h5" sx={{ fontWeight: 700, color, lineHeight: 1.2 }}>
                {value}
              </Typography>
            )}
            {sub && (
              <Typography variant="caption" color="text.secondary">
                {sub}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const currentUserQuery = useCurrentUserQuery()
  const systemsQuery = useSystemsQuery(Boolean(currentUserQuery.data))
  const bookingsQuery = useBookingsQuery(Boolean(currentUserQuery.data))

  const systems  = systemsQuery.data  ?? []
  const bookings = bookingsQuery.data ?? []
  const loading  = systemsQuery.isLoading || bookingsQuery.isLoading

  const stats = useMemo(() => {
    const active   = systems.filter((s) => s.status === "ACTIVE").length
    const offline  = systems.filter((s) => s.status === "OFFLINE").length
    const maint    = systems.filter((s) => s.status === "MAINTENANCE").length
    const liveJobs: BookingStatus[] = ["CONFIRMED", "REQUESTED"]
    const running  = bookings.filter((b) => liveJobs.includes(b.status as BookingStatus)).length
    const today    = new Date()
    today.setHours(0,0,0,0)
    const todayBookings = bookings.filter(
      (b) => new Date(b.start_time).getTime() >= today.getTime()
    ).length
    return { active, offline, maint, running, todayBookings }
  }, [systems, bookings])

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Stat row */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              icon={<DnsRounded fontSize="small" />}
              label="ACTIVE SYSTEMS"
              value={stats.active}
              sub={`${stats.maint} maintenance · ${stats.offline} offline`}
              color={BRAND.blue}
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              icon={<ScheduleRounded fontSize="small" />}
              label="RUNNING JOBS"
              value={stats.running}
              sub="confirmed + requested"
              color={BRAND.green}
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              icon={<AssessmentRounded fontSize="small" />}
              label="TODAY'S BOOKINGS"
              value={stats.todayBookings}
              sub="starting today"
              color={BRAND.purple}
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              icon={<MemoryRounded fontSize="small" />}
              label="TOTAL SYSTEMS"
              value={systems.length}
              sub="in inventory"
              color={BRAND.amber}
              loading={loading}
            />
          </Grid>
        </Grid>

        {/* System status strip */}
        {systems.length > 0 && (
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: FONT_MONO, mr: 0.5 }}>
                  SYSTEMS
                </Typography>
                {systems.map((sys) => {
                  const tone = statusTone(sys.status)
                  return (
                    <Chip
                      key={sys.id}
                      label={sys.name}
                      size="small"
                      sx={{ background: tone.bg, color: tone.color }}
                    />
                  )
                })}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Errors */}
        {systemsQuery.isError && (
          <Alert severity="error" icon={<WarningAmberRounded />}>
            Unable to reach systems endpoint. Ensure the backend is healthy.
          </Alert>
        )}

        {/* Mission control heatmap + alerts */}
        {!systemsQuery.isError && (
          <MissionControlDashboard systems={systems} bookings={bookings} />
        )}

        {/* Timeline */}
        {systems.length > 0 && (
          <Card>
            <CardContent sx={{ p: 2, pb: "16px !important" }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: "text.secondary", fontFamily: FONT_MONO }}>
                TIMELINE · ALL SYSTEMS
              </Typography>
              <TemporalGantt
                systems={systems}
                bookings={bookings}
                requestedBooking={null}
                selectedSystemId={null}
                startUtcIso=""
                endUtcIso=""
                onWindowSelect={() => {}}
              />
            </CardContent>
          </Card>
        )}

        {systems.length === 0 && !loading && !systemsQuery.isError && (
          <Alert severity="info">
            No compute systems registered yet. Go to <strong>Systems</strong> to add one.
          </Alert>
        )}
      </Stack>
    </Box>
  )
}
