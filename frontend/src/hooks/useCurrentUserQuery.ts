import { useQuery } from "@tanstack/react-query"
import { getCurrentUser } from "../api/cragsApi"

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: 0,
    staleTime: 30_000,
  })
}
