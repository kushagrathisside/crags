import {
  Alert,
  Box,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { FONT_MONO, OKLCH_BLUE, OKLCH_TEAL, OKLCH_RED, OKLCH_AMBER, CLR_RED } from "../../theme"
import type { BookingRecord, ComputeSystem } from "../../types/crags"

// ── helpers ────────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000

function dayWindow() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return { dayStart: start.getTime(), dayEnd: start.getTime() + DAY_MS }
}

function overlapsDay(b: BookingRecord, dayStart: number, dayEnd: number): boolean {
  const s = +new Date(b.start_time)
  const e = +new Date(b.end_time)
  return Number.isFinite(s) && Number.isFinite(e) && s < dayEnd && e > dayStart
}

function isNowActive(b: BookingRecord, nowMs: number): boolean {
  if (["CANCELLED", "EXPIRED"].includes(b.status)) return false
  const s = +new Date(b.start_time)
  const e = +new Date(b.end_time)
  return s <= nowMs && nowMs < e
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
}

function bookingBarStyle(b: BookingRecord, dark: boolean): React.CSSProperties {
  const fg = b.access_type === "FOREGROUND"
  switch (b.status) {
    case "CONFIRMED":
      return {
        background: `${OKLCH_BLUE} / ${fg ? 0.8 : 0.4}`,
        backgroundColor: fg
          ? `color-mix(in oklch, ${OKLCH_BLUE} 80%, transparent)`
          : `color-mix(in oklch, ${OKLCH_BLUE} 40%, transparent)`,
        borderLeft: fg ? `3px solid ${OKLCH_BLUE}` : `1px solid ${OKLCH_BLUE}`,
        borderTop: `1px solid ${OKLCH_BLUE}`,
        borderBottom: `1px solid ${OKLCH_BLUE}`,
        borderRight: `1px solid ${OKLCH_BLUE}`,
      }
    case "REQUESTED":
      return {
        backgroundColor: `color-mix(in oklch, ${OKLCH_AMBER} 15%, transparent)`,
        border: `1px dashed ${OKLCH_AMBER}`,
        borderLeft: `2px dashed ${OKLCH_AMBER}`,
      }
    case "PREEMPTED":
      return {
        backgroundColor: `color-mix(in oklch, ${OKLCH_RED} 70%, transparent)`,
        border: `1px solid ${OKLCH_RED}`,
      }
    case "COMPLETED":
      return {
        backgroundColor: dark ? "rgba(113,113,122,0.25)" : "rgba(113,113,122,0.15)",
        border: "1px solid rgba(113,113,122,0.3)",
      }
    default:
      return { backgroundColor: "transparent" }
  }
}

