import { OpenInFullRounded, TuneRounded } from "@mui/icons-material"
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { extendBooking, resizeBooking } from "../../api/cragsApi"
import type { BookingRecord } from "../../types/crags"
import { FONT_MONO } from "../../theme"

type Props = { bookings: BookingRecord[] }

function ExtendDialog({ booking, open, onClose }: { booking: BookingRecord; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  // Pre-fill with current end time + 1 hour
  const defaultEnd = new Date(new Date(booking.end_time).getTime() + 3600000)
    .toISOString().slice(0, 16)
  const [newEnd, setNewEnd] = useState(defaultEnd)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => extendBooking(booking.id, new Date(newEnd).toISOString()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bookings"] }); onClose() },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      setError(err.response?.data?.detail ?? "Extension failed"),
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: FONT_MONO, fontSize: "0.9rem" }}>EXTEND · #{booking.id}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: FONT_MONO }}>
            Current end: {new Date(booking.end_time).toLocaleString()}
          </Typography>
          <TextField
            label="New end time"
            type="datetime-local"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button size="small" onClick={onClose}>Cancel</Button>
        <Button variant="contained" size="small" disabled={!newEnd || mutation.isPending}
          onClick={() => { setError(null); mutation.mutate() }}>
          {mutation.isPending ? "Extending…" : "Extend"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function ResizeDialog({ booking, open, onClose }: { booking: BookingRecord; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [cpu, setCpu] = useState(String(booking.req_cpu))
  const [gpu, setGpu] = useState(String(booking.req_gpu))
  const [ram, setRam] = useState(String(booking.req_ram))
  const [vram, setVram] = useState(String(booking.req_vram))
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => resizeBooking(booking.id, {
      req_cpu: cpu ? Number(cpu) : undefined,
      req_gpu: gpu ? Number(gpu) : undefined,
      req_ram: ram ? Number(ram) : undefined,
      req_vram: vram ? Number(vram) : undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bookings"] }); onClose() },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      setError(err.response?.data?.detail ?? "Resize failed"),
  })

  const numField = (label: string, val: string, set: (v: string) => void) => (
    <TextField label={label} size="small" type="number" inputProps={{ min: 0 }}
      value={val} onChange={(e) => set(e.target.value)} fullWidth />
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: FONT_MONO, fontSize: "0.9rem" }}>RESIZE · #{booking.id}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          <Stack direction="row" spacing={1}>
            {numField("CPU cores", cpu, setCpu)}
            {numField("GPU units", gpu, setGpu)}
          </Stack>
          <Stack direction="row" spacing={1}>
            {numField("RAM (GB)", ram, setRam)}
            {numField("VRAM (GB)", vram, setVram)}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button size="small" onClick={onClose}>Cancel</Button>
        <Button variant="contained" size="small" disabled={mutation.isPending}
          onClick={() => { setError(null); mutation.mutate() }}>
          {mutation.isPending ? "Resizing…" : "Apply resize"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function BookingActionsPanel({ bookings }: Props) {
  useTheme()

  const modifiable = bookings.filter((b) => b.status === "CONFIRMED" || b.status === "REQUESTED")

  const [selectedId, setSelectedId] = useState<number | "">("")
  const [extendOpen, setExtendOpen] = useState(false)
  const [resizeOpen, setResizeOpen] = useState(false)

  const selected = modifiable.find((b) => b.id === selectedId) ?? null

  if (modifiable.length === 0) return null

  return (
    <>
      <Card>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="caption" sx={{ fontFamily: FONT_MONO, color: "text.secondary", fontWeight: 600, letterSpacing: "0.08em", display: "block", mb: 1.5 }}>
            MODIFY BOOKING
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Select
              size="small"
              displayEmpty
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value as number | "")}
              sx={{ fontFamily: FONT_MONO, fontSize: "0.75rem", minWidth: 200 }}
            >
              <MenuItem value="">— select booking —</MenuItem>
              {modifiable.map((b) => (
                <MenuItem key={b.id} value={b.id} sx={{ fontFamily: FONT_MONO, fontSize: "0.75rem" }}>
                  #{b.id} · {b.project_title || "(no title)"}
                </MenuItem>
              ))}
            </Select>
            <Button
              size="small"
              startIcon={<OpenInFullRounded />}
              disabled={!selected}
              onClick={() => setExtendOpen(true)}
              sx={{ fontFamily: FONT_MONO, fontSize: "0.7rem" }}
            >
              Extend
            </Button>
            <Button
              size="small"
              startIcon={<TuneRounded />}
              disabled={!selected}
              onClick={() => setResizeOpen(true)}
              sx={{ fontFamily: FONT_MONO, fontSize: "0.7rem" }}
            >
              Resize
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {selected && extendOpen && (
        <ExtendDialog booking={selected} open onClose={() => setExtendOpen(false)} />
      )}
      {selected && resizeOpen && (
        <ResizeDialog booking={selected} open onClose={() => setResizeOpen(false)} />
      )}
    </>
  )
}
