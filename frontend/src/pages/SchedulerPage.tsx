import { Alert, Box, Grid, LinearProgress, Stack } from "@mui/material"
import axios from "axios"
import { useEffect, useMemo, useState } from "react"
import { BookingRequestForm, type BookingDraft, draftToBookingPayload } from "../components/forms/BookingRequestForm"
import { ResourceConstraintChart } from "../components/charts/ResourceConstraintChart"
import { TemporalGantt } from "../components/charts/TemporalGantt"
import { DecisionPanel } from "../components/panels/DecisionPanel"
import { WaitlistPanel } from "../components/panels/WaitlistPanel"
import { BookingActionsPanel } from "../components/panels/BookingActionsPanel"
import { mapBookingError, useCreateBooking } from "../hooks/useCreateBooking"
import { useBookingsQuery } from "../hooks/useBookingsQuery"
import { useCurrentUserQuery } from "../hooks/useCurrentUserQuery"
import { useSystemsQuery } from "../hooks/useSystemsQuery"
import { useAvailabilityQuery } from "../hooks/useAvailabilityQuery"
import { useDebouncedValue } from "../hooks/shared/useDebouncedValue"
import { toExplainableError } from "../lib/explainableError"
import { durationHours, isValidTimeRange, toLocalInputValue, toUtcIsoFromLocalInput } from "../lib/time"
import type { BookingRecord, BookingRequest, ExplainableError, ValidationIssue } from "../types/crags"
import { simulateBooking } from "../utils/simulateBooking"
import { useQueryClient } from "@tanstack/react-query"

function createInitialDraft(): BookingDraft {
  const now   = new Date()
  const start = new Date(now.getTime() + 60 * 60 * 1000)
  const end   = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  return {
    systemId: null,
    startLocal: toLocalInputValue(start),
    endLocal:   toLocalInputValue(end),
    reqCpu: 4, reqGpu: 1, reqRam: 32, reqVram: 16,
    accessType:          "BACKGROUND",
    academicCategory:    "Research",
    projectTitle:        "",
    expectedDeliverable: "",
    objective:           "",
  }
}

function validateDraft(draft: BookingDraft, startIso: string, endIso: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (draft.systemId === null) issues.push({ field: "system",    message: "Select a compute system." })
  if (!isValidTimeRange(startIso, endIso))
    issues.push({ field: "time",      message: "End must be after start, and both must be valid timestamps." })
  if (durationHours(startIso, endIso) > 72)
    issues.push({ field: "time",      message: "Window exceeds 72 hours — split into smaller intervals." })
  if (draft.reqCpu < 1 || draft.reqGpu < 0 || draft.reqRam < 1 || draft.reqVram < 0)
    issues.push({ field: "resources", message: "Resource requests must be non-negative; CPU/RAM must be > 0." })
  if (!draft.projectTitle.trim())
    issues.push({ field: "project",   message: "Project title is required." })
  if (!draft.objective.trim())
    issues.push({ field: "objective", message: "Objective is required for governance explainability." })
  return issues
}

function fallbackRequest(draft: BookingDraft): BookingRequest {
  return {
    system_id: draft.systemId ?? 0, start_time: "", end_time: "",
    req_cpu: draft.reqCpu, req_gpu: draft.reqGpu, req_ram: draft.reqRam, req_vram: draft.reqVram,
    access_type: draft.accessType, academic_category: draft.academicCategory,
    project_title: draft.projectTitle, expected_deliverable: draft.expectedDeliverable,
    objective: draft.objective,
  }
}

