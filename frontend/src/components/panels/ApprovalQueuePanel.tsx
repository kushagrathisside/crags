import { CheckCircleOutlineRounded, CancelOutlined } from "@mui/icons-material"
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
import { approveBooking, rejectBooking } from "../../api/cragsApi"
import { FONT_MONO } from "../../theme"

function RejectDialog({ bookingId, open, onClose }: { bookingId: number; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => rejectBooking(bookingId, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bookings"] }); onClose() },
    onError: () => setError("Rejection failed. Try again."),
  })
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: FONT_MONO, fontSize: "0.9rem" }}>REJECT BOOKING #{bookingId}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} mt={1}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          <TextField
            label="Reason (required)"
            multiline
            rows={3}
            size="small"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button size="small" onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          size="small"
          disabled={!reason.trim() || mutation.isPending}
          onClick={() => { setError(null); mutation.mutate() }}
        >
          {mutation.isPending ? "Rejecting…" : "Reject"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function ApprovalQueuePanel() {
  const theme = useTheme()
  const dark = theme.palette.mode === "dark"
  const queryClient = useQueryClient()
  const [rejectId, setRejectId] = useState<number | null>(null)

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => import("../../api/cragsApi").then((m) => m.listBookings()),
    refetchInterval: 30000,
  })

  const requested = bookings.filter((b) => b.status === "REQUESTED")

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  })

  if (requested.length === 0 && !isLoading) {
    return (
      <Card>
        <CardContent sx={{ p: 3, textAlign: "center" }}>
          <CheckCircleOutlineRounded sx={{ fontSize: 36, color: "#00E5A0", mb: 1 }} />
          <Typography color="text.secondary" variant="body2">No pending approvals</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ px: 2, pt: 2, pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="caption" sx={{ fontFamily: FONT_MONO, color: "text.secondary", fontWeight: 600, letterSpacing: "0.08em" }}>
              PENDING APPROVALS
            </Typography>
            <Chip label={requested.length} size="small" sx={{ fontFamily: FONT_MONO, fontSize: "0.6rem", height: 18, background: "rgba(255,166,0,0.15)", color: "#FFA600" }} />
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontFamily: FONT_MONO, fontSize: "0.65rem", color: "text.secondary", fontWeight: 600, letterSpacing: "0.06em", borderBottom: `1px solid ${dark ? "rgba(0,180,216,0.12)" : "rgba(0,119,182,0.1)"}` } }}>
                  <TableCell>#</TableCell>
                  <TableCell>PROJECT</TableCell>
                  <TableCell align="right">CPU</TableCell>
                  <TableCell align="right">GPU</TableCell>
                  <TableCell align="right">RAM</TableCell>
                  <TableCell>START</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {requested.map((b) => (
                  <TableRow key={b.id} sx={{ "&:hover": { background: dark ? "rgba(0,180,216,0.04)" : "rgba(0,119,182,0.03)" }, "& td": { fontFamily: FONT_MONO, fontSize: "0.72rem", py: 1 } }}>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: FONT_MONO, color: "text.secondary" }}>#{b.id}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 160 }}>{b.project_title}</Typography>
                      <Typography variant="caption" color="text.secondary">user #{b.user_id}</Typography>
                    </TableCell>
                    <TableCell align="right">{b.req_cpu}</TableCell>
                    <TableCell align="right">{b.req_gpu}</TableCell>
                    <TableCell align="right">{b.req_ram}G</TableCell>
                    <TableCell>{new Date(b.start_time).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Approve">
                          <IconButton
                            size="small"
                            sx={{ color: "#00E5A0" }}
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(b.id)}
                          >
                            <CheckCircleOutlineRounded sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <IconButton size="small" sx={{ color: "error.main" }} onClick={() => setRejectId(b.id)}>
                            <CancelOutlined sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {rejectId !== null && (
        <RejectDialog bookingId={rejectId} open onClose={() => setRejectId(null)} />
      )}
    </>
  )
}
