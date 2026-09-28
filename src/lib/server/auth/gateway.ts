/**
 * THE MUREEH AUTH GATEWAY — server-only core of the official login system.
 *
 * Every rule that must never be bypassed lives here:
 * - Registration only with a valid, unexpired institutional invitation.
 * - Passwords verified against scrypt hashes; unknown emails still spend
 *   a verify cycle so response time cannot enumerate accounts.
 * - Per-account lockout (database-backed) + per-window rate limit (memory).
 * - Sessions are opaque random tokens; only SHA-256 hashes are stored.
 * - Suspension revokes every live session of the account.
 * - Every security-relevant action lands in the append-only audit trail.
 *
 * The gateway is framework-free (plain functions over a Prisma client),
 * so it is independently testable and swappable behind the route handlers.
 */

import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient, type User } from "@prisma/client";
import type {
  AdminAuditRow,
  AdminInvitationRow,
  AdminOutboxRow,
  AdminSummary,
  AdminUserRow,
} from "@/types/admin";
import { checkRate, resetRate } from "@/lib/server/auth/rate-limit";
import { hashPassword, TIMING_DEFENDER_HASH, verifyPassword } from "@/lib/server/auth/password";
import type {
  AuthErrorCode,
  AuthResponse,
  AuthUser,
  EmailVerificationState,
  OnboardingState,
  SessionState,
  UserRole,
} from "@/types/auth";

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export class AuthGatewayError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "AuthGatewayError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const SESSION_TTL_SEC = 14 * 24 * 60 * 60; // 14 days
const LOCK_AFTER_FAILURES = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const INVITE_DEFAULT_TTL_DAYS = 14;
/** Unambiguous uppercase alphabet (no I, L, O, U). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function generateInviteCode(): string {
  const pick = (n: number): string =>
    Array.from(randomBytes(n))
      .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length] ?? "0")
      .join("");
  return `MU-${pick(4)}-${pick(4)}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/* ------------------------------------------------------------------ */
/* Projections                                                         */
/* ------------------------------------------------------------------ */

type UserRow = Pick<
  User,
  "id" | "email" | "name" | "role" | "emailVerification" | "onboarding"
>;

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    emailVerification: row.emailVerification as EmailVerificationState,
    onboarding: row.onboarding as OnboardingState,
  };
}

export interface GatewayMeta {
  ip?: string | null;
  userAgent?: string | null;
}

/* ------------------------------------------------------------------ */
/* Input records                                                       */
/* ------------------------------------------------------------------ */

export interface GatewayRegisterInput {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
  nationalId?: string;
}

export interface GatewayLoginInput {
  email: string;
  password: string;
}

export interface GatewayLoginResult extends AuthResponse {
  /** Raw cookie token — returned once, stored only as a hash. */
  token: string;
  maxAgeSec: number;
}

type AccountStatus = import("@/types/admin").AccountStatusCode;

