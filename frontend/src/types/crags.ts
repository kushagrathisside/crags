export type AccessType = "FOREGROUND" | "BACKGROUND"
export type UserRole = "MEMBER" | "GROUP_LEAD" | "RESOURCE_ADMIN" | "SUPER_ADMIN"
export type BookingStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "PREEMPTED"
  | "CANCELLED"
  | "COMPLETED"
  | "EXPIRED"

export type SystemStatus = "ACTIVE" | "MAINTENANCE" | "OFFLINE"

export type ComputeSystem = {
  id: number
  name: string
  system_type: string
  cpu_cores: number
  ram_gb: number
  gpu_units: number
  vram_gb: number
  status: SystemStatus
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
  status?: SystemStatus
}

export type UpdateSystemRequest = {
  name?: string
  system_type?: string
  cpu_cores?: number
  ram_gb?: number
  gpu_units?: number
  vram_gb?: number
  status?: SystemStatus
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
  access_token_expires_at: string
}

export type ForgotPasswordPayload = {
  email: string
}

export type ResetPasswordPayload = {
  token: string
  new_password: string
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

// ── New module types ──────────────────────────────────────────────────────────

export type WaitlistEntry = {
  id: number
  user_id: number
  system_id: number
  req_cpu: number
  req_gpu: number
  req_ram: number
  req_vram: number
  duration_hours: number
  access_type: string
  academic_category: string | null
  project_title: string | null
  status: string
  priority: number
  created_at: string
  notified_at: string | null
}

export type WaitlistJoin = {
  system_id: number
  req_cpu: number
  req_gpu: number
  req_ram: number
  req_vram: number
  duration_hours: number
  access_type: string
  academic_category?: string
  project_title?: string
}

export type MaintenanceWindow = {
  id: number
  system_id: number
  start_time: string
  end_time: string
  reason: string | null
  created_by: number | null
  created_at: string
}

export type MaintenanceWindowCreate = {
  system_id: number
  start_time: string
  end_time: string
  reason?: string
}

export type BookingPolicy = {
  id: number
  name: string
  description: string | null
  max_duration_hours: number | null
  max_advance_days: number | null
  max_concurrent_bookings: number | null
  approval_required_above_gpu: number | null
  approval_required_above_cpu: number | null
  approval_required_above_ram_gb: number | null
  approval_required_above_hours: number | null
  always_require_approval: boolean
  group_id: number | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export type AnalyticsSummary = {
  from_time: string
  to_time: string
  total_bookings: number
  total_cpu_hours: number
  total_gpu_hours: number
  total_ram_gb_hours: number
  total_vram_gb_hours: number
  per_user: ResourceUsageEntry[]
  per_group: GroupUsageEntry[]
  per_system: SystemUtilizationEntry[]
}

export type ResourceUsageEntry = {
  user_id: number
  username: string | null
  cpu_hours: number
  gpu_hours: number
  ram_gb_hours: number
  vram_gb_hours: number
  booking_count: number
}

export type GroupUsageEntry = {
  group_id: number
  group_name: string | null
  cpu_hours: number
  gpu_hours: number
  ram_gb_hours: number
  vram_gb_hours: number
  booking_count: number
}

export type SystemUtilizationEntry = {
  system_id: number
  system_name: string
  cpu_utilization_pct: number
  gpu_utilization_pct: number
  ram_utilization_pct: number
  vram_utilization_pct: number
  booking_count: number
  active_hours: number
}

export type BookingTemplate = {
  id: number
  user_id: number
  name: string
  system_id: number | null
  req_cpu: number
  req_gpu: number
  req_ram: number
  req_vram: number
  duration_hours: number | null
  access_type: string
  academic_category: string | null
  project_title: string | null
  expected_deliverable: string | null
  objective: string | null
  created_at: string
  updated_at: string
}
