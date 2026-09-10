import { AccountDeletionState, CommercialState, JobState, PublicationState, Prisma, type PrismaClient } from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";

export const ACCOUNT_DELETION_COMMIT_JOB = "ACCOUNT_DELETION_COMMIT";
export const ACCOUNT_PURGE_JOB = "ACCOUNT_PURGE";

type AccountDeletionDatabase = Pick<PrismaClient, "$transaction">;

export interface AccountDeletionStatus {
  readonly state: AccountDeletionState;
  readonly cancellableUntil: Date | null;
}

export interface AccountDeletionServiceOptions {
  /** Server-owned policy. The UI never derives this duration. */
  readonly coolingOffSeconds: number;
  readonly now?: () => Date;
}

function deletionJobKey(userId: string): string {
  return `account-deletion:${userId}`;
}

function purgeJobKey(userId: string): string {
  return `account-purge:${userId}`;
}

function assertCoolingOffSeconds(seconds: number): void {
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new Error("Account deletion cooling-off policy is not configured");
  }
}

export async function getAccountDeletionStatus(
  database: PrismaClient,
  userId: string,
): Promise<AccountDeletionStatus | null> {
  const user = await database.user.findUnique({
    where: { id: userId },
    select: { deletionState: true, deletionCancellableUntil: true },
  });

  if (!user) return null;

  return {
    state: user.deletionState,
    cancellableUntil:
      user.deletionState === AccountDeletionState.DELETION_COOLING_OFF
        ? user.deletionCancellableUntil
        : null,
  };
}

export async function requestAccountDeletion(
  database: AccountDeletionDatabase,
  userId: string,
  options: AccountDeletionServiceOptions,
): Promise<AccountDeletionStatus> {
  assertCoolingOffSeconds(options.coolingOffSeconds);
  const now = options.now?.() ?? new Date();
  const cancellableUntil = new Date(now.getTime() + options.coolingOffSeconds * 1_000);

  return database.$transaction(async (transaction) => {
    const transitioned = await transaction.user.updateMany({
      where: { id: userId, deletionState: AccountDeletionState.ACTIVE },
      data: {
        deletionState: AccountDeletionState.DELETION_COOLING_OFF,
        deletionRequestedAt: now,
        deletionCancellableUntil: cancellableUntil,
        deletionCommittedAt: null,
      },
    });

    if (transitioned.count === 0) {
      const current = await transaction.user.findUnique({
        where: { id: userId },
        select: { deletionState: true, deletionCancellableUntil: true },
      });
      if (!current) throw new Error("Account not found");
      if (current.deletionState !== AccountDeletionState.DELETION_COOLING_OFF) {
        throw new Error("Account deletion is not available in the current state");
      }

      return {
        state: current.deletionState,
        cancellableUntil: current.deletionCancellableUntil,
      };
    }

    await transaction.invitation.updateMany({
      where: {
        ownerId: userId,
        publicationState: PublicationState.PUBLISHED,
      },
      data: { publicationState: PublicationState.UNPUBLISHED },
    });

    await transaction.job.upsert({
      where: { dedupKey: deletionJobKey(userId) },
      create: {
        type: ACCOUNT_DELETION_COMMIT_JOB,
        dedupKey: deletionJobKey(userId),
        payload: { userId },
        state: JobState.PENDING,
        runAfter: cancellableUntil,
      },
      update: {
        payload: { userId },
        state: JobState.PENDING,
        runAfter: cancellableUntil,
        attempts: 0,
        lastError: null,
      },
    });

    await writeAuditEvent(transaction, {
      actorId: userId,
      resourceType: "account",
      resourceId: userId,
      action: "account.deletion.scheduled",
      metadata: { cancellable_until: cancellableUntil.toISOString() },
      createdAt: now,
    });

    return {
      state: AccountDeletionState.DELETION_COOLING_OFF,
      cancellableUntil,
    };
  });
}

