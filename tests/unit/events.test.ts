import { describe, expect, it, vi } from "vitest";

import { CommercialState, EventVisibility } from "@/generated/prisma/client";
import {
  cancelEvent,
  eventDateTimeFields,
  eventInputSchema,
  localDateTimeToInstant,
  MAX_EVENTS_PER_INVITATION,
  saveEvent,
  setPrimaryEvent,
} from "@/modules/events";

const now = new Date("2026-09-11T08:30:00.000Z");
const invitation = {
  id: "invitation-events-1",
  version: 4,
  timezone: "Asia/Jakarta",
  commercialState: CommercialState.TRIAL,
  trialEndsAt: new Date("2026-09-13T08:30:00.000Z"),
  activeUntil: null,
  primaryEventId: "event-1",
};

function input(overrides: Record<string, unknown> = {}) {
  return {
    name: "Resepsi",
    startDate: "2026-12-20",
    startTime: "18:00",
    visibility: EventVisibility.GENERIC,
    isPrimary: false,
    ...overrides,
  };
}

function transactionFor() {
  return {
    invitation: {
      findFirst: vi.fn().mockResolvedValue(invitation),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    event: {
      findFirst: vi.fn().mockResolvedValue({ id: "event-2", isPrimary: false, cancelledAt: null, guestEvents: [] }),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({ id: "event-new" }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

function databaseFor(transaction: ReturnType<typeof transactionFor>) {
  return {
    $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  } as never;
}

describe("event domain", () => {
  it("converts local event times using the selected timezone", () => {
    expect(localDateTimeToInstant("2026-12-20", "10:00", "Asia/Jakarta")).toEqual(new Date("2026-12-20T03:00:00.000Z"));
    expect(localDateTimeToInstant("2026-07-01", "10:00", "America/New_York")).toEqual(new Date("2026-07-01T14:00:00.000Z"));
    expect(eventDateTimeFields(new Date("2026-12-20T03:00:00.000Z"), "Asia/Jakarta")).toEqual({ date: "2026-12-20", time: "10:00" });
  });

  it("rejects an end time that is not after the start", async () => {
    expect(() => eventInputSchema.parse(input({ endDate: "2026-12-20", endTime: "17:59" }))).not.toThrow();
    const transaction = transactionFor();
    await expect(saveEvent(databaseFor(transaction), "owner-1", invitation.id, null, input({ endDate: "2026-12-20", endTime: "17:59" }), { now: () => now })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("defaults timezone to invitation timezone and persists the full event detail set", async () => {
    const transaction = transactionFor();
    const cache = { invalidateInvitation: vi.fn() };
    await expect(saveEvent(databaseFor(transaction), "owner-1", invitation.id, null, input({
      timezone: "",
      venue: "Grand Ballroom",
      address: "Jl. Melati 1",
      mapsUrl: "https://maps.google.com/?q=grand",
      locationNote: "Parkir basement",
      livestreamUrl: "https://youtube.com/live/example",
      dressCode: "Formal",
      contactName: "Rina",
      contactRole: "WO",
      contactPhone: "08123456789",
      isPrimary: true,
    }), { now: () => now, cache })).resolves.toMatchObject({ eventId: "event-new", mode: "created" });

    expect(transaction.event.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        timezone: "Asia/Jakarta",
        venue: "Grand Ballroom",
        contactFields: { name: "Rina", role: "WO", phone: "08123456789" },
        isPrimary: true,
      }),
    }));
    expect(transaction.invitation.update).toHaveBeenCalledWith({ where: { id: invitation.id }, data: { primaryEventId: "event-new" } });
    expect(cache.invalidateInvitation).toHaveBeenCalledWith(invitation.id);
  });

  it("rejects a sixth active event", async () => {
    const transaction = transactionFor();
    transaction.event.count.mockResolvedValue(MAX_EVENTS_PER_INVITATION);
    await expect(saveEvent(databaseFor(transaction), "owner-1", invitation.id, null, input(), { now: () => now })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(transaction.event.create).not.toHaveBeenCalled();
  });

  it("switches the primary event atomically", async () => {
    const transaction = transactionFor();
    await expect(setPrimaryEvent(databaseFor(transaction), "owner-1", invitation.id, "event-2", { now: () => now })).resolves.toMatchObject({ changed: true, mode: "primary" });
    expect(transaction.event.updateMany).toHaveBeenCalledWith({ where: { invitationId: invitation.id }, data: { isPrimary: false } });
    expect(transaction.event.update).toHaveBeenCalledWith({ where: { id: "event-2" }, data: { isPrimary: true } });
    expect(transaction.invitation.update).toHaveBeenCalledWith({ where: { id: invitation.id }, data: { primaryEventId: "event-2" } });
  });

  it("cancels an event with an optional message and audits without exposing the message", async () => {
    const transaction = transactionFor();
    const cache = { invalidateInvitation: vi.fn() };
    await expect(cancelEvent(databaseFor(transaction), "owner-1", invitation.id, "event-2", { message: "Acara dipindahkan." }, { now: () => now, cache })).resolves.toMatchObject({ mode: "cancelled", changed: true });
    expect(transaction.event.update).toHaveBeenCalledWith({ where: { id: "event-2" }, data: { cancelledAt: now, cancellationMessage: "Acara dipindahkan." } });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "event.cancelled", metadata: { has_notice: true } }) }));
    expect(transaction.auditEvent.create).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: expect.objectContaining({ message: expect.anything() }) }) }));
    expect(cache.invalidateInvitation).toHaveBeenCalledWith(invitation.id);
  });

  it("archives a cancelled event instead of hard deleting it", async () => {
    const transaction = transactionFor();
    transaction.event.findFirst.mockResolvedValue({ id: "event-2", isPrimary: false, cancelledAt: now, guestEvents: [] });
    const { removeEvent } = await import("@/modules/events");
    await expect(removeEvent(databaseFor(transaction), "owner-1", invitation.id, "event-2", { now: () => now })).resolves.toMatchObject({ mode: "archived" });
    expect(transaction.event.update).toHaveBeenCalledWith({ where: { id: "event-2" }, data: { archivedAt: now, isPrimary: false } });
    expect(transaction.event.delete).not.toHaveBeenCalled();
  });

  it("rejects mutations after the invitation becomes read-only", async () => {
    const transaction = transactionFor();
    transaction.invitation.findFirst.mockResolvedValue({ ...invitation, commercialState: CommercialState.GRACE });
    await expect(saveEvent(databaseFor(transaction), "owner-1", invitation.id, null, input(), { now: () => now })).rejects.toMatchObject({ code: "LIFECYCLE_LOCKED" });
    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
  });
});
