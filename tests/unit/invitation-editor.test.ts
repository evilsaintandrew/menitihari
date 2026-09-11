import { afterEach, describe, expect, it, vi } from "vitest";

import { CommercialState, PublicationState } from "@/generated/prisma/client";
import {
  saveInvitationContent,
  type InvitationEditorCacheInvalidator,
} from "@/modules/invitations";

const invitationId = "invitation-editor-1";
const userId = "owner-editor-1";
const now = new Date("2026-09-11T08:30:00.000Z");

const content = {
  language: "id" as const,
  core: { coupleDisplayName1: "Alya", coupleDisplayName2: "Bima" },
  optional: { opening: "Selamat datang", closing: "Sampai jumpa" },
};

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: invitationId,
    ownerFacingTitle: "Alya & Bima",
    version: 1,
    publicationState: PublicationState.DRAFT,
    commercialState: CommercialState.TRIAL,
    trialEndsAt: new Date("2026-09-13T08:30:00.000Z"),
    activeUntil: null,
    themeId: "classic",
    themeVersion: "1",
    themeConfig: { accent: "rose", fontPairing: "serif-sans", coverStyle: "centered", sectionStyle: "soft" },
    ...overrides,
  };
}

function databaseFor(transaction: Record<string, unknown>) {
  return {
    $transaction: vi.fn(async (callback: (database: Record<string, unknown>) => unknown) => callback(transaction)),
  } as never;
}

function transactionFor(current = invitation()) {
  return {
    invitation: {
      findFirst: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    invitationContent: {
      upsert: vi.fn().mockResolvedValue({ invitationId }),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({ id: "audit-editor-1" }),
    },
  };
}

function cacheFor() {
  return { invalidateInvitation: vi.fn() } satisfies InvitationEditorCacheInvalidator;
}

afterEach(() => vi.restoreAllMocks());

describe("invitation content autosave", () => {
  it("writes content and version atomically before invalidating the public cache", async () => {
    const transaction = transactionFor();
    const cache = cacheFor();
    let committed = false;
    transaction.invitation.updateMany.mockImplementation(async () => {
      committed = true;
      return { count: 1 };
    });
    cache.invalidateInvitation.mockImplementation(() => {
      expect(committed).toBe(true);
    });

    await expect(saveInvitationContent(
      databaseFor(transaction),
      userId,
      invitationId,
      { expectedVersion: 1, content },
      { cache, now: () => now },
    )).resolves.toEqual({ invitationId, version: 2, changed: true });

    expect(transaction.invitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: invitationId, version: 1 }),
      data: expect.objectContaining({
        coupleDisplayName1: "Alya",
        coupleDisplayName2: "Bima",
        version: { increment: 1 },
      }),
    }));
    expect(transaction.invitationContent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { invitationId },
      update: expect.objectContaining({ opening: "Selamat datang", closing: "Sampai jumpa" }),
    }));
    expect(transaction.invitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ themeConfig: invitation().themeConfig }),
    }));
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "invitation.content_saved" }),
    }));
    expect(cache.invalidateInvitation).toHaveBeenCalledWith(invitationId);
  });

  it("rejects a stale version without changing content or invalidating cache", async () => {
    const transaction = transactionFor();
    transaction.invitation.updateMany.mockResolvedValue({ count: 0 });
    const cache = cacheFor();

    await expect(saveInvitationContent(
      databaseFor(transaction),
      userId,
      invitationId,
      { expectedVersion: 1, content },
      { cache, now: () => now },
    )).rejects.toMatchObject({ code: "STALE_VERSION", retryable: true });

    expect(transaction.invitationContent.upsert).not.toHaveBeenCalled();
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });

  it.each([
    CommercialState.TRIAL_EXPIRED,
    CommercialState.GRACE,
    CommercialState.DELETION_PENDING,
    CommercialState.DELETED,
  ])("does not save when lifecycle state is %s", async (commercialState) => {
    const transaction = transactionFor(invitation({ commercialState }));
    const cache = cacheFor();

    await expect(saveInvitationContent(
      databaseFor(transaction),
      userId,
      invitationId,
      { expectedVersion: 1, content },
      { cache, now: () => now },
    )).rejects.toMatchObject({ code: "LIFECYCLE_LOCKED" });

    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });

  it("rejects an accent that the active theme does not support", async () => {
    const transaction = transactionFor();

    await expect(saveInvitationContent(
      databaseFor(transaction),
      userId,
      invitationId,
      { expectedVersion: 1, content, themeConfig: { accent: "ocean", fontPairing: "serif-sans", coverStyle: "centered", sectionStyle: "soft" } },
      { now: () => now },
    )).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
  });
});
