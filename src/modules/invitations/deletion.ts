import {
  CommercialState,
  JobState,
  Prisma,
  PublicationState,
  type PrismaClient,
} from "@/generated/prisma/client";
import type { StorageProvider } from "@/providers";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { z } from "zod";

import { ownerMembershipWhere } from "./authorization";
import { purgeJobKey, INVITATION_PURGE_JOB } from "@/modules/lifecycle";

export const INVITATION_DELETION_CONFIRMATION = "HAPUS" as const;
export const DEFAULT_INVITATION_PURGE_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export const invitationDeletionInputSchema = z.object({
  confirmation: z.literal(INVITATION_DELETION_CONFIRMATION),
}).strict();

export interface InvitationDeletionStatus {
  readonly invitationId: string;
  readonly commercialState: CommercialState;
  readonly publicationState: PublicationState;
  readonly purgeAt: Date | null;
  readonly changed: boolean;
}

export interface InvitationDeletionOptions {
  /** Server-owned policy. The client never derives or chooses this value. */
  readonly purgeWindowSeconds: number;
  readonly now?: () => Date;
  readonly cache?: {
    invalidateInvitation(invitationId: string): void | Promise<void>;
  };
}

export interface InvitationPurgeOptions {
  readonly storage: Pick<StorageProvider, "deleteObject">;
  readonly now?: () => Date;
}

export interface InvitationPurgeResult {
  readonly invitationId: string;
  readonly deleted: boolean;
  readonly alreadyPurged: boolean;
  readonly notDue: boolean;
}

type InvitationDeletionDatabase = Pick<PrismaClient, "$transaction">;
type InvitationDeletionReadDatabase = Pick<PrismaClient, "invitation">;

const deletionSelect = {
  id: true,
  commercialState: true,
  publicationState: true,
  purgeAt: true,
} satisfies Prisma.InvitationSelect;

type DeletableInvitation = NonNullable<
  Prisma.Result<
    PrismaClient["invitation"],
    { select: typeof deletionSelect },
    "findUnique"
  >
>;

const purgeSelect = {
  id: true,
  commercialState: true,
  purgeAt: true,
  mediaAssets: {
    select: {
      originalKey: true,
      variants: { select: { storageKey: true } },
    },
  },
  exportJobs: {
    select: {
      artifact: { select: { storageKey: true } },
    },
  },
} satisfies Prisma.InvitationSelect;

type PurgeableInvitation = NonNullable<
  Prisma.Result<
    PrismaClient["invitation"],
    { select: typeof purgeSelect },
    "findUnique"
  >
>;

function assertPurgeWindowSeconds(seconds: number): void {
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new Error("Invitation purge window policy is not configured");
  }
}

function unchangedStatus(invitation: DeletableInvitation): InvitationDeletionStatus {
  return {
    invitationId: invitation.id,
    commercialState: invitation.commercialState,
    publicationState: invitation.publicationState,
    purgeAt: invitation.purgeAt,
    changed: false,
  };
}

export async function getInvitationDeletionStatus(
  database: InvitationDeletionReadDatabase,
  userId: string,
  invitationId: string,
): Promise<InvitationDeletionStatus | null> {
  const invitation = await database.invitation.findFirst({
    where: { id: invitationId, ...ownerMembershipWhere(userId) },
    select: deletionSelect,
  });
  return invitation ? unchangedStatus(invitation) : null;
}

/**
 * Takes one invitation offline and schedules its physical purge. The update
 * is conditional on owner membership and the current lifecycle state so a
 * repeated request cannot move the deadline or enqueue duplicate work.
 */
