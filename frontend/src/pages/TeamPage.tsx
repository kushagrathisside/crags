import { GroupsRounded } from "@mui/icons-material"
import { Box, Chip, Stack, Typography } from "@mui/material"
import { ErrorBoundary } from "../components/ErrorBoundary"
import { TeamManagementPanel } from "../components/panels/TeamManagementPanel"
import { useCurrentUserQuery } from "../hooks/useCurrentUserQuery"
import { FONT_MONO } from "../theme"

export function TeamPage() {
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
              borderRadius: "8px",
              background: "action.hover",
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
            variant="outlined"
            sx={{ fontFamily: FONT_MONO, color: "text.secondary" }}
          />
        </Stack>

        <ErrorBoundary>
          <TeamManagementPanel currentRole={role} />
        </ErrorBoundary>
      </Stack>
    </Box>
  )
}
