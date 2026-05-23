import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  MenuItem,
  Slider,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material"
import { useMemo, useState } from "react"
import { formatLocal, formatUtc } from "../../lib/time"
import type { ExplainableError, AccessType, AvailabilitySnapshot, BookingRequest, ComputeSystem, ValidationIssue } from "../../types/crags"
import type { SimulationResult } from "../../utils/simulateBooking"

export type BookingDraft = {
  systemId: number | null
  startLocal: string
  endLocal: string
  reqCpu: number
  reqGpu: number
  reqRam: number
  reqVram: number
  accessType: AccessType
  academicCategory: string
  projectTitle: string
  expectedDeliverable: string
  objective: string
}

type Props = {
  systems: ComputeSystem[]
  draft: BookingDraft
  startUtcIso: string
  endUtcIso: string
  issues: ValidationIssue[]
  busy: boolean
  backendMessage: string | null
  availability: AvailabilitySnapshot | null
  availabilityLoading: boolean
  availabilityError: string | null
  simulation: SimulationResult | null
  explainableError: ExplainableError | null
  apiValidated: boolean
  onChange: (next: BookingDraft) => void
  onSubmit: () => void
}

const steps = [
  "System",
  "Time",
  "Resources",
  "Access",
  "Metadata",
  "Impact Preview",
  "Submit",
]

export function draftToBookingPayload(draft: BookingDraft, startUtcIso: string, endUtcIso: string): BookingRequest | null {
  if (draft.systemId === null) {
    return null
  }

  return {
    system_id: draft.systemId,
    start_time: startUtcIso,
    end_time: endUtcIso,
    req_cpu: draft.reqCpu,
    req_gpu: draft.reqGpu,
    req_ram: draft.reqRam,
    req_vram: draft.reqVram,
    access_type: draft.accessType,
    academic_category: draft.academicCategory,
    project_title: draft.projectTitle,
    expected_deliverable: draft.expectedDeliverable,
    objective: draft.objective,
  }
}

function stepHasBlockingIssue(stepIndex: number, draft: BookingDraft, issues: ValidationIssue[]): boolean {
  if (stepIndex === 0) {
    return draft.systemId === null || issues.some((issue) => issue.field === "system")
  }

  if (stepIndex === 1) {
    return issues.some((issue) => issue.field === "time")
  }

  if (stepIndex === 2) {
    return issues.some((issue) => issue.field === "resources")
  }

  if (stepIndex === 4) {
    return issues.some((issue) => issue.field === "project" || issue.field === "objective")
  }

  return false
}

function hoursBetween(startLocal: string, endLocal: string): number {
  const start = new Date(startLocal)
  const end = new Date(endLocal)

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return 1
  }

  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000)))
}

