/**
 * MOCK AUTH BACKEND — isolated simulation of the future auth API.
 *
 * This module is the ONLY place demo accounts, credentials and failure
 * triggers exist. It is consumed exclusively by `auth.service.ts`;
 * no UI code may import it. When the real backend lands, this file is
 * deleted and `USE_MOCK` flips — nothing else changes.
 *
 * Demo behavior (mock phase only):
 * - Any password signs in a seeded account, EXCEPT the triggers below.
 * - `wrong@example.com` / password `wrongpassword1`  → invalid_credentials
 * - `offline@example.com`                            → network failure
 * - `limited@example.com`                            → rate_limited
 * - `expired@example.com`                             → session issued already expired
 * - `pending@example.com`                             → unverified account (verification gating)
 * - 5 consecutive failed logins for one email        → rate_limited
 * - Verification link token `demo-verify-token` verifies `pending@example.com`
 * - Reset link token `demo-reset-token` is valid; `expired-token` simulates expiry
 */

import { AuthApiError } from "@/lib/api/client";
import { MOCK_SESSION_TTL_MS } from "@/features/auth/constants/auth.constants";
import type {
  AuthResponse,
  AuthUser,
  ForgotPasswordResponse,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ResendVerificationResponse,
  ResetPasswordPayload,
  ResetPasswordResponse,
  Session,
  SessionState,
  VerifyEmailPayload,
  VerifyEmailResult,
} from "@/types/auth";

const STORAGE_KEY = "mureeh.mock.auth.v1";

interface StoredUser extends AuthUser {
  /** Mock-only. A real backend stores a hash; never a plaintext password. */
  passwordHint: string;
}

interface MockDb {
  users: StoredUser[];
  /** Opaque session token → session record (simulates httpOnly cookie server-side). */
  sessions: Record<string, Session>;
  /** The browser's "cookie": only the opaque token is stored client-side. */
  currentToken: string | null;
  verificationTokens: Record<string, string>; // token → userId
  resetTokens: Record<string, string>; // token → userId
  failedAttempts: Record<string, number>; // email → consecutive failures
}

function seed(): MockDb {
  const student: StoredUser = {
    id: "usr_student_01",
    name: "Layla Hassan",
    email: "layla.hassan@example.com",
    role: "student",
    emailVerification: "verified",
    onboarding: "completed",
    passwordHint: "any",
  };
  const guardian: StoredUser = {
    id: "usr_guardian_01",
    name: "Yusuf Hassan",
    email: "guardian@example.com",
    role: "guardian",
    emailVerification: "verified",
    onboarding: "completed",
    passwordHint: "any",
  };
  const pending: StoredUser = {
    id: "usr_pending_01",
    name: "Pending Student",
    email: "pending@example.com",
    role: "student",
    emailVerification: "unverified",
    onboarding: "not-started",
    passwordHint: "any",
  };
  /** Signs in, but the session is issued already expired (session-expiry demo). */
  const expired: StoredUser = {
    id: "usr_expired_01",
    name: "Expired Session",
    email: "expired@example.com",
    role: "student",
    emailVerification: "verified",
    onboarding: "completed",
    passwordHint: "any",
  };

  return {
    users: [student, guardian, pending, expired],
    sessions: {},
    currentToken: null,
    verificationTokens: { "demo-verify-token": pending.id },
    resetTokens: { "demo-reset-token": student.id, "expired-token": student.id },
    failedAttempts: {},
  };
}

let db: MockDb = seed();

function load(): MockDb {
  if (typeof window === "undefined") return db;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      db = { ...seed(), ...(JSON.parse(raw) as Partial<MockDb>) } as MockDb;
    }
  } catch {
    // Corrupt storage: fall back to a fresh seed rather than crashing auth.
    db = seed();
  }
  return db;
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full/unavailable (private mode): session lives in memory only.
  }
}

function toPublicUser(user: StoredUser): AuthUser {
  const { passwordHint: _passwordHint, ...publicUser } = user;
  void _passwordHint;
  return publicUser;
}

