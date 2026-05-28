import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { createGroup, createUser, listGroups, listUsers, updateGroup, updateUser } from "../../api/cragsApi"
import type { GroupCreatePayload, GroupRecord, GroupUpdatePayload, UserRole, UserUpdatePayload } from "../../types/crags"

type Props = {
  currentRole: UserRole
}

type GroupDraft = GroupUpdatePayload
type UserDraft = UserUpdatePayload

const quotaFieldLabels = {
  concurrent_cpu_quota: {
    label: "Conc CPU",
    fullName: "Concurrent Central Processing Unit core quota",
  },
  concurrent_gpu_quota: {
    label: "Conc GPU",
    fullName: "Concurrent Graphics Processing Unit quota",
  },
  concurrent_ram_quota: {
    label: "Conc RAM",
    fullName: "Concurrent Random Access Memory quota in gigabytes",
  },
  concurrent_vram_quota: {
    label: "Conc VRAM",
    fullName: "Concurrent Video Random Access Memory quota in gigabytes",
  },
  monthly_cpu_hours_quota: {
    label: "Month CPU-h",
    fullName: "Monthly Central Processing Unit core-hour quota",
  },
  monthly_gpu_hours_quota: {
    label: "Month GPU-h",
    fullName: "Monthly Graphics Processing Unit-hour quota",
  },
  monthly_ram_gb_hours_quota: {
    label: "Month RAM-h",
    fullName: "Monthly Random Access Memory gigabyte-hour quota",
  },
  monthly_vram_gb_hours_quota: {
    label: "Month VRAM-h",
    fullName: "Monthly Video Random Access Memory gigabyte-hour quota",
  },
} as const

const emptyGroupForm: GroupCreatePayload = {
  group_name: "",
  concurrent_cpu_quota: null,
  concurrent_gpu_quota: null,
  concurrent_ram_quota: null,
  concurrent_vram_quota: null,
  monthly_cpu_hours_quota: null,
  monthly_gpu_hours_quota: null,
  monthly_ram_gb_hours_quota: null,
  monthly_vram_gb_hours_quota: null,
}

