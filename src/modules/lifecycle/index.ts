import {
  CommercialState,
  Prisma,
  PublicationState,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";

export const INVITATION_TRIAL_EXPIRY_JOB = "INVITATION_TRIAL_EXPIRY";

export interface LifecycleCacheInvalidator {
  invalidateInvitation(invitationId: string): void | Promise<void>;
}

export interface TrialExpiryOptions {
  readonly cache?: LifecycleCacheInvalidator;
  readonly now?: () => Date;
}

export interface TrialExpiryTransition {
  readonly invitationId: string;
  readonly previousCommercialState: CommercialState;
  readonly commercialState: CommercialState;
  readonly previousPublicationState: PublicationState;
  readonly publicationState: PublicationState;
  readonly changed: boolean;
}

export interface InvitationLifecycleCapabilities {
  readonly canEdit: boolean;
  readonly canPublish: boolean;
  readonly canPreviewPrivately: boolean;
  readonly canPay: boolean;
  readonly canExport: boolean;
}

type LifecycleDatabase = Pick<PrismaClient, "$transaction">;
type LifecycleReadDatabase = Pick<PrismaClient, "invitation">;

const trialInvitationSelect = {
  id: true,
  commercialState: true,
  publicationState: true,
  trialEndsAt: true,
} satisfies Prisma.InvitationSelect;

type TrialInvitation = NonNullable<
  Prisma.Result<
    PrismaClient["invitation"],
    { select: typeof trialInvitationSelect },
    "findUnique"
  >
>;

export function trialExpiryJobKey(invitationId: string): string {
  return `invitation-trial-expiry:${invitationId}`;
}

export function isTrialExpired(trialEndsAt: Date, now = new Date()): boolean {
  return trialEndsAt.getTime() <= now.getTime();
}

export function isCommerciallyEditable(
  commercialState: CommercialState,
  trialEndsAt?: Date | null,
  now = new Date(),
): boolean {
  if (commercialState === CommercialState.PAID_ACTIVE) return true;
  return commercialState === CommercialState.TRIAL &&
    trialEndsAt !== null &&
    (trialEndsAt === undefined || !isTrialExpired(trialEndsAt, now));
}

export function isPublicInvitationAvailable(input: {
  readonly publicationState: PublicationState;
  readonly commercialState: CommercialState;
  readonly genericAccessEnabled: boolean;
  readonly trialEndsAt?: Date | null;
}, now = new Date()): boolean {
  const activeCommercialState =
    input.commercialState === CommercialState.PAID_ACTIVE ||
    (input.commercialState === CommercialState.TRIAL &&
      input.trialEndsAt !== null &&
      input.trialEndsAt !== undefined &&
      !isTrialExpired(input.trialEndsAt, now));

  return input.publicationState === PublicationState.PUBLISHED &&
    input.genericAccessEnabled &&
    activeCommercialState;
}

export function getInvitationLifecycleCapabilities(
  commercialState: CommercialState,
  trialEndsAt?: Date | null,
  now = new Date(),
): InvitationLifecycleCapabilities {
  const canEdit = isCommerciallyEditable(commercialState, trialEndsAt, now);
  const canPreviewPrivately =
    commercialState === CommercialState.TRIAL ||
    commercialState === CommercialState.TRIAL_EXPIRED ||
    commercialState === CommercialState.PAID_ACTIVE ||
    commercialState === CommercialState.GRACE;
  const canPay =
    commercialState === CommercialState.TRIAL ||
    commercialState === CommercialState.TRIAL_EXPIRED;
  const canExport = canPreviewPrivately;

  return {
    canEdit,
    canPublish: canEdit,
    canPreviewPrivately,
    canPay,
    canExport,
  };
}

function unchangedTransition(invitation: TrialInvitation): TrialExpiryTransition {
  return {
    invitationId: invitation.id,
    previousCommercialState: invitation.commercialState,
    commercialState: invitation.commercialState,
    previousPublicationState: invitation.publicationState,
    publicationState: invitation.publicationState,
    changed: false,
  };
}

/**
 * Marks one due trial as expired. This is a system transition: callers must
 * not supply an owner identity, and the conditional update makes retries and
 * concurrent scheduler/worker delivery safe.
 */
export async function expireInvitationTrial(
  database: LifecycleDatabase,
  invitationId: string,
  options: TrialExpiryOptions = {},
): Promise<TrialExpiryTransition> {
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Lifecycle clock is invalid");

  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findUnique({
      where: { id: invitationId },
      select: trialInvitationSelect,
    });

    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);

    if (
      invitation.commercialState !== CommercialState.TRIAL ||
      !isTrialExpired(invitation.trialEndsAt, now)
    ) {
      return unchangedTransition(invitation);
    }

    const publicationState =
      invitation.publicationState === PublicationState.PUBLISHED
        ? PublicationState.UNPUBLISHED
        : invitation.publicationState;
    const updated = await transaction.invitation.updateMany({
      where: {
        id: invitationId,
        commercialState: CommercialState.TRIAL,
        trialEndsAt: { lte: now },
      },
      data: {
        commercialState: CommercialState.TRIAL_EXPIRED,
        publicationState,
        version: { increment: 1 },
      },
    });

    if (updated.count !== 1) {
      const current = await transaction.invitation.findUnique({
        where: { id: invitationId },
        select: trialInvitationSelect,
      });
      if (!current) throw new DomainError(ERROR_CODES.NOT_FOUND);
      return unchangedTransition(current);
    }

    await writeAuditEvent(transaction, {
      invitationId,
      resourceType: "invitation",
      resourceId: invitationId,
      action: "invitation.trial_expired",
      metadata: {
        before_commercial_state: invitation.commercialState,
        after_commercial_state: CommercialState.TRIAL_EXPIRED,
        before_publication_state: invitation.publicationState,
        after_publication_state: publicationState,
      },
      createdAt: now,
    });

    return {
      invitationId,
      previousCommercialState: invitation.commercialState,
      commercialState: CommercialState.TRIAL_EXPIRED,
      previousPublicationState: invitation.publicationState,
      publicationState,
      changed: true,
    } satisfies TrialExpiryTransition;
  });

  if (result.changed && options.cache) {
    await options.cache.invalidateInvitation(result.invitationId);
  }

  return result;
}

/** Finds due trials for the scheduler/worker sweep and expires each safely. */
export async function expireDueInvitationTrials(
  database: LifecycleReadDatabase & LifecycleDatabase,
  options: TrialExpiryOptions & { readonly limit?: number } = {},
): Promise<readonly TrialExpiryTransition[]> {
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Lifecycle clock is invalid");
  const limit = options.limit ?? 100;
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("Lifecycle sweep limit is invalid");

  const due = await database.invitation.findMany({
    where: {
      commercialState: CommercialState.TRIAL,
      trialEndsAt: { lte: now },
    },
    orderBy: { trialEndsAt: "asc" },
    take: limit,
    select: { id: true },
  });

  return Promise.all(
    due.map(({ id }) => expireInvitationTrial(database, id, { ...options, now: () => now })),
  );
}
