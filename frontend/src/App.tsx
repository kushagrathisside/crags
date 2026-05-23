import {
  Alert,
  Button,
  Chip,
  Container,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material"
import { useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { useEffect, useMemo, useState } from "react"
import { ResourceConstraintChart } from "./components/charts/ResourceConstraintChart"
import { TemporalGantt } from "./components/charts/TemporalGantt"
import { BookingRequestForm, type BookingDraft, draftToBookingPayload } from "./components/forms/BookingRequestForm"
import { SystemRegistrationForm } from "./components/forms/SystemRegistrationForm"
import { CragsHeader } from "./components/layout/CragsHeader"
import { AuditTrailPanel } from "./components/panels/AuditTrailPanel"
import { BookingLifecycle } from "./components/panels/BookingLifecycle"
import { DecisionPanel } from "./components/panels/DecisionPanel"
import { LoginPanel } from "./components/panels/LoginPanel"
import { MissionControlDashboard } from "./components/panels/MissionControlDashboard"
import { SystemInventoryPanel } from "./components/panels/SystemInventoryPanel"
import { TeamManagementPanel } from "./components/panels/TeamManagementPanel"
import { useAuditTrailQuery } from "./hooks/useAuditTrailQuery"
import { useAvailabilityQuery } from "./hooks/useAvailabilityQuery"
import { mapBookingError, useCreateBooking } from "./hooks/useCreateBooking"
import { useBookingsQuery } from "./hooks/useBookingsQuery"
import { useCurrentUserQuery } from "./hooks/useCurrentUserQuery"
import { useLoginMutation } from "./hooks/useLoginMutation"
import { useLogoutMutation } from "./hooks/useLogoutMutation"
import { useSystemsQuery } from "./hooks/useSystemsQuery"
import { useDebouncedValue } from "./hooks/shared/useDebouncedValue"
import { toExplainableError } from "./lib/explainableError"
import { durationHours, isValidTimeRange, toLocalInputValue, toUtcIsoFromLocalInput } from "./lib/time"
import type { BookingRecord, BookingRequest, ExplainableError, ValidationIssue } from "./types/crags"
import { simulateBooking } from "./utils/simulateBooking"

type AppTab = "mission" | "scheduler" | "monitoring" | "governance"

function createInitialDraft(): BookingDraft {
  const now = new Date()
  const start = new Date(now.getTime() + 60 * 60 * 1000)
  const end = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  return {
    systemId: null,
    startLocal: toLocalInputValue(start),
    endLocal: toLocalInputValue(end),
    reqCpu: 4,
    reqGpu: 1,
    reqRam: 32,
    reqVram: 16,
    accessType: "BACKGROUND",
    academicCategory: "Research",
    projectTitle: "",
    expectedDeliverable: "",
    objective: "",
  }
}

function validateDraft(draft: BookingDraft, startUtcIso: string, endUtcIso: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (draft.systemId === null) {
    issues.push({ field: "system", message: "Select a compute system." })
  }

  if (!isValidTimeRange(startUtcIso, endUtcIso)) {
    issues.push({ field: "time", message: "End must be after start, and both timestamps must be valid." })
  }

  if (durationHours(startUtcIso, endUtcIso) > 72) {
    issues.push({ field: "time", message: "Window exceeds 72 hours; split into smaller scheduling intervals." })
  }

  if (draft.reqCpu < 1 || draft.reqGpu < 0 || draft.reqRam < 1 || draft.reqVram < 0) {
    issues.push({ field: "resources", message: "Resource requests must be non-negative and CPU/RAM must be > 0." })
  }

  if (!draft.projectTitle.trim()) {
    issues.push({ field: "project", message: "Project title is required." })
  }

  if (!draft.objective.trim()) {
    issues.push({ field: "objective", message: "Objective is required for governance explainability." })
  }

  return issues
}

function fallbackBookingFromDraft(draft: BookingDraft): BookingRequest {
  return {
    system_id: draft.systemId ?? 0,
    start_time: "",
    end_time: "",
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

function App() {
  const queryClient = useQueryClient()
  const currentUserQuery = useCurrentUserQuery()
  const loginMutation = useLoginMutation()
  const logoutMutation = useLogoutMutation()

  const [activeTab, setActiveTab] = useState<AppTab>("mission")
  const [draft, setDraft] = useState<BookingDraft>(() => createInitialDraft())
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [localBookings, setLocalBookings] = useState<BookingRecord[]>([])
  const [explainableError, setExplainableError] = useState<ExplainableError | null>(null)
  const [selectedLifecycleBookingId, setSelectedLifecycleBookingId] = useState<number | "none">("none")
  const [loginError, setLoginError] = useState<string | null>(null)

  const currentUser = currentUserQuery.data ?? null
  const isAuthenticated = Boolean(currentUser)
  const canViewMonitoring =
    currentUser?.role === "GROUP_LEAD" ||
    currentUser?.role === "RESOURCE_ADMIN" ||
    currentUser?.role === "SUPER_ADMIN"
  const canViewGovernance = currentUser?.role === "RESOURCE_ADMIN" || currentUser?.role === "SUPER_ADMIN"
  const canViewAudit = canViewGovernance

  const systemsQuery = useSystemsQuery(isAuthenticated)
  const bookingsQuery = useBookingsQuery(isAuthenticated)
  const createBookingMutation = useCreateBooking()
  const auditQuery = useAuditTrailQuery(isAuthenticated && canViewAudit)

  const tabs = useMemo(() => {
    const values: Array<{ value: AppTab; label: string }> = [
      { value: "mission", label: "Mission Control" },
      { value: "scheduler", label: "Scheduler Control Plane" },
    ]

    if (canViewMonitoring) {
      values.push({ value: "monitoring", label: "Group Monitoring" })
    }

    if (canViewGovernance) {
      values.push({ value: "governance", label: "Governance & Admin" })
    }

    return values
  }, [canViewGovernance, canViewMonitoring])

  const visibleActiveTab = tabs.find((entry) => entry.value === activeTab)?.value ?? tabs[0]?.value ?? "mission"

  const startUtcIso = toUtcIsoFromLocalInput(draft.startLocal)
  const endUtcIso = toUtcIsoFromLocalInput(draft.endLocal)

  const validationIssues = useMemo(() => validateDraft(draft, startUtcIso, endUtcIso), [draft, startUtcIso, endUtcIso])
  const bookingPayload = draftToBookingPayload(draft, startUtcIso, endUtcIso)

  const availabilityInput = useMemo(
    () => ({
      systemId: bookingPayload?.system_id ?? null,
      startUtcIso: bookingPayload?.start_time ?? "",
      endUtcIso: bookingPayload?.end_time ?? "",
      enabled:
        isAuthenticated &&
        Boolean(bookingPayload && !validationIssues.some((issue) => issue.field === "time" || issue.field === "system")),
    }),
    [bookingPayload, isAuthenticated, validationIssues],
  )

  const debouncedAvailabilityInput = useDebouncedValue(availabilityInput, 300)
  const availabilityQuery = useAvailabilityQuery(debouncedAvailabilityInput)

  const currentSignature = `${availabilityInput.systemId ?? "none"}|${availabilityInput.startUtcIso}|${availabilityInput.endUtcIso}`
  const availabilityForCurrentForm = useMemo(() => {
    if (!availabilityQuery.data) {
      return null
    }

    if (availabilityQuery.signature !== currentSignature) {
      return null
    }

    return availabilityQuery.data
  }, [availabilityQuery.data, availabilityQuery.signature, currentSignature])

  const availabilityValidationPending =
    availabilityInput.enabled &&
    (availabilityQuery.signature !== currentSignature || availabilityQuery.isFetching)

  const apiValidated = Boolean(availabilityForCurrentForm) && !availabilityValidationPending && !availabilityQuery.isError

  const availabilityError = useMemo(() => {
    if (!availabilityInput.enabled) {
      return null
    }

    if (availabilityQuery.signature !== currentSignature) {
      return null
    }

    if (!availabilityQuery.error) {
      return null
    }

    if (axios.isAxiosError(availabilityQuery.error) && availabilityQuery.error.code === "ERR_CANCELED") {
      return null
    }

    if (axios.isAxiosError(availabilityQuery.error)) {
      const status = availabilityQuery.error.response?.status
      const detail =
        typeof availabilityQuery.error.response?.data?.detail === "string"
          ? availabilityQuery.error.response.data.detail
          : null

      if (detail) {
        return `Could not validate availability: ${detail}`
      }

      if (status) {
        return `Could not validate availability (HTTP ${status}).`
      }
    }

    return "Could not validate availability for the current form state."
  }, [availabilityInput.enabled, availabilityQuery.error, availabilityQuery.signature, currentSignature])

  useEffect(() => {
    if (!systemsQuery.data?.length) {
      return
    }

    setDraft((current) => {
      if (current.systemId !== null) {
        return current
      }

      return {
        ...current,
        systemId: systemsQuery.data[0].id,
      }
    })
  }, [systemsQuery.data])

  const mergedBookings = useMemo(() => {
    const map = new Map<number, BookingRecord>()

    for (const booking of bookingsQuery.data ?? []) {
      map.set(booking.id, booking)
    }

    for (const booking of localBookings) {
      if (!map.has(booking.id)) {
        map.set(booking.id, booking)
      }
    }

    return Array.from(map.values()).sort(
      (left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
    )
  }, [bookingsQuery.data, localBookings])

  const selectedSystem = useMemo(
    () => systemsQuery.data?.find((system) => system.id === draft.systemId) ?? null,
    [systemsQuery.data, draft.systemId],
  )

  const previewBooking = successMessage ? null : bookingPayload

  const simulation = useMemo(() => {
    if (!previewBooking || !selectedSystem) {
      return null
    }

    return simulateBooking(
      mergedBookings,
      {
        id: selectedSystem.id,
        cpu_cores: selectedSystem.cpu_cores,
        gpu_units: selectedSystem.gpu_units,
        ram_gb: selectedSystem.ram_gb,
        vram_gb: selectedSystem.vram_gb,
      },
      previewBooking,
    )
  }, [previewBooking, selectedSystem, mergedBookings])

  useEffect(() => {
    if (selectedLifecycleBookingId !== "none") {
      return
    }

    if (!mergedBookings.length) {
      return
    }

    setSelectedLifecycleBookingId(mergedBookings[0].id)
  }, [mergedBookings, selectedLifecycleBookingId])

  const selectedLifecycleBooking = useMemo(() => {
    if (selectedLifecycleBookingId === "none") {
      return null
    }

    return mergedBookings.find((booking) => booking.id === selectedLifecycleBookingId) ?? null
  }, [mergedBookings, selectedLifecycleBookingId])

  const auditMissing = !canViewAudit || (axios.isAxiosError(auditQuery.error) && auditQuery.error.response?.status === 404)
  const auditErrorMessage = canViewAudit && auditQuery.error && !auditMissing ? "Could not load audit events." : null
  const bookingsMissing = axios.isAxiosError(bookingsQuery.error) && [404, 405].includes(bookingsQuery.error.response?.status ?? 0)

  async function handleLogin(payload: { identifier: string; password: string }) {
    setLoginError(null)

    try {
      await loginMutation.mutateAsync(payload)
      await queryClient.invalidateQueries({ queryKey: ["current-user"] })
    } catch (error) {
      if (axios.isAxiosError(error) && typeof error.response?.data?.detail === "string") {
        setLoginError(error.response.data.detail)
        return
      }

      setLoginError("Login failed.")
    }
  }

  async function handleLogout() {
    await logoutMutation.mutateAsync()
    setLocalBookings([])
    setSuccessMessage(null)
    setExplainableError(null)
  }

  async function handleSubmit() {
    if (!currentUser) {
      return
    }

    setSuccessMessage(null)

    if (!bookingPayload || validationIssues.length) {
      return
    }

    if (!apiValidated) {
      setExplainableError({
        title: "Validation Pending",
        whyRejected: "Availability snapshot is stale or still loading.",
        cause: "Form state changed and API validation has not completed for this exact signature.",
        fixes: ["Wait for availability to refresh.", "Keep system/time stable until validation completes."],
        overlapWindow: {
          start_time: bookingPayload.start_time,
          end_time: bookingPayload.end_time,
        },
      })
      return
    }

    if (simulation && !simulation.feasible) {
      setExplainableError({
        title: "Simulation Block",
        whyRejected: "Simulation predicts policy or capacity violation.",
        cause: simulation.violations.map((violation) => violation.message).join(" | "),
        fixes: [
          "Reduce requested resources.",
          "Change to a lower-contention time window.",
          "Select a larger-capacity system.",
        ],
        overlapWindow: {
          start_time: bookingPayload.start_time,
          end_time: bookingPayload.end_time,
        },
      })
      return
    }

    try {
      const response = await createBookingMutation.mutateAsync(bookingPayload)

      setLocalBookings((current) => [
        {
          id: response.id,
          system_id: bookingPayload.system_id,
          start_time: bookingPayload.start_time,
          end_time: bookingPayload.end_time,
          req_cpu: bookingPayload.req_cpu,
          req_gpu: bookingPayload.req_gpu,
          req_ram: bookingPayload.req_ram,
          req_vram: bookingPayload.req_vram,
          access_type: bookingPayload.access_type,
          academic_category: bookingPayload.academic_category,
          project_title: bookingPayload.project_title,
          expected_deliverable: bookingPayload.expected_deliverable,
          objective: bookingPayload.objective,
          status: response.status,
          user_id: response.user_id,
          source: "local",
          created_at: new Date().toISOString(),
        },
        ...current,
      ])

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["availability"] }),
      ])
      setSuccessMessage("Booking confirmed by backend scheduler.")
      setExplainableError(null)
    } catch (error) {
      const mapped = mapBookingError(error)
      setExplainableError(
        toExplainableError({
          statusCode: mapped.statusCode,
          detail: mapped.detail,
          simulation,
          start_time: bookingPayload.start_time,
          end_time: bookingPayload.end_time,
        }),
      )
    }
  }

  if (!isAuthenticated) {
    const showGlobalError =
      currentUserQuery.isError &&
      !(axios.isAxiosError(currentUserQuery.error) && currentUserQuery.error.response?.status === 401)

    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Stack spacing={2}>
          <Typography variant="h4" fontWeight={700} textAlign="center">
            Compute Resource Allocation and Governance System
          </Typography>
          {currentUserQuery.isLoading ? <LinearProgress /> : null}
          {showGlobalError ? <Alert severity="error">Could not initialize user session.</Alert> : null}
          <LoginPanel busy={loginMutation.isPending} errorMessage={loginError} onSubmit={(payload) => void handleLogin(payload)} />
        </Stack>
      </Container>
    )
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <CragsHeader
          systemsCount={systemsQuery.data?.length ?? 0}
          apiBaseUrl={import.meta.env.VITE_API_BASE_URL ?? "/api/v1"}
        />

        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip label={`User: ${currentUser?.username ?? "-"}`} size="small" />
            <Chip label={`Role: ${currentUser?.role ?? "-"}`} size="small" color="primary" variant="outlined" />
            {currentUser?.group_name ? <Chip label={`Group: ${currentUser.group_name}`} size="small" variant="outlined" /> : null}
          </Stack>
          <Button variant="outlined" size="small" onClick={() => void handleLogout()} disabled={logoutMutation.isPending}>
            {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
          </Button>
        </Stack>

        <Tabs value={visibleActiveTab} onChange={(_, value: AppTab) => setActiveTab(value)}>
          {tabs.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>

        {systemsQuery.isLoading ? <LinearProgress /> : null}
        {systemsQuery.isError ? <Alert severity="error">Unable to load systems. Ensure backend is running and reachable.</Alert> : null}

        {bookingsQuery.isFetching ? <LinearProgress color="secondary" /> : null}
        {bookingsQuery.error && !bookingsMissing ? (
          <Alert severity="warning">Unable to load booking history; timeline uses local confirmed requests only.</Alert>
        ) : null}
        {bookingsMissing ? (
          <Alert severity="info">`GET /bookings/` not exposed by backend yet; timeline/governance use locally observed bookings.</Alert>
        ) : null}

        {visibleActiveTab === "mission" ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <MissionControlDashboard systems={systemsQuery.data ?? []} bookings={mergedBookings} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TemporalGantt
                systems={systemsQuery.data ?? []}
                bookings={mergedBookings}
                requestedBooking={previewBooking}
                selectedSystemId={draft.systemId}
                startUtcIso={startUtcIso}
                endUtcIso={endUtcIso}
                onWindowSelect={({ systemId, startUtcIso: nextStart, endUtcIso: nextEnd }) => {
                  setDraft((current) => ({
                    ...current,
                    systemId,
                    startLocal: toLocalInputValue(new Date(nextStart)),
                    endLocal: toLocalInputValue(new Date(nextEnd)),
                  }))
                }}
              />
            </Grid>
          </Grid>
        ) : null}

        {visibleActiveTab === "scheduler" ? (
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
                onChange={(next) => {
                  setDraft(next)
                  setSuccessMessage(null)
                }}
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
                  booking={bookingPayload ?? fallbackBookingFromDraft(draft)}
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
                onWindowSelect={({ systemId, startUtcIso: nextStart, endUtcIso: nextEnd }) => {
                  setDraft((current) => ({
                    ...current,
                    systemId,
                    startLocal: toLocalInputValue(new Date(nextStart)),
                    endLocal: toLocalInputValue(new Date(nextEnd)),
                  }))
                }}
              />
            </Grid>
          </Grid>
        ) : null}

        {visibleActiveTab === "monitoring" ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <AuditTrailPanel
                events={canViewAudit ? auditQuery.data ?? [] : []}
                bookings={mergedBookings}
                loading={canViewAudit ? auditQuery.isLoading : false}
                endpointMissing={!canViewAudit || auditMissing}
                errorMessage={auditErrorMessage}
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Stack spacing={1.2}>
                <FormControl size="small">
                  <InputLabel id="lifecycle-booking-label">Lifecycle Booking</InputLabel>
                  <Select
                    labelId="lifecycle-booking-label"
                    label="Lifecycle Booking"
                    value={selectedLifecycleBookingId}
                    onChange={(event) =>
                      setSelectedLifecycleBookingId(event.target.value === "none" ? "none" : Number(event.target.value))
                    }
                  >
                    <MenuItem value="none">None</MenuItem>
                    {mergedBookings.map((booking) => (
                      <MenuItem key={booking.id} value={booking.id}>
                        #{booking.id} · {booking.project_title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <BookingLifecycle booking={selectedLifecycleBooking} events={canViewAudit ? auditQuery.data ?? [] : []} />
              </Stack>
            </Grid>
          </Grid>
        ) : null}

        {visibleActiveTab === "governance" && canViewGovernance ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <SystemRegistrationForm />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <SystemInventoryPanel systems={systemsQuery.data ?? []} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TeamManagementPanel currentRole={currentUser?.role ?? "MEMBER"} />
            </Grid>
          </Grid>
        ) : null}

        {createBookingMutation.isPending ? <LinearProgress color="secondary" /> : null}
      </Stack>
    </Container>
  )
}

export default App
