import { DarkModeRounded, LightModeRounded, NotificationsNoneRounded } from "@mui/icons-material"
import {
  AppBar,
  Box,
  Chip,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { useLocation } from "react-router-dom"
import { FONT_MONO } from "../../theme"
import { useThemeMode } from "../../context/ThemeContext"
import type { AuthUser } from "../../types/crags"

const PAGE_TITLES: Record<string, string> = {
  "/":           "Mission Control",
  "/scheduler":  "Scheduler",
  "/systems":    "Systems",
  "/monitoring": "Monitoring",
  "/team":       "Team & Quotas",
}

interface Props {
  sidebarWidth: number
  user: AuthUser
  liveCount?: number
}

export function TopBar({ sidebarWidth, user, liveCount }: Props) {
  const theme = useTheme()
  const dark = theme.palette.mode === "dark"
  const { toggle } = useThemeMode()
  const { pathname } = useLocation()

  const title = PAGE_TITLES[pathname] ?? "CRAGS"
  const gradient = "linear-gradient(135deg, #00B4D8 0%, #00E5A0 80%)"

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        ml: `${sidebarWidth}px`,
        width: `calc(100% - ${sidebarWidth}px)`,
        transition: theme.transitions.create(["width", "margin-left"], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
        background: dark
          ? "rgba(8,12,20,0.82)"
          : "rgba(240,249,255,0.88)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${dark ? "rgba(0,180,216,0.1)" : "rgba(0,119,182,0.08)"}`,
        color: "text.primary",
      }}
    >
      <Toolbar sx={{ gap: 1.5, minHeight: "64px !important" }}>
        {/* Page title */}
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography
            variant="h6"
            sx={{
              background: gradient,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </Typography>

          {/* Live indicator */}
          {liveCount !== undefined && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#00E5A0",
                  boxShadow: "0 0 8px rgba(0,229,160,0.8)",
                  flexShrink: 0,
                  position: "relative",
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: "#00E5A0",
                    animation: "pulse-ring 2s ease-out infinite",
                  },
                }}
              />
              <Typography variant="caption" sx={{ color: "#00E5A0", fontFamily: FONT_MONO, fontWeight: 600 }}>
                {liveCount} live
              </Typography>
            </Box>
          )}
        </Box>

        {/* Actions */}
        <Tooltip title="Notifications (coming soon)">
          <IconButton size="small" sx={{ color: "text.secondary" }}>
            <NotificationsNoneRounded fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={dark ? "Switch to light mode" : "Switch to dark mode"}>
          <IconButton size="small" onClick={toggle} sx={{ color: "text.secondary" }}>
            {dark ? <LightModeRounded fontSize="small" /> : <DarkModeRounded fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* User chip */}
        <Chip
          label={`${user.username} · ${user.role}`}
          size="small"
          sx={{
            fontFamily: FONT_MONO,
            fontSize: "0.68rem",
            height: 26,
            background: dark ? "rgba(0,180,216,0.12)" : "rgba(0,119,182,0.08)",
            border: `1px solid ${dark ? "rgba(0,180,216,0.25)" : "rgba(0,119,182,0.2)"}`,
            color: "primary.main",
          }}
        />
      </Toolbar>
    </AppBar>
  )
}
