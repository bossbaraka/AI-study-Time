/**
 * Seed for the official auth gateway.
 *
 * Creates the administration account, the demo student/guardian (with the
 * SAME ids the mock data layer uses, so existing browser state keeps
 * working) and two open invitation codes for the registration demo.
 * Idempotent: safe to run repeatedly.
 */

import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  const salt = randomBytes(16);
  const dk = scryptSync(Buffer.from(password.normalize("NFKC"), "utf8"), salt, SCRYPT.keylen, {
    ...SCRYPT,
    maxmem: 64 * 1024 * 1024,
  });
  return `s2$${SCRYPT.N}$${salt.toString("hex")}$${Buffer.from(dk).toString("base64url")}`;
}

const connectionString = process.env.DATABASE_URL;
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function upsertUser({ id, email, name, role, nationalId, password, onboarding }) {
  const passwordHash = hashPassword(password);
  await db.user.upsert({
    where: { email },
    update: { name, role, passwordHash, nationalId: nationalId ?? null },
    create: {
      id,
      email,
      name,
      role,
      nationalId: nationalId ?? null,
      passwordHash,
      status: "active",
      emailVerification: "verified",
      onboarding: onboarding ?? "completed",
    },
  });
  console.log(`  user  ${role.padEnd(8)} ${email}  (${id})`);
}

async function upsertInvitation({ code, email, role, nationalId, note, adminId }) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.invitation.upsert({
    where: { code },
    update: {},
    create: { code, email, role, nationalId: nationalId ?? null, note, expiresAt, invitedById: adminId },
  });
  await db.outboxMessage.create({
    data: {
      to: email,
      subject: "You are invited to Mureeh",
      body: `Your invitation code: ${code} (valid 30 days). Register at http://localhost:3000/sign-up`,
      kind: "invite",
    },
  });
  console.log(`  invite ${code}  → ${email} (${role})`);
}

async function main() {
  console.log("Seeding Mureeh auth gateway (DATABASE_URL):", process.env.DATABASE_URL ?? "file:./data/dev.db");

  await upsertUser({
    id: "usr_admin_01",
    email: "admin@mureeh.app",
    name: "إدارة مريح",
    role: "admin",
    password: "AdminPass1",
    onboarding: "completed",
  });
  // Same ids as the mock data layer → journeys created while the app used
  // the mock backend remain attached to these accounts.
  await upsertUser({
    id: "usr_student_01",
    email: "layla.hassan@example.com",
    name: "Layla Hassan",
    role: "student",
    nationalId: "1098765432",
    password: "securePass1",
    onboarding: "completed",
  });
  await upsertUser({
    id: "usr_guardian_01",
    email: "guardian@example.com",
    name: "Yusuf Hassan",
    role: "guardian",
    password: "securePass1",
    onboarding: "completed",
  });

  await upsertInvitation({
    code: "MU-STUDENT-2026",
    email: "new.student@example.com",
    role: "student",
    note: "Demo cohort — Autumn",
    adminId: "usr_admin_01",
  });
  await upsertInvitation({
    code: "MU-GUARDIAN-7X",
    email: "new.guardian@example.com",
    role: "guardian",
    note: "Reserved for national id 1011121314",
    nationalId: "1011121314",
    adminId: "usr_admin_01",
  });

  console.log("Done. Sign-in: admin@mureeh.app / AdminPass1 · layla.hassan@example.com / securePass1");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
