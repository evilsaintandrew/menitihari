import { describe, expect, it, vi } from "vitest";

import { EventVisibility, RsvpStatus } from "@/generated/prisma/client";
import {
  buildPersonalizedRsvpData,
  buildPublicRsvpData,
  createRsvpRateLimiter,
  submitPublicRsvp,
  submitPersonalizedRsvp,
  type PersonalizedRsvpAssignmentRecord,
} from "@/modules/rsvp";
import { getInvitedPeopleCapacity } from "@/modules/guests/capacity";

const now = new Date("2026-09-12T00:00:00.000Z");

function assignment(overrides: Partial<PersonalizedRsvpAssignmentRecord> = {}): PersonalizedRsvpAssignmentRecord {
  return {
    id: "guest-event-1",
    eventId: "event-1",
    maxPartySize: 4,
    rsvpEligible: true,
    rsvp: null,
    event: {
      id: "event-1",
      name: "Resepsi",
      startsAt: new Date("2026-12-20T04:00:00.000Z"),
      endsAt: null,
      timezone: "Asia/Jakarta",
      rsvpEnabled: true,
      rsvpClosesAt: null,
      cancelledAt: null,
    },
    ...overrides,
  };
}

function databaseFor(inputAssignments: PersonalizedRsvpAssignmentRecord[]) {
  const transaction = {
    invitation: {
      findFirst: vi.fn().mockResolvedValue({
        id: "invitation-1",
        publicationState: "PUBLISHED",
        commercialState: "TRIAL",
        trialEndsAt: new Date("2026-09-15T00:00:00.000Z"),
        activeUntil: null,
        rsvpEnabled: true,
      }),
    },
    guestEvent: {
      findMany: vi.fn()
        .mockResolvedValueOnce(inputAssignments)
        .mockResolvedValueOnce(inputAssignments.map((item) => ({
          eventId: item.eventId,
          event: { name: item.event.name },
          rsvp: item.rsvp,
        }))),
    },
    rSVP: { upsert: vi.fn().mockResolvedValue({}) },
  };
  return {
    database: {
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as never,
    transaction,
  };
}

describe("personalized RSVP domain", () => {
  it("keeps pending responses, assignment limits, and close boundaries server-derived", () => {
    const data = buildPersonalizedRsvpData(true, [
      assignment(),
      assignment({
        id: "guest-event-2",
        eventId: "event-2",
        event: { ...assignment().event, id: "event-2", name: "Akad", rsvpClosesAt: now },
        rsvp: { status: RsvpStatus.ATTENDING, attendanceCount: 2, notAttendingReason: null },
      }),
    ], now);

    expect(data.events).toEqual([
      expect.objectContaining({ id: "event-1", status: RsvpStatus.PENDING, maxPartySize: 4, canRespond: true }),
      expect.objectContaining({ id: "event-2", status: RsvpStatus.ATTENDING, attendanceCount: 2, canRespond: false }),
    ]);
  });

  it("writes multiple event responses atomically and returns a complete summary", async () => {
    const first = assignment();
    const second = assignment({
      id: "guest-event-2",
      eventId: "event-2",
      event: { ...first.event, id: "event-2", name: "Akad" },
    });
    const { database, transaction } = databaseFor([first, second]);

    await expect(submitPersonalizedRsvp(database, "invitation-1", "guest-1", {
      responses: [
        { eventId: "event-1", status: RsvpStatus.ATTENDING, attendanceCount: 3 },
        { eventId: "event-2", status: RsvpStatus.NOT_ATTENDING, notAttendingReason: "Ada keperluan." },
      ],
    }, { now: () => now })).resolves.toMatchObject({
      invitationId: "invitation-1",
      guestId: "guest-1",
      summary: [
        { eventId: "event-1", eventName: "Resepsi", status: RsvpStatus.PENDING, attendanceCount: null },
        { eventId: "event-2", eventName: "Akad", status: RsvpStatus.PENDING, attendanceCount: null },
      ],
    });
    expect(transaction.rSVP.upsert).toHaveBeenCalledTimes(2);
    expect(transaction.rSVP.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ guestEventId: "guest-event-1", status: RsvpStatus.ATTENDING, attendanceCount: 3 }),
    }));
    expect(transaction.rSVP.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ guestEventId: "guest-event-2", status: RsvpStatus.NOT_ATTENDING, attendanceCount: null, notAttendingReason: "Ada keperluan." }),
    }));
  });

  it("rejects an over-capacity response and does not write", async () => {
    const { database, transaction } = databaseFor([assignment({ maxPartySize: 2 })]);

    await expect(submitPersonalizedRsvp(database, "invitation-1", "guest-1", {
      responses: [{ eventId: "event-1", status: RsvpStatus.ATTENDING, attendanceCount: 3 }],
    }, { now: () => now })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(transaction.rSVP.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unassigned event and closed RSVP", async () => {
    const missing = databaseFor([]);
    await expect(submitPersonalizedRsvp(missing.database, "invitation-1", "guest-1", {
      responses: [{ eventId: "other-event", status: RsvpStatus.ATTENDING, attendanceCount: 1 }],
    }, { now: () => now })).rejects.toMatchObject({ code: "NOT_INVITED_TO_EVENT" });

    const closed = databaseFor([assignment({ event: { ...assignment().event, endsAt: now } })]);
    await expect(submitPersonalizedRsvp(closed.database, "invitation-1", "guest-1", {
      responses: [{ eventId: "event-1", status: RsvpStatus.ATTENDING, attendanceCount: 1 }],
    }, { now: () => now })).rejects.toMatchObject({ code: "RSVP_CLOSED" });
  });

  it("rate-limits repeated mutations without retaining raw scope values", () => {
    let currentTime = 0;
    const limiter = createRsvpRateLimiter({ now: () => currentTime, maxAttempts: 2, windowMs: 1_000 });
    const input = { ip: "203.0.113.5", invitationId: "invitation-1", guestId: "guest-1" };
    expect(limiter.consume(input).allowed).toBe(true);
    expect(limiter.consume(input).allowed).toBe(true);
    expect(limiter.consume(input)).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    currentTime = 1_000;
    expect(limiter.consume(input).allowed).toBe(true);
  });

  it("builds public RSVP settings with only open generic events and closes at capacity", () => {
    const event = {
      id: "event-1",
      name: "Resepsi",
      startsAt: new Date("2026-12-20T04:00:00.000Z"),
      endsAt: null,
      rsvpEnabled: true,
      publicRsvpEnabled: true,
      visibility: EventVisibility.GENERIC,
      cancelledAt: null,
      archivedAt: null,
      rsvpClosesAt: null,
    };
    const data = buildPublicRsvpData({
      genericAccessEnabled: true,
      publicRsvpEnabled: true,
      publicRsvpRequirePhone: true,
      publicRsvpMaxPartySize: 3,
    }, [event], getInvitedPeopleCapacity(500), now);

    expect(data).toMatchObject({ enabled: true, requirePhone: true, maxPartySize: 3, closed: true, events: [{ id: "event-1" }] });
  });

  it("creates public guest assignments, RSVPs, duplicate flag, and a one-time personalized path atomically", async () => {
    const event = {
      id: "event-1",
      name: "Resepsi",
      startsAt: new Date("2026-12-20T04:00:00.000Z"),
      endsAt: null,
      rsvpEnabled: true,
      publicRsvpEnabled: true,
      visibility: EventVisibility.GENERIC,
      cancelledAt: null,
      archivedAt: null,
      rsvpClosesAt: null,
    };
    const transaction = {
      invitation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: "invitation-1",
          genericAccessEnabled: true,
          publicRsvpEnabled: true,
          publicRsvpRequirePhone: true,
          publicRsvpMaxPartySize: 3,
          publicationState: "PUBLISHED",
          commercialState: "TRIAL",
          trialEndsAt: new Date("2026-12-20T00:00:00.000Z"),
          activeUntil: null,
        }),
      },
      event: { findMany: vi.fn().mockResolvedValue([event]) },
      guestEvent: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { maxPartySize: 0 } }),
        create: vi.fn().mockResolvedValue({ id: "guest-event-1" }),
      },
      guest: {
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({ id: "guest-1" }),
      },
      rSVP: { create: vi.fn().mockResolvedValue({ id: "rsvp-1" }) },
      invitationSlug: { findFirst: vi.fn().mockResolvedValue({ slug: "alya-bima" }) },
      guestActivationCredential: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ version: 1, createdAt: now }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const database = {
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as never;

    const result = await submitPublicRsvp(database, "invitation-1", {
      displayName: "  Keluarga Santoso ",
      phone: "+62 812 3456 7890",
      partySize: 2,
    }, { now: () => now });

    expect(result).toMatchObject({
      guestId: "guest-1",
      duplicateWarning: true,
      events: [{ id: "event-1", name: "Resepsi" }],
    });
    expect(result.personalizedPath).toMatch(/^\/alya-bima\/g\/[A-Za-z0-9_-]{43,}$/);
    expect(transaction.guest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ normalizedName: "keluarga santoso", normalizedPhone: "+6281234567890" }) }));
    expect(transaction.guestEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ maxPartySize: 3 }) }));
    expect(transaction.rSVP.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: RsvpStatus.ATTENDING, attendanceCount: 2, source: "PUBLIC" }) }));
  });

  it("rejects a public signup that would exceed the invited capacity before creating a guest", async () => {
    const transaction = {
      invitation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: "invitation-1", genericAccessEnabled: true, publicRsvpEnabled: true,
          publicRsvpRequirePhone: false, publicRsvpMaxPartySize: 2,
          publicationState: "PUBLISHED", commercialState: "TRIAL",
          trialEndsAt: new Date("2026-12-20T00:00:00.000Z"), activeUntil: null,
        }),
      },
      event: { findMany: vi.fn().mockResolvedValue([{
        id: "event-1", name: "Resepsi", startsAt: new Date("2026-12-20T04:00:00.000Z"), endsAt: null,
        rsvpEnabled: true, publicRsvpEnabled: true, visibility: EventVisibility.GENERIC,
        cancelledAt: null, archivedAt: null, rsvpClosesAt: null,
      }]) },
      guestEvent: { aggregate: vi.fn().mockResolvedValue({ _sum: { maxPartySize: 499 } }) },
      guest: { create: vi.fn() },
    };
    const database = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) } as never;

    await expect(submitPublicRsvp(database, "invitation-1", { displayName: "Tamu", partySize: 1 }, { now: () => now })).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });
    expect(transaction.guest.create).not.toHaveBeenCalled();
  });
});
