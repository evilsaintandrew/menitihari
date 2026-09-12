import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient, RsvpStatus } from "@/generated/prisma/client";
import { createInvitation, publishInvitation } from "@/modules/invitations";
import { saveGuest } from "@/modules/guests";
import { submitPersonalizedRsvp } from "@/modules/rsvp";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 2, connectionTimeoutMillis: 5_000 }) })
  : undefined;

describe("personalized RSVP PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("persists per-event responses, enforces party limits, and closes at the server boundary", async () => {
    const now = new Date("2026-09-12T00:00:00.000Z");
    const owner = await testPrisma!.user.create({ data: { email: `rsvp-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    }, { now: () => now });
    try {
      await publishInvitation(testPrisma!, owner.id, invitation.id, { cache: { invalidateInvitation: () => undefined } });
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      const guest = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Keluarga Santoso",
        assignments: [{ eventId: event.id, maxPartySize: 3 }],
      }, { now: () => now });
      const assignment = await testPrisma!.guestEvent.findFirstOrThrow({ where: { guestId: guest.guestId, eventId: event.id } });

      await expect(submitPersonalizedRsvp(testPrisma!, invitation.id, guest.guestId, {
        responses: [{ eventId: event.id, status: RsvpStatus.ATTENDING, attendanceCount: 3 }],
      }, { now: () => now })).resolves.toMatchObject({
        invitationId: invitation.id,
        guestId: guest.guestId,
        summary: [{ eventId: event.id, eventName: event.name, status: RsvpStatus.ATTENDING, attendanceCount: 3 }],
      });
      await expect(testPrisma!.rSVP.findUnique({ where: { guestEventId: assignment.id } })).resolves.toMatchObject({
        status: RsvpStatus.ATTENDING,
        attendanceCount: 3,
      });

      await expect(submitPersonalizedRsvp(testPrisma!, invitation.id, guest.guestId, {
        responses: [{ eventId: event.id, status: RsvpStatus.ATTENDING, attendanceCount: 4 }],
      }, { now: () => now })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

      await testPrisma!.event.update({ where: { id: event.id }, data: { rsvpClosesAt: now } });
      await expect(submitPersonalizedRsvp(testPrisma!, invitation.id, guest.guestId, {
        responses: [{ eventId: event.id, status: RsvpStatus.NOT_ATTENDING }],
      }, { now: () => now })).rejects.toMatchObject({ code: "RSVP_CLOSED" });
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
