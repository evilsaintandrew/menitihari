import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  CommercialState,
  InvitationRole,
  PrismaClient,
  PublicationState,
} from "@/generated/prisma/client";
import { createInvitation } from "@/modules/invitations";

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

describe("invitation creation PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("creates the draft, commercial state, owner membership, event, and audit atomically", async () => {
    const now = new Date("2026-09-10T08:30:00.000Z");
    const user = await testPrisma!.user.create({
      data: { email: `invitation-${Date.now()}@example.com`, emailVerified: true },
    });

    try {
      const created = await createInvitation(testPrisma!, user.id, {
        coupleDisplayName1: "Alya",
        coupleDisplayName2: "Bima",
        mainEventDate: "2026-12-20",
      }, { now: () => now });

      expect(created).toMatchObject({
        ownerFacingTitle: "Alya & Bima",
        publicationState: PublicationState.DRAFT,
        commercialState: CommercialState.TRIAL,
        priceLockedAmount: "79000.00",
        currency: "IDR",
      });
      expect(created.trialStartedAt).toEqual(now);
      expect(created.trialEndsAt).toEqual(new Date("2026-09-13T08:30:00.000Z"));

      const invitation = await testPrisma!.invitation.findUniqueOrThrow({
        where: { id: created.id },
        include: { members: true, events: true, content: true },
      });
      expect(invitation).toMatchObject({
        primaryEventId: created.primaryEventId,
        publicationState: PublicationState.DRAFT,
        commercialState: CommercialState.TRIAL,
      });
      expect(invitation.members).toHaveLength(1);
      expect(invitation.members[0]).toMatchObject({ userId: user.id, role: InvitationRole.OWNER });
      expect(invitation.events).toHaveLength(1);
      expect(invitation.events[0]).toMatchObject({
        id: created.primaryEventId,
        name: "Acara Utama",
        isPrimary: true,
        timezone: "Asia/Jakarta",
        startsAt: new Date("2026-12-19T17:00:00.000Z"),
      });
      expect(invitation.content).not.toBeNull();
      expect(await testPrisma!.auditEvent.count({ where: { invitationId: created.id, action: "invitation.created" } })).toBe(1);
    } finally {
      const invitation = await testPrisma!.invitation.findFirst({
        where: { members: { some: { userId: user.id, role: InvitationRole.OWNER } } },
      });
      if (invitation) {
        await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
        await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      }
      await testPrisma!.user.delete({ where: { id: user.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("rejects an unverified owner without creating partial records", async () => {
    const user = await testPrisma!.user.create({
      data: { email: `unverified-invitation-${Date.now()}@example.com` },
    });

    try {
      await expect(createInvitation(testPrisma!, user.id, {
        coupleDisplayName1: "Alya",
        coupleDisplayName2: "Bima",
        mainEventDate: "2026-12-20",
      })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await testPrisma!.invitation.count({
        where: { members: { some: { userId: user.id, role: InvitationRole.OWNER } } },
      })).toBe(0);
    } finally {
      await testPrisma!.user.delete({ where: { id: user.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("enforces exactly one owner membership per invitation", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `membership-owner-${Date.now()}@example.com`, emailVerified: true },
    });
    const secondUser = await testPrisma!.user.create({
      data: { email: `membership-second-${Date.now()}@example.com`, emailVerified: true },
    });
    const created = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    });

    try {
      await expect(testPrisma!.invitationMember.create({
        data: {
          invitationId: created.id,
          userId: secondUser.id,
          role: InvitationRole.OWNER,
        },
      })).rejects.toMatchObject({ code: "P2002" });

      await expect(testPrisma!.invitationMember.delete({
        where: { invitationId_userId: { invitationId: created.id, userId: owner.id } },
      })).rejects.toThrow(/exactly one owner membership/);

      await expect(testPrisma!.invitationMember.count({
        where: { invitationId: created.id, role: InvitationRole.OWNER },
      })).resolves.toBe(1);
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: created.id } });
      await testPrisma!.invitation.delete({ where: { id: created.id } });
      await testPrisma!.user.delete({ where: { id: secondUser.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
