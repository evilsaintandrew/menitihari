import { describe, expect, it, vi } from "vitest";

import { RsvpStatus } from "@/generated/prisma/client";
import {
  buildPersonalizedRsvpData,
  createRsvpRateLimiter,
  submitPersonalizedRsvp,
  type PersonalizedRsvpAssignmentRecord,
} from "@/modules/rsvp";

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
});