function issueSession(user: StoredUser, ttlMs: number = MOCK_SESSION_TTL_MS): Session {
  const token = `mock_session_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const now = Date.now();
  const session: Session = {
    user: toPublicUser(user),
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  };
  db.sessions[token] = session;
  db.currentToken = token;
  persist();
  return session;
}

function findUserByEmail(email: string): StoredUser | undefined {
  const normalized = email.trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === normalized);
}

const RATE_LIMIT_THRESHOLD = 5;

export const mockAuthBackend = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    load();
    const email = payload.email.trim().toLowerCase();

    if (email === "offline@example.com") {
      throw new AuthApiError("network", 0);
    }
    if (email === "limited@example.com") {
      throw new AuthApiError("rate_limited", 429);
    }

    if ((db.failedAttempts[email] ?? 0) >= RATE_LIMIT_THRESHOLD) {
      throw new AuthApiError("rate_limited", 429);
    }

    const invalid =
      email === "wrong@example.com" ||
      payload.password === "wrongpassword1" ||
      !findUserByEmail(email);

    if (invalid) {
      db.failedAttempts[email] = (db.failedAttempts[email] ?? 0) + 1;
      persist();
      throw new AuthApiError("invalid_credentials", 401);
    }

    db.failedAttempts[email] = 0;
    const user = findUserByEmail(email)!;
    const ttl = email === "expired@example.com" ? -1000 : MOCK_SESSION_TTL_MS;
    return { session: issueSession(user, ttl) };
  },

  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    load();
    const email = payload.email.trim().toLowerCase();
    if (findUserByEmail(email)) {
      throw new AuthApiError("email_already_registered", 409);
    }

    const user: StoredUser = {
      id: `usr_${Math.random().toString(36).slice(2, 10)}`,
      name: payload.name.trim(),
      email,
      role: payload.role,
      emailVerification: "unverified",
      onboarding: "not-started",
      passwordHint: "any",
    };
    db.users.push(user);

    const token = `verify_${user.id}_${Date.now().toString(36)}`;
    db.verificationTokens[token] = user.id;
    persist();

    // A real backend emails the link; the mock records it and resolves as submitted.
    return { status: "verification-required", email };
  },

  async getSessionState(): Promise<SessionState> {
    load();
    const token = db.currentToken;
    if (!token) return { status: "unauthenticated", session: null, expired: false };

    const session = db.sessions[token];
    if (!session) return { status: "unauthenticated", session: null, expired: false };

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      delete db.sessions[token];
      db.currentToken = null;
      persist();
      return { status: "unauthenticated", session: null, expired: true };
    }

    return { status: "authenticated", session, expired: false };
  },

  async logout(): Promise<void> {
    load();
    if (db.currentToken) {
      delete db.sessions[db.currentToken];
      db.currentToken = null;
      persist();
    }
  },

  /** Always resolves generically — account existence is never disclosed. */
  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    load();
    const user = findUserByEmail(email);
    if (user) {
      const token = `reset_${user.id}_${Date.now().toString(36)}`;
      db.resetTokens[token] = user.id;
      persist();
    }
    return { status: "submitted" };
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
    load();
    if (payload.token === "expired-token") {
      throw new AuthApiError("token_expired", 410);
    }
    const userId = db.resetTokens[payload.token];
    if (!userId) {
      throw new AuthApiError("token_invalid", 400);
    }

    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new AuthApiError("token_invalid", 400);

    // Server-side policy re-check (defense in depth; UI validation is not trusted).
    if (payload.password.length < 8 || !/[a-zA-Z]/.test(payload.password) || !/[0-9]/.test(payload.password)) {
      throw new AuthApiError("unknown", 422);
    }

    delete db.resetTokens[payload.token];
    // Invalidate active sessions, exactly as a real backend would.
    for (const [token, session] of Object.entries(db.sessions)) {
      if (session.user.id === user.id) delete db.sessions[token];
    }
    if (db.currentToken && !db.sessions[db.currentToken]) db.currentToken = null;
    persist();
    return { status: "reset" };
  },

  async verifyEmail(payload: VerifyEmailPayload): Promise<VerifyEmailResult> {
    load();
    if (payload.token === "expired-token") return { status: "expired" };

    const userId = db.verificationTokens[payload.token];
    if (!userId) return { status: "invalid" };

    const user = db.users.find((u) => u.id === userId);
    if (!user) return { status: "invalid" };
    if (user.emailVerification === "verified") return { status: "already-verified" };

    user.emailVerification = "verified";
    delete db.verificationTokens[payload.token];
    persist();
    return { status: "verified" };
  },

  /** Generic response regardless of whether the account exists. */
  async resendVerification(_email: string): Promise<ResendVerificationResponse> {
    load();
    void _email;
    return { status: "sent" };
  },

  /** Test-only: restore pristine seeded state between test cases. */
  __reset(): void {
    db = seed();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },
};
