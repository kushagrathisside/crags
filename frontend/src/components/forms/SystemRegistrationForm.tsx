import { Alert, Button, Card, CardContent, Grid, Stack, TextField, Typography } from "@mui/material"
import { useState } from "react"
import { useCreateSystem } from "../../hooks/useCreateSystem"
import type { CreateSystemRequest } from "../../types/crags"

const initial: CreateSystemRequest = {
  name: "",
  system_type: "GPU",
  cpu_cores: 64,
  ram_gb: 256,
  gpu_units: 8,
  vram_gb: 320,
}

export function SystemRegistrationForm() {
  const [payload, setPayload] = useState<CreateSystemRequest>(initial)
  const mutation = useCreateSystem()

  const handleSubmit = async () => {
    if (!payload.name.trim()) {
      return
    }

    await mutation.mutateAsync(payload)
    setPayload(initial)
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Governance: Register New System</Typography>

          {mutation.isSuccess ? <Alert severity="success">System registered and inventory refreshed.</Alert> : null}
          {mutation.isError ? <Alert severity="error">Failed to register system.</Alert> : null}

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="System Name"
                value={payload.name}
                onChange={(event) => setPayload({ ...payload, name: event.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="System Type"
                value={payload.system_type}
                onChange={(event) => setPayload({ ...payload, system_type: event.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth
                type="number"
                label="CPU Cores"
                value={payload.cpu_cores}
                title="Central Processing Unit cores"
                onChange={(event) => setPayload({ ...payload, cpu_cores: Number(event.target.value) })}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth
                type="number"
                label="GPU Units"
                value={payload.gpu_units}
                title="Graphics Processing Unit count"
                onChange={(event) => setPayload({ ...payload, gpu_units: Number(event.target.value) })}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth
                type="number"
                label="RAM (GB)"
                value={payload.ram_gb}
                title="Random Access Memory in gigabytes"
                onChange={(event) => setPayload({ ...payload, ram_gb: Number(event.target.value) })}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                fullWidth
                type="number"
                label="VRAM (GB)"
                value={payload.vram_gb}
                title="Video Random Access Memory in gigabytes"
                onChange={(event) => setPayload({ ...payload, vram_gb: Number(event.target.value) })}
              />
            </Grid>
          </Grid>

          <Button variant="contained" onClick={() => void handleSubmit()} disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting..." : "Register System"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
