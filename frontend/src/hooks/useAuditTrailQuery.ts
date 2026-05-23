import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { listAuditEvents } from "../api/cragsApi"

export function useAuditTrailQuery(enabled = true) {
  return useQuery({
    queryKey: ["audit"],
    queryFn: listAuditEvents,
    staleTime: 15_000,
    retry: 0,
    enabled,
    throwOnError: false,
    meta: {
      description: "Audit endpoint may not be available in early backend versions",
    },
  })
}

export function isAuditEndpointMissing(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404
}
