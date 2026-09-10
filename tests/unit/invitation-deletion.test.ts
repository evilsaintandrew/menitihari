import { describe, expect, it, vi } from "vitest";

import {
  CommercialState,
  JobState,
  PublicationState,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  invitationDeletionInputSchema,
  purgeInvitation,
  requestInvitationDeletion,
} from "@/modules/invitations";

const now = new Date("2026-09-10T00:00:00.000Z");
const invitationId = "invitation-1";
const userId = "user-1";

function databaseFor(transaction: Record<string, unknown>): Pick<PrismaClient, "$transaction"> {
  return {
    $transaction: vi.fn(async (callback: (value: Record<string, unknown>) => unknown) => callback(transaction)),
  } as unknown as Pick<PrismaClient, "$transaction">;
}

describe("invitation voluntary deletion", () => {
  it("requires the exact strong confirmation phrase", () => {
    expect(invitationDeletionInputSchema.safeParse({ confirmation: "HAPUS" }).success).toBe(true);
    expect(invitationDeletionInputSchema.safeParse({ confirmation: "hapus" }).success).toBe(false);
    expect(invitationDeletionInputSchema.safeParse({ confirmation: "HAPUS", invitationId }).success).toBe(false);
  });

  it("takes the invitation offline, schedules one purge, audits, and invalidates after commit", async () => {
    const transaction = {
      invitation: {
        findFirst: vi.fn().mockResolvedValue({
          id: invitationId,
          commercialState: CommercialState.PAID_ACTIVE,
          publicationState: PublicationState.PUBLISHED,
          purgeAt: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      job: { upsert: vi.fn().mockResolvedValue(undefined) },
      auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };
    const cache = { invalidateInvitation: vi.fn() };

    await expect(requestInvitationDeletion(databaseFor(transaction), userId, invitationId, {
      purgeWindowSeconds: 7 * 24 * 60 * 60,
      now: () => now,
      cache,
    })).resolves.toEqual({
      invitationId,
      commercialState: CommercialState.DELETION_PENDING,
      publicationState: PublicationState.UNPUBLISHED,
      purgeAt: new Date("2026-09-17T00:00:00.000Z"),
      changed: true,
    });

    expect(transaction.invitation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: invitationId,
        commercialState: { notIn: [CommercialState.DELETION_PENDING, CommercialState.DELETED] },
      }),
      data: expect.objectContaining({
        commercialState: CommercialState.DELETION_PENDING,
        publicationState: PublicationState.UNPUBLISHED,
        purgeAt: new Date("2026-09-17T00:00:00.000Z"),
      }),
    });
    expect(transaction.job.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupKey: `invitation-purge:${invitationId}` },
      create: expect.objectContaining({
        type: "INVITATION_PURGE",
        state: JobState.PENDING,
        runAfter: new Date("2026-09-17T00:00:00.000Z"),
      }),
    }));
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "invitation.deletion.requested" }),
    }));
    expect(cache.invalidateInvitation).toHaveBeenCalledWith(invitationId);
  });

  it("does not move the purge deadline or enqueue duplicate work on retry", async () => {
    const transaction = {
      invitation: {
        findFirst: vi.fn().mockResolvedValue({
          id: invitationId,
          commercialState: CommercialState.DELETION_PENDING,
          publicationState: PublicationState.UNPUBLISHED,
          purgeAt: new Date("2026-09-17T00:00:00.000Z"),
        }),
        updateMany: vi.fn(),
      },
      job: { upsert: vi.fn() },
      auditEvent: { create: vi.fn() },
    };

    await expect(requestInvitationDeletion(databaseFor(transaction), userId, invitationId, {
      purgeWindowSeconds: 1,
      now: () => now,
    })).resolves.toMatchObject({ changed: false, purgeAt: new Date("2026-09-17T00:00:00.000Z") });
    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
    expect(transaction.job.upsert).not.toHaveBeenCalled();
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
  });

  it("waits for the server deadline, deletes storage idempotently, and detaches financial records", async () => {
    const storage = { deleteObject: vi.fn().mockResolvedValue(undefined) };
    const current = {
      id: invitationId,
      commercialState: CommercialState.DELETION_PENDING,
      purgeAt: new Date("2026-09-10T01:00:00.000Z"),
      mediaAssets: [{
        originalKey: "invitations/invitation-1/original.jpg",
        variants: [{ storageKey: "invitations/invitation-1/medium.jpg" }],
      }],
      exportJobs: [{ artifact: { storageKey: "exports/export-1.csv" } }],
    };
    const transaction = {
      invitation: {
        findUnique: vi.fn().mockResolvedValue(current),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      financialRecord: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const database = {
      invitation: { findUnique: vi.fn().mockResolvedValue(current) },
      ...databaseFor(transaction),
    } as unknown as Pick<PrismaClient, "invitation" | "$transaction">;

    await expect(purgeInvitation(database, invitationId, {
      storage,
      now: () => new Date("2026-09-10T00:30:00.000Z"),
    })).resolves.toEqual({ invitationId, deleted: false, alreadyPurged: false, notDue: true });
    expect(storage.deleteObject).not.toHaveBeenCalled();

    await expect(purgeInvitation(database, invitationId, {
      storage,
      now: () => new Date("2026-09-10T01:00:00.000Z"),
    })).resolves.toEqual({ invitationId, deleted: true, alreadyPurged: false, notDue: false });
    expect(storage.deleteObject).toHaveBeenCalledTimes(3);
    expect(transaction.financialRecord.updateMany).toHaveBeenCalledWith({
      where: { paymentOrder: { invitationId } },
      data: { paymentOrderId: null },
    });
    expect(transaction.invitation.deleteMany).toHaveBeenCalledWith({
      where: { id: invitationId, commercialState: CommercialState.DELETION_PENDING },
    });
  });
});
