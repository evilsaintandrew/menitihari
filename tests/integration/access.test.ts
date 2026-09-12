import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import {
  createInvitation,
  publishInvitation,
} from "@/modules/invitations";
import {
  createInvitationPasswordSession,
  getInvitationPasswordAccess,
  INVITATION_PASSWORD_SESSION_SECONDS,
  setInvitationSharedPassword,
} from "@/modules/access";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: testDatabaseUrl,
        max: 2,
        connectionTimeoutMillis: 5_000,
      }),
    })
  : undefined;

describe("shared invitation access PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("hashes, scopes, expires, and invalidates password sessions", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `shared-password-${Date.now()}@example.com`, emailVerified: true },
    });
    const created = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    });
    await publishInvitation(testPrisma!, owner.id, created.id, {
      cache: { invalidateInvitation: () => undefined },
    });

    const now = new Date("2026-09-10T08:30:00.000Z");
    try {
      const enabled = await setInvitationSharedPassword(
        testPrisma!,
        owner.id,
        created.id,
        "rahasia-lama",
        { now: () => now },
      );
      expect(enabled).toMatchObject({ passwordEnabled: true, accessVersion: 2 });
      const stored = await testPrisma!.invitation.findUniqueOrThrow({
        where: { id: created.id },
        select: { sharedPasswordHash: true, accessVersion: true },
      });
      expect(stored.sharedPasswordHash).not.toContain("rahasia-lama");

      const session = await createInvitationPasswordSession(testPrisma!, created.id, "rahasia-lama", { now: () => now });
      await expect(getInvitationPasswordAccess(testPrisma!, created.id, session.sessionToken, now)).resolves.toMatchObject({
        available: true,
        passwordRequired: true,
        authorized: true,
        accessVersion: 2,
      });
      await expect(createInvitationPasswordSession(testPrisma!, created.id, "salah", { now: () => now })).rejects.toMatchObject({ code: "FORBIDDEN" });

      const changed = await setInvitationSharedPassword(
        testPrisma!,
        owner.id,
        created.id,
        "rahasia-baru",
        { now: () => now },
      );
      expect(changed.accessVersion).toBe(3);
      await expect(getInvitationPasswordAccess(testPrisma!, created.id, session.sessionToken, now)).resolves.toMatchObject({ authorized: false, accessVersion: 3 });

      const freshSession = await createInvitationPasswordSession(testPrisma!, created.id, "rahasia-baru", { now: () => now });
      await expect(getInvitationPasswordAccess(
        testPrisma!,
        created.id,
        freshSession.sessionToken,
        new Date(now.getTime() + INVITATION_PASSWORD_SESSION_SECONDS * 1_000 + 1),
      )).resolves.toMatchObject({ authorized: false });

      const disabled = await setInvitationSharedPassword(testPrisma!, owner.id, created.id, null, { now: () => now });
      expect(disabled).toMatchObject({ passwordEnabled: false, accessVersion: 4 });
      await expect(getInvitationPasswordAccess(testPrisma!, created.id, undefined, now)).resolves.toMatchObject({
        passwordRequired: false,
        authorized: true,
      });
      await expect(testPrisma!.auditEvent.count({
        where: { invitationId: created.id, action: { in: ["invitation.password_enabled", "invitation.password_changed", "invitation.password_disabled"] } },
      })).resolves.toBe(3);
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: created.id } });
      await testPrisma!.invitation.delete({ where: { id: created.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
