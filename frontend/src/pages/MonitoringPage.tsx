import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Box,
  Grid,
  Stack,
  Alert,
  Card,
  CardContent,
  Typography,
  LinearProgress,
} from "@mui/material"
import { useMemo, useState } from "react"
import axios from "axios"
import { AuditTrailPanel } from "../components/panels/AuditTrailPanel"
import { BookingLifecycle } from "../components/panels/BookingLifecycle"
import { ApprovalQueuePanel } from "../components/panels/ApprovalQueuePanel"
import { ErrorBoundary } from "../components/ErrorBoundary"
import { useAuditTrailQuery } from "../hooks/useAuditTrailQuery"
import { useBookingsQuery } from "../hooks/useBookingsQuery"
import { useCurrentUserQuery } from "../hooks/useCurrentUserQuery"
import { FONT_MONO } from "../theme"

export function MonitoringPage() {
  const currentUserQuery = useCurrentUserQuery()
  const user = currentUserQuery.data ?? null

  const canViewAudit =
    user?.role === "RESOURCE_ADMIN" || user?.role === "SUPER_ADMIN"

  const bookingsQuery = useBookingsQuery(Boolean(user))
  const auditQuery    = useAuditTrailQuery(Boolean(user) && canViewAudit)

  const [selectedBookingId, setSelectedBookingId] = useState<number | "none">("none")

  const bookings = bookingsQuery.data ?? []

  const auditMissing =
    !canViewAudit ||
    (axios.isAxiosError(auditQuery.error) && auditQuery.error.response?.status === 404)

  const auditErrorMessage =
    canViewAudit && auditQuery.error && !auditMissing ? "Could not load audit events." : null

  const bookingsMissing =
    axios.isAxiosError(bookingsQuery.error) &&
    [404, 405].includes(bookingsQuery.error.response?.status ?? 0)

  // Auto-select first booking
  useMemo(() => {
    if (selectedBookingId === "none" && bookings.length > 0) {
      setSelectedBookingId(bookings[0].id)
    }
  }, [bookings, selectedBookingId])

  const selectedBooking = useMemo(() => {
    if (selectedBookingId === "none") return null
    return bookings.find((b) => b.id === selectedBookingId) ?? null
  }, [bookings, selectedBookingId])

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        {bookingsQuery.isFetching && <LinearProgress color="secondary" />}

        {bookingsQuery.error && !bookingsMissing && (
          <Alert severity="warning">
            Unable to load booking history. Audit timeline uses locally observed events.
          </Alert>
        )}
        {bookingsMissing && (
          <Alert severity="info">
            Bookings endpoint not available — lifecycle view uses locally submitted requests.
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Approval queue — full width, admins only */}
          {canViewAudit && (
            <Grid size={{ xs: 12 }}>
              <ErrorBoundary>
                <ApprovalQueuePanel />
              </ErrorBoundary>
            </Grid>
          )}

          {/* Audit trail — wide */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <ErrorBoundary>
              <AuditTrailPanel
                events={canViewAudit ? (auditQuery.data ?? []) : []}
                bookings={bookings}
                loading={canViewAudit ? auditQuery.isLoading : false}
                endpointMissing={!canViewAudit || auditMissing}
                errorMessage={auditErrorMessage}
              />
            </ErrorBoundary>
          </Grid>

          {/* Lifecycle — sidebar */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Stack spacing={2}>
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: FONT_MONO, color: "text.secondary", display: "block", mb: 1.5 }}
                  >
                    BOOKING LIFECYCLE
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Select booking</InputLabel>
                    <Select
                      label="Select booking"
                      value={selectedBookingId}
                      onChange={(e) =>
                        setSelectedBookingId(
                          e.target.value === "none" ? "none" : Number(e.target.value),
                        )
                      }
                    >
                      <MenuItem value="none">— none —</MenuItem>
                      {bookings.map((b) => (
                        <MenuItem key={b.id} value={b.id}>
                          #{b.id} · {b.project_title || "(no title)"}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>

              <ErrorBoundary>
                <BookingLifecycle
                  booking={selectedBooking}
                  events={canViewAudit ? (auditQuery.data ?? []) : []}
                />
              </ErrorBoundary>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  )
}
