import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CommercialState,
  PublicationState,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  getInvitationPublishReadiness,
  publishInvitation,
  unpublishInvitation,
  type PublicCacheInvalidator,
} from "@/modules/invitations";

const userId = "user-1";
const invitationId = "invitation-1";
const event = {
  startsAt: new Date("2026-12-19T17:00:00.000Z"),
  cancelledAt: null,
  archivedAt: null,
};

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: invitationId,
    coupleDisplayName1: "Alya",
    coupleDisplayName2: "Bima",
    themeId: "classic",
    themeVersion: "1",
    publicationState: PublicationState.DRAFT,
    commercialState: CommercialState.TRIAL,
    primaryEventId: "event-1",
    primaryEvent: event,
    ...overrides,
  };
}

function databaseFor(transaction: Record<string, unknown>): Pick<PrismaClient, "$transaction"> {
  return {
    $transaction: vi.fn(async (callback: (value: Record<string, unknown>) => unknown) => callback(transaction)),
  } as unknown as Pick<PrismaClient, "$transaction">;
}

function cacheFor() {
  return { invalidateInvitation: vi.fn() } satisfies PublicCacheInvalidator;
}

function transactionFor(current: ReturnType<typeof invitation> | null = invitation()) {
  return {
    invitation: {
      findFirst: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("invitation publication", () => {
  it("reports the minimum publish checklist from owner-scoped data", async () => {
    const findFirst = vi.fn().mockResolvedValue(
      invitation({ coupleDisplayName2: " ", primaryEventId: null, primaryEvent: null }),
    );
    const database = { invitation: { findFirst } } as unknown as Pick<PrismaClient, "invitation">;

    await expect(getInvitationPublishReadiness(database, userId, invitationId)).resolves.toMatchObject({
      requirements: { coupleNames: false, primaryEvent: false, theme: true },
      missingRequirements: ["coupleNames", "primaryEvent"],
      commercialStateAllowsPublication: true,
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: invitationId, members: expect.anything() }),
    }));
  });

  it("publishes atomically, audits, and invalidates public cache after commit", async () => {
    const transaction = transactionFor();
    const cache = cacheFor();
    let committed = false;
    transaction.invitation.updateMany = vi.fn().mockImplementation(async () => {
      committed = true;
      return { count: 1 };
    });
    cache.invalidateInvitation.mockImplementation(() => {
      expect(committed).toBe(true);
    });

    await expect(
      publishInvitation(databaseFor(transaction), userId, invitationId, { cache }),
    ).resolves.toEqual({
      invitationId,
      previousState: PublicationState.DRAFT,
      publicationState: PublicationState.PUBLISHED,
      changed: true,
    });
    expect(transaction.invitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { publicationState: PublicationState.PUBLISHED, version: { increment: 1 } },
    }));
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "invitation.published",
        metadata: { before_status: "DRAFT", after_status: "PUBLISHED" },
      }),
    }));
    expect(cache.invalidateInvitation).toHaveBeenCalledWith(invitationId);
  });

  it("rejects missing core information without mutating or invalidating", async () => {
    const transaction = transactionFor(invitation({ primaryEventId: null, primaryEvent: null }));
    const cache = cacheFor();

    await expect(
      publishInvitation(databaseFor(transaction), userId, invitationId, { cache }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });

  it.each([
    CommercialState.TRIAL_EXPIRED,
    CommercialState.GRACE,
    CommercialState.DELETION_PENDING,
    CommercialState.DELETED,
  ])("gates publication actions in %s", async (commercialState) => {
    const transaction = transactionFor(invitation({ commercialState }));
    const cache = cacheFor();

    await expect(
      publishInvitation(databaseFor(transaction), userId, invitationId, { cache }),
    ).rejects.toMatchObject({ code: "LIFECYCLE_LOCKED" });
    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });

  it("unpublishes and supports republishing from UNPUBLISHED", async () => {
    const unpublishTransaction = transactionFor(
      invitation({ publicationState: PublicationState.PUBLISHED }),
    );
    const cache = cacheFor();
    await expect(
      unpublishInvitation(databaseFor(unpublishTransaction), userId, invitationId, { cache }),
    ).resolves.toMatchObject({
      previousState: PublicationState.PUBLISHED,
      publicationState: PublicationState.UNPUBLISHED,
      changed: true,
    });

    const republishTransaction = transactionFor(
      invitation({ publicationState: PublicationState.UNPUBLISHED }),
    );
    await expect(
      publishInvitation(databaseFor(republishTransaction), userId, invitationId, { cache }),
    ).resolves.toMatchObject({
      previousState: PublicationState.UNPUBLISHED,
      publicationState: PublicationState.PUBLISHED,
      changed: true,
    });
    expect(cache.invalidateInvitation).toHaveBeenCalledTimes(2);
  });

  it("is idempotent for the requested state without writing or invalidating", async () => {
    const transaction = transactionFor(invitation({ publicationState: PublicationState.PUBLISHED }));
    const cache = cacheFor();

    await expect(
      publishInvitation(databaseFor(transaction), userId, invitationId, { cache }),
    ).resolves.toMatchObject({ changed: false, publicationState: PublicationState.PUBLISHED });
    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });

  it("fails closed when the owner membership is missing", async () => {
    const transaction = transactionFor(null);
    const cache = cacheFor();

    await expect(
      publishInvitation(databaseFor(transaction), "not-the-owner", invitationId, { cache }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });
});
