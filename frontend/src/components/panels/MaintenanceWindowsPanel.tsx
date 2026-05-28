import { AddRounded, DeleteOutlineRounded, BuildRounded } from "@mui/icons-material"
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createMaintenanceWindow, deleteMaintenanceWindow, listMaintenanceWindows } from "../../api/cragsApi"
import type { ComputeSystem } from "../../types/crags"
import { FONT_MONO } from "../../theme"

type Props = { systems: ComputeSystem[] }

function AddWindowDialog({ systems, open, onClose }: { systems: ComputeSystem[]; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [systemId, setSystemId] = useState<number>(systems[0]?.id ?? 0)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => createMaintenanceWindow({ system_id: systemId, start_time: startTime, end_time: endTime, reason: reason || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["maintenance"] }); onClose() },
    onError: () => setError("Failed to create maintenance window"),
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: FONT_MONO, fontSize: "0.9rem" }}>SCHEDULE MAINTENANCE</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          <Select size="small" value={systemId} onChange={(e) => setSystemId(Number(e.target.value))}>
            {systems.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </Select>
          <TextField label="Start time" type="datetime-local" size="small" InputLabelProps={{ shrink: true }}
            value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <TextField label="End time" type="datetime-local" size="small" InputLabelProps={{ shrink: true }}
            value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          <TextField label="Reason (optional)" size="small" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button size="small" onClick={onClose}>Cancel</Button>
        <Button variant="contained" size="small" disabled={!systemId || !startTime || !endTime || mutation.isPending}
          onClick={() => { setError(null); mutation.mutate() }}>
          {mutation.isPending ? "Scheduling…" : "Schedule"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function MaintenanceWindowsPanel({ systems }: Props) {
  useTheme()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data: windows = [] } = useQuery({
    queryKey: ["maintenance"],
    queryFn: () => listMaintenanceWindows(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMaintenanceWindow(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["maintenance"] }),
  })

  const systemMap = Object.fromEntries(systems.map((s) => [s.id, s.name]))

  return (
    <>
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <BuildRounded sx={{ fontSize: 16, color: "#FFA600" }} />
              <Typography variant="caption" sx={{ fontFamily: FONT_MONO, color: "text.secondary", fontWeight: 600, letterSpacing: "0.08em" }}>
                MAINTENANCE WINDOWS
              </Typography>
            </Stack>
            <Button size="small" startIcon={<AddRounded />} onClick={() => setAddOpen(true)} sx={{ fontFamily: FONT_MONO, fontSize: "0.7rem" }}>
              Schedule
            </Button>
          </Stack>
          {windows.length === 0 ? (
            <Box sx={{ px: 2, pb: 2, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary">No maintenance windows scheduled</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontFamily: FONT_MONO, fontSize: "0.65rem", color: "text.secondary", fontWeight: 600, letterSpacing: "0.06em" } }}>
                    <TableCell>SYSTEM</TableCell>
                    <TableCell>START</TableCell>
                    <TableCell>END</TableCell>
                    <TableCell>REASON</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {windows.map((w) => {
                    const now = Date.now()
                    const start = new Date(w.start_time).getTime()
                    const end = new Date(w.end_time).getTime()
                    const isActive = start <= now && now < end
                    return (
                      <TableRow key={w.id} sx={{ "& td": { fontFamily: FONT_MONO, fontSize: "0.72rem", py: 1 } }}>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <span>{systemMap[w.system_id] ?? `#${w.system_id}`}</span>
                            {isActive && <Chip label="ACTIVE" size="small" sx={{ height: 16, fontSize: "0.55rem", background: "rgba(255,166,0,0.15)", color: "#FFA600" }} />}
                          </Stack>
                        </TableCell>
                        <TableCell>{new Date(w.start_time).toLocaleString()}</TableCell>
                        <TableCell>{new Date(w.end_time).toLocaleString()}</TableCell>
                        <TableCell sx={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.reason ?? "—"}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Delete">
                            <IconButton size="small" sx={{ color: "error.main" }} onClick={() => deleteMutation.mutate(w.id)}>
                              <DeleteOutlineRounded sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <AddWindowDialog systems={systems} open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