export function SchedulerPage() {
  const queryClient          = useQueryClient()
  const currentUserQuery     = useCurrentUserQuery()
  const systemsQuery         = useSystemsQuery(Boolean(currentUserQuery.data))
  const bookingsQuery        = useBookingsQuery(Boolean(currentUserQuery.data))
  const createBookingMutation = useCreateBooking()

  const [draft,          setDraft]          = useState<BookingDraft>(() => createInitialDraft())
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [localBookings,  setLocalBookings]  = useState<BookingRecord[]>([])
  const [explainableError, setExplainableError] = useState<ExplainableError | null>(null)

  const startUtcIso = toUtcIsoFromLocalInput(draft.startLocal)
  const endUtcIso   = toUtcIsoFromLocalInput(draft.endLocal)

  const validationIssues = useMemo(
    () => validateDraft(draft, startUtcIso, endUtcIso),
    [draft, startUtcIso, endUtcIso],
  )
  const bookingPayload = draftToBookingPayload(draft, startUtcIso, endUtcIso)

  const availabilityInput = useMemo(() => ({
    systemId:   bookingPayload?.system_id ?? null,
    startUtcIso: bookingPayload?.start_time ?? "",
    endUtcIso:   bookingPayload?.end_time   ?? "",
    enabled:
      Boolean(currentUserQuery.data) &&
      Boolean(bookingPayload && !validationIssues.some((i) => i.field === "time" || i.field === "system")),
  }), [bookingPayload, currentUserQuery.data, validationIssues])

  const debouncedInput     = useDebouncedValue(availabilityInput, 300)
  const availabilityQuery  = useAvailabilityQuery(debouncedInput)
  const currentSignature   = `${availabilityInput.systemId ?? "none"}|${availabilityInput.startUtcIso}|${availabilityInput.endUtcIso}`

  const availabilityForCurrentForm = useMemo(() => {
    if (!availabilityQuery.data) return null
    if (availabilityQuery.signature !== currentSignature) return null
    return availabilityQuery.data
  }, [availabilityQuery.data, availabilityQuery.signature, currentSignature])

  const availabilityValidationPending =
    availabilityInput.enabled &&
    (availabilityQuery.signature !== currentSignature || availabilityQuery.isFetching)

  const apiValidated =
    Boolean(availabilityForCurrentForm) && !availabilityValidationPending && !availabilityQuery.isError

  const availabilityError = useMemo(() => {
    if (!availabilityInput.enabled) return null
    if (availabilityQuery.signature !== currentSignature) return null
    if (!availabilityQuery.error) return null
    if (axios.isAxiosError(availabilityQuery.error) && availabilityQuery.error.code === "ERR_CANCELED") return null
    if (axios.isAxiosError(availabilityQuery.error)) {
      const status = availabilityQuery.error.response?.status
      const detail = typeof availabilityQuery.error.response?.data?.detail === "string"
        ? availabilityQuery.error.response.data.detail : null
      if (detail) return `Could not validate availability: ${detail}`
      if (status) return `Could not validate availability (HTTP ${status}).`
    }
    return "Could not validate availability for the current form state."
  }, [availabilityInput.enabled, availabilityQuery.error, availabilityQuery.signature, currentSignature])

  const mergedBookings = useMemo(() => {
    const map = new Map<number, BookingRecord>()
    for (const b of bookingsQuery.data ?? []) map.set(b.id, b)
    for (const b of localBookings) if (!map.has(b.id)) map.set(b.id, b)
    return Array.from(map.values()).sort(
      (a, z) => new Date(a.start_time).getTime() - new Date(z.start_time).getTime(),
    )
  }, [bookingsQuery.data, localBookings])

  const selectedSystem = useMemo(
    () => (systemsQuery.data ?? []).find((s) => s.id === draft.systemId) ?? null,
    [systemsQuery.data, draft.systemId],
  )

  const previewBooking = successMessage ? null : bookingPayload

  const simulation = useMemo(() => {
    if (!previewBooking || !selectedSystem) return null
    return simulateBooking(
      mergedBookings,
      { id: selectedSystem.id, cpu_cores: selectedSystem.cpu_cores, gpu_units: selectedSystem.gpu_units, ram_gb: selectedSystem.ram_gb, vram_gb: selectedSystem.vram_gb },
      previewBooking,
    )
  }, [previewBooking, selectedSystem, mergedBookings])

  // Auto-select first system
  useEffect(() => {
    if (!systemsQuery.data?.length) return
    setDraft((cur) => cur.systemId !== null ? cur : { ...cur, systemId: systemsQuery.data[0].id })
  }, [systemsQuery.data])

  async function handleSubmit() {
    if (!currentUserQuery.data || !bookingPayload || validationIssues.length) return
    setSuccessMessage(null)

    if (!apiValidated) {
      setExplainableError({
        title: "Validation Pending",
        whyRejected: "Availability snapshot is stale or still loading.",
        cause: "Form state changed and API validation has not completed for this exact signature.",
        fixes: ["Wait for availability to refresh.", "Keep system/time stable until validation completes."],
        overlapWindow: { start_time: bookingPayload.start_time, end_time: bookingPayload.end_time },
      })
      return
    }
    if (simulation && !simulation.feasible) {
      setExplainableError({
        title: "Simulation Block",
        whyRejected: "Simulation predicts policy or capacity violation.",
        cause: simulation.violations.map((v) => v.message).join(" | "),
        fixes: ["Reduce requested resources.", "Change to a lower-contention window.", "Select a larger-capacity system."],
        overlapWindow: { start_time: bookingPayload.start_time, end_time: bookingPayload.end_time },
      })
      return
    }

    try {
      const response = await createBookingMutation.mutateAsync(bookingPayload)
      setLocalBookings((cur) => [{
        id: response.id, system_id: bookingPayload.system_id,
        start_time: bookingPayload.start_time, end_time: bookingPayload.end_time,
        req_cpu: bookingPayload.req_cpu, req_gpu: bookingPayload.req_gpu,
        req_ram: bookingPayload.req_ram, req_vram: bookingPayload.req_vram,
        access_type: bookingPayload.access_type, academic_category: bookingPayload.academic_category,
        project_title: bookingPayload.project_title, expected_deliverable: bookingPayload.expected_deliverable,
        objective: bookingPayload.objective, status: response.status, user_id: response.user_id,
        source: "local", created_at: new Date().toISOString(),
      }, ...cur])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["availability"] }),
      ])
      setSuccessMessage("Booking confirmed by backend scheduler.")
      setExplainableError(null)
    } catch (err) {
      const mapped = mapBookingError(err)
      setExplainableError(toExplainableError({
        statusCode: mapped.statusCode, detail: mapped.detail, simulation,
        start_time: bookingPayload.start_time, end_time: bookingPayload.end_time,
      }))
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        {systemsQuery.isLoading && <LinearProgress />}
        {systemsQuery.isError && (
          <Alert severity="error">Unable to load systems. Ensure backend is running.</Alert>
        )}
        {bookingsQuery.error && (
          <Alert severity="warning">Booking history unavailable — timeline uses locally submitted requests only.</Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, xl: 7 }}>
            <BookingRequestForm
              systems={systemsQuery.data ?? []}
              draft={draft}
              startUtcIso={startUtcIso}
              endUtcIso={endUtcIso}
              issues={validationIssues}
              busy={createBookingMutation.isPending}
              backendMessage={successMessage}
              availability={availabilityForCurrentForm}
              availabilityLoading={availabilityValidationPending}
              availabilityError={availabilityError}
              simulation={simulation}
              explainableError={explainableError}
              apiValidated={apiValidated}
              onChange={(next) => { setDraft(next); setSuccessMessage(null) }}
              onSubmit={() => void handleSubmit()}
            />
          </Grid>
          <Grid size={{ xs: 12, xl: 5 }}>
            <Stack spacing={2}>
              <DecisionPanel
                simulation={simulation}
                availability={availabilityForCurrentForm}
                apiValidated={apiValidated}
                explainableError={explainableError}
              />
              <ResourceConstraintChart
                availability={availabilityForCurrentForm}
                booking={bookingPayload ?? fallbackRequest(draft)}
                loading={availabilityValidationPending}
                error={availabilityError}
              />
            </Stack>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TemporalGantt
              systems={systemsQuery.data ?? []}
              bookings={mergedBookings}
              requestedBooking={previewBooking}
              selectedSystemId={draft.systemId}
              startUtcIso={startUtcIso}
              endUtcIso={endUtcIso}
              onWindowSelect={({ systemId, startUtcIso: s, endUtcIso: e }) =>
                setDraft((cur) => ({
                  ...cur, systemId,
                  startLocal: toLocalInputValue(new Date(s)),
                  endLocal:   toLocalInputValue(new Date(e)),
                }))
              }
            />
          </Grid>

          {/* Booking modifications */}
          <Grid size={{ xs: 12, md: 6 }}>
            <BookingActionsPanel bookings={mergedBookings} />
          </Grid>

          {/* Waitlist */}
          <Grid size={{ xs: 12, md: 6 }}>
            <WaitlistPanel systems={systemsQuery.data ?? []} />
          </Grid>
        </Grid>

        {createBookingMutation.isPending && <LinearProgress color="secondary" />}
      </Stack>
    </Box>
  )
}
