import { Box, LinearProgress } from "@mui/material"
import { useCallback, useState } from "react"
import { Navigate, Outlet, useNavigate } from "react-router-dom"
import { useCurrentUserQuery } from "../../hooks/useCurrentUserQuery"
import { useLogoutMutation } from "../../hooks/useLogoutMutation"
import { useSystemsQuery } from "../../hooks/useSystemsQuery"
import { Sidebar, SIDEBAR_COLLAPSED, SIDEBAR_EXPANDED } from "./Sidebar"
import { TopBar } from "./TopBar"

export function AppShell() {
  const navigate = useNavigate()
  const currentUserQuery = useCurrentUserQuery()
  const [expanded, setExpanded] = useState(true)

  const handleLoggedOut = useCallback(
    () => navigate("/login", { replace: true }),
    [navigate],
  )
  const logoutMutation = useLogoutMutation(handleLoggedOut)

  const user = currentUserQuery.data ?? null
  const systemsQuery = useSystemsQuery(Boolean(user))

  if (currentUserQuery.isLoading) {
    return (
      <Box sx={{ width: "100%", position: "fixed", top: 0, zIndex: 9999 }}>
        <LinearProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const sidebarWidth = expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED
  const liveCount = (systemsQuery.data ?? []).filter((s) => s.status === "ACTIVE").length

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        role={user.role}
        onLogout={() => logoutMutation.mutate()}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <TopBar sidebarWidth={sidebarWidth} user={user} liveCount={liveCount} />

        <Box sx={{ flexGrow: 1, pt: "64px" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
