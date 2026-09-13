/**
 * Administration portal (official gateway) view types.
 *
 * Shared contract between the server gateway and the admin client —
 * deliberately projection-only: no hashes, no tokens, masked identifiers.
 */

export type AccountStatusCode = "pending" | "active" | "suspended";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: AccountStatusCode;
  /** Last four digits only — identifiers are never displayed in full. */
  nationalIdTail: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  sessions: number;
  createdAt: string;
}

export interface AdminInvitationRow {
  id: string;
  code: string;
  email: string;
  role: string;
  nationalId: string | null;
  note: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedByName: string | null;
}

export interface AdminAuditRow {
  id: string;
  type: string;
  actorName: string | null;
  subjectName: string | null;
  ip: string | null;
  meta: string | null;
  createdAt: string;
}

export interface AdminOutboxRow {
  id: string;
  to: string;
  subject: string;
  body: string;
  kind: string;
  createdAt: string;
}

export interface AdminSummary {
  users: number;
  suspended: number;
  invitesPending: number;
  sessionsActive: number;
  auditToday: number;
}

export interface CreateInvitationInput {
  email: string;
  role: "student" | "guardian";
  nationalId?: string;
  note?: string;
  expiresInDays?: number;
}