export async function requestInvitationDeletion(
  database: InvitationDeletionDatabase,
  userId: string,
  invitationId: string,
  options: InvitationDeletionOptions,
): Promise<InvitationDeletionStatus> {
  assertPurgeWindowSeconds(options.purgeWindowSeconds);
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Invitation deletion clock is invalid");
  const purgeAt = new Date(now.getTime() + options.purgeWindowSeconds * 1_000);

  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: deletionSelect,
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);

    if (invitation.commercialState === CommercialState.DELETION_PENDING) {
      return unchangedStatus(invitation);
    }
    if (invitation.commercialState === CommercialState.DELETED) {
      throw new DomainError(ERROR_CODES.NOT_FOUND);
    }

    const transitioned = await transaction.invitation.updateMany({
      where: {
        id: invitationId,
        ...ownerMembershipWhere(userId),
        commercialState: { notIn: [CommercialState.DELETION_PENDING, CommercialState.DELETED] },
      },
      data: {
        commercialState: CommercialState.DELETION_PENDING,
        publicationState: PublicationState.UNPUBLISHED,
        deletionRequestedAt: now,
        purgeAt,
        version: { increment: 1 },
      },
    });

    if (transitioned.count !== 1) {
      const current = await transaction.invitation.findFirst({
        where: { id: invitationId, ...ownerMembershipWhere(userId) },
        select: deletionSelect,
      });
      if (!current) throw new DomainError(ERROR_CODES.NOT_FOUND);
      return unchangedStatus(current);
    }

    await transaction.job.upsert({
      where: { dedupKey: purgeJobKey(invitationId) },
      create: {
        type: INVITATION_PURGE_JOB,
        dedupKey: purgeJobKey(invitationId),
        payload: { invitationId },
        state: JobState.PENDING,
        runAfter: purgeAt,
      },
      update: {
        payload: { invitationId },
        state: JobState.PENDING,
        runAfter: purgeAt,
        attempts: 0,
        lastError: null,
      },
    });

    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "invitation",
      resourceId: invitationId,
      action: "invitation.deletion.requested",
      metadata: { purge_at: purgeAt.toISOString() },
      createdAt: now,
    });

    return {
      invitationId,
      commercialState: CommercialState.DELETION_PENDING,
      publicationState: PublicationState.UNPUBLISHED,
      purgeAt,
      changed: true,
    } satisfies InvitationDeletionStatus;
  });

  if (result.changed && options.cache) {
    await options.cache.invalidateInvitation(result.invitationId);
  }
  return result;
}

function storageKeys(invitation: PurgeableInvitation): readonly string[] {
  return [
    ...invitation.mediaAssets.flatMap((asset) => [
      asset.originalKey,
      ...asset.variants.map((variant) => variant.storageKey),
    ]),
    ...invitation.exportJobs.flatMap((job) => job.artifact ? [job.artifact.storageKey] : []),
  ].filter((key, index, keys) => key.length > 0 && keys.indexOf(key) === index);
}

/**
 * Performs the physical invitation purge once its server-owned deadline is
 * due. Storage deletion is safe to retry; database cleanup is transactional,
 * and retained financial records are detached before the payment order is
 * cascaded with the invitation.
 */
export async function purgeInvitation(
  database: InvitationDeletionReadDatabase & InvitationDeletionDatabase,
  invitationId: string,
  options: InvitationPurgeOptions,
): Promise<InvitationPurgeResult> {
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Invitation purge clock is invalid");

  const invitation = await database.invitation.findUnique({
    where: { id: invitationId },
    select: purgeSelect,
  });
  if (!invitation) {
    return { invitationId, deleted: false, alreadyPurged: true, notDue: false };
  }
  if (invitation.commercialState !== CommercialState.DELETION_PENDING) {
    return { invitationId, deleted: false, alreadyPurged: false, notDue: false };
  }
  if (invitation.purgeAt && invitation.purgeAt > now) {
    return { invitationId, deleted: false, alreadyPurged: false, notDue: true };
  }

  for (const objectKey of storageKeys(invitation)) {
    await options.storage.deleteObject({ objectKey });
  }

  const deleted = await database.$transaction(async (transaction) => {
    const current = await transaction.invitation.findUnique({
      where: { id: invitationId },
      select: { commercialState: true, purgeAt: true },
    });
    if (!current || current.commercialState !== CommercialState.DELETION_PENDING) return false;
    if (current.purgeAt && current.purgeAt > now) return false;

    await transaction.financialRecord.updateMany({
      where: { paymentOrder: { invitationId } },
      data: { paymentOrderId: null },
    });
    const result = await transaction.invitation.deleteMany({
      where: { id: invitationId, commercialState: CommercialState.DELETION_PENDING },
    });
    return result.count === 1;
  });

  return {
    invitationId,
    deleted,
    alreadyPurged: !deleted,
    notDue: false,
  };
}
