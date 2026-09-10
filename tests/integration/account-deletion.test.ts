import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  AccountDeletionState,
  CommercialState,
  InvitationRole,
  PrismaClient,
  PublicationState,
} from "../../src/generated/prisma/client";
import {
  ACCOUNT_DELETION_COMMIT_JOB,
  ACCOUNT_PURGE_JOB,
  cancelAccountDeletion,
  commitAccountDeletion,
  requestAccountDeletion,
} from "../../src/modules/auth/account-deletion";

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

describe("account deletion PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("transitions, cancels, commits, and preserves financial records", async () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    const user = await testPrisma!.user.create({ data: { email: `delete-${Date.now()}@example.com`, emailVerified: true } });
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

    try {
      const scheduled = await requestAccountDeletion(testPrisma!, user.id, {
        coolingOffSeconds: 3_600,
        now: () => now,
      });
      expect(scheduled.cancellableUntil).toEqual(new Date("2026-09-10T01:00:00.000Z"));
      expect(await testPrisma!.user.findUnique({ where: { id: user.id } })).toMatchObject({
        deletionState: AccountDeletionState.DELETION_COOLING_OFF,
      });
      expect(await testPrisma!.invitation.findUnique({ where: { id: invitation.id } })).toMatchObject({
        publicationState: PublicationState.UNPUBLISHED,
      });
      expect(await testPrisma!.job.findUnique({ where: { dedupKey: `account-deletion:${user.id}` } })).toMatchObject({
        type: ACCOUNT_DELETION_COMMIT_JOB,
      });

      await cancelAccountDeletion(testPrisma!, user.id, { now: () => now });
      expect(await testPrisma!.user.findUnique({ where: { id: user.id } })).toMatchObject({ deletionState: AccountDeletionState.ACTIVE });
      expect(await testPrisma!.invitation.findUnique({ where: { id: invitation.id } })).toMatchObject({ publicationState: PublicationState.UNPUBLISHED });
      expect(await testPrisma!.job.findUnique({ where: { dedupKey: `account-deletion:${user.id}` } })).toBeNull();

      await requestAccountDeletion(testPrisma!, user.id, { coolingOffSeconds: 3_600, now: () => now });
      await commitAccountDeletion(testPrisma!, user.id, { now: () => new Date("2026-09-10T01:00:00.000Z") });
      expect(await testPrisma!.user.findUnique({ where: { id: user.id } })).toMatchObject({ deletionState: AccountDeletionState.DELETION_COMMITTED });
      expect(await testPrisma!.invitation.findUnique({ where: { id: invitation.id } })).toMatchObject({ commercialState: CommercialState.DELETED });
      expect(await testPrisma!.job.findUnique({ where: { dedupKey: `account-purge:${user.id}` } })).toMatchObject({ type: ACCOUNT_PURGE_JOB });
      expect(await testPrisma!.financialRecord.findUnique({ where: { id: financialRecord.id } })).not.toBeNull();
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { userId: user.id } });
      await testPrisma!.job.deleteMany({
        where: { dedupKey: { in: [`account-deletion:${user.id}`, `account-purge:${user.id}`] } },
      });
      await testPrisma!.financialRecord.delete({ where: { id: financialRecord.id } });
      await testPrisma!.paymentOrder.delete({ where: { id: paymentOrder.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: user.id } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
