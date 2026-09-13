/**
 * Admin portal service — the administration gateway's client face.
 *
 * Same transport conventions as every other service (httpRequest only;
 * components never fetch). There is deliberately NO mock branch: the
 * admin portal exists solely over the real gateway, so an unauthenticated
 * caller gets the typed 401/403 from the server, never a simulated pass.
 */

import { ApiError, httpRequest } from "@/lib/api/client";
import type {
  AdminAuditRow,
  AdminInvitationRow,
  AdminOutboxRow,
  AdminSummary,
  AdminUserRow,
  CreateInvitationInput,
} from "@/types/admin";

function asError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError) return new ApiError("network", 0, "network");
  return new ApiError("unknown", 0, "unknown");
}

export const adminService = {
  summary(signal?: AbortSignal): Promise<AdminSummary> {
    return httpRequest<AdminSummary>("/api/admin/summary", { signal }).catch((e: unknown) => {
      throw asError(e);
    });
  },

  listUsers(signal?: AbortSignal): Promise<AdminUserRow[]> {
    return httpRequest<AdminUserRow[]>("/api/admin/users", { signal }).catch((e: unknown) => {
      throw asError(e);
    });
  },

  setUserStatus(id: string, status: "pending" | "active" | "suspended"): Promise<{ ok: true }> {
    return httpRequest<{ ok: true }>("/api/admin/users-status", {
      method: "POST",
      body: { id, status },
    }).catch((e: unknown) => {
      throw asError(e);
    });
  },

  clearLock(id: string): Promise<{ ok: true }> {
    return httpRequest<{ ok: true }>("/api/admin/users-unlock", {
      method: "POST",
      body: { id },
    }).catch((e: unknown) => {
      throw asError(e);
    });
  },

  revokeSessions(id: string): Promise<{ ok: true }> {
    return httpRequest<{ ok: true }>("/api/admin/sessions-revoke", {
      method: "POST",
      body: { id },
    }).catch((e: unknown) => {
      throw asError(e);
    });
  },

  listInvitations(signal?: AbortSignal): Promise<AdminInvitationRow[]> {
    return httpRequest<AdminInvitationRow[]>("/api/admin/invitations", { signal }).catch(
      (e: unknown) => {
        throw asError(e);
      },
    );
  },

  createInvitation(input: CreateInvitationInput): Promise<{ code: string }> {
    return httpRequest<{ code: string }>("/api/admin/invitations", {
      method: "POST",
      body: input,
    }).catch((e: unknown) => {
      throw asError(e);
    });
  },

  revokeInvitation(id: string): Promise<{ ok: true }> {
    return httpRequest<{ ok: true }>("/api/admin/invitations-revoke", {
      method: "POST",
      body: { id },
    }).catch((e: unknown) => {
      throw asError(e);
    });
  },

  listAudit(signal?: AbortSignal): Promise<AdminAuditRow[]> {
    return httpRequest<AdminAuditRow[]>("/api/admin/audit", { signal }).catch((e: unknown) => {
      throw asError(e);
    });
  },

  listOutbox(signal?: AbortSignal): Promise<AdminOutboxRow[]> {
    return httpRequest<AdminOutboxRow[]>("/api/admin/outbox", { signal }).catch((e: unknown) => {
      throw asError(e);
    });
  },
};
