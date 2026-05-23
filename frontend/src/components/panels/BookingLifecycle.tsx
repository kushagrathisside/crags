import { Box, Card, CardContent, Chip, Divider, Stack, Step, StepLabel, Stepper, Typography } from "@mui/material"
import { formatUtc } from "../../lib/time"
import type { AuditEvent, BookingRecord } from "../../types/crags"

type Props = {
  booking: BookingRecord | null
  events: AuditEvent[]
}

const baseFlow = ["REQUESTED", "CONFIRMED", "COMPLETED"] as const

function stepIndexForStatus(status: string): number {
  if (status === "REQUESTED") {
    return 0
  }

  if (status === "CONFIRMED") {
    return 1
  }

  return 2
}

export function BookingLifecycle({ booking, events }: Props) {
  if (!booking) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6">Booking Lifecycle</Typography>
          <Typography color="text.secondary">Select a booking to inspect lifecycle progression.</Typography>
        </CardContent>
      </Card>
    )
  }

  const relatedEvents = events
    .filter((event) => event.record_id === booking.id || event.booking_id === booking.id)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())

  const isBranchStatus = booking.status === "PREEMPTED" || booking.status === "CANCELLED"

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h6">Booking Lifecycle</Typography>
          <Typography variant="body2" color="text.secondary">
            Booking #{booking.id} · {booking.project_title}
          </Typography>

          <Stepper activeStep={stepIndexForStatus(booking.status)} alternativeLabel>
            {baseFlow.map((step) => (
              <Step key={step}>
                <StepLabel>{step}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {isBranchStatus ? (
            <Box>
              <Chip label={`Branch: ${booking.status}`} color="error" variant="outlined" />
            </Box>
          ) : (
            <Chip label={`Current: ${booking.status}`} color="primary" variant="outlined" />
          )}

          <Divider />

          <Typography variant="subtitle2">Event Markers</Typography>
          {relatedEvents.length ? (
            <Stack spacing={0.5}>
              {relatedEvents.map((event) => (
                <Typography variant="body2" key={`${event.id}-${event.timestamp}`}>
                  {formatUtc(event.timestamp)} · {event.action}
                </Typography>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No audit events found for this booking.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
