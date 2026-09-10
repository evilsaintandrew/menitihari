import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AccountDeletionState,
  CommercialState,
  JobState,
  PublicationState,
  type PrismaClient,
} from "../../src/generated/prisma/client";
import {
  ACCOUNT_DELETION_COMMIT_JOB,
  ACCOUNT_PURGE_JOB,
  cancelAccountDeletion,
  commitAccountDeletion,
  requestAccountDeletion,
} from "../../src/modules/auth/account-deletion";

const now = new Date("2026-09-10T00:00:00.000Z");
const userId = "user-1";

function databaseFor(transaction: Record<string, unknown>): Pick<PrismaClient, "$transaction"> {
  return {
    $transaction: vi.fn(async (callback: (value: Record<string, unknown>) => unknown) => callback(transaction)),
  } as unknown as Pick<PrismaClient, "$transaction">;
}

afterEach(() => vi.restoreAllMocks());

describe("account deletion service", () => {
  it("atomically takes published invitations offline and queues a deduplicated commit", async () => {
    const transaction = {
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          deletionState: AccountDeletionState.DELETION_COOLING_OFF,
          deletionCancellableUntil: new Date("2026-09-10T01:00:00.000Z"),
        }),
      },
      invitation: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      job: { upsert: vi.fn().mockResolvedValue(undefined) },
      auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };

    const result = await requestAccountDeletion(databaseFor(transaction), userId, {
      coolingOffSeconds: 3_600,
      now: () => now,
    });

    expect(result).toEqual({
      state: AccountDeletionState.DELETION_COOLING_OFF,
      cancellableUntil: new Date("2026-09-10T01:00:00.000Z"),
    });
    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: { id: userId, deletionState: AccountDeletionState.ACTIVE },
      data: expect.objectContaining({
        deletionState: AccountDeletionState.DELETION_COOLING_OFF,
        deletionCancellableUntil: new Date("2026-09-10T01:00:00.000Z"),
      }),
    });
    expect(transaction.invitation.updateMany).toHaveBeenCalledWith({
      where: { ownerId: userId, publicationState: PublicationState.PUBLISHED },
      data: { publicationState: PublicationState.UNPUBLISHED },
    });
    expect(transaction.job.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        type: ACCOUNT_DELETION_COMMIT_JOB,
        state: JobState.PENDING,
        runAfter: new Date("2026-09-10T01:00:00.000Z"),
        payload: { userId },
      }),
    }));
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "account.deletion.scheduled" }),
    }));
  });

  it("cancels during cooling-off without republishing invitations", async () => {
    const transaction = {
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          deletionState: AccountDeletionState.DELETION_COOLING_OFF,
          deletionCancellableUntil: new Date("2026-09-10T01:00:00.000Z"),
        }),
      },
      job: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-2" }) },
    };

    const result = await cancelAccountDeletion(databaseFor(transaction), userId, { now: () => now });

    expect(result).toEqual({ state: AccountDeletionState.ACTIVE, cancellableUntil: null });
    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: userId, deletionState: AccountDeletionState.DELETION_COOLING_OFF }),
      data: expect.objectContaining({
        deletionState: AccountDeletionState.ACTIVE,
        deletionCancellableUntil: null,
      }),
    });
    expect(transaction.job.deleteMany).toHaveBeenCalledWith({ where: { dedupKey: `account-deletion:${userId}` } });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "account.deletion.cancelled" }),
    }));
  });

  it("marks due deletion committed and queues purge while leaving financial data untouched", async () => {
    const transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          deletionState: AccountDeletionState.DELETION_COOLING_OFF,
          deletionCancellableUntil: new Date("2026-09-09T23:00:00.000Z"),
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      invitation: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      job: {
        upsert: vi.fn().mockResolvedValue(undefined),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-3" }) },
    };

    const result = await commitAccountDeletion(databaseFor(transaction), userId, { now: () => now });

    expect(result).toEqual({ committed: true, cancellableUntil: null });
    expect(transaction.invitation.updateMany).toHaveBeenCalledWith({
      where: { ownerId: userId },
      data: { publicationState: PublicationState.UNPUBLISHED, commercialState: CommercialState.DELETED },
    });
    expect(transaction.job.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ type: ACCOUNT_PURGE_JOB, payload: { userId } }),
    }));
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "account.deletion.committed" }),
    }));
  });

  it("fails closed when the cooling-off policy is not configured", async () => {
    const database = databaseFor({});
    await expect(requestAccountDeletion(database, userId, { coolingOffSeconds: 0 })).rejects.toThrow("not configured");
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
