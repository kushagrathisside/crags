import { Alert, Card, CardContent, Typography } from "@mui/material"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { AvailabilitySnapshot, BookingRequest } from "../../types/crags"

type Props = {
  availability: AvailabilitySnapshot | null
  booking: BookingRequest
  loading?: boolean
  error?: string | null
}

export function ResourceConstraintChart({ availability, booking, loading = false, error = null }: Props) {
  const data = [
    {
      metric: "CPU",
      requested: booking.req_cpu,
      available: availability ? availability.cpu_available : null,
    },
    {
      metric: "GPU",
      requested: booking.req_gpu,
      available: availability ? availability.gpu_available : null,
    },
    {
      metric: "RAM",
      requested: booking.req_ram,
      available: availability ? availability.ram_available : null,
    },
    {
      metric: "VRAM",
      requested: booking.req_vram,
      available: availability ? availability.vram_available : null,
    },
  ]

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Resource Constraint View
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Requested vs currently available resources in selected window.
        </Typography>
        {loading ? (
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            Refreshing availability snapshot...
          </Typography>
        ) : null}
        {error ? (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        ) : null}
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="4 4" />
            <XAxis dataKey="metric" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="requested" fill="#d32f2f" name="Requested" />
            <Bar dataKey="available" fill="#1976d2" name="Available" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