// ── sub-components ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: string
  dark: boolean
}
function StatCard({ label, value, sub, accent, dark }: StatCardProps) {
  return (
    <Box
      sx={{
        flex: 1,
        borderRight: `1px solid ${dark ? "rgba(228,228,226,0.07)" : "#E4E4E2"}`,
        px: 2,
        py: 1.5,
        "&:last-child": { borderRight: "none" },
      }}
    >
      <Typography
        sx={{
          fontFamily: FONT_MONO,
          fontSize: "0.62rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "text.secondary",
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: FONT_MONO,
          fontSize: "1.65rem",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: accent || "text.primary",
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography
          sx={{
            fontFamily: FONT_MONO,
            fontSize: "0.62rem",
            color: "text.secondary",
            mt: 0.4,
            letterSpacing: "0.04em",
          }}
        >
          {sub}
        </Typography>
      )}
    </Box>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

type Props = {
  systems: ComputeSystem[]
  bookings: BookingRecord[]
}

export function MissionControlDashboard({ systems, bookings }: Props) {
  const theme = useTheme()
  const dark  = theme.palette.mode === "dark"
  const nowMs = Date.now()
  const { dayStart, dayEnd } = dayWindow()

  // ── fleet stats ──────────────────────────────────────────────────────────────
  const activeSystems = systems.filter((s) => s.status === "ACTIVE")
  const activeBookings = bookings.filter((b) => isNowActive(b, nowMs))

  const fleetGpuPct = (() => {
    const total = activeSystems.reduce((s, sys) => s + (sys.gpu_units ?? 0), 0)
    if (!total) return 0
    const used = activeBookings.reduce((s, b) => {
      if (activeSystems.find((sys) => sys.id === b.system_id)) return s + b.req_gpu
      return s
    }, 0)
    return Math.round((used / total) * 100)
  })()

  const fleetCpuPct = (() => {
    const total = activeSystems.reduce((s, sys) => s + (sys.cpu_cores ?? 0), 0)
    if (!total) return 0
    const used = activeBookings.reduce((s, b) => {
      if (activeSystems.find((sys) => sys.id === b.system_id)) return s + b.req_cpu
      return s
    }, 0)
    return Math.round((used / total) * 100)
  })()

  // ── timeline ─────────────────────────────────────────────────────────────────
  const todayBookings = bookings.filter(
    (b) => !["CANCELLED", "EXPIRED"].includes(b.status) && overlapsDay(b, dayStart, dayEnd)
  )

  const systemsWithActivity = systems.filter((sys) =>
    todayBookings.some((b) => b.system_id === sys.id)
  )
  const nowPct = Math.max(0, Math.min(100, ((nowMs - dayStart) / DAY_MS) * 100))

  // ── alerts ────────────────────────────────────────────────────────────────────
  const highGpu = systems.filter((sys) => {
    const used = activeBookings.filter((b) => b.system_id === sys.id).reduce((s, b) => s + b.req_gpu, 0)
    return sys.gpu_units && (used / sys.gpu_units) >= 0.8
  })
  const offline = systems.filter((s) => s.status === "OFFLINE")

  // ── tick labels ───────────────────────────────────────────────────────────────
  const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

  const borderColor = dark ? "rgba(228,228,226,0.07)" : "#E4E4E2"
  const gridColor   = dark ? "rgba(228,228,226,0.04)" : "rgba(0,0,0,0.04)"

  return (
    <Stack spacing={0}>
      {/* ── stat row ─────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          borderBottom: `1px solid ${borderColor}`,
          mb: 0,
        }}
      >
        <StatCard
          label="Fleet GPU"
          value={`${fleetGpuPct}%`}
          sub={`${activeSystems.reduce((s, sys) => s + (sys.gpu_units ?? 0), 0)} total units`}
          accent={fleetGpuPct >= 80 ? OKLCH_RED : fleetGpuPct >= 50 ? OKLCH_AMBER : undefined}
          dark={dark}
        />
        <StatCard
          label="Fleet CPU"
          value={`${fleetCpuPct}%`}
          sub={`${activeSystems.reduce((s, sys) => s + (sys.cpu_cores ?? 0), 0)} total cores`}
          accent={fleetCpuPct >= 80 ? OKLCH_RED : fleetCpuPct >= 50 ? OKLCH_AMBER : undefined}
          dark={dark}
        />
        <StatCard
          label="Active bookings"
          value={`${activeBookings.length}`}
          sub={`${activeBookings.filter((b) => b.access_type === "FOREGROUND").length} fg · ${activeBookings.filter((b) => b.access_type === "BACKGROUND").length} bg`}
          dark={dark}
        />
        <StatCard
          label="Systems online"
          value={`${activeSystems.length}/${systems.length}`}
          sub={systems.filter((s) => s.status === "MAINTENANCE").length > 0 ? `${systems.filter((s) => s.status === "MAINTENANCE").length} in maintenance` : "all healthy"}
          accent={activeSystems.length < systems.length ? OKLCH_AMBER : OKLCH_TEAL}
          dark={dark}
        />
      </Box>

      {/* ── gantt timeline ───────────────────────────────────────────────────── */}
      <Box sx={{ pt: 2, px: 0 }}>
        {/* Header */}
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1, px: 2 }}>
          <Typography
            sx={{
              fontFamily: FONT_MONO,
              fontSize: "0.65rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "text.secondary",
            }}
          >
            Temporal allocation · Fleet timeline · {fmtDate(dayStart)}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {/* Legend */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            {[
              { label: "confirmed", color: OKLCH_BLUE,  border: "solid" },
              { label: "requested", color: OKLCH_AMBER, border: "dashed" },
              { label: "preempted", color: OKLCH_RED,   border: "solid" },
              { label: "completed", color: "oklch(0.62 0.0 0)", border: "solid" },
            ].map(({ label, color, border }) => (
              <Stack key={label} direction="row" alignItems="center" spacing={0.5}>
                <Box
                  sx={{
                    width: 14,
                    height: 8,
                    border: `1px ${border} ${color}`,
                    backgroundColor: `color-mix(in oklch, ${color} 30%, transparent)`,
                  }}
                />
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: "0.58rem", color: "text.secondary", letterSpacing: "0.04em" }}>
                  {label}
                </Typography>
              </Stack>
            ))}
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Box sx={{ width: 14, height: 8, borderLeft: `3px solid ${OKLCH_BLUE}`, borderTop: `1px solid ${OKLCH_BLUE}`, borderBottom: `1px solid ${OKLCH_BLUE}`, borderRight: `1px solid ${OKLCH_BLUE}`, backgroundColor: `color-mix(in oklch, ${OKLCH_BLUE} 60%, transparent)` }} />
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: "0.58rem", color: "text.secondary", letterSpacing: "0.04em" }}>foreground</Typography>
            </Stack>
          </Stack>
        </Stack>

        {/* Grid area */}
        {systemsWithActivity.length > 0 ? (
          <Box sx={{ position: "relative" }}>
            {/* Hour grid columns */}
            {TICKS.map((h) => (
              <Box
                key={h}
                sx={{
                  position: "absolute",
                  left: `calc(120px + ${(h / 24) * 100}% - ${(h / 24) * 120}px)`,
                  top: 0,
                  bottom: 24,
                  width: "1px",
                  background: gridColor,
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              />
            ))}

            {/* NOW marker */}
            <Box
              sx={{
                position: "absolute",
                left: `calc(120px + ${nowPct}% * (100% - 120px) / 100%)`,
                top: 0,
                bottom: 24,
                width: "1px",
                background: `color-mix(in oklch, ${OKLCH_BLUE} 60%, transparent)`,
                borderLeft: `1px dashed ${OKLCH_BLUE}`,
                pointerEvents: "none",
                zIndex: 5,
              }}
            />

            {/* System rows */}
            {systemsWithActivity.map((sys, idx) => {
              const sysBookings = todayBookings.filter((b) => b.system_id === sys.id)
              return (
                <Box
                  key={sys.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    minHeight: 36,
                    borderTop: idx === 0 ? `1px solid ${borderColor}` : "none",
                    borderBottom: `1px solid ${borderColor}`,
                    "&:hover": {
                      background: dark ? "rgba(228,228,226,0.02)" : "rgba(0,0,0,0.015)",
                    },
                  }}
                >
                  {/* System label */}
                  <Box
                    sx={{
                      width: 120,
                      flexShrink: 0,
                      px: 2,
                      pr: 1.5,
                      borderRight: `1px solid ${borderColor}`,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: FONT_MONO,
                        fontSize: "0.65rem",
                        fontWeight: 500,
                        color: "text.primary",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sys.name}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: FONT_MONO,
                        fontSize: "0.55rem",
                        color: "text.secondary",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {sys.gpu_units ? `${sys.gpu_units}× GPU` : "CPU"}
                    </Typography>
                  </Box>

                  {/* Booking bars */}
                  <Box sx={{ flex: 1, position: "relative", height: 36, overflow: "visible" }}>
                    {sysBookings.map((b) => {
                      const bStart = +new Date(b.start_time)
                      const bEnd   = +new Date(b.end_time)
                      const rawLeft  = ((bStart - dayStart) / DAY_MS) * 100
                      const rawWidth = ((bEnd   - bStart)  / DAY_MS) * 100
                      const leftPct  = Math.max(0, rawLeft)
                      const widthPct = Math.max(
                        0.3,
                        Math.min(100 - leftPct, rawLeft < 0 ? rawWidth + rawLeft : rawWidth)
                      )
                      const isFg = b.access_type === "FOREGROUND"
                      const barH = isFg ? 24 : 16

                      return (
                        <Tooltip
                          key={b.id}
                          title={
                            <Stack spacing={0.3}>
                              <span style={{ fontWeight: 600 }}>{b.project_title || `#${b.id}`}</span>
                              <span>{b.status} · {b.access_type}</span>
                              <span>{fmtTime(bStart)} – {fmtTime(bEnd)}</span>
                              {b.academic_category && <span>{b.academic_category}</span>}
                            </Stack>
                          }
                          arrow
                          placement="top"
                        >
                          <Box
                            className="booking-bar"
                            sx={{
                              position: "absolute",
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              height: barH,
                              top: "50%",
                              transform: "translateY(-50%)",
                              cursor: "default",
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              px: "3px",
                              ...bookingBarStyle(b, dark),
                            }}
                          >
                            <Typography
                              noWrap
                              sx={{
                                fontFamily: FONT_MONO,
                                fontSize: "0.55rem",
                                color: dark ? "rgba(242,242,241,0.9)" : "rgba(24,24,27,0.9)",
                                letterSpacing: "0.02em",
                                lineHeight: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {b.project_title || `#${b.id}`}
                            </Typography>
                          </Box>
                        </Tooltip>
                      )
                    })}
                  </Box>
                </Box>
              )
            })}

            {/* Hour tick labels */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                pt: 0.5,
                pb: 0.5,
              }}
            >
              <Box sx={{ width: 120, flexShrink: 0 }} />
              <Box sx={{ flex: 1, position: "relative", height: 16 }}>
                {TICKS.map((h) => (
                  <Typography
                    key={h}
                    sx={{
                      position: "absolute",
                      left: `${(h / 24) * 100}%`,
                      transform: "translateX(-50%)",
                      fontFamily: FONT_MONO,
                      fontSize: "0.58rem",
                      color: "text.secondary",
                      letterSpacing: "0.04em",
                      userSelect: "none",
                    }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </Typography>
                ))}
                {/* NOW label */}
                <Typography
                  sx={{
                    position: "absolute",
                    left: `${nowPct}%`,
                    transform: "translateX(-50%)",
                    fontFamily: FONT_MONO,
                    fontSize: "0.55rem",
                    color: OKLCH_BLUE,
                    letterSpacing: "0.04em",
                    userSelect: "none",
                    fontWeight: 600,
                  }}
                >
                  NOW
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ px: 2, py: 4, textAlign: "center", borderTop: `1px solid ${borderColor}` }}>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: "0.7rem", color: "text.secondary", letterSpacing: "0.06em" }}>
              NO BOOKINGS TODAY
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── alerts ───────────────────────────────────────────────────────────── */}
      {(highGpu.length > 0 || offline.length > 0) && (
        <Stack spacing={1} sx={{ pt: 2, px: 0 }}>
          {highGpu.length > 0 && (
            <Alert severity="warning" sx={{ py: 0.5, borderRadius: 0, border: `1px solid ${OKLCH_AMBER}`, background: `color-mix(in oklch, ${OKLCH_AMBER} 8%, transparent)` }}>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: "0.72rem" }}>
                GPU ≥ 80% — {highGpu.map((s) => s.name).join(", ")}
              </Typography>
            </Alert>
          )}
          {offline.length > 0 && (
            <Alert severity="error" sx={{ py: 0.5, borderRadius: 0, border: `1px solid ${CLR_RED}`, background: `color-mix(in oklch, ${OKLCH_RED} 8%, transparent)` }}>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: "0.72rem" }}>
                Offline — {offline.map((s) => s.name).join(", ")}
              </Typography>
            </Alert>
          )}
        </Stack>
      )}
    </Stack>
  )
}
