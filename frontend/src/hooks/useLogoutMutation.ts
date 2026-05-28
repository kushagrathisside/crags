import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { logout } from "../api/cragsApi"

function clearQueryCache(queryClient: ReturnType<typeof useQueryClient>) {
  // removeQueries synchronously clears cached data so components re-render
  // with data=undefined immediately, triggering the /login redirect.
  // invalidateQueries only marks queries stale and preserves the old data
  // during the background re-fetch, which means the auth guard never fires.
  queryClient.removeQueries({ queryKey: ["current-user"] })
  queryClient.removeQueries({ queryKey: ["systems"] })
  queryClient.removeQueries({ queryKey: ["bookings"] })
  queryClient.removeQueries({ queryKey: ["audit"] })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()

  // Listen for forced logout triggered by the Axios interceptor when refresh fails.
  useEffect(() => {
    const handler = () => {
      clearQueryCache(queryClient)
    }
    window.addEventListener("crags:session-expired", handler)
    return () => window.removeEventListener("crags:session-expired", handler)
  }, [queryClient])

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearQueryCache(queryClient)
    },
    retry: 0,
  })
}
