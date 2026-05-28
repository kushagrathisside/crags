import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { ThemeProvider, CssBaseline } from "@mui/material"
import { buildTheme } from "../theme"

type Mode = "light" | "dark"

interface ThemeCtx {
  mode: Mode
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>({ mode: "dark", toggle: () => {} })

function loadMode(): Mode {
  try {
    const stored = localStorage.getItem("crags-theme")
    if (stored === "light" || stored === "dark") return stored
  } catch {}
  return "dark"
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(loadMode)

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: Mode = prev === "dark" ? "light" : "dark"
      try { localStorage.setItem("crags-theme", next) } catch {}
      return next
    })
  }, [])

  const theme = useMemo(() => buildTheme(mode), [mode])
  const ctx = useMemo(() => ({ mode, toggle }), [mode, toggle])

  return (
    <Ctx.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </Ctx.Provider>
  )
}

export function useThemeMode() {
  return useContext(Ctx)
}
