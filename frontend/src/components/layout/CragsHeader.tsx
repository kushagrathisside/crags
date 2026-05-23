import { Box, Chip, Stack, Typography } from "@mui/material"

type CragsHeaderProps = {
  systemsCount: number
  apiBaseUrl: string
}

export function CragsHeader({ systemsCount, apiBaseUrl }: CragsHeaderProps) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="overline" sx={{ letterSpacing: 1.4 }}>
        Research Infrastructure Governance
      </Typography>
      <Typography variant="h4" component="h1" fontWeight={700}>
        Compute Resource Allocation and Governance System
      </Typography>
      <Typography color="text.secondary" maxWidth={860}>
        Temporal scheduling, hard resource constraints, and policy outcomes are surfaced in one control plane. All
        booking decisions are backend-authoritative.
      </Typography>
      <Box display="flex" gap={1} flexWrap="wrap">
        <Chip label={`Systems: ${systemsCount}`} color="primary" variant="outlined" />
        <Chip label="Time model: UTC authoritative" variant="outlined" />
        <Chip label={`API: ${apiBaseUrl}`} variant="outlined" />
      </Box>
    </Stack>
  )
}
