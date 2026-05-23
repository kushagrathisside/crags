import { useMutation, useQueryClient } from "@tanstack/react-query"
import { login } from "../api/cragsApi"
import type { LoginPayload } from "../types/crags"

export function useLoginMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-user"] })
    },
    retry: 0,
  })
}
