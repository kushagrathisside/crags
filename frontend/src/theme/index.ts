import { createTheme, type PaletteMode } from "@mui/material"

export const FONT_MONO = '"JetBrains Mono", "Fira Code", "Courier New", monospace'
export const FONT_SANS = '"Inter", "Segoe UI", sans-serif'

// ── Design-file colour tokens ──────────────────────────────────────────────────
// Zinc neutrals (from design files)
const zinc = {
  50:  "#F6F6F5",
  100: "#F2F2F1",
  200: "#E4E4E2",
  400: "#A1A1AA",
  500: "#71717A",
  900: "#18181B",
  950: "#0A0D10",
}

// Accent colours — hex equivalents of the oklch values used in the designs:
//   oklch(0.62 0.19 255) ≈ #1E85F4   blue / primary
//   oklch(0.62 0.19 200) ≈ #00A4B3   teal / secondary & success
//   oklch(0.58 0.21 25)  ≈ #DB2B28   red  / error & preempted
//   oklch(0.62 0.19 60)  ≈ #D46100   amber / warning & requested
export const CLR_BLUE  = "#1E85F4"   // oklch(0.62 0.19 255)
export const CLR_TEAL  = "#00A4B3"   // oklch(0.62 0.19 200)
export const CLR_RED   = "#DB2B28"   // oklch(0.58 0.21 25)
export const CLR_AMBER = "#D46100"   // oklch(0.62 0.19 60)

// Use these CSS colour strings directly in sx props for pixel-perfect rendering:
export const OKLCH_BLUE  = "oklch(0.62 0.19 255)"
export const OKLCH_TEAL  = "oklch(0.62 0.19 200)"
export const OKLCH_RED   = "oklch(0.58 0.21 25)"
export const OKLCH_AMBER = "oklch(0.62 0.19 60)"

export function buildTheme(mode: PaletteMode) {
  const dark = mode === "dark"

  return createTheme({
    palette: {
      mode,
      primary:   { main: CLR_BLUE,  contrastText: "#fff" },
      secondary: { main: CLR_TEAL,  contrastText: "#fff" },
      error:     { main: CLR_RED },
      warning:   { main: CLR_AMBER },
      success:   { main: CLR_TEAL },
      background: {
        default: dark ? zinc[950] : zinc[50],
        paper:   dark ? zinc[900] : "#FFFFFF",
      },
      divider: dark ? "rgba(228,228,226,0.08)" : zinc[200],
      text: {
        primary:   dark ? zinc[100] : zinc[900],
        secondary: dark ? zinc[400] : zinc[500],
      },
    },

    shape: { borderRadius: 4 },

    typography: {
      fontFamily: FONT_SANS,
      h1: { fontWeight: 700, letterSpacing: "-0.025em" },
      h2: { fontWeight: 700, letterSpacing: "-0.02em" },
      h3: { fontWeight: 600, letterSpacing: "-0.015em" },
      h4: { fontWeight: 600, letterSpacing: "-0.01em" },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 600, letterSpacing: "0.04em" },
      body1: { lineHeight: 1.6 },
      body2: { lineHeight: 1.5 },
      caption: { fontFamily: FONT_MONO, letterSpacing: "0.06em", fontSize: "0.7rem" },
      overline: { fontFamily: FONT_MONO, letterSpacing: "0.1em", fontSize: "0.65rem", fontWeight: 600 },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ":root": {
            "--scrollbar-thumb":       dark ? `${CLR_BLUE}44` : `${zinc[400]}88`,
            "--scrollbar-thumb-hover": dark ? `${CLR_BLUE}77` : zinc[400],
          },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            background: dark ? zinc[900] : "#FFFFFF",
            border: `1px solid ${dark ? "rgba(228,228,226,0.07)" : zinc[200]}`,
            boxShadow: "none",
          },
        },
      },

      MuiCardContent: {
        styleOverrides: {
          root: { "&:last-child": { paddingBottom: 16 } },
        },
      },

      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            letterSpacing: "0.01em",
            boxShadow: "none",
            "&:hover": { boxShadow: "none" },
            "&:active": { boxShadow: "none" },
          },
          containedPrimary: {
            background: CLR_BLUE,
            "&:hover": { background: "#1A78DC" },
          },
          containedSecondary: {
            background: CLR_TEAL,
            "&:hover": { background: "#009AAA" },
          },
          outlinedPrimary: {
            borderColor: dark ? `${CLR_BLUE}66` : `${CLR_BLUE}88`,
            "&:hover": {
              borderColor: CLR_BLUE,
              background: `${CLR_BLUE}0D`,
            },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily: FONT_MONO,
            fontSize: "0.68rem",
            fontWeight: 600,
            letterSpacing: "0.05em",
            height: 22,
            borderRadius: 4,
          },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 2, height: 4 },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 4 },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: dark ? zinc[950] : "#FFFFFF",
            borderRight: `1px solid ${dark ? "rgba(228,228,226,0.07)" : zinc[200]}`,
          },
        },
      },

      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 4,
              "& fieldset": { borderColor: dark ? "rgba(228,228,226,0.15)" : zinc[200] },
              "&:hover fieldset": { borderColor: dark ? zinc[400] : zinc[500] },
              "&.Mui-focused fieldset": { borderColor: CLR_BLUE },
            },
          },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 600 },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: dark ? "rgba(228,228,226,0.07)" : zinc[200],
          },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            margin: "1px 6px",
            "&.Mui-selected": {
              background: dark ? `${CLR_BLUE}18` : `${CLR_BLUE}12`,
              borderLeft: `2px solid ${CLR_BLUE}`,
              paddingLeft: "14px",
              "&:hover": { background: dark ? `${CLR_BLUE}22` : `${CLR_BLUE}18` },
            },
            "&:hover": { background: dark ? "rgba(228,228,226,0.05)" : `${CLR_BLUE}08` },
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontFamily: FONT_MONO,
            fontSize: "0.7rem",
            background: dark ? zinc[200] : zinc[900],
            color: dark ? zinc[900] : zinc[50],
            borderRadius: 4,
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
    },
  })
}
