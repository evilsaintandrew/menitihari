import { describe, expect, it, vi } from "vitest";

import { CommercialState, RsvpStatus } from "@/generated/prisma/client";
import { overrideRsvp, setOwnerRsvpControl } from "@/modules/rsvp";

const now = new Date("2026-09-12T00:00:00.000Z");

function transactionFor() {
  return {
    invitation: {
      findFirst: vi.fn().mockResolvedValue({
        id: "invitation-1",
        commercialState: CommercialState.TRIAL,
        trialEndsAt: new Date("2026-09-20T00:00:00.000Z"),
        activeUntil: null,
      }),
    },
    event: {
      findFirst: vi.fn().mockResolvedValue({
        id: "event-1",
        timezone: "Asia/Jakarta",
        endsAt: new Date("2026-12-20T08:00:00.000Z"),
        cancelledAt: null,
        rsvpEnabled: true,
        rsvpClosesAt: null,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    guestEvent: {
      findFirst: vi.fn().mockResolvedValue({
        id: "guest-event-1",
        maxPartySize: 4,
        rsvp: { id: "rsvp-1", status: RsvpStatus.PENDING, attendanceCount: null },
      }),
    },
    rSVP: {
      upsert: vi.fn().mockResolvedValue({ id: "rsvp-1" }),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
}

function databaseFor(transaction: ReturnType<typeof transactionFor>) {
  return {
    $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  } as never;
}

describe("owner RSVP controls", () => {
  it("closes and reopens an active event through the persisted close boundary", async () => {
    const transaction = transactionFor();
    const database = databaseFor(transaction);

    await expect(setOwnerRsvpControl(database, "owner-1", "invitation-1", {
      eventId: "event-1",
      action: "CLOSE",
    }, { now: () => now })).resolves.toMatchObject({ action: "CLOSE", rsvpClosesAt: now });
    expect(transaction.event.update).toHaveBeenCalledWith({ where: { id: "event-1" }, data: { rsvpClosesAt: now } });

    transaction.event.findFirst.mockResolvedValueOnce({
      id: "event-1",
      timezone: "Asia/Jakarta",
      endsAt: new Date("2026-12-20T08:00:00.000Z"),
      cancelledAt: null,
      rsvpEnabled: true,
      rsvpClosesAt: now,
    });
    await expect(setOwnerRsvpControl(database, "owner-1", "invitation-1", {
      eventId: "event-1",
      action: "REOPEN",
    }, { now: () => now })).resolves.toMatchObject({ action: "REOPEN", rsvpClosesAt: null });
    expect(transaction.event.update).toHaveBeenLastCalledWith({ where: { id: "event-1" }, data: { rsvpClosesAt: null } });
  });

  it("converts a scheduled close in the event timezone and audits the control", async () => {
    const transaction = transactionFor();
    await expect(setOwnerRsvpControl(databaseFor(transaction), "owner-1", "invitation-1", {
      eventId: "event-1",
      action: "SCHEDULE",
      closesAtDate: "2026-12-19",
      closesAtTime: "12:00",
    }, { now: () => now })).resolves.toMatchObject({
      rsvpClosesAt: new Date("2026-12-19T05:00:00.000Z"),
    });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "rsvp.control_updated", metadata: { control_action: "SCHEDULE", has_closes_at: true } }),
    }));
  });

  it("overrides a closed response, enforces the assignment limit, and audits it", async () => {
    const transaction = transactionFor();
    const database = databaseFor(transaction);

    await expect(overrideRsvp(database, "owner-1", "invitation-1", {
      guestEventId: "guest-event-1",
      status: RsvpStatus.ATTENDING,
      attendanceCount: 3,
    }, { now: () => now })).resolves.toMatchObject({ status: RsvpStatus.ATTENDING, attendanceCount: 3 });
    expect(transaction.rSVP.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ source: "OWNER", ownerOverride: true, updatedBy: "owner-1" }),
    }));
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "rsvp.owner_overridden" }),
    }));

    await expect(overrideRsvp(database, "owner-1", "invitation-1", {
      guestEventId: "guest-event-1",
      status: RsvpStatus.ATTENDING,
      attendanceCount: 5,
    }, { now: () => now })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("rejects control changes after the invitation lifecycle becomes read-only", async () => {
    const transaction = transactionFor();
    transaction.invitation.findFirst.mockResolvedValue({
      id: "invitation-1",
      commercialState: CommercialState.GRACE,
      trialEndsAt: new Date("2026-09-01T00:00:00.000Z"),
      activeUntil: new Date("2026-09-10T00:00:00.000Z"),
    });
    await expect(setOwnerRsvpControl(databaseFor(transaction), "owner-1", "invitation-1", {
      eventId: "event-1",
      action: "CLOSE",
    }, { now: () => now })).rejects.toMatchObject({ code: "LIFECYCLE_LOCKED" });
    expect(transaction.event.update).not.toHaveBeenCalled();
  });

  it("does not include raw guest or token data in override audit metadata", async () => {
    const transaction = transactionFor();
    await overrideRsvp(databaseFor(transaction), "owner-1", "invitation-1", {
      guestEventId: "guest-event-1",
      status: RsvpStatus.NOT_ATTENDING,
      notAttendingReason: "Tidak dapat hadir",
    }, { now: () => now });
    const audit = transaction.auditEvent.create.mock.calls.at(-1)?.[0] as { data: { metadata: Record<string, unknown> } };
    expect(audit.data.metadata).not.toHaveProperty("guest_id");
    expect(audit.data.metadata).not.toHaveProperty("token");
  });
});
