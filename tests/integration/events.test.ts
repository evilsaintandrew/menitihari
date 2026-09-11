import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { EventVisibility, PrismaClient } from "@/generated/prisma/client";
import { createInvitation } from "@/modules/invitations";
import { cancelEvent, MAX_EVENTS_PER_INVITATION, removeEvent, saveEvent, setPrimaryEvent } from "@/modules/events";
import { saveGuest } from "@/modules/guests";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 2, connectionTimeoutMillis: 5_000 }) })
  : undefined;

function eventInput(index: number) {
  return {
    name: `Acara ${index}`,
    startDate: "2026-12-20",
    startTime: `${String(10 + index).padStart(2, "0")}:00`,
    timezone: index === 1 ? "" : "Asia/Jakarta",
    visibility: index === 2 ? EventVisibility.PERSONALIZED_ONLY : EventVisibility.GENERIC,
    venue: `Venue ${index}`,
    address: `Alamat ${index}`,
    mapsUrl: "https://maps.google.com/?q=venue",
    locationNote: "Masuk dari pintu utara",
    livestreamUrl: "https://youtube.com/live/example",
    dressCode: "Formal",
    contactName: "Rina",
    contactRole: "WO",
    contactPhone: "08123456789",
    isPrimary: false,
  } as const;
}

describe("event CRUD PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("persists event fields, enforces five events, changes the primary event, and cancels with a message", async () => {
    const owner = await testPrisma!.user.create({ data: { email: `events-${Date.now()}@example.com`, emailVerified: true } });
    const created = await createInvitation(testPrisma!, owner.id, { coupleDisplayName1: "Alya", coupleDisplayName2: "Bima", mainEventDate: "2026-12-20" });
    try {
      const first = await saveEvent(testPrisma!, owner.id, created.id, null, { ...eventInput(1), isPrimary: true });
      const firstEventGuest = await saveGuest(testPrisma!, owner.id, created.id, null, {
        displayName: "Keluarga Santoso",
        assignments: [{ eventId: first.eventId, maxPartySize: 4 }],
      });
      const second = await saveEvent(testPrisma!, owner.id, created.id, null, eventInput(2));
      await expect(testPrisma!.guestEvent.count({ where: { guestId: firstEventGuest.guestId, eventId: second.eventId } })).resolves.toBe(0);
      await saveEvent(testPrisma!, owner.id, created.id, null, eventInput(3));
      await saveEvent(testPrisma!, owner.id, created.id, null, eventInput(4));

      await expect(saveEvent(testPrisma!, owner.id, created.id, null, eventInput(5))).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
      await expect(setPrimaryEvent(testPrisma!, owner.id, created.id, second.eventId)).resolves.toMatchObject({ changed: true });

      const invitation = await testPrisma!.invitation.findUniqueOrThrow({ where: { id: created.id }, include: { events: true } });
      expect(invitation.events).toHaveLength(MAX_EVENTS_PER_INVITATION);
      expect(invitation.primaryEventId).toBe(second.eventId);
      expect(invitation.events.find(({ id }) => id === second.eventId)).toMatchObject({
        visibility: EventVisibility.PERSONALIZED_ONLY,
        timezone: "Asia/Jakarta",
        venue: "Venue 2",
        contactFields: { name: "Rina", role: "WO", phone: "08123456789" },
      });
      expect(invitation.events.find(({ id }) => id === first.eventId)?.isPrimary).toBe(false);
      await expect(cancelEvent(testPrisma!, owner.id, created.id, second.eventId, { message: "Acara dipindahkan." })).resolves.toMatchObject({ mode: "cancelled", changed: true });
      await expect(testPrisma!.event.findUnique({ where: { id: second.eventId } })).resolves.toMatchObject({ cancelledAt: expect.any(Date), cancellationMessage: "Acara dipindahkan." });
      await expect(removeEvent(testPrisma!, owner.id, created.id, second.eventId)).resolves.toMatchObject({ mode: "archived" });
      await expect(testPrisma!.event.findUnique({ where: { id: second.eventId } })).resolves.toMatchObject({ archivedAt: expect.any(Date), cancellationMessage: "Acara dipindahkan." });
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
