import { describe, expect, it, vi } from "vitest";

import { CommercialState, GuestEventState } from "@/generated/prisma/client";
import {
  archiveGuest,
  bulkUpdateGuests,
  getInvitedPeopleCapacity,
  mergeGuests,
  normalizePhone,
  normalizeGuestName,
  saveGuest,
} from "@/modules/guests";

const now = new Date("2026-09-11T08:30:00.000Z");
const invitation = {
  id: "invitation-guests-1",
  version: 4,
  commercialState: CommercialState.TRIAL,
  trialEndsAt: new Date("2026-09-13T08:30:00.000Z"),
  activeUntil: null,
};

function transactionFor() {
  return {
    invitation: {
      findFirst: vi.fn().mockResolvedValue(invitation),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    guest: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "guest-new" }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
    },
    guestGroup: {
      findFirst: vi.fn().mockResolvedValue({ id: "group-existing" }),
      upsert: vi.fn().mockResolvedValue({ id: "group-new" }),
    },
    guestActivationCredential: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    guestSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    qRCredential: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    event: { findMany: vi.fn().mockResolvedValue([{ id: "event-1" }]), findFirst: vi.fn().mockResolvedValue({ id: "event-1" }) },
    guestEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { maxPartySize: 0 } }),
      create: vi.fn().mockResolvedValue({ id: "guest-event-new" }),
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

