import { AddCircleOutlineRounded, DnsRounded } from "@mui/icons-material"
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material"
import { ErrorBoundary } from "../components/ErrorBoundary"
import { SystemRegistrationForm } from "../components/forms/SystemRegistrationForm"
import { SystemInventoryPanel } from "../components/panels/SystemInventoryPanel"
import { MaintenanceWindowsPanel } from "../components/panels/MaintenanceWindowsPanel"
import { useCurrentUserQuery } from "../hooks/useCurrentUserQuery"
import { useSystemsQuery } from "../hooks/useSystemsQuery"
import { FONT_MONO } from "../theme"

export function SystemsPage() {
  const currentUserQuery = useCurrentUserQuery()
  const systemsQuery     = useSystemsQuery(Boolean(currentUserQuery.data))
  const systems          = systemsQuery.data ?? []
  const role             = currentUserQuery.data?.role ?? "MEMBER"

  const active = systems.filter((s) => s.status === "ACTIVE").length
  const total  = systems.length

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Page header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: "8px",
              background: "action.hover",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "primary.main",
            }}
          >
            <DnsRounded fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Compute Systems
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: FONT_MONO }}>
              {active}/{total} active
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            label={`${total} systems`}
            size="small"
            variant="outlined"
            sx={{ fontFamily: FONT_MONO, color: "text.secondary" }}
          />
        </Stack>

        {systemsQuery.isLoading && <LinearProgress />}
        {systemsQuery.isError && (
          <Alert severity="error">Unable to load systems. Check backend connectivity.</Alert>
        )}

        <Grid container spacing={3}>
          {/* Inventory */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={3}>
              <ErrorBoundary>
                <SystemInventoryPanel systems={systems} currentRole={role} />
              </ErrorBoundary>
              {(role === "RESOURCE_ADMIN" || role === "SUPER_ADMIN") && (
                <ErrorBoundary>
                  <MaintenanceWindowsPanel systems={systems} />
                </ErrorBoundary>
              )}
            </Stack>
          </Grid>

          {/* Registration */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <AddCircleOutlineRounded fontSize="small" sx={{ color: "secondary.main" }} />
                  <Typography variant="subtitle2" sx={{ fontFamily: FONT_MONO, color: "text.secondary" }}>
                    REGISTER SYSTEM
                  </Typography>
                </Stack>
                <ErrorBoundary>
                  <SystemRegistrationForm />
                </ErrorBoundary>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  )
}
