import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { archiveGuest, bulkUpdateGuests, mergeGuests, saveGuest } from "@/modules/guests";
import {
  createInvitation,
  getInvitationPreviewRenderData,
  getPersonalizedInvitationPageData,
  publishInvitation,
} from "@/modules/invitations";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 2, connectionTimeoutMillis: 5_000 }) })
  : undefined;

describe("guest CRUD PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("persists guest groups and archives guests with RSVP history", async () => {
    const owner = await testPrisma!.user.create({ data: { email: `guests-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, { coupleDisplayName1: "Alya", coupleDisplayName2: "Bima", mainEventDate: "2026-12-20" });
    try {
      const created = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Keluarga Santoso",
        phone: "0812 3456 7890",
        groupName: "Keluarga",
        assignments: [{ eventId: (await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } })).id, maxPartySize: 4 }],
      });
      const assignment = await testPrisma!.guestEvent.findFirstOrThrow({ where: { guestId: created.guestId } });
      await testPrisma!.rSVP.create({ data: { guestEventId: assignment.id, status: "ATTENDING", attendanceCount: 3 } });

      const guest = await testPrisma!.guest.findUniqueOrThrow({ where: { id: created.guestId }, include: { group: true } });
      expect(guest).toMatchObject({ displayName: "Keluarga Santoso", normalizedPhone: "+6281234567890", displayPhone: "0812 3456 7890", group: { name: "Keluarga" } });

      await expect(archiveGuest(testPrisma!, owner.id, invitation.id, created.guestId)).resolves.toMatchObject({ mode: "archived" });
      const archived = await testPrisma!.guest.findUniqueOrThrow({ where: { id: created.guestId }, include: { eventAssignments: { include: { rsvp: true } } } });
      expect(archived.archivedAt).toBeInstanceOf(Date);
      expect(archived.eventAssignments[0]).toMatchObject({ state: "REMOVED", rsvp: { status: "ATTENDING", attendanceCount: 3 } });
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("serializes capacity-increasing mutations at the invitation boundary", async () => {
    const owner = await testPrisma!.user.create({ data: { email: `capacity-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, { coupleDisplayName1: "Alya", coupleDisplayName2: "Bima", mainEventDate: "2026-12-20" });
    try {
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Keluarga Besar",
        assignments: [{ eventId: event.id, maxPartySize: 499 }],
      });

      const results = await Promise.allSettled([
        saveGuest(testPrisma!, owner.id, invitation.id, null, {
          displayName: "Tamu Satu",
          assignments: [{ eventId: event.id, maxPartySize: 1 }],
        }),
        saveGuest(testPrisma!, owner.id, invitation.id, null, {
          displayName: "Tamu Dua",
          assignments: [{ eventId: event.id, maxPartySize: 1 }],
        }),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      await expect(testPrisma!.guestEvent.aggregate({
        where: { state: "ACTIVE", guest: { invitationId: invitation.id, archivedAt: null } },
        _sum: { maxPartySize: true },
      })).resolves.toMatchObject({ _sum: { maxPartySize: 500 } });
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("warns on normalized duplicates and preserves source history during merge", async () => {
    const owner = await testPrisma!.user.create({ data: { email: `merge-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, { coupleDisplayName1: "Alya", coupleDisplayName2: "Bima", mainEventDate: "2026-12-20" });
    try {
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      const source = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Bpk. Andi",
        phone: "0812 3456 7890",
        assignments: [{ eventId: event.id, maxPartySize: 2 }],
      });
      const target = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Bpk Andi",
        phone: "+62 812 3456 7890",
        assignments: [{ eventId: event.id, maxPartySize: 3 }],
      });

      expect(target.duplicateWarnings).toEqual(expect.arrayContaining([expect.objectContaining({ guestId: source.guestId, matchingSignals: ["PHONE", "NAME"] })]));
      const sourceAssignment = await testPrisma!.guestEvent.findFirstOrThrow({ where: { guestId: source.guestId } });
      await testPrisma!.rSVP.create({ data: { guestEventId: sourceAssignment.id, status: "ATTENDING", attendanceCount: 2 } });

      await expect(mergeGuests(testPrisma!, owner.id, invitation.id, {
        sourceGuestId: source.guestId,
        targetGuestId: target.guestId,
        conflictResolutions: [{ eventId: event.id, keep: "SOURCE" }],
      })).resolves.toMatchObject({ mode: "merged", sourceGuestId: source.guestId, targetGuestId: target.guestId });

      const archivedSource = await testPrisma!.guest.findUniqueOrThrow({ where: { id: source.guestId }, include: { eventAssignments: { include: { rsvp: true } } } });
      expect(archivedSource).toMatchObject({ archivedAt: expect.any(Date), mergedIntoGuestId: target.guestId });
      expect(archivedSource.eventAssignments[0]).toMatchObject({ state: "REMOVED", rsvp: { status: "ATTENDING", attendanceCount: 2 } });
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("applies bulk group/distribution changes and warns before removing RSVP history", async () => {
    const owner = await testPrisma!.user.create({ data: { email: `bulk-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, { coupleDisplayName1: "Alya", coupleDisplayName2: "Bima", mainEventDate: "2026-12-20" });
    try {
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      const first = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Keluarga Satu",
        assignments: [{ eventId: event.id, maxPartySize: 1 }],
      });
      const second = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Keluarga Dua",
        assignments: [{ eventId: event.id, maxPartySize: 1 }],
      });
      const group = await testPrisma!.guestGroup.create({ data: { invitationId: invitation.id, name: "Keluarga" } });

      await expect(bulkUpdateGuests(testPrisma!, owner.id, invitation.id, {
        operation: "GROUP",
        guestIds: [first.guestId, second.guestId],
        groupId: group.id,
      })).resolves.toMatchObject({ operation: "GROUP", updatedGuestCount: 2 });
      await bulkUpdateGuests(testPrisma!, owner.id, invitation.id, {
        operation: "DISTRIBUTION",
        guestIds: [first.guestId, second.guestId],
        distributionStatus: "MARKED_SENT",
      });

      const assignment = await testPrisma!.guestEvent.findFirstOrThrow({ where: { guestId: first.guestId, eventId: event.id } });
      await testPrisma!.rSVP.create({ data: { guestEventId: assignment.id, status: "ATTENDING", attendanceCount: 1 } });
      await expect(bulkUpdateGuests(testPrisma!, owner.id, invitation.id, {
        operation: "EVENT",
        guestIds: [first.guestId, second.guestId],
        eventId: event.id,
        eventAction: "UNASSIGN",
      })).resolves.toMatchObject({ changed: false, warning: { guestCount: 1 } });

      await bulkUpdateGuests(testPrisma!, owner.id, invitation.id, {
        operation: "EVENT",
        guestIds: [first.guestId, second.guestId],
        eventId: event.id,
        eventAction: "UNASSIGN",
        confirmHistoricalRemoval: true,
      });
      await expect(testPrisma!.guest.findMany({ where: { id: { in: [first.guestId, second.guestId] }, groupId: group.id, distributionStatus: "MARKED_SENT" } })).resolves.toHaveLength(2);
      await expect(testPrisma!.guestEvent.findFirstOrThrow({ where: { id: assignment.id }, include: { rsvp: true } })).resolves.toMatchObject({ state: "REMOVED", rsvp: { status: "ATTENDING" } });
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("records viewed state only after a successful personalized render", async () => {
    const owner = await testPrisma!.user.create({ data: { email: `viewed-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    });
    try {
      await publishInvitation(testPrisma!, owner.id, invitation.id, { cache: { invalidateInvitation: () => undefined } });
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      const guest = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Keluarga Santoso",
        assignments: [{ eventId: event.id, maxPartySize: 3 }],
      });

      await expect(getInvitationPreviewRenderData(testPrisma!, owner.id, invitation.id, guest.guestId)).resolves.toMatchObject({
        mode: "personalized",
        guest: { displayName: "Keluarga Santoso" },
      });
      await expect(testPrisma!.guest.findUniqueOrThrow({ where: { id: guest.guestId }, select: { lastViewedAt: true } })).resolves.toMatchObject({ lastViewedAt: null });

      const viewedAt = new Date("2026-09-12T04:00:00.000Z");
      await expect(getPersonalizedInvitationPageData(testPrisma!, invitation.id, guest.guestId, viewedAt)).resolves.toMatchObject({
        mode: "personalized",
        guest: { displayName: "Keluarga Santoso" },
      });
      await expect(testPrisma!.guest.findUniqueOrThrow({ where: { id: guest.guestId }, select: { lastViewedAt: true } })).resolves.toMatchObject({ lastViewedAt: viewedAt });
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
