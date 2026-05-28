import { GroupsRounded } from "@mui/icons-material"
import { Box, Chip, Stack, Typography, useTheme } from "@mui/material"
import { ErrorBoundary } from "../components/ErrorBoundary"
import { TeamManagementPanel } from "../components/panels/TeamManagementPanel"
import { useCurrentUserQuery } from "../hooks/useCurrentUserQuery"
import { FONT_MONO } from "../theme"

export function TeamPage() {
  const theme = useTheme()
  const dark  = theme.palette.mode === "dark"
  const currentUserQuery = useCurrentUserQuery()
  const role = currentUserQuery.data?.role ?? "MEMBER"

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Page header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: "10px",
              background: dark ? "rgba(0,229,160,0.1)" : "rgba(0,168,112,0.08)",
              border: `1px solid ${dark ? "rgba(0,229,160,0.22)" : "rgba(0,168,112,0.18)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "secondary.main",
            }}
          >
            <GroupsRounded fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Team &amp; Quotas
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: FONT_MONO }}>
              Groups · Members · Resource budgets
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            label={role}
            size="small"
            sx={{
              fontFamily: FONT_MONO,
              background: dark ? "rgba(0,229,160,0.1)" : "rgba(0,168,112,0.08)",
              border: `1px solid ${dark ? "rgba(0,229,160,0.2)" : "rgba(0,168,112,0.15)"}`,
              color: "secondary.main",
            }}
          />
        </Stack>

        <ErrorBoundary>
          <TeamManagementPanel currentRole={role} />
        </ErrorBoundary>
      </Stack>
    </Box>
  )
}
