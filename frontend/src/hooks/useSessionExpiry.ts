import { useEffect, useRef, useState } from "react"
import { refreshToken } from "../api/cragsApi"

/**
 * Tracks access token expiry and pre-emptively refreshes before it expires.
 *
 * Usage:
 *   const { secondsRemaining, isExpiringSoon } = useSessionExpiry(expiresAt, onExpired)
 *
 * - expiresAt:      ISO string from LoginResponse.access_token_expires_at
 * - onExpired:      called when the session cannot be refreshed (e.g. refresh token also expired)
 * - isExpiringSoon: true when < 2 minutes remain (use to show a warning banner)
 */

const REFRESH_BEFORE_SECONDS = 60   // refresh when 60 s remain
const WARN_AT_SECONDS = 120         // show banner when 2 min remain

interface SessionExpiryState {
  secondsRemaining: number | null
  isExpiringSoon: boolean
}

export function useSessionExpiry(
  expiresAt: string | null | undefined,
  onExpired: () => void,
): SessionExpiryState {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)
  const refreshingRef = useRef(false)

  useEffect(() => {
    if (!expiresAt) {
      setSecondsRemaining(null)
      return
    }

    const expiryMs = new Date(expiresAt).getTime()

    const tick = async () => {
      const remaining = Math.floor((expiryMs - Date.now()) / 1000)
      setSecondsRemaining(remaining)

      if (remaining <= 0) {
        // Already expired — the interceptor will handle the 401, but we trigger
        // onExpired here too for UI state.
        onExpired()
        return
      }

      if (remaining <= REFRESH_BEFORE_SECONDS && !refreshingRef.current) {
        refreshingRef.current = true
        try {
          await refreshToken()
          // The caller should update expiresAt from the new LoginResponse,
          // which will reset this hook via the expiresAt dependency changing.
        } catch {
          // Refresh failed — session is truly over.
          onExpired()
        } finally {
          refreshingRef.current = false
        }
      }
    }

    // Run immediately, then every 10 seconds.
    tick()
    const interval = setInterval(tick, 10_000)
    return () => clearInterval(interval)
  }, [expiresAt, onExpired])

  return {
    secondsRemaining,
    isExpiringSoon: secondsRemaining !== null && secondsRemaining <= WARN_AT_SECONDS,
  }
}
