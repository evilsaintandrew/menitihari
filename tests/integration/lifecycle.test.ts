import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  CommercialState,
  InvitationRole,
  PrismaClient,
  PublicationState,
} from "@/generated/prisma/client";
import { expireInvitationTrial } from "@/modules/lifecycle";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 2, connectionTimeoutMillis: 5_000 }),
    })
  : undefined;

describe("invitation trial expiry PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("takes a published invitation offline exactly once", async () => {
    const now = new Date("2026-09-13T08:30:00.000Z");
    const user = await testPrisma!.user.create({
      data: { email: `trial-expiry-${Date.now()}@example.com`, emailVerified: true },
    });
    const invitation = await testPrisma!.invitation.create({
      data: {
        ownerFacingTitle: "Alya & Bima",
        coupleDisplayName1: "Alya",
        coupleDisplayName2: "Bima",
        themeId: "classic",
        themeVersion: "1",
        themeConfig: {},
        publicationState: PublicationState.PUBLISHED,
        commercialState: CommercialState.TRIAL,
        trialStartedAt: new Date("2026-09-10T08:30:00.000Z"),
        trialEndsAt: now,
      },
    });
    await testPrisma!.invitationMember.create({
      data: { invitationId: invitation.id, userId: user.id, role: InvitationRole.OWNER },
    });
    const cache = { invalidateInvitation: () => undefined };

    try {
      await expect(expireInvitationTrial(testPrisma!, invitation.id, { now: () => now, cache }))
        .resolves.toMatchObject({ changed: true, commercialState: CommercialState.TRIAL_EXPIRED });
      await expect(expireInvitationTrial(testPrisma!, invitation.id, { now: () => now, cache }))
        .resolves.toMatchObject({ changed: false, commercialState: CommercialState.TRIAL_EXPIRED });

      await expect(testPrisma!.invitation.findUnique({ where: { id: invitation.id } }))
        .resolves.toMatchObject({
          commercialState: CommercialState.TRIAL_EXPIRED,
          publicationState: PublicationState.UNPUBLISHED,
        });
      await expect(testPrisma!.auditEvent.count({
        where: { invitationId: invitation.id, action: "invitation.trial_expired" },
      })).resolves.toBe(1);
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: user.id } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
