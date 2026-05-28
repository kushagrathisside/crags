import { DeleteOutlineRounded, EditRounded, MemoryRounded } from "@mui/icons-material"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import type { ComputeSystem, SystemStatus, UpdateSystemRequest, UserRole } from "../../types/crags"
import { updateSystem, deleteSystem } from "../../api/cragsApi"
import { FONT_MONO } from "../../theme"

type Props = {
  systems: ComputeSystem[]
  currentRole: UserRole | undefined
}

const STATUS_STYLE: Record<SystemStatus, { color: string; bg: string }> = {
  ACTIVE:      { color: "#00E5A0", bg: "rgba(0,229,160,0.12)" },
  MAINTENANCE: { color: "#FFA600", bg: "rgba(255,166,0,0.12)" },
  OFFLINE:     { color: "#FF4560", bg: "rgba(255,69,96,0.12)"  },
}

function EditSystemDialog({ system, open, onClose }: { system: ComputeSystem; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<UpdateSystemRequest>({
    name:        system.name,
    system_type: system.system_type,
    cpu_cores:   system.cpu_cores,
    ram_gb:      system.ram_gb,
    gpu_units:   system.gpu_units,
    vram_gb:     system.vram_gb,
    status:      system.status,
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: UpdateSystemRequest) => updateSystem(system.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["systems"] }); onClose() },
    onError:   (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail ?? "Update failed")
    },
  })

  const numField = (key: keyof UpdateSystemRequest) => ({
    type: "number" as const,
    value: form[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: Number(e.target.value) })),
    inputProps: { min: 0 },
    size: "small" as const,
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: FONT_MONO, fontSize: "0.9rem" }}>
        EDIT · {system.name}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          <TextField label="Name" size="small" value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Select size="small" value={form.system_type ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, system_type: e.target.value }))}>
            {["CPU", "GPU", "HYBRID"].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
          <Select size="small" value={form.status ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SystemStatus }))}>
            {(["ACTIVE", "MAINTENANCE", "OFFLINE"] as SystemStatus[]).map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
          <Grid2 container spacing={1.5}>
            <Grid2 size={6}><TextField fullWidth label="CPU cores" {...numField("cpu_cores")} /></Grid2>
            <Grid2 size={6}><TextField fullWidth label="GPU units" {...numField("gpu_units")} /></Grid2>
            <Grid2 size={6}><TextField fullWidth label="RAM (GB)"  {...numField("ram_gb")} /></Grid2>
            <Grid2 size={6}><TextField fullWidth label="VRAM (GB)" {...numField("vram_gb")} /></Grid2>
          </Grid2>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} size="small">Cancel</Button>
        <Button variant="contained" size="small" disabled={mutation.isPending}
          onClick={() => { setError(null); mutation.mutate(form) }}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Grid2 shim to avoid another import
function Grid2({ container, spacing, size, children }: { container?: boolean; spacing?: number; size?: number; children: React.ReactNode }) {
  void size
  if (container) {
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing ? spacing * 0.5 : 0 }}>
        {children}
      </Box>
    )
  }
  return <Box>{children}</Box>
}

export function SystemInventoryPanel({ systems, currentRole }: Props) {
  const theme   = useTheme()
  const dark    = theme.palette.mode === "dark"
  const queryClient = useQueryClient()
  const [editTarget, setEditTarget] = useState<ComputeSystem | null>(null)
  const isAdmin = currentRole === "RESOURCE_ADMIN" || currentRole === "SUPER_ADMIN"

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSystem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["systems"] }),
  })

  if (systems.length === 0) {
    return (
      <Card>
        <CardContent sx={{ p: 3, textAlign: "center" }}>
          <MemoryRounded sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">No systems registered yet.</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    "& .MuiTableCell-head": {
                      fontFamily: FONT_MONO,
                      fontSize: "0.68rem",
                      color: "text.secondary",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      borderBottom: `1px solid ${dark ? "rgba(0,180,216,0.12)" : "rgba(0,119,182,0.1)"}`,
                      py: 1.5,
                      px: 2,
                    },
                  }}
                >
                  <TableCell>NAME</TableCell>
                  <TableCell>TYPE</TableCell>
                  <TableCell>STATUS</TableCell>
                  <TableCell align="right">
                    <Tooltip title="CPU cores" arrow><span>CPU</span></Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="GPU units" arrow><span>GPU</span></Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="RAM in GB" arrow><span>RAM</span></Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="VRAM in GB" arrow><span>VRAM</span></Tooltip>
                  </TableCell>
                  {isAdmin && <TableCell align="right" />}
                </TableRow>
              </TableHead>
              <TableBody>
                {systems.map((sys) => {
                  const st = STATUS_STYLE[sys.status] ?? { color: "#888", bg: "rgba(136,136,136,0.1)" }
                  return (
                    <TableRow
                      key={sys.id}
                      sx={{
                        "&:hover": { background: dark ? "rgba(0,180,216,0.04)" : "rgba(0,119,182,0.03)" },
                        "& .MuiTableCell-body": { borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, py: 1.25, px: 2 },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{sys.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: FONT_MONO }}>#{sys.id}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={sys.system_type} size="small" sx={{ fontFamily: FONT_MONO, fontSize: "0.65rem", height: 20 }} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sys.status}
                          size="small"
                          sx={{ fontFamily: FONT_MONO, fontSize: "0.65rem", height: 22, background: st.bg, color: st.color, border: `1px solid ${st.color}40` }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: FONT_MONO }}>{sys.cpu_cores}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: FONT_MONO }}>{sys.gpu_units}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: FONT_MONO }}>{sys.ram_gb}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: FONT_MONO }}>{sys.vram_gb}</TableCell>
                      {isAdmin && (
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Edit system">
                              <IconButton size="small" onClick={() => setEditTarget(sys)}>
                                <EditRounded sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={sys.status === "OFFLINE" ? "Already offline" : "Decommission (set OFFLINE)"}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={sys.status === "OFFLINE" || deleteMutation.isPending}
                                  onClick={() => deleteMutation.mutate(sys.id)}
                                  sx={{ color: "error.main", "&:hover": { background: "rgba(255,69,96,0.1)" } }}
                                >
                                  <DeleteOutlineRounded sx={{ fontSize: 15 }} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {editTarget && (
        <EditSystemDialog system={editTarget} open onClose={() => setEditTarget(null)} />
      )}
    </>
  )
}
