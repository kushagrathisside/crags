import { Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "./components/layout/AppShell"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { LoginPage } from "./pages/LoginPage"
import { DashboardPage } from "./pages/DashboardPage"
import { SchedulerPage } from "./pages/SchedulerPage"
import { SystemsPage } from "./pages/SystemsPage"
import { MonitoringPage } from "./pages/MonitoringPage"
import { TeamPage } from "./pages/TeamPage"
import { AnalyticsPage } from "./pages/AnalyticsPage"
import { useCurrentUserQuery } from "./hooks/useCurrentUserQuery"

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { data: user } = useCurrentUserQuery()
  if (user && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />

          <Route path="/scheduler" element={<SchedulerPage />} />

          <Route
            path="/systems"
            element={
              <RequireRole roles={["RESOURCE_ADMIN", "SUPER_ADMIN"]}>
                <SystemsPage />
              </RequireRole>
            }
          />

          <Route
            path="/monitoring"
            element={
              <RequireRole roles={["GROUP_LEAD", "RESOURCE_ADMIN", "SUPER_ADMIN"]}>
                <MonitoringPage />
              </RequireRole>
            }
          />

          <Route
            path="/analytics"
            element={
              <RequireRole roles={["GROUP_LEAD", "RESOURCE_ADMIN", "SUPER_ADMIN"]}>
                <AnalyticsPage />
              </RequireRole>
            }
          />

          <Route
            path="/team"
            element={
              <RequireRole roles={["RESOURCE_ADMIN", "SUPER_ADMIN"]}>
                <TeamPage />
              </RequireRole>
            }
          />

          {/* Catch-all inside shell → dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

export default App