export function createGateway(db: PrismaClient) {
  async function audit(
    type: string,
    opts: { userId?: string; actorId?: string; meta?: string } & GatewayMeta,
  ): Promise<void> {
    await db.auditEvent.create({
      data: {
        type,
        userId: opts.userId ?? null,
        actorId: opts.actorId ?? null,
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ? opts.userAgent.slice(0, 200) : null,
        meta: opts.meta ?? null,
      },
    });
  }

  async function notify(
    to: string,
    subject: string,
    body: string,
    kind: "invite" | "reset" | "welcome",
  ): Promise<void> {
    // The dev outbox stands in for the future email transport.
    await db.outboxMessage.create({ data: { to, subject, body, kind } });
  }

  return {
    /* ---------------- registration (invitation-only) --------------- */

    async register(
      input: GatewayRegisterInput,
      meta: GatewayMeta,
    ): Promise<{ status: "active"; email: string }> {
      const email = input.email.trim().toLowerCase();
      const rate = checkRate(`register:${email}`, 5);
      if (!rate.ok) throw new AuthGatewayError("rate_limited", 429);

      const code = input.inviteCode.trim().toUpperCase();
      const invite = await db.invitation.findUnique({ where: { code } });
      if (!invite || invite.status !== "pending") {
        throw new AuthGatewayError("invitation_invalid", 409);
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        throw new AuthGatewayError("invitation_expired", 409);
      }
      // An invitation bound to another address is invalid for this one —
      // never revealed which part failed.
      if (invite.email.toLowerCase() !== email) {
        throw new AuthGatewayError("invitation_invalid", 409);
      }

      const nationalId = input.nationalId?.trim() ? input.nationalId.trim() : null;
      if (invite.nationalId && nationalId && invite.nationalId !== nationalId) {
        throw new AuthGatewayError("invitation_invalid", 409);
      }
      if (nationalId === null && invite.nationalId) {
        // The invitation reserves an identifier; it must be presented.
        throw new AuthGatewayError("invitation_invalid", 409);
      }

      const existing = await db.user.findUnique({ where: { email } });
      if (existing) throw new AuthGatewayError("email_already_registered", 409);

      const onboarding: OnboardingState = invite.role === "student" ? "not-started" : "completed";
      let user: User;
      try {
        user = await db.user.create({
          data: {
            email,
            name: input.name.trim(),
            passwordHash: hashPassword(input.password),
            role: invite.role,
            nationalId,
            status: "active",
            emailVerification: "verified",
            onboarding,
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Unique targets: email (race) or nationalId.
          const clash = await db.user.findUnique({ where: { email } });
          throw new AuthGatewayError(
            clash ? "email_already_registered" : "identifier_taken",
            409,
          );
        }
        throw error;
      }

      await db.invitation.update({
        where: { id: invite.id },
        data: { status: "accepted", acceptedById: user.id },
      });
      await notify(
        email,
        "Your Mureeh account is ready",
        `Welcome ${user.name}. Your institutional account is active. Sign in at ${appUrl()}/sign-in`,
        "welcome",
      );
      await audit("register_completed", { userId: user.id, ip: meta.ip, userAgent: meta.userAgent });
      return { status: "active", email };
    },

    /* ---------------- login / sessions ----------------------------- */

    async login(input: GatewayLoginInput, meta: GatewayMeta): Promise<GatewayLoginResult> {
      const email = input.email.trim().toLowerCase();
      const rateKey = `login:${email}:${meta.ip ?? "local"}`;
      const rate = checkRate(rateKey);
      if (!rate.ok) throw new AuthGatewayError("rate_limited", 429);

      const user = await db.user.findUnique({ where: { email } });

      // Always spend a verify cycle — timing never reveals existence.
      const ok = verifyPassword(
        input.password,
        user?.passwordHash ?? TIMING_DEFENDER_HASH,
      );

      if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        throw new AuthGatewayError("account_locked", 423);
      }

      if (!user || !ok) {
        if (user) {
          const failures = user.failedAttempts + 1;
          await db.user.update({
            where: { id: user.id },
            data:
              failures >= LOCK_AFTER_FAILURES
                ? {
                    failedAttempts: 0,
                    lockedUntil: new Date(Date.now() + LOCK_WINDOW_MS),
                  }
                : { failedAttempts: failures },
          });
        }
        await audit("login_failed", {
          userId: user?.id,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        throw new AuthGatewayError("invalid_credentials", 401);
      }

      if (user.status === "pending") throw new AuthGatewayError("account_pending", 403);
      if (user.status === "suspended") throw new AuthGatewayError("account_suspended", 403);

      const token = newToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_SEC * 1000);
      await db.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: user.id,
          expiresAt,
          userAgent: meta.userAgent ? meta.userAgent.slice(0, 200) : null,
        },
      });
      if (user.failedAttempts > 0 || user.lockedUntil) {
        await db.user.update({
          where: { id: user.id },
          data: { failedAttempts: 0, lockedUntil: null },
        });
      }
      resetRate(rateKey);
      await audit("login_success", { userId: user.id, ip: meta.ip, userAgent: meta.userAgent });

      return {
        token,
        maxAgeSec: SESSION_TTL_SEC,
        session: {
          user: toAuthUser(user),
          issuedAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      };
    },

    async resolveSession(rawToken: string | undefined): Promise<SessionState> {
      const unauthenticated: SessionState = { status: "unauthenticated", session: null, expired: false };
      if (!rawToken) return unauthenticated;

      const session = await db.session.findUnique({
        where: { tokenHash: hashToken(rawToken) },
        include: { user: true },
      });
      if (!session) return unauthenticated;

      if (session.expiresAt.getTime() <= Date.now()) {
        await db.session.delete({ where: { id: session.id } });
        return { status: "unauthenticated", session: null, expired: true };
      }
      if (session.user.status !== "active") {
        // Suspension kills every live session of the account.
        await db.session.deleteMany({ where: { userId: session.userId } });
        return unauthenticated;
      }

      return {
        status: "authenticated",
        session: {
          user: toAuthUser(session.user),
          issuedAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        },
        expired: false,
      };
    },

    async logout(rawToken: string | undefined, meta: GatewayMeta): Promise<void> {
      if (!rawToken) return;
      const session = await db.session.findUnique({
        where: { tokenHash: hashToken(rawToken) },
      });
      if (!session) return;
      await db.session.delete({ where: { id: session.id } });
      await audit("logout", {
        userId: session.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    },

    /* ---------------- password recovery ---------------------------- */

    async forgotPassword(
      emailRaw: string,
      meta: GatewayMeta = {},
    ): Promise<{ status: "submitted" }> {
      const email = emailRaw.trim().toLowerCase();
      const emailKey = createHash("sha256").update(email).digest("hex");
      // Bound both one target account and one source. The same response is
      // kept for unknown accounts, so this does not become an enumeration
      // oracle. The limiter is process-local; see the production-hardening note.
      const perEmail = checkRate(`password-forgot:email:${emailKey}`, 5);
      const perIp = checkRate(`password-forgot:ip:${meta.ip ?? "local"}`, 10);
      if (!perEmail.ok || !perIp.ok) throw new AuthGatewayError("rate_limited", 429);
      const user = await db.user.findUnique({ where: { email } });
      if (user && user.status === "active") {
        await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
        const token = newToken();
        await db.passwordResetToken.create({
          data: {
            tokenHash: hashToken(token),
            userId: user.id,
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          },
        });
        await notify(
          email,
          "Mureeh password recovery",
          `Open this secure link to choose a new password (valid 1 hour): ${appUrl()}/reset-password?token=${token}`,
          "reset",
        );
        await audit("password_reset_requested", { userId: user.id });
      }
      // Response is intentionally identical whether or not the account exists.
      return { status: "submitted" };
    },

    async resetPassword(
      token: string,
      password: string,
      meta: GatewayMeta = {},
    ): Promise<{ status: "reset" }> {
      // Token guesses are bounded per source address before any database work.
      const rate = checkRate(`password-reset:${meta.ip ?? "local"}`, 10);
      if (!rate.ok) throw new AuthGatewayError("rate_limited", 429);
      const row = await db.passwordResetToken.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      if (!row || row.usedAt) throw new AuthGatewayError("token_invalid", 400);
      if (row.expiresAt.getTime() <= Date.now()) {
        throw new AuthGatewayError("token_expired", 410);
      }
      await db.$transaction([
        db.user.update({
          where: { id: row.userId },
          data: { passwordHash: hashPassword(password), failedAttempts: 0, lockedUntil: null },
        }),
        db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
        // New password invalidates every existing session.
        db.session.deleteMany({ where: { userId: row.userId } }),
      ]);
      await audit("password_reset_completed", { userId: row.userId });
      return { status: "reset" };
    },

    /** Gateway mode pre-verifies emails through the invitation; kept for contract parity. */
    verifyEmail(): { status: "already-verified" } {
      return { status: "already-verified" };
    },
    resendVerification(): { status: "sent" } {
      return { status: "sent" };
    },

    /* ---------------- administration ------------------------------- */

    async listUsers(): Promise<AdminUserRow[]> {
      const rows = await db.user.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { sessions: true } } },
        take: 200,
      });
      return rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status as AccountStatus,
        nationalIdTail: u.nationalId ? `••••${u.nationalId.slice(-4)}` : null,
        failedAttempts: u.failedAttempts,
        lockedUntil: u.lockedUntil ? u.lockedUntil.toISOString() : null,
        sessions: u._count.sessions,
        createdAt: u.createdAt.toISOString(),
      }));
    },

    async setUserStatus(id: string, status: AccountStatus, actorId: string): Promise<void> {
      const target = await db.user.findUnique({ where: { id } });
      if (!target) throw new AuthGatewayError("unknown", 404);
      await db.user.update({ where: { id }, data: { status } });
      if (status !== "active") {
        await db.session.deleteMany({ where: { userId: id } });
      }
      await audit(
        status === "active" ? "account_activated" : "account_suspended",
        { userId: id, actorId },
      );
    },

    async clearLock(id: string, actorId: string): Promise<void> {
      await db.user.update({ where: { id }, data: { failedAttempts: 0, lockedUntil: null } });
      await audit("account_unlocked", { userId: id, actorId });
    },

    async revokeSessions(id: string, actorId: string): Promise<void> {
      await db.session.deleteMany({ where: { userId: id } });
      await audit("sessions_revoked", { userId: id, actorId });
    },

    async summary(): Promise<AdminSummary> {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [users, suspended, invitesPending, sessionsActive, auditToday] = await Promise.all([
        db.user.count(),
        db.user.count({ where: { status: "suspended" } }),
        db.invitation.count({ where: { status: "pending" } }),
        db.session.count({ where: { expiresAt: { gt: new Date() } } }),
        db.auditEvent.count({ where: { createdAt: { gte: startOfDay } } }),
      ]);
      return { users, suspended, invitesPending, sessionsActive, auditToday };
    },

    async createInvitation(
      actorId: string,
      input: { email: string; role: "student" | "guardian"; nationalId?: string; note?: string; expiresInDays?: number },
    ): Promise<{ code: string }> {
      const email = input.email.trim().toLowerCase();
      if (input.role !== "student" && input.role !== "guardian") {
        throw new AuthGatewayError("forbidden", 403);
      }
      const code = generateInviteCode();
      const expiresAt = new Date(
        Date.now() + Math.min(90, Math.max(1, input.expiresInDays ?? INVITE_DEFAULT_TTL_DAYS)) * 24 * 60 * 60 * 1000,
      );
      const invite = await db.invitation.create({
        data: {
          code,
          email,
          role: input.role,
          nationalId: input.nationalId?.trim() || null,
          note: input.note?.trim() || null,
          expiresAt,
          invitedById: actorId,
        },
      });
      await notify(
        email,
        "You are invited to Mureeh",
        `Your invitation code: ${code} (valid until ${expiresAt.toISOString().slice(0, 10)}). Register at ${appUrl()}/sign-up`,
        "invite",
      );
      await audit("invitation_created", {
        actorId,
        meta: JSON.stringify({ invitationId: invite.id, email }),
      });
      return { code };
    },

    async listInvitations(): Promise<AdminInvitationRow[]> {
      const rows = await db.invitation.findMany({
        orderBy: { createdAt: "desc" },
        include: { invitedBy: { select: { name: true } } },
        take: 200,
      });
      return rows.map((i) => ({
        id: i.id,
        code: i.code,
        email: i.email,
        role: i.role,
        nationalId: i.nationalId,
        note: i.note,
        status: i.status,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
        invitedByName: i.invitedBy?.name ?? null,
      }));
    },

    async revokeInvitation(id: string, actorId: string): Promise<void> {
      const invite = await db.invitation.findUnique({ where: { id } });
      if (!invite || invite.status !== "pending") {
        throw new AuthGatewayError("unknown", 404);
      }
      await db.invitation.update({ where: { id }, data: { status: "revoked" } });
      await audit("invitation_revoked", {
        actorId,
        meta: JSON.stringify({ invitationId: id, email: invite.email }),
      });
    },

    async listAudit(limit = 100): Promise<AdminAuditRow[]> {
      const rows = await db.auditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: Math.min(500, Math.max(1, limit)),
        include: {
          actor: { select: { name: true } },
          user: { select: { name: true } },
        },
      });
      return rows.map((a) => ({
        id: a.id,
        type: a.type,
        actorName: a.actor?.name ?? null,
        subjectName: a.user?.name ?? null,
        ip: a.ip,
        meta: a.meta,
        createdAt: a.createdAt.toISOString(),
      }));
    },

    async listOutbox(limit = 30): Promise<AdminOutboxRow[]> {
      const rows = await db.outboxMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: Math.min(100, Math.max(1, limit)),
      });
      return rows.map((m) => ({
        id: m.id,
        to: m.to,
        subject: m.subject,
        body: m.body,
        kind: m.kind,
        createdAt: m.createdAt.toISOString(),
      }));
    },
  };
}

export type AuthGateway = ReturnType<typeof createGateway>;
