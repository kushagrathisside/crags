import { apiClient } from "./client"
import type {
  AnalyticsSummary,
  AuditEvent,
  AuthUser,
  AvailabilitySnapshot,
  BookingPolicy,
  BookingRecord,
  BookingRequest,
  BookingResponse,
  BookingTemplate,
  ComputeSystem,
  CreateSystemRequest,
  UpdateSystemRequest,
  ForgotPasswordPayload,
  GroupCreatePayload,
  GroupRecord,
  GroupUpdatePayload,
  GroupUsageSummary,
  LoginPayload,
  LoginResponse,
  MaintenanceWindow,
  MaintenanceWindowCreate,
  ResetPasswordPayload,
  UserCreatePayload,
  UserUpdatePayload,
  WaitlistEntry,
  WaitlistJoin,
} from "../types/crags"

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>("/auth/login", payload)
  return response.data
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout")
}

export async function refreshToken(): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>("/auth/refresh")
  return response.data
}

export async function forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    "/auth/forgot-password",
    payload,
  )
  return response.data
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>("/auth/reset-password", payload)
  return response.data
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>("/users/me")
  return response.data
}

export async function listGroups(): Promise<GroupRecord[]> {
  const response = await apiClient.get<GroupRecord[]>("/iam/groups")
  return response.data
}

export async function createGroup(payload: GroupCreatePayload): Promise<GroupRecord> {
  const response = await apiClient.post<GroupRecord>("/iam/groups", payload)
  return response.data
}

export async function updateGroup(groupId: number, payload: GroupUpdatePayload): Promise<GroupRecord> {
  const response = await apiClient.patch<GroupRecord>(`/iam/groups/${groupId}`, payload)
  return response.data
}

export async function listUsers(): Promise<AuthUser[]> {
  const response = await apiClient.get<AuthUser[]>("/iam/users")
  return response.data
}

export async function createUser(payload: UserCreatePayload): Promise<AuthUser> {
  const response = await apiClient.post<AuthUser>("/iam/users", payload)
  return response.data
}

export async function updateUser(userId: number, payload: UserUpdatePayload): Promise<AuthUser> {
  const response = await apiClient.patch<AuthUser>(`/iam/users/${userId}`, payload)
  return response.data
}

export async function listGroupMembers(groupId: number): Promise<AuthUser[]> {
  const response = await apiClient.get<AuthUser[]>(`/groups/${groupId}/members`)
  return response.data
}

export async function getGroupUsage(groupId: number, month?: string): Promise<GroupUsageSummary> {
  const response = await apiClient.get<GroupUsageSummary>(`/groups/${groupId}/usage`, {
    params: month ? { month } : undefined,
  })
  return response.data
}

export async function listSystems(): Promise<ComputeSystem[]> {
  const response = await apiClient.get<ComputeSystem[]>("/systems/")
  return response.data
}

export async function createSystem(payload: CreateSystemRequest): Promise<ComputeSystem> {
  const response = await apiClient.post<ComputeSystem>("/systems/", payload)
  return response.data
}

export async function updateSystem(systemId: number, payload: UpdateSystemRequest): Promise<ComputeSystem> {
  const response = await apiClient.patch<ComputeSystem>(`/systems/${systemId}`, payload)
  return response.data
}

export async function deleteSystem(systemId: number): Promise<ComputeSystem> {
  const response = await apiClient.delete<ComputeSystem>(`/systems/${systemId}`)
  return response.data
}

export async function getAvailability(params: {
  systemId: number
  startUtcIso: string
  endUtcIso: string
  signal?: AbortSignal
}): Promise<AvailabilitySnapshot> {
  const response = await apiClient.get<AvailabilitySnapshot>(`/bookings/systems/${params.systemId}/availability`, {
    signal: params.signal,
    params: {
      start_time: params.startUtcIso,
      end_time: params.endUtcIso,
    },
  })

  return response.data
}

export async function createBooking(payload: BookingRequest): Promise<BookingResponse> {
  const response = await apiClient.post<BookingResponse>("/bookings/", payload)
  return response.data
}

function parseTsRange(value: unknown): { start: string; end: string } | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const withoutBounds = trimmed.replace(/^[[(]/, "").replace(/[\])]$/, "")
  const parts = withoutBounds.split(",", 2)
  if (parts.length !== 2) {
    return null
  }

  const [start, end] = parts
  if (!start || !end) {
    return null
  }

  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  }
}

