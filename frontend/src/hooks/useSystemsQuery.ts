import { useQuery } from "@tanstack/react-query"
import { listSystems } from "../api/cragsApi"

export function useSystemsQuery(enabled = true) {
  return useQuery({
    queryKey: ["systems"],
    queryFn: listSystems,
    staleTime: 30_000,
    retry: 1,
    enabled,
  })
}
