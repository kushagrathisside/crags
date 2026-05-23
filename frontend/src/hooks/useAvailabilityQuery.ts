import { useQuery } from "@tanstack/react-query"
import { getAvailability } from "../api/cragsApi"

type Params = {
  systemId: number | null
  startUtcIso: string
  endUtcIso: string
  enabled: boolean
}

export function useAvailabilityQuery(params: Params) {
  const signature = `${params.systemId ?? "none"}|${params.startUtcIso}|${params.endUtcIso}`

  const query = useQuery({
    queryKey: ["availability", params.systemId, params.startUtcIso, params.endUtcIso],
    queryFn: ({ signal }) =>
      getAvailability({
        systemId: params.systemId ?? 0,
        startUtcIso: params.startUtcIso,
        endUtcIso: params.endUtcIso,
        signal,
      }),
    enabled: params.enabled && params.systemId !== null,
    staleTime: 5_000,
    retry: 0,
  })

  return {
    ...query,
    signature,
  }
}
