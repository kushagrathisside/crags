import { HourglassEmptyRounded, DeleteOutlineRounded, AddRounded } from "@mui/icons-material"
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
import { cancelWaitlistEntry, joinWaitlist, listWaitlist } from "../../api/cragsApi"
import type { ComputeSystem, WaitlistJoin } from "../../types/crags"
import { FONT_MONO } from "../../theme"

type Props = { systems: ComputeSystem[] }

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  WAITING:   { color: "#FFA600", bg: "rgba(255,166,0,0.12)" },
  PROMOTED:  { color: "#00E5A0", bg: "rgba(0,229,160,0.12)" },
  CANCELLED: { color: "#888",    bg: "rgba(136,136,136,0.1)" },
}

function JoinDialog({ systems, open, onClose }: { systems: ComputeSystem[]; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<WaitlistJoin>({
    system_id: systems[0]?.id ?? 0,
    req_cpu: 4, req_gpu: 1, req_ram: 32, req_vram: 16,
    duration_hours: 4, access_type: "FOREGROUND",
    academic_category: "", project_title: "",
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => joinWaitlist(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["waitlist"] }); onClose() },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      setError(err.response?.data?.detail ?? "Failed to join waitlist"),
  })

  const num = (key: keyof WaitlistJoin) => ({
    type: "number" as const,
    size: "small" as const,
    value: form[key] ?? "",
    inputProps: { min: 0 },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: Number(e.target.value) })),
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: FONT_MONO, fontSize: "0.9rem" }}>JOIN WAITLIST</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          <Select size="small" value={form.system_id}
            onChange={(e) => setForm((f) => ({ ...f, system_id: Number(e.target.value) }))}>
            {systems.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </Select>
          <TextField label="Project title" size="small" value={form.project_title ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, project_title: e.target.value }))} />
          <Stack direction="row" spacing={1}>
            <TextField fullWidth label="CPU" {...num("req_cpu")} />
            <TextField fullWidth label="GPU" {...num("req_gpu")} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField fullWidth label="RAM (GB)" {...num("req_ram")} />
            <TextField fullWidth label="VRAM (GB)" {...num("req_vram")} />
          </Stack>
          <TextField fullWidth label="Duration (hours)" {...num("duration_hours")} />
          <Select size="small" value={form.access_type}
            onChange={(e) => setForm((f) => ({ ...f, access_type: e.target.value }))}>
            <MenuItem value="FOREGROUND">FOREGROUND</MenuItem>
            <MenuItem value="BACKGROUND">BACKGROUND</MenuItem>
          </Select>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button size="small" onClick={onClose}>Cancel</Button>
        <Button variant="contained" size="small" disabled={mutation.isPending}
          onClick={() => { setError(null); mutation.mutate() }}>
          {mutation.isPending ? "Joining…" : "Join waitlist"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function WaitlistPanel({ systems }: Props) {
  const theme = useTheme()
  const dark = theme.palette.mode === "dark"
  const queryClient = useQueryClient()
  const [joinOpen, setJoinOpen] = useState(false)

  const { data: entries = [] } = useQuery({
    queryKey: ["waitlist"],
    queryFn: () => listWaitlist(),
    refetchInterval: 30000,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelWaitlistEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["waitlist"] }),
  })

  const systemMap = Object.fromEntries(systems.map((s) => [s.id, s.name]))

  return (
    <>
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <HourglassEmptyRounded sx={{ fontSize: 16, color: "#FFA600" }} />
              <Typography variant="caption" sx={{ fontFamily: FONT_MONO, color: "text.secondary", fontWeight: 600, letterSpacing: "0.08em" }}>
                WAITLIST
              </Typography>
              {entries.filter(e => e.status === "WAITING").length > 0 && (
                <Chip
                  label={entries.filter(e => e.status === "WAITING").length}
                  size="small"
                  sx={{ height: 16, fontSize: "0.55rem", fontFamily: FONT_MONO, background: "rgba(255,166,0,0.15)", color: "#FFA600" }}
                />
              )}
            </Stack>
            <Button size="small" startIcon={<AddRounded />} onClick={() => setJoinOpen(true)}
              sx={{ fontFamily: FONT_MONO, fontSize: "0.7rem" }}>
              Join
            </Button>
          </Stack>

          {entries.length === 0 ? (
            <Box sx={{ px: 2, pb: 2, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary">No waitlist entries</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontFamily: FONT_MONO, fontSize: "0.65rem", color: "text.secondary", fontWeight: 600, letterSpacing: "0.06em", borderBottom: `1px solid ${dark ? "rgba(0,180,216,0.12)" : "rgba(0,119,182,0.1)"}` } }}>
                    <TableCell>SYSTEM</TableCell>
                    <TableCell>PROJECT</TableCell>
                    <TableCell align="right">CPU</TableCell>
                    <TableCell align="right">GPU</TableCell>
                    <TableCell align="right">HRS</TableCell>
                    <TableCell>STATUS</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((e) => {
                    const st = STATUS_STYLE[e.status] ?? STATUS_STYLE.CANCELLED
                    return (
                      <TableRow key={e.id} sx={{ "& td": { fontFamily: FONT_MONO, fontSize: "0.72rem", py: 1 }, "&:hover": { background: dark ? "rgba(0,180,216,0.04)" : "rgba(0,119,182,0.03)" } }}>
                        <TableCell>{systemMap[e.system_id] ?? `#${e.system_id}`}</TableCell>
                        <TableCell sx={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {e.project_title ?? "—"}
                        </TableCell>
                        <TableCell align="right">{e.req_cpu}</TableCell>
                        <TableCell align="right">{e.req_gpu}</TableCell>
                        <TableCell align="right">{e.duration_hours}</TableCell>
                        <TableCell>
                          <Chip label={e.status} size="small"
                            sx={{ fontFamily: FONT_MONO, fontSize: "0.6rem", height: 18, background: st.bg, color: st.color, border: `1px solid ${st.color}40` }} />
                        </TableCell>
                        <TableCell align="right">
                          {e.status === "WAITING" && (
                            <Tooltip title="Cancel waitlist entry">
                              <IconButton size="small" sx={{ color: "error.main" }}
                                disabled={cancelMutation.isPending}
                                onClick={() => cancelMutation.mutate(e.id)}>
                                <DeleteOutlineRounded sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                          )}
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

      <JoinDialog systems={systems} open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  )
}
