import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#145da0",
    },
    secondary: {
      main: "#2e7d32",
    },
    background: {
      default: "#f4f7fa",
      paper: "#ffffff",
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: ["IBM Plex Sans", "Segoe UI", "Helvetica", "Arial", "sans-serif"].join(","),
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
