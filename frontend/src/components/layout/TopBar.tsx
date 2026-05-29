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
        background: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: "text.primary",
      }}
    >
      <Toolbar sx={{ gap: 1.5, minHeight: "64px !important" }}>
        {/* Page title */}
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 500, color: "text.primary" }}>
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
                  background: "success.main",
                  flexShrink: 0,
                }}
              />
              <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: FONT_MONO, fontWeight: 500 }}>
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
          variant="outlined"
          sx={{
            fontFamily: FONT_MONO,
            fontSize: "0.68rem",
            height: 26,
            color: "text.secondary",
          }}
        />
      </Toolbar>
    </AppBar>
  )
}
