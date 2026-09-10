import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  CommercialState,
  PrismaClient,
  PublicationState,
} from "@/generated/prisma/client";
import {
  createInvitation,
  publishInvitation,
  unpublishInvitation,
  type PublicCacheInvalidator,
} from "@/modules/invitations";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 2, connectionTimeoutMillis: 5_000 }),
    })
  : undefined;

function cacheFor(): PublicCacheInvalidator & { readonly invalidateInvitation: ReturnType<typeof vi.fn> } {
  const invalidateInvitation = vi.fn<(invitationId: string) => void>();
  return { invalidateInvitation };
}

describe("invitation publication PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("commits publish, unpublish, and republish transitions", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `publication-${Date.now()}@example.com`, emailVerified: true },
    });
    const created = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    });
    const cache = cacheFor();

    try {
      await expect(publishInvitation(testPrisma!, owner.id, created.id, { cache })).resolves.toMatchObject({
        previousState: PublicationState.DRAFT,
        publicationState: PublicationState.PUBLISHED,
        changed: true,
      });
      await expect(unpublishInvitation(testPrisma!, owner.id, created.id, { cache })).resolves.toMatchObject({
        previousState: PublicationState.PUBLISHED,
        publicationState: PublicationState.UNPUBLISHED,
      });
      await expect(publishInvitation(testPrisma!, owner.id, created.id, { cache })).resolves.toMatchObject({
        previousState: PublicationState.UNPUBLISHED,
        publicationState: PublicationState.PUBLISHED,
      });

      await expect(testPrisma!.invitation.findUnique({ where: { id: created.id } })).resolves.toMatchObject({
        publicationState: PublicationState.PUBLISHED,
        version: 4,
      });
      await expect(testPrisma!.auditEvent.count({
        where: { invitationId: created.id, action: { in: ["invitation.published", "invitation.unpublished"] } },
      })).resolves.toBe(3);
      expect(cache.invalidateInvitation).toHaveBeenCalledTimes(3);
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: created.id } });
      await testPrisma!.invitation.delete({ where: { id: created.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("enforces validation and commercial lifecycle gates transactionally", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `publication-gates-${Date.now()}@example.com`, emailVerified: true },
    });
    const created = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    });
    const cache = cacheFor();

    try {
      await testPrisma!.invitation.update({
        where: { id: created.id },
        data: { coupleDisplayName2: " " },
      });
      await expect(
        publishInvitation(testPrisma!, owner.id, created.id, { cache }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
      await expect(testPrisma!.invitation.findUnique({ where: { id: created.id } })).resolves.toMatchObject({
        publicationState: PublicationState.DRAFT,
      });

      await testPrisma!.invitation.update({
        where: { id: created.id },
        data: { coupleDisplayName2: "Bima", commercialState: CommercialState.GRACE },
      });
      await expect(
        publishInvitation(testPrisma!, owner.id, created.id, { cache }),
      ).rejects.toMatchObject({ code: "LIFECYCLE_LOCKED" });
      expect(cache.invalidateInvitation).not.toHaveBeenCalled();
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