export async function cancelAccountDeletion(
  database: AccountDeletionDatabase,
  userId: string,
  options: Pick<AccountDeletionServiceOptions, "now"> = {},
): Promise<AccountDeletionStatus> {
  const now = options.now?.() ?? new Date();

  return database.$transaction(async (transaction) => {
    const current = await transaction.user.findUnique({
      where: { id: userId },
      select: { deletionState: true, deletionCancellableUntil: true },
    });
    if (!current) throw new Error("Account not found");
    if (
      current.deletionState !== AccountDeletionState.DELETION_COOLING_OFF ||
      !current.deletionCancellableUntil ||
      current.deletionCancellableUntil <= now
    ) {
      return {
        state: current.deletionState,
        cancellableUntil:
          current.deletionState === AccountDeletionState.DELETION_COOLING_OFF
            ? current.deletionCancellableUntil
            : null,
      };
    }

    const cancelled = await transaction.user.updateMany({
      where: {
        id: userId,
        deletionState: AccountDeletionState.DELETION_COOLING_OFF,
        deletionCancellableUntil: { gt: now },
      },
      data: {
        deletionState: AccountDeletionState.ACTIVE,
        deletionRequestedAt: null,
        deletionCancellableUntil: null,
        deletionCommittedAt: null,
      },
    });

    if (cancelled.count === 0) {
      const latest = await transaction.user.findUnique({
        where: { id: userId },
        select: { deletionState: true, deletionCancellableUntil: true },
      });
      if (!latest) throw new Error("Account not found");

      return {
        state: latest.deletionState,
        cancellableUntil:
          latest.deletionState === AccountDeletionState.DELETION_COOLING_OFF
            ? latest.deletionCancellableUntil
            : null,
      };
    }

    await transaction.job.deleteMany({ where: { dedupKey: deletionJobKey(userId) } });
    await writeAuditEvent(transaction, {
      actorId: userId,
      resourceType: "account",
      resourceId: userId,
      action: "account.deletion.cancelled",
      createdAt: now,
    });

    return { state: AccountDeletionState.ACTIVE, cancellableUntil: null };
  });
}

/**
 * Called by the account-deletion worker after the server-owned deadline.
 * This marks the account committed and enqueues the later physical purge;
 * LIFE-010 owns the dependency-safe data/object deletion implementation.
 */
export async function commitAccountDeletion(
  database: AccountDeletionDatabase,
  userId: string,
  options: Pick<AccountDeletionServiceOptions, "now"> = {},
): Promise<{ readonly committed: boolean; readonly cancellableUntil: Date | null }> {
  const now = options.now?.() ?? new Date();

  return database.$transaction(async (transaction) => {
    const current = await transaction.user.findUnique({
      where: { id: userId },
      select: { deletionState: true, deletionCancellableUntil: true },
    });
    if (!current) throw new Error("Account not found");
    if (current.deletionState !== AccountDeletionState.DELETION_COOLING_OFF) {
      return {
        committed: false,
        cancellableUntil: current.deletionCancellableUntil,
      };
    }
    if (!current.deletionCancellableUntil || current.deletionCancellableUntil > now) {
      return {
        committed: false,
        cancellableUntil: current.deletionCancellableUntil,
      };
    }

    const committed = await transaction.user.updateMany({
      where: { id: userId, deletionState: AccountDeletionState.DELETION_COOLING_OFF },
      data: {
        deletionState: AccountDeletionState.DELETION_COMMITTED,
        deletionCancellableUntil: null,
        deletionCommittedAt: now,
      },
    });
    if (committed.count !== 1) return { committed: false, cancellableUntil: null };

    await transaction.invitation.updateMany({
      where: { ownerId: userId },
      data: {
        publicationState: PublicationState.UNPUBLISHED,
        commercialState: CommercialState.DELETED,
      },
    });
    await transaction.job.upsert({
      where: { dedupKey: purgeJobKey(userId) },
      create: {
        type: ACCOUNT_PURGE_JOB,
        dedupKey: purgeJobKey(userId),
        payload: { userId },
        state: JobState.PENDING,
        runAfter: now,
      },
      update: { payload: { userId }, state: JobState.PENDING, runAfter: now },
    });
    await transaction.job.deleteMany({ where: { dedupKey: deletionJobKey(userId) } });
    await writeAuditEvent(transaction, {
      actorId: userId,
      resourceType: "account",
      resourceId: userId,
      action: "account.deletion.committed",
      createdAt: now,
    });

    return { committed: true, cancellableUntil: null };
  });
}
