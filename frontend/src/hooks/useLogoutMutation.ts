import { useMutation, useQueryClient } from "@tanstack/react-query"
import { logout } from "../api/cragsApi"

export function useLogoutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["current-user"] }),
        queryClient.invalidateQueries({ queryKey: ["systems"] }),
        queryClient.invalidateQueries({ queryKey: ["bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["audit"] }),
      ])
    },
    retry: 0,
  })
}
