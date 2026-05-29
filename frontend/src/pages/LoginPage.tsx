import { BoltRounded, LightModeRounded, DarkModeRounded } from "@mui/icons-material"
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { useState } from "react"
import { Navigate } from "react-router-dom"
import { useThemeMode } from "../context/ThemeContext"
import { useCurrentUserQuery } from "../hooks/useCurrentUserQuery"
import { useLoginMutation } from "../hooks/useLoginMutation"
import { FONT_MONO } from "../theme"
import axios from "axios"

export function LoginPage() {
  const theme = useTheme()
  const dark = theme.palette.mode === "dark"
  const { toggle } = useThemeMode()

  const currentUserQuery = useCurrentUserQuery()
  const loginMutation = useLoginMutation()

  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  if (currentUserQuery.data) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await loginMutation.mutateAsync({ identifier, password })
    } catch (err) {
      if (axios.isAxiosError(err) && typeof err.response?.data?.detail === "string") {
        setError(err.response.data.detail)
      } else {
        setError("Authentication failed. Check your credentials and try again.")
      }
    }
  }

  const busy = loginMutation.isPending

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: dark ? "#0A0D10" : "#F6F6F5",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle grid overlay */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: dark
            ? "linear-gradient(rgba(228,228,226,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(228,228,226,0.03) 1px, transparent 1px)"
            : "linear-gradient(rgba(113,113,122,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(113,113,122,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />

      {/* Theme toggle */}
      <Box sx={{ position: "absolute", top: 16, right: 16 }}>
        <Tooltip title={dark ? "Light mode" : "Dark mode"}>
          <IconButton onClick={toggle} size="small">
            {dark ? <LightModeRounded fontSize="small" /> : <DarkModeRounded fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Card */}
      <Box
        component="form"
        onSubmit={(e) => void handleSubmit(e)}
        sx={{
          width: "100%",
          maxWidth: 400,
          mx: 2,
          p: 4,
          borderRadius: "4px",
          background: dark ? "#18181B" : "#FFFFFF",
          border: `1px solid ${dark ? "rgba(228,228,226,0.07)" : "#E4E4E2"}`,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo + title */}
        <Stack alignItems="center" spacing={1} sx={{ mb: 4 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "8px",
              background: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 0.5,
            }}
          >
            <BoltRounded sx={{ fontSize: 22, color: "#fff" }} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontFamily: FONT_MONO,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "text.primary",
              textTransform: "uppercase",
            }}
          >
            CRAGS
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", maxWidth: 280 }}>
            Compute Resource Allocation &amp; Governance System
          </Typography>
        </Stack>

        <Stack spacing={2}>
          {error && <Alert severity="error" sx={{ fontSize: "0.8rem" }}>{error}</Alert>}

          <TextField
            fullWidth
            label="Username or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={busy}
            autoComplete="username"
            autoFocus
            size="small"
            InputProps={{
              sx: { fontFamily: FONT_MONO, fontSize: "0.875rem" },
            }}
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="current-password"
            size="small"
            InputProps={{
              endAdornment: busy ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ) : null,
              sx: { fontFamily: FONT_MONO, fontSize: "0.875rem" },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={busy || !identifier.trim() || !password}
            sx={{ mt: 1, py: 1.25, fontSize: "0.9rem" }}
          >
            {busy ? "Authenticating…" : "Sign In"}
          </Button>
        </Stack>

        <Typography
          variant="caption"
          sx={{
            display: "block",
            textAlign: "center",
            mt: 3,
            color: "text.secondary",
            fontFamily: FONT_MONO,
          }}
        >
          v0.1.0 · Restricted Access
        </Typography>
      </Box>
    </Box>
  )
}