describe("guest domain", () => {
  it("summarizes invited people and marks the final 50 places as near capacity", () => {
    expect(getInvitedPeopleCapacity(449)).toEqual({ used: 449, limit: 500, remaining: 51, isNearLimit: false });
    expect(getInvitedPeopleCapacity(450)).toEqual({ used: 450, limit: 500, remaining: 50, isNearLimit: true });
    expect(getInvitedPeopleCapacity(510)).toEqual({ used: 510, limit: 500, remaining: 0, isNearLimit: true });
  });

  it("normalizes common Indonesian phone formats to a stable value", () => {
    expect(normalizePhone("0812 3456-7890")).toBe("+6281234567890");
    expect(normalizePhone("+62 (812) 3456-7890")).toBe("+6281234567890");
    expect(normalizePhone("6281234567890")).toBe("+6281234567890");
    expect(normalizePhone("  ")).toBeNull();
  });

  it("normalizes names conservatively for duplicate signals", () => {
    expect(normalizeGuestName("  Bpk.  Andi & Keluarga ")).toBe("bpk andi keluarga");
    expect(normalizeGuestName("BPK ANDI KELUARGA")).toBe("bpk andi keluarga");
  });

  it("returns duplicate warnings without auto-merging a new guest", async () => {
    const transaction = transactionFor();
    transaction.guest.findMany.mockResolvedValue([{
      id: "guest-existing",
      displayName: "Bpk Andi",
      displayPhone: "0812 3456 7890",
      normalizedName: normalizeGuestName("Bpk Andi"),
      normalizedPhone: "+6281234567890",
    }]);

    const result = await saveGuest(databaseFor(transaction), "owner-1", invitation.id, null, {
      displayName: "Bpk. Andi",
      phone: "+62 812 3456 7890",
      assignments: [{ eventId: "event-1", maxPartySize: 1 }],
    }, { now: () => now });

    expect(result).toMatchObject({ guestId: "guest-new", mode: "created" });
    expect(result.duplicateWarnings).toEqual([{
      guestId: "guest-existing",
      displayName: "Bpk Andi",
      displayPhone: "0812 3456 7890",
      matchingSignals: ["PHONE", "NAME"],
    }]);
    expect(transaction.guest.create).toHaveBeenCalledTimes(1);
  });

  it("persists the owner-defined addressee, original display phone, and one group", async () => {
    const transaction = transactionFor();
    await expect(saveGuest(databaseFor(transaction), "owner-1", invitation.id, null, {
      displayName: "Keluarga Santoso",
      phone: "0812 3456 7890",
      groupName: "Keluarga",
      notes: "Datang bersama anak",
      assignments: [{ eventId: "event-1", maxPartySize: 4 }],
    }, { now: () => now })).resolves.toMatchObject({ guestId: "guest-new", mode: "created" });

    expect(transaction.guestGroup.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { invitationId_name: { invitationId: invitation.id, name: "Keluarga" } },
    }));
    expect(transaction.guest.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      displayName: "Keluarga Santoso",
      normalizedPhone: "+6281234567890",
      displayPhone: "0812 3456 7890",
      groupId: "group-new",
      notes: "Datang bersama anak",
    }) });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "guest.created" }) }));
  });

  it("requires unique event assignments with a positive party capacity", async () => {
    const transaction = transactionFor();
    await expect(saveGuest(databaseFor(transaction), "owner-1", invitation.id, null, {
      displayName: "Keluarga Santoso",
      assignments: [
        { eventId: "event-1", maxPartySize: 4 },
        { eventId: "event-1", maxPartySize: 4 },
      ],
    }, { now: () => now })).rejects.toThrow("Acara tidak boleh dipilih dua kali.");
    await expect(saveGuest(databaseFor(transaction), "owner-1", invitation.id, null, {
      displayName: "Keluarga Santoso",
      assignments: [{ eventId: "event-1", maxPartySize: 0 }],
    }, { now: () => now })).rejects.toThrow("Maksimal orang minimal 1.");
    expect(transaction.guest.create).not.toHaveBeenCalled();
  });

  it("rejects reducing capacity below RSVP or check-in history", async () => {
    const transaction = transactionFor();
    transaction.guest.findFirst.mockResolvedValue({ id: "guest-history" });
    transaction.guestEvent.findMany.mockResolvedValue([{
      id: "guest-event-1",
      eventId: "event-1",
      state: GuestEventState.ACTIVE,
      maxPartySize: 4,
      rsvp: { status: "ATTENDING", attendanceCount: 3 },
      attendance: { actualCount: null },
    }]);

    await expect(saveGuest(databaseFor(transaction), "owner-1", invitation.id, "guest-history", {
      displayName: "Keluarga Santoso",
      assignments: [{ eventId: "event-1", maxPartySize: 2 }],
    }, { now: () => now })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(transaction.guestEvent.update).not.toHaveBeenCalled();
    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an assignment that would exceed the 500 invited-people entitlement", async () => {
    const transaction = transactionFor();
    transaction.guestEvent.aggregate.mockResolvedValue({ _sum: { maxPartySize: 499 } });

    await expect(saveGuest(databaseFor(transaction), "owner-1", invitation.id, null, {
      displayName: "Tamu Baru",
      assignments: [{ eventId: "event-1", maxPartySize: 2 }],
    }, { now: () => now })).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });

    expect(transaction.guest.create).not.toHaveBeenCalled();
    expect(transaction.guestEvent.create).not.toHaveBeenCalled();
  });

  it("applies a group change to the selected guests in one owner mutation", async () => {
    const transaction = transactionFor();
    transaction.guest.findMany.mockResolvedValue([{ id: "guest-1" }, { id: "guest-2" }]);

    await expect(bulkUpdateGuests(databaseFor(transaction), "owner-1", invitation.id, {
      operation: "GROUP",
      guestIds: ["guest-1", "guest-2"],
      groupId: "group-existing",
    }, { now: () => now })).resolves.toMatchObject({ operation: "GROUP", updatedGuestCount: 2, changed: true });

    expect(transaction.guest.updateMany).toHaveBeenCalledWith({
      where: { invitationId: invitation.id, archivedAt: null, id: { in: ["guest-1", "guest-2"] } },
      data: { groupId: "group-existing" },
    });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "guests.bulk_updated" }) }));
  });

  it("warns before unassigning event history and preserves it after explicit confirmation", async () => {
    const transaction = transactionFor();
    transaction.guest.findMany.mockResolvedValue([{ id: "guest-1" }]);
    transaction.event.findFirst.mockResolvedValue({ id: "event-1" });
    transaction.guestEvent.findMany.mockResolvedValue([{
      id: "guest-event-1",
      state: GuestEventState.ACTIVE,
      maxPartySize: 2,
      rsvp: { status: "ATTENDING", attendanceCount: 1 },
      attendance: null,
    }]);

    await expect(bulkUpdateGuests(databaseFor(transaction), "owner-1", invitation.id, {
      operation: "EVENT",
      guestIds: ["guest-1"],
      eventId: "event-1",
      eventAction: "UNASSIGN",
      confirmHistoricalRemoval: false,
    }, { now: () => now })).resolves.toMatchObject({
      changed: false,
      warning: { code: "HISTORICAL_EVENT_UNASSIGN", guestCount: 1, assignmentCount: 1 },
    });
    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();

    await expect(bulkUpdateGuests(databaseFor(transaction), "owner-1", invitation.id, {
      operation: "EVENT",
      guestIds: ["guest-1"],
      eventId: "event-1",
      eventAction: "UNASSIGN",
      confirmHistoricalRemoval: true,
    }, { now: () => now })).resolves.toMatchObject({ operation: "EVENT", changed: true });
    expect(transaction.guestEvent.updateMany).toHaveBeenCalledWith({
      where: { guestId: { in: ["guest-1"] }, eventId: "event-1", state: GuestEventState.ACTIVE },
      data: { state: GuestEventState.REMOVED, removedAt: now },
    });
  });

  it("updates distribution status without exposing guest data in the audit metadata", async () => {
    const transaction = transactionFor();
    transaction.guest.findMany.mockResolvedValue([{ id: "guest-1" }, { id: "guest-2" }]);

    await expect(bulkUpdateGuests(databaseFor(transaction), "owner-1", invitation.id, {
      operation: "DISTRIBUTION",
      guestIds: ["guest-1", "guest-2"],
      distributionStatus: "MARKED_SENT",
    }, { now: () => now })).resolves.toMatchObject({ operation: "DISTRIBUTION", updatedGuestCount: 2 });

    expect(transaction.guest.updateMany).toHaveBeenCalledWith({
      where: { invitationId: invitation.id, archivedAt: null, id: { in: ["guest-1", "guest-2"] } },
      data: { distributionStatus: "MARKED_SENT" },
    });
    const auditCall = transaction.auditEvent.create.mock.calls.at(-1)?.[0] as { data: { metadata: Record<string, unknown> } };
    expect(auditCall.data.metadata).toEqual(expect.objectContaining({ operation: "DISTRIBUTION", guest_count: 2, distribution_status: "MARKED_SENT" }));
    expect(auditCall.data.metadata).not.toHaveProperty("guest_ids");
  });

  it("removes an assignment without deleting its RSVP history", async () => {
    const transaction = transactionFor();
    transaction.event.findMany.mockResolvedValue([{ id: "event-1" }, { id: "event-2" }]);
    transaction.guest.findFirst.mockResolvedValue({ id: "guest-history" });
    transaction.guestEvent.findMany.mockResolvedValue([{
      id: "guest-event-1",
      eventId: "event-1",
      state: GuestEventState.ACTIVE,
      maxPartySize: 4,
      rsvp: { status: "ATTENDING", attendanceCount: 2 },
      attendance: null,
    }, {
      id: "guest-event-2",
      eventId: "event-2",
      state: GuestEventState.ACTIVE,
      maxPartySize: 2,
      rsvp: null,
      attendance: null,
    }]);

    await expect(saveGuest(databaseFor(transaction), "owner-1", invitation.id, "guest-history", {
      displayName: "Keluarga Santoso",
      assignments: [{ eventId: "event-2", maxPartySize: 2 }],
    }, { now: () => now })).resolves.toMatchObject({ mode: "updated" });
    expect(transaction.guestEvent.update).toHaveBeenCalledWith({
      where: { id: "guest-event-1" },
      data: { state: GuestEventState.REMOVED, removedAt: now },
    });
    expect(transaction.guestEvent.delete).not.toHaveBeenCalled();
  });

  it("rejects phone values that cannot be normalized", () => {
    expect(() => normalizePhone("0812abc3456")).toThrow(/Some information needs to be corrected/);
    expect(() => normalizePhone("123")).toThrow(/Some information needs to be corrected/);
  });

  it("archives guests with RSVP history and preserves the assignment", async () => {
    const transaction = transactionFor();
    transaction.guest.findFirst.mockResolvedValue({
      id: "guest-history",
      archivedAt: null,
      lastViewedAt: null,
      distributionStatus: null,
      eventAssignments: [{ id: "guest-event-1", rsvp: { id: "rsvp-1" }, attendance: null }],
      activationCredentials: [{ id: "credential-1" }],
      sessions: [{ id: "session-1" }],
      wishes: [],
      qrCredentials: [{ id: "qr-1" }],
    });

    await expect(archiveGuest(databaseFor(transaction), "owner-1", invitation.id, "guest-history", { now: () => now })).resolves.toMatchObject({ mode: "archived" });
    expect(transaction.guest.update).toHaveBeenCalledWith({ where: { id: "guest-history" }, data: { archivedAt: now } });
    expect(transaction.guestEvent.updateMany).toHaveBeenCalledWith({
      where: { guestId: "guest-history", state: GuestEventState.ACTIVE },
      data: { state: GuestEventState.REMOVED, removedAt: now },
    });
    expect(transaction.guest.delete).not.toHaveBeenCalled();
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "guest.archived" }) }));
  });

  it("hard deletes a guest that has no history", async () => {
    const transaction = transactionFor();
    transaction.guest.findFirst.mockResolvedValue({
      id: "guest-empty",
      archivedAt: null,
      lastViewedAt: null,
      distributionStatus: null,
      eventAssignments: [],
      activationCredentials: [],
      sessions: [],
      wishes: [],
      qrCredentials: [],
    });

    await expect(archiveGuest(databaseFor(transaction), "owner-1", invitation.id, "guest-empty", { now: () => now })).resolves.toMatchObject({ mode: "deleted" });
    expect(transaction.guest.delete).toHaveBeenCalledWith({ where: { id: "guest-empty" } });
  });

  it("requires an explicit choice when both guests have history for the same event", async () => {
    const transaction = transactionFor();
    transaction.guest.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "guest-source"
      ? {
        id: "guest-source",
        displayName: "Andi",
        displayPhone: null,
        eventAssignments: [{ id: "source-event", eventId: "event-1", state: GuestEventState.ACTIVE, maxPartySize: 2, event: { name: "Resepsi" }, rsvp: { id: "source-rsvp" }, attendance: null }],
      }
      : {
        id: "guest-target",
        displayName: "Andi Keluarga",
        displayPhone: null,
        eventAssignments: [{ id: "target-event", eventId: "event-1", state: GuestEventState.ACTIVE, maxPartySize: 3, event: { name: "Resepsi" }, rsvp: null, attendance: { id: "target-attendance" } }],
      });

    await expect(mergeGuests(databaseFor(transaction), "owner-1", invitation.id, {
      sourceGuestId: "guest-source",
      targetGuestId: "guest-target",
      conflictResolutions: [],
    }, { now: () => now })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(transaction.guest.update).not.toHaveBeenCalled();
  });

  it("archives the source, moves non-conflicting assignments, and retains conflicting history", async () => {
    const transaction = transactionFor();
    transaction.guest.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "guest-source"
      ? {
        id: "guest-source",
        displayName: "Andi",
        displayPhone: null,
        eventAssignments: [
          { id: "source-event-1", eventId: "event-1", state: GuestEventState.ACTIVE, maxPartySize: 2, event: { name: "Akad" }, rsvp: { id: "source-rsvp" }, attendance: null },
          { id: "source-event-2", eventId: "event-2", state: GuestEventState.ACTIVE, maxPartySize: 1, event: { name: "Resepsi" }, rsvp: null, attendance: null },
        ],
      }
      : {
        id: "guest-target",
        displayName: "Andi Keluarga",
        displayPhone: null,
        eventAssignments: [{ id: "target-event-1", eventId: "event-1", state: GuestEventState.ACTIVE, maxPartySize: 3, event: { name: "Akad" }, rsvp: null, attendance: { id: "target-attendance" } }],
      });

    await expect(mergeGuests(databaseFor(transaction), "owner-1", invitation.id, {
      sourceGuestId: "guest-source",
      targetGuestId: "guest-target",
      conflictResolutions: [{ eventId: "event-1", keep: "TARGET" }],
    }, { now: () => now })).resolves.toMatchObject({ mode: "merged", sourceGuestId: "guest-source", targetGuestId: "guest-target" });

    expect(transaction.guestEvent.update).toHaveBeenCalledWith({ where: { id: "source-event-2" }, data: { guestId: "guest-target" } });
    expect(transaction.guestEvent.update).toHaveBeenCalledWith({ where: { id: "source-event-1" }, data: { state: GuestEventState.REMOVED, removedAt: now } });
    expect(transaction.guest.update).toHaveBeenCalledWith({ where: { id: "guest-source" }, data: { archivedAt: now, mergedIntoGuestId: "guest-target", mergedAt: now } });
    expect(transaction.guestActivationCredential.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { guestId: "guest-source" } }));
    expect(transaction.guestSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { guestId: "guest-source", revokedAt: null } }));
    expect(transaction.qRCredential.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ guestId: "guest-source" }) }));
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "guest.merged" }) }));
  });
});
