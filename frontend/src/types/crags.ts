export type AccessType = "FOREGROUND" | "BACKGROUND"
export type UserRole = "MEMBER" | "GROUP_LEAD" | "RESOURCE_ADMIN" | "SUPER_ADMIN"
export type BookingStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "PREEMPTED"
  | "CANCELLED"
  | "COMPLETED"
  | "EXPIRED"

export type ComputeSystem = {
  id: number
  name: string
  system_type: string
  cpu_cores: number
  ram_gb: number
  gpu_units: number
  vram_gb: number
}

export type AvailabilitySnapshot = {
  cpu_available: number
  gpu_available: number
  ram_available: number
  vram_available: number
}

export type BookingRequest = {
  system_id: number
  start_time: string
  end_time: string
  req_cpu: number
  req_gpu: number
  req_ram: number
  req_vram: number
  access_type: AccessType
  academic_category: string
  project_title: string
  expected_deliverable: string
  objective: string
}

export type BookingResponse = {
  id: number
  status: string
  system_id: number
  user_id: number
}

export type BookingRecord = {
  id: number
  system_id: number
  start_time: string
  end_time: string
  req_cpu: number
  req_gpu: number
  req_ram: number
  req_vram: number
  access_type: AccessType
  academic_category: string
  project_title: string
  expected_deliverable: string
  objective: string
  status: BookingStatus | string
  user_id: number
  created_at?: string
  updated_at?: string
  source?: "api" | "local"
}

export type AuditEvent = {
  id: number
  table_name: string
  record_id: number
  action: string
  timestamp: string
  user_id: number
  group_name?: string
  booking_id?: number
  metadata?: Record<string, string | number | boolean | null>
}

export type CreateSystemRequest = {
  name: string
  system_type: string
  cpu_cores: number
  ram_gb: number
  gpu_units: number
  vram_gb: number
}

export type ValidationIssue = {
  field: string
  message: string
}

export type TimelineZoom = "hour" | "day" | "week"

export type UtilizationCell = {
  start_time: string
  end_time: string
  cpu_pct: number
  gpu_pct: number
  ram_pct: number
  vram_pct: number
  has_conflict: boolean
}

export type ExplainableError = {
  title: string
  whyRejected: string
  cause: string
  fixes: string[]
  conflictingBookingId?: number
  resourceShortage?: {
    resource: "CPU" | "GPU" | "RAM" | "VRAM"
    missing: number
  }
  overlapWindow?: {
    start_time: string
    end_time: string
  }
}

export type AuthUser = {
  id: number
  username: string
  email: string | null
  role: UserRole
  group_id: number | null
  group_name: string | null
  is_active: boolean
  auth_provider: string
  created_at?: string | null
  last_login?: string | null
}

export type LoginPayload = {
  identifier: string
  password: string
}

export type LoginResponse = {
  token_type: "cookie"
  user: AuthUser
}

export type GroupQuota = {
  concurrent_cpu_quota: number | null
  concurrent_gpu_quota: number | null
  concurrent_ram_quota: number | null
  concurrent_vram_quota: number | null
  monthly_cpu_hours_quota: number | null
  monthly_gpu_hours_quota: number | null
  monthly_ram_gb_hours_quota: number | null
  monthly_vram_gb_hours_quota: number | null
}

export type GroupRecord = {
  id: number
  group_name: string
} & GroupQuota

export type GroupCreatePayload = {
  group_name: string
} & GroupQuota

export type GroupUpdatePayload = Partial<GroupCreatePayload>

export type UserCreatePayload = {
  username: string
  email: string | null
  password: string
  role: UserRole
  group_id: number | null
  is_active: boolean
}

export type UserUpdatePayload = {
  email?: string | null
  group_id?: number | null
  is_active?: boolean
  role?: UserRole
  password?: string
}

export type GroupUsageSummary = {
  group_id: number
  month: string
  cpu_hours: number
  gpu_hours: number
  ram_gb_hours: number
  vram_gb_hours: number
  bookings_count: number
}