function toNullableNumber(raw: string): number | null {
  if (!raw.trim()) {
    return null
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

function quotaText(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return ""
  }

  return String(value)
}

function quotaLabel(field: keyof typeof quotaFieldLabels) {
  const { label, fullName } = quotaFieldLabels[field]

  return (
    <Tooltip title={fullName} arrow>
      <span>{label}</span>
    </Tooltip>
  )
}

function quotaInputProps(field: keyof typeof quotaFieldLabels) {
  return {
    title: quotaFieldLabels[field].fullName,
    inputProps: {
      "aria-label": quotaFieldLabels[field].fullName,
    },
  }
}

function initialGroupDraft(group: GroupRecord): GroupDraft {
  return {
    group_name: group.group_name,
    concurrent_cpu_quota: group.concurrent_cpu_quota,
    concurrent_gpu_quota: group.concurrent_gpu_quota,
    concurrent_ram_quota: group.concurrent_ram_quota,
    concurrent_vram_quota: group.concurrent_vram_quota,
    monthly_cpu_hours_quota: group.monthly_cpu_hours_quota,
    monthly_gpu_hours_quota: group.monthly_gpu_hours_quota,
    monthly_ram_gb_hours_quota: group.monthly_ram_gb_hours_quota,
    monthly_vram_gb_hours_quota: group.monthly_vram_gb_hours_quota,
  }
}

export function TeamManagementPanel({ currentRole }: Props) {
  const queryClient = useQueryClient()
  const canManageRoles = currentRole === "SUPER_ADMIN"

  const groupsQuery = useQuery({
    queryKey: ["iam-groups"],
    queryFn: listGroups,
  })
  const usersQuery = useQuery({
    queryKey: ["iam-users"],
    queryFn: listUsers,
  })

  const [groupForm, setGroupForm] = useState<GroupCreatePayload>(emptyGroupForm)
  const [groupDrafts, setGroupDrafts] = useState<Record<number, GroupDraft>>({})
  const [userDrafts, setUserDrafts] = useState<Record<number, UserDraft>>({})
  const [userCreateForm, setUserCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "MEMBER" as UserRole,
    group_id: "",
    is_active: true,
  })

  const groupOptions = groupsQuery.data ?? []

  const groupMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: async () => {
      setGroupForm(emptyGroupForm)
      await queryClient.invalidateQueries({ queryKey: ["iam-groups"] })
    },
  })

  const groupUpdateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: GroupUpdatePayload }) => updateGroup(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["iam-groups"] })
    },
  })

  const userCreateMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setUserCreateForm({
        username: "",
        email: "",
        password: "",
        role: "MEMBER",
        group_id: "",
        is_active: true,
      })
      await queryClient.invalidateQueries({ queryKey: ["iam-users"] })
    },
  })

  const userUpdateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserUpdatePayload }) => updateUser(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["iam-users"] })
    },
  })

  const groupErrors = useMemo(() => {
    if (!groupMutation.error) {
      return null
    }
    return "Failed to create group."
  }, [groupMutation.error])

  const userErrors = useMemo(() => {
    if (!userCreateMutation.error) {
      return null
    }
    return "Failed to create user."
  }, [userCreateMutation.error])

  if (groupsQuery.isLoading || usersQuery.isLoading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 2 }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary">Loading team data…</Typography>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  if (groupsQuery.isError || usersQuery.isError) {
    const msg = (groupsQuery.error ?? usersQuery.error) instanceof Error
      ? ((groupsQuery.error ?? usersQuery.error) as Error).message
      : "Failed to load team data."
    return (
      <Card variant="outlined">
        <CardContent>
          <Alert severity="error">{msg}</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Team, Member & Quota Control</Typography>
          <Typography color="text.secondary">
            Manage groups, assign members, and enforce concurrent and monthly quota budgets.
          </Typography>

          {groupErrors ? <Alert severity="error">{groupErrors}</Alert> : null}
          {userErrors ? <Alert severity="error">{userErrors}</Alert> : null}

          <Divider />

          <Typography variant="subtitle2">Create Group</Typography>
          <Grid container spacing={1}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Group Name"
                value={groupForm.group_name}
                onChange={(event) => setGroupForm((current) => ({ ...current, group_name: event.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                label={quotaLabel("concurrent_cpu_quota")}
                type="number"
                value={quotaText(groupForm.concurrent_cpu_quota)}
                {...quotaInputProps("concurrent_cpu_quota")}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, concurrent_cpu_quota: toNullableNumber(event.target.value) }))
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                label={quotaLabel("concurrent_gpu_quota")}
                type="number"
                value={quotaText(groupForm.concurrent_gpu_quota)}
                {...quotaInputProps("concurrent_gpu_quota")}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, concurrent_gpu_quota: toNullableNumber(event.target.value) }))
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                label={quotaLabel("monthly_cpu_hours_quota")}
                type="number"
                value={quotaText(groupForm.monthly_cpu_hours_quota)}
                {...quotaInputProps("monthly_cpu_hours_quota")}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, monthly_cpu_hours_quota: toNullableNumber(event.target.value) }))
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                label={quotaLabel("monthly_gpu_hours_quota")}
                type="number"
                value={quotaText(groupForm.monthly_gpu_hours_quota)}
                {...quotaInputProps("monthly_gpu_hours_quota")}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, monthly_gpu_hours_quota: toNullableNumber(event.target.value) }))
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                label={quotaLabel("concurrent_ram_quota")}
                type="number"
                value={quotaText(groupForm.concurrent_ram_quota)}
                {...quotaInputProps("concurrent_ram_quota")}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, concurrent_ram_quota: toNullableNumber(event.target.value) }))
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                label={quotaLabel("concurrent_vram_quota")}
                type="number"
                value={quotaText(groupForm.concurrent_vram_quota)}
                {...quotaInputProps("concurrent_vram_quota")}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, concurrent_vram_quota: toNullableNumber(event.target.value) }))
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                label={quotaLabel("monthly_ram_gb_hours_quota")}
                type="number"
                value={quotaText(groupForm.monthly_ram_gb_hours_quota)}
                {...quotaInputProps("monthly_ram_gb_hours_quota")}
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    monthly_ram_gb_hours_quota: toNullableNumber(event.target.value),
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                label={quotaLabel("monthly_vram_gb_hours_quota")}
                type="number"
                value={quotaText(groupForm.monthly_vram_gb_hours_quota)}
                {...quotaInputProps("monthly_vram_gb_hours_quota")}
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    monthly_vram_gb_hours_quota: toNullableNumber(event.target.value),
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button
                variant="contained"
                disabled={groupMutation.isPending || !groupForm.group_name.trim()}
                onClick={() => groupMutation.mutate(groupForm)}
              >
                {groupMutation.isPending ? "Creating..." : "Create Group"}
              </Button>
            </Grid>
          </Grid>

          <Divider />

          <Typography variant="subtitle2">Group Quotas</Typography>
          <Stack spacing={1.2}>
            {(groupsQuery.data ?? []).map((group) => {
              const draft = groupDrafts[group.id] ?? initialGroupDraft(group)

              return (
                <Box key={group.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1 }}>
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        fullWidth
                        label="Group Name"
                        value={draft.group_name ?? ""}
                        onChange={(event) =>
                          setGroupDrafts((current) => ({
                            ...current,
                            [group.id]: { ...draft, group_name: event.target.value },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 1.5 }}>
                      <TextField
                        fullWidth
                        label={quotaLabel("concurrent_cpu_quota")}
                        type="number"
                        value={quotaText(draft.concurrent_cpu_quota ?? null)}
                        {...quotaInputProps("concurrent_cpu_quota")}
                        onChange={(event) =>
                          setGroupDrafts((current) => ({
                            ...current,
                            [group.id]: { ...draft, concurrent_cpu_quota: toNullableNumber(event.target.value) },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 1.5 }}>
                      <TextField
                        fullWidth
                        label={quotaLabel("concurrent_gpu_quota")}
                        type="number"
                        value={quotaText(draft.concurrent_gpu_quota ?? null)}
                        {...quotaInputProps("concurrent_gpu_quota")}
                        onChange={(event) =>
                          setGroupDrafts((current) => ({
                            ...current,
                            [group.id]: { ...draft, concurrent_gpu_quota: toNullableNumber(event.target.value) },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 2 }}>
                      <TextField
                        fullWidth
                        label={quotaLabel("monthly_cpu_hours_quota")}
                        type="number"
                        value={quotaText(draft.monthly_cpu_hours_quota ?? null)}
                        {...quotaInputProps("monthly_cpu_hours_quota")}
                        onChange={(event) =>
                          setGroupDrafts((current) => ({
                            ...current,
                            [group.id]: { ...draft, monthly_cpu_hours_quota: toNullableNumber(event.target.value) },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 2 }}>
                      <TextField
                        fullWidth
                        label={quotaLabel("monthly_gpu_hours_quota")}
                        type="number"
                        value={quotaText(draft.monthly_gpu_hours_quota ?? null)}
                        {...quotaInputProps("monthly_gpu_hours_quota")}
                        onChange={(event) =>
                          setGroupDrafts((current) => ({
                            ...current,
                            [group.id]: { ...draft, monthly_gpu_hours_quota: toNullableNumber(event.target.value) },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 1.5 }}>
                      <TextField
                        fullWidth
                        label={quotaLabel("concurrent_ram_quota")}
                        type="number"
                        value={quotaText(draft.concurrent_ram_quota ?? null)}
                        {...quotaInputProps("concurrent_ram_quota")}
                        onChange={(event) =>
                          setGroupDrafts((current) => ({
                            ...current,
                            [group.id]: { ...draft, concurrent_ram_quota: toNullableNumber(event.target.value) },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 1.5 }}>
                      <TextField
                        fullWidth
                        label={quotaLabel("concurrent_vram_quota")}
                        type="number"
                        value={quotaText(draft.concurrent_vram_quota ?? null)}
                        {...quotaInputProps("concurrent_vram_quota")}
                        onChange={(event) =>
                          setGroupDrafts((current) => ({
                            ...current,
                            [group.id]: { ...draft, concurrent_vram_quota: toNullableNumber(event.target.value) },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 2 }}>
                      <TextField
                        fullWidth
                        label={quotaLabel("monthly_ram_gb_hours_quota")}
                        type="number"
                        value={quotaText(draft.monthly_ram_gb_hours_quota ?? null)}
                        {...quotaInputProps("monthly_ram_gb_hours_quota")}
                        onChange={(event) =>
                          setGroupDrafts((current) => ({
                            ...current,
                            [group.id]: { ...draft, monthly_ram_gb_hours_quota: toNullableNumber(event.target.value) },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 2 }}>
                      <TextField
                        fullWidth
                        label={quotaLabel("monthly_vram_gb_hours_quota")}
                        type="number"
                        value={quotaText(draft.monthly_vram_gb_hours_quota ?? null)}
                        {...quotaInputProps("monthly_vram_gb_hours_quota")}
                        onChange={(event) =>
                          setGroupDrafts((current) => ({
                            ...current,
                            [group.id]: {
                              ...draft,
                              monthly_vram_gb_hours_quota: toNullableNumber(event.target.value),
                            },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 2 }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => groupUpdateMutation.mutate({ id: group.id, payload: draft })}
                        disabled={groupUpdateMutation.isPending}
                      >
                        Save Quota
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              )
            })}
          </Stack>

          <Divider />

          <Typography variant="subtitle2">Create User</Typography>
          <Grid container spacing={1}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Username"
                value={userCreateForm.username}
                onChange={(event) => setUserCreateForm((current) => ({ ...current, username: event.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Email"
                value={userCreateForm.email}
                onChange={(event) => setUserCreateForm((current) => ({ ...current, email: event.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={userCreateForm.password}
                onChange={(event) => setUserCreateForm((current) => ({ ...current, password: event.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                select
                label="Role"
                value={userCreateForm.role}
                onChange={(event) =>
                  setUserCreateForm((current) => ({ ...current, role: event.target.value as UserRole }))
                }
              >
                <MenuItem value="MEMBER">MEMBER</MenuItem>
                <MenuItem value="GROUP_LEAD">GROUP_LEAD</MenuItem>
                {canManageRoles ? <MenuItem value="RESOURCE_ADMIN">RESOURCE_ADMIN</MenuItem> : null}
                {canManageRoles ? <MenuItem value="SUPER_ADMIN">SUPER_ADMIN</MenuItem> : null}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                select
                label="Group"
                value={userCreateForm.group_id}
                onChange={(event) => setUserCreateForm((current) => ({ ...current, group_id: event.target.value }))}
              >
                <MenuItem value="">No group</MenuItem>
                {groupOptions.map((group) => (
                  <MenuItem key={group.id} value={String(group.id)}>
                    {group.group_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={userCreateForm.is_active}
                    onChange={(event) =>
                      setUserCreateForm((current) => ({ ...current, is_active: event.target.checked }))
                    }
                  />
                }
                label="Active User"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button
                variant="contained"
                disabled={userCreateMutation.isPending || !userCreateForm.username.trim() || !userCreateForm.password}
                onClick={() =>
                  userCreateMutation.mutate({
                    username: userCreateForm.username.trim(),
                    email: userCreateForm.email.trim() || null,
                    password: userCreateForm.password,
                    role: userCreateForm.role,
                    group_id: userCreateForm.group_id ? Number(userCreateForm.group_id) : null,
                    is_active: userCreateForm.is_active,
                  })
                }
              >
                {userCreateMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </Grid>
          </Grid>

          <Divider />

          <Typography variant="subtitle2">Manage Members</Typography>
          <Stack spacing={1}>
            {(usersQuery.data ?? []).map((user) => {
              const draft = userDrafts[user.id] ?? {
                email: user.email,
                group_id: user.group_id,
                is_active: user.is_active,
              }

              return (
                <Box key={user.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1 }}>
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 12, md: 2 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {user.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.role}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Email"
                        value={draft.email ?? ""}
                        onChange={(event) =>
                          setUserDrafts((current) => ({
                            ...current,
                            [user.id]: { ...draft, email: event.target.value },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        fullWidth
                        size="small"
                        select
                        label="Group"
                        value={draft.group_id === null || draft.group_id === undefined ? "" : String(draft.group_id)}
                        onChange={(event) =>
                          setUserDrafts((current) => ({
                            ...current,
                            [user.id]: {
                              ...draft,
                              group_id: event.target.value ? Number(event.target.value) : null,
                            },
                          }))
                        }
                      >
                        <MenuItem value="">No group</MenuItem>
                        {groupOptions.map((group) => (
                          <MenuItem key={group.id} value={String(group.id)}>
                            {group.group_name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, md: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(draft.is_active)}
                            onChange={(event) =>
                              setUserDrafts((current) => ({
                                ...current,
                                [user.id]: { ...draft, is_active: event.target.checked },
                              }))
                            }
                          />
                        }
                        label="Active"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 2 }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        disabled={userUpdateMutation.isPending}
                        onClick={() => userUpdateMutation.mutate({ id: user.id, payload: draft })}
                      >
                        Save
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              )
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