function normalizeBooking(raw: Record<string, unknown>): BookingRecord | null {
  const id = typeof raw.id === "number" ? raw.id : Number(raw.id)
  const systemId = typeof raw.system_id === "number" ? raw.system_id : Number(raw.system_id)
  const userId = typeof raw.user_id === "number" ? raw.user_id : Number(raw.user_id ?? 0)

  if (Number.isNaN(id) || Number.isNaN(systemId)) {
    return null
  }

  let startTime = typeof raw.start_time === "string" ? raw.start_time : ""
  let endTime = typeof raw.end_time === "string" ? raw.end_time : ""

  if ((!startTime || !endTime) && raw.booking_period) {
    const parsedRange = parseTsRange(raw.booking_period)
    if (parsedRange) {
      startTime = parsedRange.start
      endTime = parsedRange.end
    }
  }

  if (!startTime || !endTime) {
    return null
  }

  return {
    id,
    system_id: systemId,
    start_time: new Date(startTime).toISOString(),
    end_time: new Date(endTime).toISOString(),
    req_cpu: Number(raw.req_cpu ?? 0),
    req_gpu: Number(raw.req_gpu ?? 0),
    req_ram: Number(raw.req_ram ?? 0),
    req_vram: Number(raw.req_vram ?? 0),
    access_type: (raw.access_type as BookingRecord["access_type"]) ?? "BACKGROUND",
    academic_category: String(raw.academic_category ?? "Unknown"),
    project_title: String(raw.project_title ?? `Booking ${id}`),
    expected_deliverable: String(raw.expected_deliverable ?? ""),
    objective: String(raw.objective ?? ""),
    status: String(raw.status ?? "CONFIRMED"),
    user_id: Number.isNaN(userId) ? 0 : userId,
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
    source: "api",
  }
}

export async function listBookings(): Promise<BookingRecord[]> {
  const response = await apiClient.get<Array<Record<string, unknown>>>("/bookings/")
  return response.data.map(normalizeBooking).filter((booking): booking is BookingRecord => booking !== null)
}

export async function listAuditEvents(): Promise<AuditEvent[]> {
  const response = await apiClient.get<AuditEvent[]>("/audit/")
  return response.data
}

// ── Booking actions ───────────────────────────────────────────────────────────

export async function approveBooking(bookingId: number): Promise<BookingRecord> {
  const response = await apiClient.patch<BookingRecord>(`/bookings/${bookingId}/approve`)
  return response.data
}

export async function rejectBooking(bookingId: number, reason: string): Promise<BookingRecord> {
  const response = await apiClient.patch<BookingRecord>(`/bookings/${bookingId}/reject`, { reason })
  return response.data
}

export async function extendBooking(bookingId: number, newEndTime: string): Promise<BookingRecord> {
  const response = await apiClient.patch<BookingRecord>(`/bookings/${bookingId}/extend`, { new_end_time: newEndTime })
  return response.data
}

export async function resizeBooking(bookingId: number, resources: { req_cpu?: number; req_gpu?: number; req_ram?: number; req_vram?: number }): Promise<BookingRecord> {
  const response = await apiClient.patch<BookingRecord>(`/bookings/${bookingId}/resize`, resources)
  return response.data
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getAnalytics(fromTime?: string, toTime?: string): Promise<AnalyticsSummary> {
  const response = await apiClient.get<AnalyticsSummary>("/analytics", {
    params: { from_time: fromTime, to_time: toTime },
  })
  return response.data
}

export function getAnalyticsCsvUrl(fromTime?: string, toTime?: string): string {
  const params = new URLSearchParams()
  if (fromTime) params.set("from_time", fromTime)
  if (toTime) params.set("to_time", toTime)
  return `/api/v1/analytics/export.csv?${params.toString()}`
}

// ── Maintenance Windows ────────────────────────────────────────────────────────

export async function listMaintenanceWindows(systemId?: number): Promise<MaintenanceWindow[]> {
  const response = await apiClient.get<MaintenanceWindow[]>("/maintenance", {
    params: systemId ? { system_id: systemId } : undefined,
  })
  return response.data
}

export async function createMaintenanceWindow(payload: MaintenanceWindowCreate): Promise<MaintenanceWindow> {
  const response = await apiClient.post<MaintenanceWindow>("/maintenance", payload)
  return response.data
}

export async function deleteMaintenanceWindow(windowId: number): Promise<void> {
  await apiClient.delete(`/maintenance/${windowId}`)
}

// ── Waitlist ──────────────────────────────────────────────────────────────────

export async function listWaitlist(systemId?: number): Promise<WaitlistEntry[]> {
  const response = await apiClient.get<WaitlistEntry[]>("/waitlist", {
    params: systemId ? { system_id: systemId } : undefined,
  })
  return response.data
}

export async function joinWaitlist(payload: WaitlistJoin): Promise<WaitlistEntry> {
  const response = await apiClient.post<WaitlistEntry>("/waitlist", payload)
  return response.data
}

export async function cancelWaitlistEntry(entryId: number): Promise<void> {
  await apiClient.delete(`/waitlist/${entryId}`)
}

// ── Policies ──────────────────────────────────────────────────────────────────

export async function listPolicies(): Promise<BookingPolicy[]> {
  const response = await apiClient.get<BookingPolicy[]>("/policies")
  return response.data
}

// ── Booking Templates ─────────────────────────────────────────────────────────

export async function listTemplates(): Promise<BookingTemplate[]> {
  const response = await apiClient.get<BookingTemplate[]>("/templates")
  return response.data
}

export async function createTemplate(payload: Omit<BookingTemplate, "id" | "user_id" | "created_at" | "updated_at">): Promise<BookingTemplate> {
  const response = await apiClient.post<BookingTemplate>("/templates", payload)
  return response.data
}

export async function deleteTemplate(templateId: number): Promise<void> {
  await apiClient.delete(`/templates/${templateId}`)
}
