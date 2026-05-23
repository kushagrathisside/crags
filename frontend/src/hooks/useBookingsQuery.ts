import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { listBookings } from "../api/cragsApi"

export function useBookingsQuery(enabled = true) {
  return useQuery({
    queryKey: ["bookings"],
    queryFn: listBookings,
    staleTime: 10_000,
    retry: 0,
    enabled,
  })
}

export function isBookingsEndpointMissing(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405)
}
