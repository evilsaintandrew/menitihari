import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createInvitation, saveInvitationContent, type PublicCacheInvalidator } from "@/modules/invitations";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 2, connectionTimeoutMillis: 5_000 }) })
  : undefined;

function cacheFor(): PublicCacheInvalidator & { readonly invalidateInvitation: ReturnType<typeof vi.fn> } {
  const invalidateInvitation = vi.fn<(invitationId: string) => void>();
  return { invalidateInvitation };
}

describe("invitation editor PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("persists autosave content and rejects a stale retry", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `editor-${Date.now()}@example.com`, emailVerified: true },
    });
    const created = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    });
    const cache = cacheFor();
    const content = {
      language: "id" as const,
      core: { coupleDisplayName1: "Alya Putri", coupleDisplayName2: "Bima Pratama" },
      optional: { opening: "Selamat datang", closing: "Sampai jumpa" },
    };

    try {
      await expect(saveInvitationContent(
        testPrisma!,
        owner.id,
        created.id,
        { expectedVersion: 1, content },
        { cache },
      )).resolves.toMatchObject({ version: 2, changed: true });

      await expect(testPrisma!.invitation.findUnique({ where: { id: created.id }, include: { content: true } })).resolves.toMatchObject({
        version: 2,
        coupleDisplayName1: "Alya Putri",
        coupleDisplayName2: "Bima Pratama",
        content: { opening: "Selamat datang", closing: "Sampai jumpa" },
      });
      expect(cache.invalidateInvitation).toHaveBeenCalledTimes(1);

      await expect(saveInvitationContent(
        testPrisma!,
        owner.id,
        created.id,
        { expectedVersion: 1, content },
        { cache },
      )).rejects.toMatchObject({ code: "STALE_VERSION" });
      expect(cache.invalidateInvitation).toHaveBeenCalledTimes(1);
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