function shiftHours(localValue: string, offsetHours: number): string {
  const date = new Date(localValue)
  if (!Number.isFinite(date.getTime())) {
    return localValue
  }

  date.setHours(date.getHours() + offsetHours)

  const pad = (value: number) => String(value).padStart(2, "0")

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

export function BookingRequestForm({
  systems,
  draft,
  startUtcIso,
  endUtcIso,
  issues,
  busy,
  backendMessage,
  availability,
  availabilityLoading,
  availabilityError,
  simulation,
  explainableError,
  apiValidated,
  onChange,
  onSubmit,
}: Props) {
  const [activeStep, setActiveStep] = useState(0)

  const durationHours = useMemo(() => hoursBetween(draft.startLocal, draft.endLocal), [draft.startLocal, draft.endLocal])

  const hasBlockingIssues = issues.length > 0
  const canAdvance = !stepHasBlockingIssue(activeStep, draft, issues)
  const canSubmit = !hasBlockingIssues && apiValidated && !busy

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Booking Wizard</Typography>

          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {backendMessage ? <Alert severity="success">{backendMessage}</Alert> : null}

          {issues.length ? (
            <Alert severity="warning">
              {issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | ")}
            </Alert>
          ) : null}

          {availabilityLoading ? (
            <Alert severity="info" icon={<CircularProgress size={16} />}>
              Revalidating availability for current selection...
            </Alert>
          ) : null}

          {availabilityError ? <Alert severity="warning">{availabilityError}</Alert> : null}

          {activeStep === 0 ? (
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  select
                  label="Compute System"
                  value={draft.systemId ?? ""}
                  onChange={(event) => onChange({ ...draft, systemId: Number(event.target.value) })}
                >
                  {systems.map((system) => (
                    <MenuItem key={system.id} value={system.id}>
                      {system.name} ({system.system_type}) · {system.cpu_cores} CPU / {system.gpu_units} GPU
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          ) : null}

          {activeStep === 1 ? (
            <Stack spacing={1.5}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Start (local)"
                    type="datetime-local"
                    value={draft.startLocal}
                    InputLabelProps={{ shrink: true }}
                    onChange={(event) => onChange({ ...draft, startLocal: event.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="End (local)"
                    type="datetime-local"
                    value={draft.endLocal}
                    InputLabelProps={{ shrink: true }}
                    onChange={(event) => onChange({ ...draft, endLocal: event.target.value })}
                  />
                </Grid>
              </Grid>

              <Box>
                <Typography gutterBottom>Duration (timeline interaction)</Typography>
                <Slider
                  value={durationHours}
                  min={1}
                  max={72}
                  step={1}
                  valueLabelDisplay="on"
                  onChange={(_, value) => {
                    const hours = Number(Array.isArray(value) ? value[0] : value)
                    const nextEnd = shiftHours(draft.startLocal, hours)
                    onChange({ ...draft, endLocal: nextEnd })
                  }}
                />
              </Box>

              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => onChange({ ...draft, startLocal: shiftHours(draft.startLocal, -1), endLocal: shiftHours(draft.endLocal, -1) })}>
                  Shift -1h
                </Button>
                <Button variant="outlined" onClick={() => onChange({ ...draft, startLocal: shiftHours(draft.startLocal, 1), endLocal: shiftHours(draft.endLocal, 1) })}>
                  Shift +1h
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {activeStep === 2 ? (
            <Stack spacing={1.2}>
              <Typography variant="body2" color="text.secondary">
                Use sliders to allocate resources for this booking request.
              </Typography>

              <Box>
                <Typography gutterBottom>CPU: {draft.reqCpu}</Typography>
                <Slider value={draft.reqCpu} min={1} max={256} step={1} valueLabelDisplay="auto" onChange={(_, value) => onChange({ ...draft, reqCpu: Number(Array.isArray(value) ? value[0] : value) })} />
              </Box>

              <Box>
                <Typography gutterBottom>GPU: {draft.reqGpu}</Typography>
                <Slider value={draft.reqGpu} min={0} max={32} step={1} valueLabelDisplay="auto" onChange={(_, value) => onChange({ ...draft, reqGpu: Number(Array.isArray(value) ? value[0] : value) })} />
              </Box>

              <Box>
                <Typography gutterBottom>RAM GB: {draft.reqRam}</Typography>
                <Slider value={draft.reqRam} min={1} max={2048} step={1} valueLabelDisplay="auto" onChange={(_, value) => onChange({ ...draft, reqRam: Number(Array.isArray(value) ? value[0] : value) })} />
              </Box>

              <Box>
                <Typography gutterBottom>VRAM GB: {draft.reqVram}</Typography>
                <Slider value={draft.reqVram} min={0} max={1024} step={1} valueLabelDisplay="auto" onChange={(_, value) => onChange({ ...draft, reqVram: Number(Array.isArray(value) ? value[0] : value) })} />
              </Box>
            </Stack>
          ) : null}

          {activeStep === 3 ? (
            <TextField
              fullWidth
              select
              label="Access Type"
              value={draft.accessType}
              onChange={(event) => onChange({ ...draft, accessType: event.target.value as AccessType })}
            >
              <MenuItem value="BACKGROUND">BACKGROUND (non-preemptive)</MenuItem>
              <MenuItem value="FOREGROUND">FOREGROUND (may preempt background)</MenuItem>
            </TextField>
          ) : null}

          {activeStep === 4 ? (
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Academic Category"
                  value={draft.academicCategory}
                  onChange={(event) => onChange({ ...draft, academicCategory: event.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Project Title"
                  value={draft.projectTitle}
                  onChange={(event) => onChange({ ...draft, projectTitle: event.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Expected Deliverable"
                  value={draft.expectedDeliverable}
                  onChange={(event) => onChange({ ...draft, expectedDeliverable: event.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Objective"
                  value={draft.objective}
                  onChange={(event) => onChange({ ...draft, objective: event.target.value })}
                />
              </Grid>
            </Grid>
          ) : null}

          {activeStep === 5 ? (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Impact Preview</Typography>

              <Alert severity={simulation?.feasible ? "success" : "error"}>
                {simulation?.feasible ? "Simulation indicates request is feasible." : "Simulation indicates policy/capacity risk."}
              </Alert>

              <Typography variant="body2" color="text.secondary">
                Confidence: {apiValidated ? "API-validated" : "Simulation-based (pending API validation)"}
              </Typography>

              {availability ? (
                <Typography variant="body2" color="text.secondary">
                  Availability snapshot: CPU {availability.cpu_available}, GPU {availability.gpu_available}, RAM {availability.ram_available}, VRAM {availability.vram_available}
                </Typography>
              ) : null}

              {simulation?.violations.length ? (
                <Alert severity="warning">
                  {simulation.violations.map((violation) => `${violation.type.toUpperCase()}: ${violation.message}`).join(" | ")}
                </Alert>
              ) : null}

              {explainableError ? (
                <Alert severity="error">
                  Why rejected: {explainableError.whyRejected}
                  <br />
                  Cause: {explainableError.cause}
                </Alert>
              ) : null}
            </Stack>
          ) : null}

          {activeStep === 6 ? (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Submission Summary</Typography>
              <Typography variant="body2">
                System: {systems.find((system) => system.id === draft.systemId)?.name ?? "-"}
              </Typography>
              <Typography variant="body2">
                Time: {startUtcIso ? formatUtc(startUtcIso) : "-"} → {endUtcIso ? formatUtc(endUtcIso) : "-"}
              </Typography>
              <Typography variant="body2">
                Resources: CPU {draft.reqCpu}, GPU {draft.reqGpu}, RAM {draft.reqRam}, VRAM {draft.reqVram}
              </Typography>
              <Typography variant="body2">Access: {draft.accessType}</Typography>
              <Typography variant="body2" color="text.secondary">
                Local display: {startUtcIso ? formatLocal(startUtcIso) : "-"} → {endUtcIso ? formatLocal(endUtcIso) : "-"}
              </Typography>
              {!apiValidated ? <Alert severity="warning">Submission blocked until availability catches up with the current form state.</Alert> : null}
            </Stack>
          ) : null}

          <Stack direction="row" spacing={1} justifyContent="space-between" flexWrap="wrap">
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" disabled={activeStep === 0} onClick={() => setActiveStep((step) => Math.max(0, step - 1))}>
                Back
              </Button>
              <Button
                variant="outlined"
                disabled={activeStep >= steps.length - 1 || !canAdvance}
                onClick={() => setActiveStep((step) => Math.min(steps.length - 1, step + 1))}
              >
                Next
              </Button>
            </Stack>

            <Button variant="contained" disabled={!canSubmit || activeStep !== steps.length - 1} onClick={onSubmit}>
              {busy ? "Submitting..." : "Submit to Scheduler"}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
