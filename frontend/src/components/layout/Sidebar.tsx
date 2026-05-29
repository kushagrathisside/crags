import {
  BarChartRounded,
  BoltRounded,
  ChevronLeftRounded,
  DnsRounded,
  EventNoteRounded,
  GridViewRounded,
  GroupsRounded,
  InsightsRounded,
  LogoutRounded,
  MenuRounded,
} from "@mui/icons-material"
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { useNavigate, useLocation } from "react-router-dom"
import type { UserRole } from "../../types/crags"

export const SIDEBAR_EXPANDED = 228
export const SIDEBAR_COLLAPSED = 64

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
  visible: (role: UserRole) => boolean
}

const NAV: NavItem[] = [
  {
    path: "/",
    label: "Dashboard",
    icon: <GridViewRounded fontSize="small" />,
    visible: () => true,
  },
  {
    path: "/scheduler",
    label: "Scheduler",
    icon: <EventNoteRounded fontSize="small" />,
    visible: () => true,
  },
  {
    path: "/systems",
    label: "Systems",
    icon: <DnsRounded fontSize="small" />,
    visible: (r) => r === "RESOURCE_ADMIN" || r === "SUPER_ADMIN",
  },
  {
    path: "/monitoring",
    label: "Monitoring",
    icon: <BarChartRounded fontSize="small" />,
    visible: (r) => r !== "MEMBER",
  },
  {
    path: "/analytics",
    label: "Analytics",
    icon: <InsightsRounded fontSize="small" />,
    visible: (r) => r !== "MEMBER",
  },
  {
    path: "/team",
    label: "Team",
    icon: <GroupsRounded fontSize="small" />,
    visible: (r) => r === "RESOURCE_ADMIN" || r === "SUPER_ADMIN",
  },
]

interface Props {
  expanded: boolean
  onToggle: () => void
  role: UserRole
  onLogout: () => void
}

export function Sidebar({ expanded, onToggle, role, onLogout }: Props) {
  const theme = useTheme()
  const dark = theme.palette.mode === "dark"
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const width = expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width,
          overflowX: "hidden",
          transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          height: 56,
          display: "flex",
          alignItems: "center",
          px: expanded ? 2 : 1.5,
          gap: 1.5,
          borderBottom: `1px solid ${dark ? "rgba(228,228,226,0.07)" : "#E4E4E2"}`,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "4px",
            background: "oklch(0.62 0.19 255)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <BoltRounded sx={{ fontSize: 16, color: "#fff" }} />
        </Box>
        {expanded && (
          <Box>
            <Typography
              sx={{
                fontFamily: '"Roboto Mono", monospace',
                color: "text.primary",
                lineHeight: 1.1,
                fontWeight: 600,
                letterSpacing: "0.06em",
                fontSize: "0.72rem",
                textTransform: "uppercase",
              }}
            >
              CRAGS
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.58rem", lineHeight: 1, fontFamily: '"Roboto Mono", monospace', letterSpacing: "0.04em" }}>
              compute control
            </Typography>
          </Box>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title={expanded ? "Collapse" : "Expand"} placement="right">
          <IconButton size="small" onClick={onToggle} sx={{ flexShrink: 0 }}>
            {expanded ? (
              <ChevronLeftRounded fontSize="small" />
            ) : (
              <MenuRounded fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Nav items */}
      <List sx={{ px: 0.5, pt: 1.5, flexGrow: 1 }}>
        {NAV.filter((item) => item.visible(role)).map((item) => {
          const active = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)
          return (
            <Tooltip key={item.path} title={expanded ? "" : item.label} placement="right">
              <ListItemButton
                selected={active}
                onClick={() => navigate(item.path)}
                sx={{
                  minHeight: 44,
                  px: expanded ? 2 : 1.5,
                  justifyContent: expanded ? "flex-start" : "center",
                  mb: 0.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: expanded ? 1.5 : 0,
                    color: active ? "primary.main" : "text.secondary",
                    transition: "color 0.2s",
                    filter: "none",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {expanded && (
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        fontSize: "0.875rem",
                        fontWeight: active ? 600 : 400,
                        color: active ? "primary.main" : "text.primary",
                      },
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          )
        })}
      </List>

      {/* Footer — logout */}
      <Box
        sx={{
          borderTop: `1px solid ${dark ? "rgba(228,228,226,0.07)" : "#E4E4E2"}`,
          p: 1,
        }}
      >
        <Tooltip title={expanded ? "" : "Sign out"} placement="right">
          <ListItemButton
            onClick={onLogout}
            sx={{
              minHeight: 44,
              px: expanded ? 2 : 1.5,
              justifyContent: expanded ? "flex-start" : "center",
              borderRadius: 2,
              color: "text.secondary",
              "&:hover": { color: "error.main" },
            }}
          >
            <ListItemIcon
              sx={{ minWidth: 0, mr: expanded ? 1.5 : 0, color: "inherit" }}
            >
              <LogoutRounded fontSize="small" />
            </ListItemIcon>
            {expanded && (
              <ListItemText
                primary="Sign out"
                slotProps={{ primary: { fontSize: "0.875rem", fontWeight: 500, color: "inherit" } }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Drawer>
  )
}
