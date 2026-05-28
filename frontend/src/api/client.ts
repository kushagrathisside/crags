import axios from "axios"
import type { AxiosRequestConfig } from "axios"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1"

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
})

// ---------------------------------------------------------------------------
// 401 interceptor — transparent token refresh
// ---------------------------------------------------------------------------

// Track whether a refresh is already in flight, and queue other 401s behind it.
let isRefreshing = false
let pendingQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = []

function drainQueue(error: unknown | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve()
    }
  })
  pendingQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: AxiosRequestConfig & { _retry?: boolean } = error.config ?? {}

    // Only intercept 401s that haven't been retried yet, and not from auth endpoints
    // themselves (avoids infinite loops on login / refresh failures).
    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/logout")

    if (error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // Another request is already refreshing. Queue this one.
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: () => resolve(apiClient(originalRequest)),
          reject,
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      await apiClient.post("/auth/refresh")
      drainQueue(null)
      return apiClient(originalRequest)
    } catch (refreshError) {
      drainQueue(refreshError)
      // Refresh failed — clear auth state and let callers handle the 401.
      window.dispatchEvent(new CustomEvent("crags:session-expired"))
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
