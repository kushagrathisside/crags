import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import { createBooking } from "../api/cragsApi"
import type { BookingRequest } from "../types/crags"

export type BookingSubmitError = {
  statusCode: number
  detail: string
}

export function useCreateBooking() {
  return useMutation({
    mutationFn: async (payload: BookingRequest) => createBooking(payload),
    retry: 0,
  })
}

export function mapBookingError(error: unknown): BookingSubmitError {
  if (axios.isAxiosError(error)) {
    return {
      statusCode: error.response?.status ?? 500,
      detail:
        typeof error.response?.data?.detail === "string"
          ? error.response.data.detail
          : "Request failed due to an unexpected API error.",
    }
  }

  return {
    statusCode: 500,
    detail: "Unknown client error while submitting booking.",
  }
}
