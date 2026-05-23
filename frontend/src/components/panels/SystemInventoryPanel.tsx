import {
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material"
import type { ComputeSystem } from "../../types/crags"

type Props = {
  systems: ComputeSystem[]
}

function HeaderWithFullName({ label, fullName }: { label: string; fullName: string }) {
  return (
    <Tooltip title={fullName} arrow>
      <span>{label}</span>
    </Tooltip>
  )
}

export function SystemInventoryPanel({ systems }: Props) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" mb={2}>
          <Typography variant="h6">System Inventory</Typography>
          <Chip label={`${systems.length} registered`} size="small" />
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>System Name</TableCell>
                <TableCell>System Type</TableCell>
                <TableCell align="right">
                  <HeaderWithFullName label="CPU" fullName="Central Processing Unit cores" />
                </TableCell>
                <TableCell align="right">
                  <HeaderWithFullName label="GPU" fullName="Graphics Processing Unit count" />
                </TableCell>
                <TableCell align="right">
                  <HeaderWithFullName label="RAM (GB)" fullName="Random Access Memory in gigabytes" />
                </TableCell>
                <TableCell align="right">
                  <HeaderWithFullName label="VRAM (GB)" fullName="Video Random Access Memory in gigabytes" />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {systems.map((system) => (
                <TableRow key={system.id} hover>
                  <TableCell>{system.name}</TableCell>
                  <TableCell>{system.system_type}</TableCell>
                  <TableCell align="right">{system.cpu_cores}</TableCell>
                  <TableCell align="right">{system.gpu_units}</TableCell>
                  <TableCell align="right">{system.ram_gb}</TableCell>
                  <TableCell align="right">{system.vram_gb}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}
