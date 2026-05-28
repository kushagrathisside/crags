import { Box, LinearProgress } from "@mui/material"
import { useState } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useCurrentUserQuery } from "../../hooks/useCurrentUserQuery"
import { useLogoutMutation } from "../../hooks/useLogoutMutation"
import { useSystemsQuery } from "../../hooks/useSystemsQuery"
import { Sidebar, SIDEBAR_COLLAPSED, SIDEBAR_EXPANDED } from "./Sidebar"
import { TopBar } from "./TopBar"

export function AppShell() {
  const currentUserQuery = useCurrentUserQuery()
  const logoutMutation = useLogoutMutation()
  const [expanded, setExpanded] = useState(true)

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

  async function handleLogout() {
    await logoutMutation.mutateAsync()
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        role={user.role}
        onLogout={() => void handleLogout()}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          ml: `${sidebarWidth}px`,
          transition: (t) =>
            t.transitions.create("margin-left", {
              easing: t.transitions.easing.sharp,
              duration: t.transitions.duration.leavingScreen,
            }),
        }}
      >
        <TopBar sidebarWidth={sidebarWidth} user={user} liveCount={liveCount} />

        {/* Page content below fixed TopBar */}
        <Box sx={{ flexGrow: 1, pt: "64px" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
