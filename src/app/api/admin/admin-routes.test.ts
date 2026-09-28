/**
 * Admin HTTP gates — the real route handlers and auth wrapper.
 *
 * The gateway's persistence is not mocked; the fake is only its session
 * resolver, shared with the other route integration suites. For all ten admin
 * handlers, this suite proves anonymous → 401 and student → 403 before the
 * handler reaches an admin operation. Representative admin reads and an
 * invitation write then prove the authorized path reaches PostgreSQL.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth/gateway", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { createGatewayModule } = await import("@/test/route-harness");
  return createGatewayModule(actual);
});

vi.mock("next/headers", async () => {
  const { createHeadersModule } = await import("@/test/route-harness");
  return createHeadersModule();
});

import { GET as listAudit } from "@/app/api/admin/audit/route";
import { GET as listInvitations, POST as createInvitation } from "@/app/api/admin/invitations/route";
import { POST as revokeInvitation } from "@/app/api/admin/invitations-revoke/route";
import { GET as listOutbox } from "@/app/api/admin/outbox/route";
import { POST as revokeSessions } from "@/app/api/admin/sessions-revoke/route";
import { GET as summary } from "@/app/api/admin/summary/route";
import { GET as listUsers } from "@/app/api/admin/users/route";
import { POST as setUserStatus } from "@/app/api/admin/users-status/route";
import { POST as unlockUser } from "@/app/api/admin/users-unlock/route";
import { prisma } from "@/lib/server/db";
import { callRoute, jsonInit, seedUsers, sessions, signInAs } from "@/test/route-harness";

const TOKEN_ADMIN = "token_admin_routes_admin";
const TOKEN_STUDENT = "token_admin_routes_student";
const ADMIN_ID = "admin_routes_owner";
const STUDENT_ID = "admin_routes_student";
let createdInvitationEmail: string | undefined;

afterEach(async () => {
  if (createdInvitationEmail) {
    await prisma.outboxMessage.deleteMany({ where: { to: createdInvitationEmail } });
    await prisma.invitation.deleteMany({ where: { email: createdInvitationEmail } });
    await prisma.auditEvent.deleteMany({ where: { actorId: ADMIN_ID } });
    createdInvitationEmail = undefined;
  }
});

const handlers: { name: string; run: () => Promise<Response> }[] = [
  { name: "GET audit", run: () => callRoute(listAudit) },
  { name: "GET invitations", run: () => callRoute(listInvitations) },
  { name: "POST invitations", run: () => callRoute(createInvitation, jsonInit({ email: "a@b.test", role: "student", nationalId: "", note: "", expiresInDays: 7 })) },
  { name: "POST invitations-revoke", run: () => callRoute(revokeInvitation, jsonInit({ id: "missing" })) },
  { name: "GET outbox", run: () => callRoute(listOutbox) },
  { name: "POST sessions-revoke", run: () => callRoute(revokeSessions, jsonInit({ id: "missing" })) },
  { name: "GET summary", run: () => callRoute(summary) },
  { name: "GET users", run: () => callRoute(listUsers) },
  { name: "POST users-status", run: () => callRoute(setUserStatus, jsonInit({ id: "missing", status: "suspended" })) },
  { name: "POST users-unlock", run: () => callRoute(unlockUser, jsonInit({ id: "missing" })) },
];

beforeEach(async () => {
  await seedUsers(ADMIN_ID, STUDENT_ID);
  await prisma.user.update({ where: { id: ADMIN_ID }, data: { role: "admin" } });
  sessions.clear();
  sessions.set(TOKEN_ADMIN, { id: ADMIN_ID, role: "admin" });
  sessions.set(TOKEN_STUDENT, { id: STUDENT_ID, role: "student" });
  signInAs(undefined);
});

describe("all admin HTTP handlers enforce authentication and role", () => {
  it.each(handlers)("$name rejects an anonymous request", async ({ run }) => {
    signInAs(undefined);
    const res = await run();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: expect.any(String) });
  });

  it.each(handlers)("$name rejects an authenticated student", async ({ run }) => {
    signInAs(TOKEN_STUDENT);
    const res = await run();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "forbidden" });
  });
});

describe("authorized admin HTTP path reaches PostgreSQL", () => {
  it("serves all read collections through the real gateway", async () => {
    signInAs(TOKEN_ADMIN);
    for (const [name, handler] of [
      ["audit", listAudit],
      ["invitations", listInvitations],
      ["outbox", listOutbox],
      ["summary", summary],
      ["users", listUsers],
    ] as const) {
      const res = await callRoute(handler);
      expect(res.status, name).toBe(200);
      await res.json();
    }
  });

  it("creates an invitation from validated input and persists it", async () => {
    signInAs(TOKEN_ADMIN);
    const email = `route-admin-${crypto.randomUUID()}@integration.test`;
    createdInvitationEmail = email;
    const res = await callRoute(
      createInvitation,
      jsonInit({ email, role: "student", nationalId: "", note: "route integration", expiresInDays: 7 }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBeTruthy();
    const row = await prisma.invitation.findUnique({ where: { code: body.code } });
    expect(row?.email).toBe(email);
    expect(row?.invitedById).toBe(ADMIN_ID);
  });

  it("rejects invalid invitation input before persistence", async () => {
    signInAs(TOKEN_ADMIN);
    const before = await prisma.invitation.count();
    const res = await callRoute(createInvitation, jsonInit({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(await prisma.invitation.count()).toBe(before);
  });
});
