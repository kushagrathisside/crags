import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { logout } from "../api/cragsApi"

export function useLogoutMutation(onLoggedOut?: () => void) {
  const queryClient = useQueryClient()

  // Handle forced logout when the interceptor detects a failed refresh.
  // Navigate first (unmounts AppShell and all active query subscribers),
  // then clear the cache — this prevents removeQueries from triggering a
  // re-fetch on a still-mounted observer, which would loop indefinitely.
  useEffect(() => {
    const handler = () => {
      queryClient.clear()
      onLoggedOut?.()
    }
    window.addEventListener("crags:session-expired", handler)
    return () => window.removeEventListener("crags:session-expired", handler)
  }, [queryClient, onLoggedOut])

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear()
      onLoggedOut?.()
    },
    retry: 0,
  })
}
