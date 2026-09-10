import { describe, expect, it, vi } from "vitest";

import {
  CommercialState,
  PublicationState,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  calculateGraceEndsAt,
  calculatePaidActiveUntil,
  expireInvitationTrial,
  expireInvitationGrace,
  expireInvitationPaid,
  getInvitationLifecycleCapabilities,
  isCommerciallyEditable,
  isPaidExpired,
  isPublicInvitationAvailable,
  scheduleInvitationPaidExpiry,
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
    activeUntil: new Date("2027-09-13T08:30:00.000Z"),
    graceEndsAt: null,
    ...overrides,
  };
}

function transactionFor(current = invitation()) {
  return {
    invitation: {
      findUnique: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    job: { upsert: vi.fn().mockResolvedValue({ id: "job-1" }) },
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

  it("uses one calendar year for paid access and an inclusive active-until boundary", () => {
    const paidAt = new Date("2026-09-13T08:30:00.000Z");
    const activeUntil = calculatePaidActiveUntil(paidAt);

    expect(activeUntil).toEqual(new Date("2027-09-13T08:30:00.000Z"));
    expect(calculateGraceEndsAt(activeUntil)).toEqual(new Date("2027-10-13T08:30:00.000Z"));
    expect(isPaidExpired(activeUntil, activeUntil)).toBe(true);
    expect(isPaidExpired(activeUntil, new Date("2027-09-13T08:29:59.999Z"))).toBe(false);
  });

  it("takes a paid invitation offline at active_until and keeps grace read-only", () => {
    expect(isPublicInvitationAvailable({
      publicationState: PublicationState.PUBLISHED,
      commercialState: CommercialState.PAID_ACTIVE,
      genericAccessEnabled: true,
      activeUntil: now,
    }, now)).toBe(false);
    expect(getInvitationLifecycleCapabilities(
      CommercialState.GRACE,
      null,
      now,
      now,
    )).toEqual({
      canEdit: false,
      canPublish: false,
      canPreviewPrivately: true,
      canPay: false,
      canExport: true,
      canDownloadMedia: true,
    });
  });

  it("keeps trial-expired preview, payment, and export capabilities available", () => {
    expect(getInvitationLifecycleCapabilities(CommercialState.TRIAL_EXPIRED)).toEqual({
      canEdit: false,
      canPublish: false,
      canPreviewPrivately: true,
      canPay: true,
      canExport: true,
      canDownloadMedia: true,
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

  it("schedules paid expiry from provider-confirmed active_until", async () => {
    const job = { upsert: vi.fn().mockResolvedValue({ id: "job-1" }) };
    const activeUntil = new Date("2027-09-13T08:30:00.000Z");

    await scheduleInvitationPaidExpiry({ job } as unknown as Pick<PrismaClient, "job">, invitationId, activeUntil);

    expect(job.upsert).toHaveBeenCalledWith({
      where: { dedupKey: "invitation-paid-expiry:invitation-1" },
      create: {
        type: "INVITATION_PAID_EXPIRY",
        dedupKey: "invitation-paid-expiry:invitation-1",
        payload: { invitationId },
        state: "PENDING",
        runAfter: activeUntil,
      },
      update: {
        payload: { invitationId },
        state: "PENDING",
        runAfter: activeUntil,
        attempts: 0,
        lastError: null,
      },
    });
  });

  it("transitions paid expiry atomically, schedules grace expiry, audits, and invalidates after commit", async () => {
    const transaction = transactionFor(invitation({
      commercialState: CommercialState.PAID_ACTIVE,
      activeUntil: now,
      publicationState: PublicationState.PUBLISHED,
    }));
    const cache = { invalidateInvitation: vi.fn() };

    await expect(expireInvitationPaid(databaseFor(transaction), invitationId, {
      now: () => now,
      cache,
    })).resolves.toEqual({
      invitationId,
      previousCommercialState: CommercialState.PAID_ACTIVE,
      commercialState: CommercialState.GRACE,
      previousPublicationState: PublicationState.PUBLISHED,
      publicationState: PublicationState.UNPUBLISHED,
      activeUntil: now,
      graceEndsAt: new Date("2026-10-13T08:30:00.000Z"),
      changed: true,
    });
    expect(transaction.invitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: invitationId,
        commercialState: CommercialState.PAID_ACTIVE,
        activeUntil: { lte: now },
      },
      data: {
        commercialState: CommercialState.GRACE,
        publicationState: PublicationState.UNPUBLISHED,
        graceEndsAt: new Date("2026-10-13T08:30:00.000Z"),
        version: { increment: 1 },
      },
    });
    expect(transaction.job.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupKey: "invitation-grace-expiry:invitation-1" },
      create: expect.objectContaining({
        type: "INVITATION_GRACE_EXPIRY",
        runAfter: new Date("2026-10-13T08:30:00.000Z"),
      }),
    }));
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "invitation.paid_expired" }),
    }));
    expect(cache.invalidateInvitation).toHaveBeenCalledWith(invitationId);
  });

  it("marks grace for deletion exactly once and queues the purge job", async () => {
    const graceEndsAt = now;
    const transaction = transactionFor(invitation({
      commercialState: CommercialState.GRACE,
      publicationState: PublicationState.UNPUBLISHED,
      graceEndsAt,
    }));
    const cache = { invalidateInvitation: vi.fn() };

    await expect(expireInvitationGrace(databaseFor(transaction), invitationId, {
      now: () => now,
      cache,
    })).resolves.toMatchObject({
      commercialState: CommercialState.DELETION_PENDING,
      publicationState: PublicationState.UNPUBLISHED,
      graceEndsAt,
      changed: true,
    });
    expect(transaction.job.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupKey: "invitation-purge:invitation-1" },
      create: expect.objectContaining({ type: "INVITATION_PURGE", runAfter: now }),
    }));

    transaction.invitation.findUnique = vi.fn().mockResolvedValue(invitation({
      commercialState: CommercialState.DELETION_PENDING,
      publicationState: PublicationState.UNPUBLISHED,
      graceEndsAt,
    }));
    await expect(expireInvitationGrace(databaseFor(transaction), invitationId, { now: () => now, cache }))
      .resolves.toMatchObject({ changed: false, commercialState: CommercialState.DELETION_PENDING });
  });
});
