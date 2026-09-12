import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient, RsvpStatus } from "@/generated/prisma/client";
import { createInvitation, publishInvitation } from "@/modules/invitations";
import { saveGuest } from "@/modules/guests";
import { activateGuest } from "@/modules/access";
import { overrideRsvp, setOwnerRsvpControl, setPublicRsvpApproval, setPublicRsvpSettings, submitPersonalizedRsvp, submitPublicRsvp } from "@/modules/rsvp";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 2, connectionTimeoutMillis: 5_000 }) })
  : undefined;

describe("personalized RSVP PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("creates a public guest, assignments, RSVP, and activatable personalized link", async () => {
    const now = new Date("2026-09-12T00:00:00.000Z");
    const owner = await testPrisma!.user.create({ data: { email: `public-rsvp-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    }, { now: () => now });
    try {
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      await setPublicRsvpSettings(testPrisma!, owner.id, invitation.id, {
        enabled: true,
        requireApproval: false,
        requirePhone: true,
        maxPartySize: 3,
        eventIds: [event.id],
      }, { now: () => now });
      await publishInvitation(testPrisma!, owner.id, invitation.id, { cache: { invalidateInvitation: () => undefined } });

      const result = await submitPublicRsvp(testPrisma!, invitation.id, {
        displayName: "Keluarga Santoso",
        phone: "+62 812 3456 7890",
        partySize: 2,
      }, { now: () => now });
      const assignment = await testPrisma!.guestEvent.findFirstOrThrow({ where: { guestId: result.guestId, eventId: event.id } });
      expect(result).toMatchObject({ invitationId: invitation.id, guestId: result.guestId, duplicateWarning: false });
      expect(assignment).toMatchObject({ publicRsvpApproval: "APPROVED", checkInEligible: true });
      expect(await testPrisma!.rSVP.findUnique({ where: { guestEventId: assignment.id } })).toMatchObject({ status: "ATTENDING", attendanceCount: 2, source: "PUBLIC" });
      expect(await testPrisma!.guestActivationCredential.count({ where: { guestId: result.guestId, state: "ISSUED" } })).toBe(1);

      const token = result.personalizedPath.split("/g/")[1];
      expect(token).toBeTruthy();
      await expect(activateGuest(testPrisma!, token!, { invitationId: invitation.id, now: () => now })).resolves.toMatchObject({ guestId: result.guestId, invitationId: invitation.id });
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("keeps public RSVP pending until owner approval and audits eligibility without changing identity", async () => {
    const now = new Date("2026-09-12T00:00:00.000Z");
    const owner = await testPrisma!.user.create({ data: { email: `rsvp-approval-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    }, { now: () => now });
    try {
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      await setPublicRsvpSettings(testPrisma!, owner.id, invitation.id, {
        enabled: true,
        requireApproval: true,
        requirePhone: true,
        maxPartySize: 3,
        eventIds: [event.id],
      }, { now: () => now });
      await publishInvitation(testPrisma!, owner.id, invitation.id, { cache: { invalidateInvitation: () => undefined } });

      const result = await submitPublicRsvp(testPrisma!, invitation.id, {
        displayName: "Keluarga Santoso",
        phone: "+62 812 3456 7890",
        partySize: 2,
      }, { now: () => now });
      const pendingAssignment = await testPrisma!.guestEvent.findFirstOrThrow({ where: { guestId: result.guestId, eventId: event.id } });
      const pendingGuest = await testPrisma!.guest.findUniqueOrThrow({ where: { id: result.guestId }, select: { displayName: true, normalizedPhone: true } });
      expect(result.approvalPending).toBe(true);
      expect(pendingAssignment).toMatchObject({ publicRsvpApproval: "PENDING", checkInEligible: false });
      expect(pendingGuest).toEqual({ displayName: "Keluarga Santoso", normalizedPhone: "+6281234567890" });
      await expect(testPrisma!.auditEvent.findFirst({ where: { invitationId: invitation.id, action: "guest.public_rsvp_eligibility_updated", resourceId: pendingAssignment.id } })).resolves.toMatchObject({ userId: null });

      await expect(setPublicRsvpApproval(testPrisma!, owner.id, invitation.id, {
        guestEventId: pendingAssignment.id,
        decision: "APPROVE",
      }, { now: () => now })).resolves.toMatchObject({ approval: "APPROVED", checkInEligible: true, changed: true });

      const approvedAssignment = await testPrisma!.guestEvent.findUniqueOrThrow({ where: { id: pendingAssignment.id } });
      const approvedGuest = await testPrisma!.guest.findUniqueOrThrow({ where: { id: result.guestId }, select: { displayName: true, normalizedPhone: true } });
      expect(approvedAssignment).toMatchObject({ publicRsvpApproval: "APPROVED", checkInEligible: true });
      expect(approvedGuest).toEqual(pendingGuest);
      await expect(testPrisma!.auditEvent.findFirst({ where: { invitationId: invitation.id, action: "guest.public_rsvp_eligibility_updated", resourceId: pendingAssignment.id, userId: owner.id } })).resolves.toMatchObject({ resourceType: "guest_event" });
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

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

  it.skipIf(!testDatabaseUrl)("supports owner close/reopen and audited override after close", async () => {
    const now = new Date("2026-09-12T00:00:00.000Z");
    const owner = await testPrisma!.user.create({ data: { email: `rsvp-owner-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    }, { now: () => now });
    try {
      await publishInvitation(testPrisma!, owner.id, invitation.id, { cache: { invalidateInvitation: () => undefined } });
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      const guest = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Keluarga Owner",
        assignments: [{ eventId: event.id, maxPartySize: 2 }],
      }, { now: () => now });
      const assignment = await testPrisma!.guestEvent.findFirstOrThrow({ where: { guestId: guest.guestId, eventId: event.id } });

      await expect(setOwnerRsvpControl(testPrisma!, owner.id, invitation.id, { eventId: event.id, action: "CLOSE" }, { now: () => now })).resolves.toMatchObject({ action: "CLOSE" });
      await expect(submitPersonalizedRsvp(testPrisma!, invitation.id, guest.guestId, {
        responses: [{ eventId: event.id, status: RsvpStatus.ATTENDING, attendanceCount: 1 }],
      }, { now: () => now })).rejects.toMatchObject({ code: "RSVP_CLOSED" });

      await expect(overrideRsvp(testPrisma!, owner.id, invitation.id, {
        guestEventId: assignment.id,
        status: RsvpStatus.ATTENDING,
        attendanceCount: 2,
      }, { now: () => now })).resolves.toMatchObject({ status: RsvpStatus.ATTENDING, attendanceCount: 2 });
      await expect(testPrisma!.auditEvent.findFirst({ where: { invitationId: invitation.id, action: "rsvp.owner_overridden" } })).resolves.toMatchObject({
        userId: owner.id,
        resourceType: "rsvp",
      });

      await expect(setOwnerRsvpControl(testPrisma!, owner.id, invitation.id, { eventId: event.id, action: "REOPEN" }, { now: () => now })).resolves.toMatchObject({ action: "REOPEN", rsvpClosesAt: null });
      await expect(submitPersonalizedRsvp(testPrisma!, invitation.id, guest.guestId, {
        responses: [{ eventId: event.id, status: RsvpStatus.NOT_ATTENDING }],
      }, { now: () => now })).resolves.toMatchObject({ summary: [{ status: RsvpStatus.NOT_ATTENDING }] });
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
