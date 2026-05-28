import { BarChartRounded, DownloadRounded } from "@mui/icons-material"
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material"
import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts"
import { getAnalytics, getAnalyticsCsvUrl } from "../api/cragsApi"
import { FONT_MONO } from "../theme"

const PERIODS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
]

function SectionHeader({ title }: { title: string }) {
  return (
    <Typography
      variant="caption"
      sx={{ fontFamily: FONT_MONO, color: "text.secondary", fontWeight: 600, letterSpacing: "0.08em", display: "block", mb: 1.5 }}
    >
      {title}
    </Typography>
  )
}

function StatCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  useTheme()
  return (
    <Card sx={{ flex: 1, minWidth: 140 }}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: FONT_MONO, fontSize: "0.65rem" }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontFamily: FONT_MONO, fontWeight: 700, mt: 0.5, color: "#00B4D8" }}>
          {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5, fontFamily: FONT_MONO }}>
            {unit}
          </Typography>
        </Typography>
      </CardContent>
    </Card>
  )
}

export function AnalyticsPage() {
  const theme = useTheme()
  const dark = theme.palette.mode === "dark"
  const [days, setDays] = useState(30)

  const now = useMemo(() => new Date(), [])
  const fromTime = useMemo(() => new Date(now.getTime() - days * 86400000).toISOString(), [now, days])
  const toTime = useMemo(() => now.toISOString(), [now])

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => getAnalytics(fromTime, toTime),
  })

  const userChartData = useMemo(
    () =>
      (data?.per_user ?? [])
        .sort((a, b) => b.gpu_hours - a.gpu_hours)
        .slice(0, 10)
        .map((u) => ({ name: u.username ?? `#${u.user_id}`, CPU: +u.cpu_hours.toFixed(1), GPU: +u.gpu_hours.toFixed(1), RAM: +u.ram_gb_hours.toFixed(1) })),
    [data],
  )

  const systemChartData = useMemo(
    () =>
      (data?.per_system ?? []).map((s) => ({
        name: s.system_name,
        CPU: +s.cpu_utilization_pct.toFixed(1),
        GPU: +s.gpu_utilization_pct.toFixed(1),
        RAM: +s.ram_utilization_pct.toFixed(1),
      })),
    [data],
  )

  const csvUrl = getAnalyticsCsvUrl(fromTime, toTime)

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1.5} alignItems="center">
          <BarChartRounded sx={{ color: "#00B4D8" }} />
          <Typography variant="h6" fontWeight={700}>Analytics & Reporting</Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Select
            size="small"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            sx={{ fontFamily: FONT_MONO, fontSize: "0.75rem" }}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p.days} value={p.days} sx={{ fontFamily: FONT_MONO, fontSize: "0.8rem" }}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadRounded />}
            href={csvUrl}
            download="crags_analytics.csv"
            sx={{ fontFamily: FONT_MONO, fontSize: "0.7rem" }}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !data ? null : (
        <>
          {/* Summary Stats */}
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <StatCard label="TOTAL BOOKINGS" value={data.total_bookings} unit="jobs" />
            <StatCard label="CPU HOURS" value={data.total_cpu_hours} unit="hr" />
            <StatCard label="GPU HOURS" value={data.total_gpu_hours} unit="hr" />
            <StatCard label="RAM·HOURS" value={data.total_ram_gb_hours} unit="GB·hr" />
          </Stack>

          {/* User Usage Bar Chart */}
          <Card>
            <CardContent sx={{ p: 2 }}>
              <SectionHeader title="TOP USERS — RESOURCE HOURS" />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={userChartData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                  <XAxis dataKey="name" tick={{ fontFamily: FONT_MONO, fontSize: 10 }} />
                  <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontFamily: FONT_MONO, fontSize: "0.7rem", background: dark ? "#0D1526" : "#fff" }} />
                  <Legend wrapperStyle={{ fontFamily: FONT_MONO, fontSize: "0.7rem" }} />
                  <Bar dataKey="CPU" fill="#00B4D8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="GPU" fill="#7C3AED" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="RAM" fill="#00E5A0" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* System Utilization */}
          <Card>
            <CardContent sx={{ p: 2 }}>
              <SectionHeader title="SYSTEM UTILIZATION %" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={systemChartData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                  <XAxis dataKey="name" tick={{ fontFamily: FONT_MONO, fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontFamily: FONT_MONO, fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ fontFamily: FONT_MONO, fontSize: "0.7rem", background: dark ? "#0D1526" : "#fff" }} />
                  <Legend wrapperStyle={{ fontFamily: FONT_MONO, fontSize: "0.7rem" }} />
                  <Bar dataKey="CPU" fill="#00B4D8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="GPU" fill="#7C3AED" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="RAM" fill="#00E5A0" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Per-Group Table */}
          {data.per_group.length > 0 && (
            <Card>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                  <SectionHeader title="GROUP USAGE" />
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ "& th": { fontFamily: FONT_MONO, fontSize: "0.65rem", color: "text.secondary", fontWeight: 600, letterSpacing: "0.06em" } }}>
                        <TableCell>GROUP</TableCell>
                        <TableCell align="right">BOOKINGS</TableCell>
                        <TableCell align="right">CPU-hr</TableCell>
                        <TableCell align="right">GPU-hr</TableCell>
                        <TableCell align="right">RAM GB·hr</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.per_group.map((g) => (
                        <TableRow key={g.group_id} sx={{ "& td": { fontFamily: FONT_MONO, fontSize: "0.75rem" } }}>
                          <TableCell>{g.group_name ?? `#${g.group_id}`}</TableCell>
                          <TableCell align="right">{g.booking_count}</TableCell>
                          <TableCell align="right">{g.cpu_hours.toFixed(1)}</TableCell>
                          <TableCell align="right">{g.gpu_hours.toFixed(1)}</TableCell>
                          <TableCell align="right">{g.ram_gb_hours.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Stack>
  )
}
