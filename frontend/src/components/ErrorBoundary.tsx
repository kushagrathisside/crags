import { Alert, Box, Button, Typography } from "@mui/material"
import { Component, type ErrorInfo, type ReactNode } from "react"

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <Box sx={{ p: 2 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={this.reset}>
                Retry
              </Button>
            }
          >
            <Typography variant="body2" fontWeight={600}>
              Something went wrong
            </Typography>
            <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
              {this.state.error.message}
            </Typography>
          </Alert>
        </Box>
      )
    }
    return this.props.children
  }
}
