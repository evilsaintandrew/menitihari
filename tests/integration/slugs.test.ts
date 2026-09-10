import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { InvitationRole, PrismaClient } from "@/generated/prisma/client";
import {
  createInvitation,
  resolveInvitationSlug,
  updateInvitationSlug,
} from "@/modules/invitations";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 3, connectionTimeoutMillis: 5_000 }),
    })
  : undefined;

describe("invitation slug PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("allocates globally unique suggestions and retains direct aliases", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `slug-owner-${Date.now()}@example.com`, emailVerified: true },
    });
    const first = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    });
    const second = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-21",
    });

    try {
      expect(first.slug).toBe("alya-bima");
      expect(second.slug).toBe("alya-bima-2");
      await expect(testPrisma!.invitationSlug.count({ where: { slug: first.slug } })).resolves.toBe(1);

      const cache = { invalidateInvitation: () => undefined };
      await updateInvitationSlug(testPrisma!, owner.id, first.id, "alya-wedding", { cache });
      await updateInvitationSlug(testPrisma!, owner.id, first.id, "alya-wedding-latest", { cache });

      await expect(resolveInvitationSlug(testPrisma!, "alya-bima")).resolves.toMatchObject({
        invitationId: first.id,
        canonicalSlug: "alya-wedding-latest",
        isCanonical: false,
      });
      await expect(resolveInvitationSlug(testPrisma!, "alya-wedding")).resolves.toMatchObject({
        invitationId: first.id,
        canonicalSlug: "alya-wedding-latest",
        isCanonical: false,
      });
      await expect(resolveInvitationSlug(testPrisma!, "alya-wedding-latest")).resolves.toMatchObject({
        invitationId: first.id,
        canonicalSlug: "alya-wedding-latest",
        isCanonical: true,
      });
      await expect(testPrisma!.invitationSlug.count({ where: { invitationId: first.id, isCanonical: true } })).resolves.toBe(1);
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: { in: [first.id, second.id] } } });
      await testPrisma!.invitation.deleteMany({ where: { id: { in: [first.id, second.id] } } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("never reuses a retained alias", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `slug-reuse-${Date.now()}@example.com`, emailVerified: true },
    });
    const first = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Citra",
      coupleDisplayName2: "Danu",
      mainEventDate: "2026-12-20",
    });
    const second = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Eka",
      coupleDisplayName2: "Fajar",
      mainEventDate: "2026-12-21",
    });

    try {
      const cache = { invalidateInvitation: () => undefined };
      await updateInvitationSlug(testPrisma!, owner.id, first.id, "citra-danu-new", { cache });
      await expect(
        updateInvitationSlug(testPrisma!, owner.id, second.id, first.slug, { cache }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: { in: [first.id, second.id] } } });
      await testPrisma!.invitation.deleteMany({ where: { id: { in: [first.id, second.id] } } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("keeps invitation ownership scoped for slug changes", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `slug-auth-owner-${Date.now()}@example.com`, emailVerified: true },
    });
    const otherUser = await testPrisma!.user.create({
      data: { email: `slug-auth-other-${Date.now()}@example.com`, emailVerified: true },
    });
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Gita",
      coupleDisplayName2: "Hadi",
      mainEventDate: "2026-12-20",
    });

    try {
      await expect(
        updateInvitationSlug(testPrisma!, otherUser.id, invitation.id, "not-authorized", {
          cache: { invalidateInvitation: () => undefined },
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(testPrisma!.invitationMember.findMany({ where: { invitationId: invitation.id, role: InvitationRole.OWNER } })).resolves.toHaveLength(1);
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.deleteMany({ where: { id: { in: [owner.id, otherUser.id] } } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
