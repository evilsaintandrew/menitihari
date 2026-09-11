import { describe, expect, it, vi } from "vitest";

import { CommercialState, GuestEventState } from "@/generated/prisma/client";
import { archiveGuest, normalizePhone, saveGuest } from "@/modules/guests";

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
      create: vi.fn().mockResolvedValue({ id: "guest-new" }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    guestGroup: {
      findFirst: vi.fn().mockResolvedValue({ id: "group-existing" }),
      upsert: vi.fn().mockResolvedValue({ id: "group-new" }),
    },
    guestEvent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    guestActivationCredential: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    guestSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    qRCredential: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

function databaseFor(transaction: ReturnType<typeof transactionFor>) {
  return {
    $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  } as never;
}

describe("guest domain", () => {
  it("normalizes common Indonesian phone formats to a stable value", () => {
    expect(normalizePhone("0812 3456-7890")).toBe("+6281234567890");
    expect(normalizePhone("+62 (812) 3456-7890")).toBe("+6281234567890");
    expect(normalizePhone("6281234567890")).toBe("+6281234567890");
    expect(normalizePhone("  ")).toBeNull();
  });

  it("persists the owner-defined addressee, original display phone, and one group", async () => {
    const transaction = transactionFor();
    await expect(saveGuest(databaseFor(transaction), "owner-1", invitation.id, null, {
      displayName: "Keluarga Santoso",
      phone: "0812 3456 7890",
      groupName: "Keluarga",
      notes: "Datang bersama anak",
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
});
