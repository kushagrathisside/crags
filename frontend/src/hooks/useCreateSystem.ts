import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createSystem } from "../api/cragsApi"
import type { CreateSystemRequest } from "../types/crags"

export function useCreateSystem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateSystemRequest) => createSystem(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["systems"] })
    },
    retry: 0,
  })
}
