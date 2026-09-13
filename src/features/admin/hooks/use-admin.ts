import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/admin.service";
import type { CreateInvitationInput } from "@/types/admin";

/**
 * Admin portal server-state. One namespace so any mutation can refresh
 * every panel at once (the audit trail updates with the action itself).
 */
const ADMIN_KEY = ["admin"] as const;

export const adminQueryKeys = {
  summary: [...ADMIN_KEY, "summary"],
  users: [...ADMIN_KEY, "users"],
  invitations: [...ADMIN_KEY, "invitations"],
  audit: [...ADMIN_KEY, "audit"],
  outbox: [...ADMIN_KEY, "outbox"],
} as const;

function useRefreshOnSuccess() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
  };
}

export function useAdminSummary() {
  return useQuery({
    queryKey: adminQueryKeys.summary,
    queryFn: ({ signal }) => adminService.summary(signal),
    staleTime: 30_000,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminQueryKeys.users,
    queryFn: ({ signal }) => adminService.listUsers(signal),
  });
}

export function useSetUserStatus() {
  const refresh = useRefreshOnSuccess();
  return useMutation({
    mutationFn: (input: { id: string; status: "pending" | "active" | "suspended" }) =>
      adminService.setUserStatus(input.id, input.status),
    onSuccess: refresh,
  });
}

export function useClearLock() {
  const refresh = useRefreshOnSuccess();
  return useMutation({
    mutationFn: (id: string) => adminService.clearLock(id),
    onSuccess: refresh,
  });
}

export function useRevokeSessions() {
  const refresh = useRefreshOnSuccess();
  return useMutation({
    mutationFn: (id: string) => adminService.revokeSessions(id),
    onSuccess: refresh,
  });
}

export function useAdminInvitations() {
  return useQuery({
    queryKey: adminQueryKeys.invitations,
    queryFn: ({ signal }) => adminService.listInvitations(signal),
  });
}

export function useCreateInvitation() {
  const refresh = useRefreshOnSuccess();
  return useMutation({
    mutationFn: (input: CreateInvitationInput) => adminService.createInvitation(input),
    onSuccess: refresh,
  });
}

export function useRevokeInvitation() {
  const refresh = useRefreshOnSuccess();
  return useMutation({
    mutationFn: (id: string) => adminService.revokeInvitation(id),
    onSuccess: refresh,
  });
}

export function useAdminAudit() {
  return useQuery({
    queryKey: adminQueryKeys.audit,
    queryFn: ({ signal }) => adminService.listAudit(signal),
  });
}

export function useAdminOutbox() {
  return useQuery({
    queryKey: adminQueryKeys.outbox,
    queryFn: ({ signal }) => adminService.listOutbox(signal),
  });
}
