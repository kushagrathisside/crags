import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material"
import { useState } from "react"

type Props = {
  busy: boolean
  errorMessage: string | null
  onSubmit: (payload: { identifier: string; password: string }) => void
}

export function LoginPanel({ busy, errorMessage, onSubmit }: Props) {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")

  return (
    <Card variant="outlined" sx={{ maxWidth: 440, mx: "auto", mt: 6 }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5" fontWeight={700}>
            CRAGS Login
          </Typography>
          <Typography color="text.secondary">
            Sign in with username or email to access role-scoped scheduler controls.
          </Typography>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          <TextField
            fullWidth
            label="Username or Email"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <Button
            variant="contained"
            disabled={busy || !identifier.trim() || !password}
            onClick={() => onSubmit({ identifier: identifier.trim(), password })}
          >
            {busy ? "Signing in..." : "Sign In"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
