import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { archiveGuest, saveGuest } from "@/modules/guests";
import { createInvitation } from "@/modules/invitations";

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
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
