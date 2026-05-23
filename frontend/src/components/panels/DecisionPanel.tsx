import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material"
import type { AvailabilitySnapshot, ExplainableError } from "../../types/crags"
import type { SimulationResult } from "../../utils/simulateBooking"

type Props = {
  simulation: SimulationResult | null
  availability: AvailabilitySnapshot | null
  apiValidated: boolean
  explainableError: ExplainableError | null
}

function pct(value: number, cap: number): number {
  if (cap <= 0) {
    return 0
  }

  return Math.min(100, (value / cap) * 100)
}

function severityFromSimulation(simulation: SimulationResult | null): "success" | "error" | "warning" {
  if (!simulation) {
    return "warning"
  }

  return simulation.feasible ? "success" : "error"
}

function violationIcon(type: string): string {
  if (type === "capacity") {
    return "[CAP]"
  }

  if (type === "policy") {
    return "[POL]"
  }

  return "[TIME]"
}

export function DecisionPanel({ simulation, availability, apiValidated, explainableError }: Props) {
  const severity = severityFromSimulation(simulation)

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Impact Preview
        </Typography>

        <Alert severity={severity} sx={{ mb: 1.5 }}>
          {simulation?.feasible ? "Feasibility: Allowed" : "Feasibility: Blocked"}
        </Alert>

        <Stack direction="row" spacing={1} mb={1.2}>
          <Chip
            size="small"
            label={apiValidated ? "Confidence: API-validated" : "Confidence: Simulation-based"}
            color={apiValidated ? "success" : "warning"}
            variant="outlined"
          />
          {availability ? <Chip size="small" label="Availability live" variant="outlined" /> : null}
        </Stack>

        {simulation?.violations.length ? (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Violations
            </Typography>
            <List dense sx={{ mb: 1 }}>
              {simulation.violations.map((violation, index) => (
                <ListItem key={`${violation.message}-${index}`} disableGutters>
                  <ListItemText primary={`${violationIcon(violation.type)} ${violation.message}`} secondary={violation.type} />
                </ListItem>
              ))}
            </List>
          </>
        ) : null}

        {simulation?.preemptions.length ? (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Preemptions
            </Typography>
            <List dense sx={{ mb: 1 }}>
              {simulation.preemptions.map((preemption) => (
                <ListItem key={preemption.booking_id} disableGutters>
                  <ListItemText
                    primary={`Booking #${preemption.booking_id} (${preemption.project_title})`}
                    secondary={`Freed GPU ${preemption.freed_gpu} · impact ${preemption.start_time} to ${preemption.end_time}`}
                  />
                </ListItem>
              ))}
            </List>
          </>
        ) : null}

        {simulation ? (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Resource Usage (Before vs After)
            </Typography>

            <Typography variant="caption">CPU</Typography>
            <LinearProgress variant="determinate" value={pct(simulation.projected_usage.before.cpu, simulation.projected_usage.capacity.cpu)} sx={{ mb: 0.4 }} />
            <LinearProgress variant="determinate" color="secondary" value={pct(simulation.projected_usage.after.cpu, simulation.projected_usage.capacity.cpu)} sx={{ mb: 1 }} />

            <Typography variant="caption">GPU</Typography>
            <LinearProgress variant="determinate" value={pct(simulation.projected_usage.before.gpu, simulation.projected_usage.capacity.gpu)} sx={{ mb: 0.4 }} />
            <LinearProgress variant="determinate" color="secondary" value={pct(simulation.projected_usage.after.gpu, simulation.projected_usage.capacity.gpu)} sx={{ mb: 1 }} />

            <Typography variant="caption">RAM</Typography>
            <LinearProgress variant="determinate" value={pct(simulation.projected_usage.before.ram, simulation.projected_usage.capacity.ram)} sx={{ mb: 0.4 }} />
            <LinearProgress variant="determinate" color="secondary" value={pct(simulation.projected_usage.after.ram, simulation.projected_usage.capacity.ram)} sx={{ mb: 1 }} />

            <Typography variant="caption">VRAM</Typography>
            <LinearProgress variant="determinate" value={pct(simulation.projected_usage.before.vram, simulation.projected_usage.capacity.vram)} sx={{ mb: 0.4 }} />
            <LinearProgress variant="determinate" color="secondary" value={pct(simulation.projected_usage.after.vram, simulation.projected_usage.capacity.vram)} sx={{ mb: 1 }} />
          </Box>
        ) : (
          <Typography color="text.secondary">No simulation available for current request.</Typography>
        )}

        {explainableError ? (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            <strong>{explainableError.title}</strong>
            <br />
            Why: {explainableError.whyRejected}
            <br />
            Cause: {explainableError.cause}
            <br />
            How to fix: {explainableError.fixes.join(" | ")}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
