import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  CommercialState,
  InvitationRole,
  MediaAssetState,
  MediaAssetType,
  PublicationState,
  PrismaClient,
} from "@/generated/prisma/client";
import {
  purgeInvitation,
  requestInvitationDeletion,
} from "@/modules/invitations";

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

describe("invitation deletion PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("takes public access offline and purges operational data while retaining financial records", async () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    const user = await testPrisma!.user.create({
      data: { email: `invitation-delete-${Date.now()}@example.com`, emailVerified: true },
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
        trialStartedAt: now,
        trialEndsAt: new Date("2026-09-13T00:00:00.000Z"),
      },
    });
    await testPrisma!.invitationMember.create({
      data: { invitationId: invitation.id, userId: user.id, role: InvitationRole.OWNER },
    });
    const paymentOrder = await testPrisma!.paymentOrder.create({
      data: { invitationId: invitation.id, provider: "test", amount: "79000", currency: "IDR" },
    });
    const financialRecord = await testPrisma!.financialRecord.create({
      data: {
        paymentOrderId: paymentOrder.id,
        invitationRef: invitation.id,
        transactionRef: `txn-${Date.now()}`,
        amount: "79000",
        currency: "IDR",
      },
    });
    const media = await testPrisma!.mediaAsset.create({
      data: {
        invitationId: invitation.id,
        type: MediaAssetType.IMAGE,
        originalKey: `invitations/${invitation.id}/original.jpg`,
        state: MediaAssetState.READY,
      },
    });
    const variant = await testPrisma!.mediaVariant.create({
      data: {
        mediaAssetId: media.id,
        kind: "MEDIUM",
        storageKey: `invitations/${invitation.id}/medium.jpg`,
      },
    });
    const storage = { deleteObject: async () => undefined };

    try {
      const scheduled = await requestInvitationDeletion(testPrisma!, user.id, invitation.id, {
        purgeWindowSeconds: 60,
        now: () => now,
      });
      expect(scheduled).toMatchObject({
        commercialState: CommercialState.DELETION_PENDING,
        publicationState: PublicationState.UNPUBLISHED,
        purgeAt: new Date("2026-09-10T00:01:00.000Z"),
      });
      expect(await testPrisma!.invitation.findUnique({ where: { id: invitation.id } })).toMatchObject({
        commercialState: CommercialState.DELETION_PENDING,
        publicationState: PublicationState.UNPUBLISHED,
      });

      await expect(purgeInvitation(testPrisma!, invitation.id, {
        storage,
        now: () => new Date("2026-09-10T00:02:00.000Z"),
      })).resolves.toMatchObject({ deleted: true });
      await expect(purgeInvitation(testPrisma!, invitation.id, {
        storage,
        now: () => new Date("2026-09-10T00:03:00.000Z"),
      })).resolves.toMatchObject({ alreadyPurged: true });

      expect(await testPrisma!.invitation.findUnique({ where: { id: invitation.id } })).toBeNull();
      expect(await testPrisma!.mediaVariant.findUnique({ where: { id: variant.id } })).toBeNull();
      expect(await testPrisma!.financialRecord.findUnique({ where: { id: financialRecord.id } })).toMatchObject({
        paymentOrderId: null,
        invitationRef: invitation.id,
      });
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { userId: user.id } });
      await testPrisma!.financialRecord.deleteMany({ where: { id: financialRecord.id } });
      await testPrisma!.job.deleteMany({ where: { dedupKey: `invitation-purge:${invitation.id}` } });
      await testPrisma!.invitation.deleteMany({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: user.id } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
