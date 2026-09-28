/**
 * Gateway integration suite — REAL PostgreSQL (see `src/test/test-env.ts`),
 * real scrypt, real sessions/invitations/audit. This is where the official
 * rules are proven: invitation-only registration, lockout, suspension
 * killing live sessions, single-use recovery links, audit persistence.
 *
 * Requires a disposable test database:
 *   DATABASE_URL=$DATABASE_URL_TEST npx prisma db push
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma as db } from "@/lib/server/db";
import { AuthGatewayError, createGateway } from "./gateway";
import { hashPassword } from "./password";
import { __clearRateBuckets } from "./rate-limit";

const gateway = createGateway(db);

let adminId = "";

async function expectRejection(
  promise: Promise<unknown>,
): Promise<InstanceType<typeof AuthGatewayError>> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AuthGatewayError) return error;
    throw error;
  }
  throw new Error("Expected an AuthGatewayError, but the promise resolved.");
}

async function invite(email: string, extra: { nationalId?: string } = {}) {
  const result = await gateway.createInvitation(adminId, {
    email,
    role: "student",
    nationalId: extra.nationalId,
  });
  return result.code;
}

const baseRegister = {
  name: "Sara Khalid",
  password: "securePass1",
};

beforeAll(async () => {
  // Safety: this suite DELETES every row it touches, so it must never be
  // pointed at the development database.
  expect(process.env.DATABASE_URL ?? "").toContain("mureeh_test");
});

beforeEach(async () => {
  __clearRateBuckets();
  await db.invitation.deleteMany();
  await db.passwordResetToken.deleteMany();
  await db.session.deleteMany();
  await db.auditEvent.deleteMany();
  await db.outboxMessage.deleteMany();
  await db.user.deleteMany();
  const admin = await db.user.create({
    data: {
      email: "admin@test.local",
      name: "Registrar",
      role: "admin",
      status: "active",
      passwordHash: hashPassword("AdminPass1"),
    },
  });
  adminId = admin.id;
});

describe("registration (invitation-gated)", () => {
  it("activates an account only with a valid invitation and records the trail", async () => {
    const code = await invite("sara@example.com");
    const result = await gateway.register(
      { ...baseRegister, email: "sara@example.com", inviteCode: code },
      { ip: "10.0.0.1", userAgent: "vitest" },
    );
    expect(result).toEqual({ status: "active", email: "sara@example.com" });

    const user = await db.user.findUnique({ where: { email: "sara@example.com" } });
    expect(user?.status).toBe("active");
    expect(user?.onboarding).toBe("not-started"); // students enter the journey
    const inviteRow = await db.invitation.findFirst({ where: { code } });
    expect(inviteRow?.status).toBe("accepted");
    const audit = await db.auditEvent.findFirst({ where: { type: "register_completed" } });
    expect(audit).toBeTruthy();
    const outbox = await db.outboxMessage.findFirst({ where: { kind: "welcome" } });
    expect(outbox?.to).toBe("sara@example.com");
  });

  it("rejects unknown or revoked codes with invitation_invalid", async () => {
    const error = await expectRejection(
      gateway.register(
        { ...baseRegister, email: "x@example.com", inviteCode: "MU-NOPE-NOPE" },
        {},
      ),
    );
    expect(error.code).toBe("invitation_invalid");
    expect(error.status).toBe(409);
  });

  it("rejects an expired invitation distinctly", async () => {
    const code = await invite("old@example.com");
    await db.invitation.update({
      where: { code },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const error = await expectRejection(
      gateway.register({ ...baseRegister, email: "old@example.com", inviteCode: code }, {}),
    );
    expect(error.code).toBe("invitation_expired");
  });

  it("binds the code to its email — the same code cannot register another address", async () => {
    const code = await invite("bound@example.com");
    const error = await expectRejection(
      gateway.register({ ...baseRegister, email: "other@example.com", inviteCode: code }, {}),
    );
    expect(error.code).toBe("invitation_invalid");
  });

  it("honors a reserved national id: required, matched, and unique", async () => {
    const code = await invite("nid@example.com", { nationalId: "1234567890" });
    // Missing id → refused (the invitation reserves it).
    expect(
      (
        await expectRejection(
          gateway.register({ ...baseRegister, email: "nid@example.com", inviteCode: code }, {}),
        )
      ).code,
    ).toBe("invitation_invalid");
    // Wrong id → refused.
    expect(
      (
        await expectRejection(
          gateway.register(
            { ...baseRegister, email: "nid@example.com", inviteCode: code, nationalId: "9999999999" },
            {},
          ),
        )
      ).code,
    ).toBe("invitation_invalid");
    // Correct id → accepted.
    await expect(
      gateway.register(
        { ...baseRegister, email: "nid@example.com", inviteCode: code, nationalId: "1234567890" },
        {},
      ),
    ).resolves.toMatchObject({ status: "active" });
  });

  it("refuses a second account on a registered email — even with a fresh invitation", async () => {
    const first = await invite("dup@example.com");
    await gateway.register({ ...baseRegister, email: "dup@example.com", inviteCode: first }, {});
    // Used codes are single-use and fail earlier, so issue a second valid one.
    const second = await invite("dup@example.com");
    const error = await expectRejection(
      gateway.register({ ...baseRegister, email: "dup@example.com", inviteCode: second }, {}),
    );
    expect(error.code).toBe("email_already_registered");
  });
});

describe("login, lockout and sessions", () => {
  async function activeStudent(email = "layla@test.local") {
    const code = await invite(email);
    await gateway.register(
      { name: "Layla", email, password: "securePass1", inviteCode: code },
      {},
    );
    return email;
  }

  it("issues a session and resolves it through the opaque token only", async () => {
    const email = await activeStudent();
    const { token, session } = await gateway.login({ email, password: "securePass1" }, { ip: "1.2.3.4" });
    expect(session.user.email).toBe(email);
    expect(session.user.role).toBe("student");
    expect(token.length).toBeGreaterThan(20);

    const stored = await db.session.findFirst();
    expect(stored?.tokenHash).not.toContain(token.slice(0, 8)); // only the hash is stored

    const state = await gateway.resolveSession(token);
    expect(state.status).toBe("authenticated");

    expect((await gateway.resolveSession("garbage-token")).status).toBe("unauthenticated");
  });

  it("fails unknown emails and wrong passwords with the same code (no enumeration)", async () => {
    const email = await activeStudent();
    const wrongPass = await expectRejection(gateway.login({ email, password: "nope12345" }, {}));
    const noUser = await expectRejection(
      gateway.login({ email: "ghost@test.local", password: "nope12345" }, {}),
    );
    expect(wrongPass.code).toBe("invalid_credentials");
    expect(noUser.code).toBe("invalid_credentials");
    expect(await db.session.count()).toBe(0);
  });

  it("locks the account after five failed attempts, then the right password still waits", async () => {
    const email = await activeStudent("locky@test.local");
    for (let i = 0; i < 5; i += 1) {
      await expectRejection(gateway.login({ email, password: `wrong${i}pass` }, {}));
    }
    const locked = await expectRejection(gateway.login({ email, password: "securePass1" }, {}));
    expect(locked.code).toBe("account_locked");
    expect(locked.status).toBe(423);
  });

  it("logout revokes exactly that session", async () => {
    const email = await activeStudent("multi@test.local");
    const a = await gateway.login({ email, password: "securePass1" }, {});
    const b = await gateway.login({ email, password: "securePass1" }, {});
    await gateway.logout(a.token, {});
    expect((await gateway.resolveSession(a.token)).status).toBe("unauthenticated");
    expect((await gateway.resolveSession(b.token)).status).toBe("authenticated");
  });

  it("marks lapsed sessions as expired so the UI can say \"sign in again\"", async () => {
    const email = await activeStudent();
    const { token } = await gateway.login({ email, password: "securePass1" }, {});
    const sessionRow = await db.session.findFirstOrThrow();
    await db.session.update({
      where: { id: sessionRow.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const state = await gateway.resolveSession(token);
    expect(state.status).toBe("unauthenticated");
    expect(state.expired).toBe(true);
  });
});

describe("official lifecycle: suspension revokes live sessions", () => {
  it("suspends, blocks sign-in, kills sessions; restore brings the account back", async () => {
    const code = await invite("life@test.local");
    await gateway.register(
      { name: "L", email: "life@test.local", password: "securePass1", inviteCode: code },
      {},
    );
    const user = await db.user.findUniqueOrThrow({ where: { email: "life@test.local" } });
    const { token } = await gateway.login({ email: "life@test.local", password: "securePass1" }, {});

    await gateway.setUserStatus(user.id, "suspended", adminId);
    expect((await gateway.resolveSession(token)).status).toBe("unauthenticated");
    const blocked = await expectRejection(
      gateway.login({ email: "life@test.local", password: "securePass1" }, {}),
    );
    expect(blocked.code).toBe("account_suspended");

    await gateway.setUserStatus(user.id, "active", adminId);
    await expect(
      gateway.login({ email: "life@test.local", password: "securePass1" }, {}),
    ).resolves.toBeTruthy();

    const auditTypes = (await db.auditEvent.findMany({ select: { type: true } })).map((a) => a.type);
    expect(auditTypes).toContain("account_suspended");
    expect(auditTypes).toContain("account_activated");
  });

  it("admin unlock clears the lockout clock", async () => {
    const code = await invite("unlocky@test.local");
    await gateway.register(
      { name: "U", email: "unlocky@test.local", password: "securePass1", inviteCode: code },
      {},
    );
    const user = await db.user.findUniqueOrThrow({ where: { email: "unlocky@test.local" } });
    for (let i = 0; i < 5; i += 1) {
      await expectRejection(gateway.login({ email: user.email, password: "badbad123" }, {}));
    }
    await gateway.clearLock(user.id, adminId);
    await expect(
      gateway.login({ email: user.email, password: "securePass1" }, {}),
    ).resolves.toBeTruthy();
  });
});

describe("password recovery", () => {
  it("rate-limits password recovery requests per address without changing the generic response", async () => {
    const email = "rate-limited-reset@example.test";
    const meta = { ip: `forgot-${crypto.randomUUID()}` };
    for (let i = 0; i < 5; i += 1) {
      await expect(gateway.forgotPassword(email, meta)).resolves.toEqual({ status: "submitted" });
    }
    const limited = await expectRejection(gateway.forgotPassword(email, meta));
    expect(limited).toBeInstanceOf(AuthGatewayError);
    expect((limited as AuthGatewayError).code).toBe("rate_limited");
  });

  it("rate-limits reset-token guesses per source address", async () => {
    const meta = { ip: `reset-${crypto.randomUUID()}` };
    for (let i = 0; i < 10; i += 1) {
      const error = await expectRejection(gateway.resetPassword(`invalid-token-${i}`, "securePass1", meta));
      expect((error as AuthGatewayError).code).toBe("token_invalid");
    }
    const limited = await expectRejection(gateway.resetPassword("another-invalid-token", "securePass1", meta));
    expect((limited as AuthGatewayError).code).toBe("rate_limited");
  });

  it("delivers a single-use reset link through the outbox and kills old sessions", async () => {
    const code = await invite("forgot@test.local");
    await gateway.register(
      { name: "F", email: "forgot@test.local", password: "securePass1", inviteCode: code },
      {},
    );
    const user = await db.user.findUniqueOrThrow({ where: { email: "forgot@test.local" } });
    const { token } = await gateway.login({ email: user.email, password: "securePass1" }, {});

    await expect(gateway.forgotPassword(user.email)).resolves.toEqual({ status: "submitted" });
    // Unknown email: intentionally indistinguishable.
    await expect(gateway.forgotPassword("nobody@test.local")).resolves.toEqual({
      status: "submitted",
    });

    const message = await db.outboxMessage.findFirst({ where: { kind: "reset" } });
    const match = message ? /token=([^\s]+)/.exec(message.body) : null;
    if (!match?.[1]) throw new Error("reset token missing from outbox");

    await gateway.resetPassword(match[1], "brandNewPass9");
    expect((await gateway.resolveSession(token)).status).toBe("unauthenticated"); // sessions killed
    await expect(
      gateway.login({ email: user.email, password: "brandNewPass9" }, {}),
    ).resolves.toBeTruthy();
    // Single-use:
    const reuse = await expectRejection(gateway.resetPassword(match[1], "thirdPass99"));
    expect(reuse.code).toBe("token_invalid");
  });
});

describe("administration records", () => {
  it("summary counts reflect the register, and invitations expose their lifecycle", async () => {
    const created = await gateway.createInvitation(adminId, {
      email: "invitee@test.local",
      role: "guardian",
      note: "cohort A",
    });
    const list = await gateway.listInvitations();
    const row = list[0];
    if (!row) throw new Error("invitation list empty");
    expect(row).toMatchObject({
      code: created.code,
      email: "invitee@test.local",
      role: "guardian",
      status: "pending",
      invitedByName: "Registrar",
    });

    await gateway.register(
      { name: "I", email: "invitee@test.local", password: "securePass1", inviteCode: created.code },
      {},
    );
    const summary = await gateway.summary();
    expect(summary.users).toBe(2); // admin + invitee
    expect(summary.sessionsActive).toBe(0);

    // Accepted invitations are no longer revocable.
    const rejected = await expectRejection(gateway.revokeInvitation(row.id, adminId));
    expect(rejected.code).toBe("unknown");
    const after = await gateway.listInvitations();
    expect(after[0]?.status).toBe("accepted");
  });

  it("user rows are safe projections — no hashes, masked national ids", async () => {
    const code = await invite("masked@test.local");
    await gateway.register(
      { name: "M", email: "masked@test.local", password: "securePass1", inviteCode: code, nationalId: "10203040" },
      {},
    );
    const rows = await gateway.listUsers();
    const student = rows.find((r) => r.email === "masked@test.local");
    expect(student?.nationalIdTail).toBe("••••3040");
    const keys = Object.keys(rows[0] ?? {});
    expect(keys.some((k) => /password|hash|token/i.test(k))).toBe(false);
  });
});
