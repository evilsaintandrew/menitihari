import { describe, expect, it, vi } from "vitest";

import {
  CommercialState,
  PublicationState,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  expireInvitationTrial,
  getInvitationLifecycleCapabilities,
  isCommerciallyEditable,
  isPublicInvitationAvailable,
} from "@/modules/lifecycle";

const now = new Date("2026-09-13T08:30:00.000Z");
const invitationId = "invitation-1";

function databaseFor(transaction: Record<string, unknown>): Pick<PrismaClient, "$transaction"> {
  return {
    $transaction: vi.fn(async (callback: (value: Record<string, unknown>) => unknown) => callback(transaction)),
  } as unknown as Pick<PrismaClient, "$transaction">;
}

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: invitationId,
    commercialState: CommercialState.TRIAL,
    publicationState: PublicationState.PUBLISHED,
    trialEndsAt: now,
    ...overrides,
  };
}

function transactionFor(current = invitation()) {
  return {
    invitation: {
      findUnique: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

describe("invitation lifecycle", () => {
  it("treats the trial end timestamp as an inclusive boundary", () => {
    expect(isCommerciallyEditable(CommercialState.TRIAL, now, now)).toBe(false);
    expect(isPublicInvitationAvailable({
      publicationState: PublicationState.PUBLISHED,
      commercialState: CommercialState.TRIAL,
      genericAccessEnabled: true,
      trialEndsAt: now,
    }, now)).toBe(false);
  });

  it("keeps trial-expired preview, payment, and export capabilities available", () => {
    expect(getInvitationLifecycleCapabilities(CommercialState.TRIAL_EXPIRED)).toEqual({
      canEdit: false,
      canPublish: false,
      canPreviewPrivately: true,
      canPay: true,
      canExport: true,
    });
  });

  it("expires a published trial atomically, takes it offline, audits, and invalidates after commit", async () => {
    const transaction = transactionFor();
    const cache = { invalidateInvitation: vi.fn() };
    let committed = false;
    transaction.invitation.updateMany = vi.fn().mockImplementation(async () => {
      committed = true;
      return { count: 1 };
    });
    cache.invalidateInvitation.mockImplementation(() => {
      expect(committed).toBe(true);
    });

    await expect(expireInvitationTrial(databaseFor(transaction), invitationId, {
      now: () => now,
      cache,
    })).resolves.toEqual({
      invitationId,
      previousCommercialState: CommercialState.TRIAL,
      commercialState: CommercialState.TRIAL_EXPIRED,
      previousPublicationState: PublicationState.PUBLISHED,
      publicationState: PublicationState.UNPUBLISHED,
      changed: true,
    });
    expect(transaction.invitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: invitationId,
        commercialState: CommercialState.TRIAL,
        trialEndsAt: { lte: now },
      },
      data: {
        commercialState: CommercialState.TRIAL_EXPIRED,
        publicationState: PublicationState.UNPUBLISHED,
        version: { increment: 1 },
      },
    });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "invitation.trial_expired" }),
    }));
    expect(cache.invalidateInvitation).toHaveBeenCalledWith(invitationId);
  });

  it("does not mutate a trial before its deadline or a paid invitation", async () => {
    const notDue = transactionFor({
      ...invitation(),
      trialEndsAt: new Date(now.getTime() + 1),
    });
    const cache = { invalidateInvitation: vi.fn() };
    await expect(expireInvitationTrial(databaseFor(notDue), invitationId, { now: () => now, cache }))
      .resolves.toMatchObject({ changed: false, commercialState: CommercialState.TRIAL });
    expect(notDue.invitation.updateMany).not.toHaveBeenCalled();

    const paid = transactionFor(invitation({ commercialState: CommercialState.PAID_ACTIVE }));
    await expect(expireInvitationTrial(databaseFor(paid), invitationId, { now: () => now, cache }))
      .resolves.toMatchObject({ changed: false, commercialState: CommercialState.PAID_ACTIVE });
    expect(paid.invitation.updateMany).not.toHaveBeenCalled();
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });

  it("is idempotent when the transition is retried", async () => {
    const transaction = transactionFor(invitation({ commercialState: CommercialState.TRIAL_EXPIRED, publicationState: PublicationState.UNPUBLISHED }));
    const cache = { invalidateInvitation: vi.fn() };

    await expect(expireInvitationTrial(databaseFor(transaction), invitationId, { now: () => now, cache }))
      .resolves.toMatchObject({ changed: false, commercialState: CommercialState.TRIAL_EXPIRED });
    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });
});
