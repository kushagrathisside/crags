import { createTheme, type PaletteMode } from "@mui/material"

// ─────────────────────────────────────────────────────────────────────────────
// CRAGS design system — SINGLE SOURCE OF TRUTH.
// Change colours / fonts / radius here and the whole app follows.
// No component should hardcode a hex value; import from this file instead.
// Palette follows Google Material (Workspace) for a clean, academic, professional feel.
// ─────────────────────────────────────────────────────────────────────────────

export const FONT_SANS = '"Roboto", "Helvetica Neue", Arial, sans-serif'
export const FONT_MONO = '"Roboto Mono", "Courier New", monospace'

// Brand / accent colours (Google Material)
export const BRAND = {
  blue:   "#1A73E8",
  green:  "#1E8E3E",
  amber:  "#F9AB00",
  red:    "#D93025",
  purple: "#9334E6",
  teal:   "#12A4AF",
}

// Backwards-compatible aliases (kept so older references keep resolving)
export const CLR_BLUE  = BRAND.blue
export const CLR_TEAL  = BRAND.teal
export const CLR_RED   = BRAND.red
export const CLR_AMBER = BRAND.amber

// Neutral greys (Google)
const grey = {
  50:  "#F8F9FA",
  100: "#F1F3F4",
  200: "#E8EAED",
  300: "#DADCE0",
  500: "#9AA0A6",
  600: "#5F6368",
  800: "#3C4043",
  900: "#202124",
}

// Dark-mode surfaces
const darkSurface = {
  default: "#1F1F1F",
  paper:   "#282A2D",
  border:  "rgba(255,255,255,0.10)",
}

// ── Semantic status colours — import these instead of hardcoding hex ──────────
export type StatusTone = { color: string; bg: string }

const NEUTRAL_TONE: StatusTone = { color: grey[600], bg: "rgba(95,99,104,0.12)" }

export const STATUS_COLOR: Record<string, StatusTone> = {
  // system status
  ACTIVE:      { color: BRAND.green, bg: "rgba(30,142,62,0.12)" },
  MAINTENANCE: { color: BRAND.amber, bg: "rgba(249,171,0,0.14)" },
  OFFLINE:     { color: BRAND.red,   bg: "rgba(217,48,37,0.12)" },
  // booking / waitlist status
  CONFIRMED:   { color: BRAND.blue,  bg: "rgba(26,115,232,0.12)" },
  REQUESTED:   { color: BRAND.amber, bg: "rgba(249,171,0,0.14)" },
  WAITING:     { color: BRAND.amber, bg: "rgba(249,171,0,0.14)" },
  PROMOTED:    { color: BRAND.green, bg: "rgba(30,142,62,0.12)" },
  PREEMPTED:   { color: BRAND.red,   bg: "rgba(217,48,37,0.12)" },
  COMPLETED:   NEUTRAL_TONE,
  EXPIRED:     NEUTRAL_TONE,
  CANCELLED:   NEUTRAL_TONE,
}

export function statusTone(status: string): StatusTone {
  return STATUS_COLOR[status] ?? NEUTRAL_TONE
}

// Chart series palette
export const CHART_COLORS = [BRAND.blue, BRAND.green, BRAND.amber, BRAND.purple, BRAND.red, BRAND.teal]

export function buildTheme(mode: PaletteMode) {
  const dark = mode === "dark"
  const border = dark ? darkSurface.border : grey[200]

  return createTheme({
    palette: {
      mode,
      primary:   { main: BRAND.blue,   contrastText: "#fff" },
      secondary: { main: BRAND.purple, contrastText: "#fff" },
      success:   { main: BRAND.green },
      warning:   { main: BRAND.amber },
      error:     { main: BRAND.red },
      info:      { main: BRAND.blue },
      background: {
        default: dark ? darkSurface.default : grey[50],
        paper:   dark ? darkSurface.paper   : "#FFFFFF",
      },
      divider: dark ? darkSurface.border : grey[300],
      text: {
        primary:   dark ? "#E8EAED" : grey[900],
        secondary: dark ? "#9AA0A6" : grey[600],
      },
    },

    shape: { borderRadius: 8 },

    typography: {
      fontFamily: FONT_SANS,
      h1: { fontWeight: 500, letterSpacing: "-0.02em" },
      h2: { fontWeight: 500, letterSpacing: "-0.015em" },
      h3: { fontWeight: 500, letterSpacing: "-0.01em" },
      h4: { fontWeight: 500 },
      h5: { fontWeight: 500 },
      h6: { fontWeight: 500 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 500 },
      button: { textTransform: "none", fontWeight: 500 },
      body1: { lineHeight: 1.6 },
      body2: { lineHeight: 1.5 },
      caption: { fontFamily: FONT_MONO, letterSpacing: "0.02em", fontSize: "0.72rem" },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ":root": {
            "--scrollbar-thumb":       dark ? "rgba(255,255,255,0.2)"  : grey[300],
            "--scrollbar-thumb-hover": dark ? "rgba(255,255,255,0.35)" : grey[500],
          },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${border}`,
            borderRadius: 8,
            boxShadow: "none",
          },
        },
      },

      MuiCardContent: {
        styleOverrides: { root: { "&:last-child": { paddingBottom: 16 } } },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 500, boxShadow: "none" },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { fontFamily: FONT_MONO, fontWeight: 500, fontSize: "0.7rem", borderRadius: 6 },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 4, height: 6 },
        },
      },

      MuiAlert: {
        styleOverrides: { root: { borderRadius: 8 } },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
            background: dark ? darkSurface.paper : "#FFFFFF",
            borderRight: `1px solid ${border}`,
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },

      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 8,
              "& fieldset": { borderColor: dark ? darkSurface.border : grey[300] },
              "&:hover fieldset": { borderColor: dark ? "rgba(255,255,255,0.3)" : grey[500] },
              "&.Mui-focused fieldset": { borderColor: BRAND.blue },
            },
          },
        },
      },

      MuiTab: {
        styleOverrides: { root: { textTransform: "none", fontWeight: 500 } },
      },

      MuiDivider: {
        styleOverrides: { root: { borderColor: dark ? darkSurface.border : grey[200] } },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: "1px 8px",
            "&.Mui-selected": {
              background: dark ? "rgba(26,115,232,0.18)" : "rgba(26,115,232,0.10)",
              color: BRAND.blue,
              "&:hover": { background: dark ? "rgba(26,115,232,0.24)" : "rgba(26,115,232,0.16)" },
            },
            "&:hover": { background: dark ? "rgba(255,255,255,0.06)" : grey[100] },
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontFamily: FONT_SANS,
            fontSize: "0.72rem",
            background: grey[800],
            borderRadius: 6,
          },
        },
      },

      MuiPaper: {
        styleOverrides: { root: { backgroundImage: "none" } },
      },
    },
  })
}
