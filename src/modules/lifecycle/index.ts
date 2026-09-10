import {
  CommercialState,
  JobState,
  Prisma,
  PublicationState,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";

export const INVITATION_TRIAL_EXPIRY_JOB = "INVITATION_TRIAL_EXPIRY";
export const INVITATION_PAID_EXPIRY_JOB = "INVITATION_PAID_EXPIRY";
export const INVITATION_GRACE_EXPIRY_JOB = "INVITATION_GRACE_EXPIRY";
export const INVITATION_PURGE_JOB = "INVITATION_PURGE";

export const INVITATION_PAID_DURATION_YEARS = 1;
export const INVITATION_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1_000;

export interface LifecycleCacheInvalidator {
  invalidateInvitation(invitationId: string): void | Promise<void>;
}

export interface TrialExpiryOptions {
  readonly cache?: LifecycleCacheInvalidator;
  readonly now?: () => Date;
}

export interface PaidExpiryOptions {
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

export interface PaidExpiryTransition {
  readonly invitationId: string;
  readonly previousCommercialState: CommercialState;
  readonly commercialState: CommercialState;
  readonly previousPublicationState: PublicationState;
  readonly publicationState: PublicationState;
  readonly activeUntil: Date | null;
  readonly graceEndsAt: Date | null;
  readonly changed: boolean;
}

export interface InvitationLifecycleCapabilities {
  readonly canEdit: boolean;
  readonly canPublish: boolean;
  readonly canPreviewPrivately: boolean;
  readonly canPay: boolean;
  readonly canExport: boolean;
  readonly canDownloadMedia: boolean;
}

type LifecycleDatabase = Pick<PrismaClient, "$transaction">;
type LifecycleReadDatabase = Pick<PrismaClient, "invitation">;

const paidInvitationSelect = {
  id: true,
  commercialState: true,
  publicationState: true,
  activeUntil: true,
  graceEndsAt: true,
} satisfies Prisma.InvitationSelect;

type PaidInvitation = NonNullable<
  Prisma.Result<
    PrismaClient["invitation"],
    { select: typeof paidInvitationSelect },
    "findUnique"
  >
>;

const graceInvitationSelect = {
  ...paidInvitationSelect,
} satisfies Prisma.InvitationSelect;

type GraceInvitation = PaidInvitation;

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

export function paidExpiryJobKey(invitationId: string): string {
  return `invitation-paid-expiry:${invitationId}`;
}

export function graceExpiryJobKey(invitationId: string): string {
  return `invitation-grace-expiry:${invitationId}`;
}

export function purgeJobKey(invitationId: string): string {
  return `invitation-purge:${invitationId}`;
}

/** Paid expiry is a calendar-year boundary measured from provider success. */
export function calculatePaidActiveUntil(paidAt: Date): Date {
  const activeUntil = new Date(paidAt);
  activeUntil.setUTCFullYear(activeUntil.getUTCFullYear() + INVITATION_PAID_DURATION_YEARS);
  return activeUntil;
}

export function calculateGraceEndsAt(activeUntil: Date): Date {
  return new Date(activeUntil.getTime() + INVITATION_GRACE_DAYS * DAY_MS);
}

export function isTrialExpired(trialEndsAt: Date, now = new Date()): boolean {
  return trialEndsAt.getTime() <= now.getTime();
}

export function isPaidExpired(activeUntil: Date | null | undefined, now = new Date()): boolean {
  return activeUntil instanceof Date && activeUntil.getTime() <= now.getTime();
}

export function isCommerciallyEditable(
  commercialState: CommercialState,
  trialEndsAt?: Date | null,
  now = new Date(),
  activeUntil?: Date | null,
): boolean {
  if (commercialState === CommercialState.PAID_ACTIVE) {
    return !isPaidExpired(activeUntil, now);
  }
  return commercialState === CommercialState.TRIAL &&
    trialEndsAt !== null &&
    (trialEndsAt === undefined || !isTrialExpired(trialEndsAt, now));
}

export function isPublicInvitationAvailable(input: {
  readonly publicationState: PublicationState;
  readonly commercialState: CommercialState;
  readonly genericAccessEnabled: boolean;
  readonly trialEndsAt?: Date | null;
  readonly activeUntil?: Date | null;
}, now = new Date()): boolean {
  const activeCommercialState =
    (input.commercialState === CommercialState.PAID_ACTIVE &&
      !isPaidExpired(input.activeUntil, now)) ||
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
  activeUntil?: Date | null,
): InvitationLifecycleCapabilities {
  const canEdit = isCommerciallyEditable(commercialState, trialEndsAt, now, activeUntil);
  const canPreviewPrivately =
    commercialState === CommercialState.TRIAL ||
    commercialState === CommercialState.TRIAL_EXPIRED ||
    commercialState === CommercialState.PAID_ACTIVE ||
    commercialState === CommercialState.GRACE;
  const canPay =
    commercialState === CommercialState.TRIAL ||
    commercialState === CommercialState.TRIAL_EXPIRED;
  const canExport = canPreviewPrivately;
  const canDownloadMedia = canPreviewPrivately;

  return {
    canEdit,
    canPublish: canEdit,
    canPreviewPrivately,
    canPay,
    canExport,
    canDownloadMedia,
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

type LifecycleJobDatabase = Pick<PrismaClient, "job">;

async function scheduleLifecycleJob(
  database: LifecycleJobDatabase,
  input: {
    readonly type: string;
    readonly dedupKey: string;
    readonly invitationId: string;
    readonly runAfter: Date;
  },
): Promise<void> {
  await database.job.upsert({
    where: { dedupKey: input.dedupKey },
    create: {
      type: input.type,
      dedupKey: input.dedupKey,
      payload: { invitationId: input.invitationId },
      state: JobState.PENDING,
      runAfter: input.runAfter,
    },
    update: {
      payload: { invitationId: input.invitationId },
      state: JobState.PENDING,
      runAfter: input.runAfter,
      attempts: 0,
      lastError: null,
    },
  });
}

/** Called by the payment application after a provider-confirmed activation. */
export async function scheduleInvitationPaidExpiry(
  database: LifecycleJobDatabase,
  invitationId: string,
  activeUntil: Date,
): Promise<void> {
  await scheduleLifecycleJob(database, {
    type: INVITATION_PAID_EXPIRY_JOB,
    dedupKey: paidExpiryJobKey(invitationId),
    invitationId,
    runAfter: activeUntil,
  });
}

function unchangedPaidTransition(invitation: PaidInvitation): PaidExpiryTransition {
  return {
    invitationId: invitation.id,
    previousCommercialState: invitation.commercialState,
    commercialState: invitation.commercialState,
    previousPublicationState: invitation.publicationState,
    publicationState: invitation.publicationState,
    activeUntil: invitation.activeUntil,
    graceEndsAt: invitation.graceEndsAt,
    changed: false,
  };
}

/** Moves a paid invitation into its read-only grace period exactly once. */
export async function expireInvitationPaid(
  database: LifecycleDatabase,
  invitationId: string,
  options: PaidExpiryOptions = {},
): Promise<PaidExpiryTransition> {
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Lifecycle clock is invalid");

  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findUnique({
      where: { id: invitationId },
      select: paidInvitationSelect,
    });

    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (
      invitation.commercialState !== CommercialState.PAID_ACTIVE ||
      !isPaidExpired(invitation.activeUntil, now)
    ) {
      return unchangedPaidTransition(invitation);
    }

    const graceEndsAt = calculateGraceEndsAt(invitation.activeUntil!);
    const publicationState =
      invitation.publicationState === PublicationState.PUBLISHED
        ? PublicationState.UNPUBLISHED
        : invitation.publicationState;
    const updated = await transaction.invitation.updateMany({
      where: {
        id: invitationId,
        commercialState: CommercialState.PAID_ACTIVE,
        activeUntil: { lte: now },
      },
      data: {
        commercialState: CommercialState.GRACE,
        publicationState,
        graceEndsAt,
        version: { increment: 1 },
      },
    });

    if (updated.count !== 1) {
      const current = await transaction.invitation.findUnique({
        where: { id: invitationId },
        select: paidInvitationSelect,
      });
      if (!current) throw new DomainError(ERROR_CODES.NOT_FOUND);
      return unchangedPaidTransition(current);
    }

    await scheduleLifecycleJob(transaction, {
      type: INVITATION_GRACE_EXPIRY_JOB,
      dedupKey: graceExpiryJobKey(invitationId),
      invitationId,
      runAfter: graceEndsAt,
    });
    await writeAuditEvent(transaction, {
      invitationId,
      resourceType: "invitation",
      resourceId: invitationId,
      action: "invitation.paid_expired",
      metadata: {
        before_commercial_state: invitation.commercialState,
        after_commercial_state: CommercialState.GRACE,
        before_publication_state: invitation.publicationState,
        after_publication_state: publicationState,
        active_until: invitation.activeUntil!.toISOString(),
        grace_ends_at: graceEndsAt.toISOString(),
      },
      createdAt: now,
    });

    return {
      invitationId,
      previousCommercialState: invitation.commercialState,
      commercialState: CommercialState.GRACE,
      previousPublicationState: invitation.publicationState,
      publicationState,
      activeUntil: invitation.activeUntil,
      graceEndsAt,
      changed: true,
    } satisfies PaidExpiryTransition;
  });

  if (result.changed && options.cache) {
    await options.cache.invalidateInvitation(result.invitationId);
  }
  return result;
}

/** Finds paid invitations at or past active_until for a bounded scheduler sweep. */
export async function expireDuePaidInvitations(
  database: LifecycleReadDatabase & LifecycleDatabase,
  options: PaidExpiryOptions & { readonly limit?: number } = {},
): Promise<readonly PaidExpiryTransition[]> {
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Lifecycle clock is invalid");
  const limit = options.limit ?? 100;
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("Lifecycle sweep limit is invalid");

  const due = await database.invitation.findMany({
    where: {
      commercialState: CommercialState.PAID_ACTIVE,
      activeUntil: { lte: now },
    },
    orderBy: { activeUntil: "asc" },
    take: limit,
    select: { id: true },
  });

  return Promise.all(
    due.map(({ id }) => expireInvitationPaid(database, id, { ...options, now: () => now })),
  );
}

export interface GraceExpiryTransition {
  readonly invitationId: string;
  readonly previousCommercialState: CommercialState;
  readonly commercialState: CommercialState;
  readonly previousPublicationState: PublicationState;
  readonly publicationState: PublicationState;
  readonly graceEndsAt: Date | null;
  readonly changed: boolean;
}

function unchangedGraceTransition(invitation: GraceInvitation): GraceExpiryTransition {
  return {
    invitationId: invitation.id,
    previousCommercialState: invitation.commercialState,
    commercialState: invitation.commercialState,
    previousPublicationState: invitation.publicationState,
    publicationState: invitation.publicationState,
    graceEndsAt: invitation.graceEndsAt,
    changed: false,
  };
}

/** Marks the invitation for deletion after the read-only grace window. */
export async function expireInvitationGrace(
  database: LifecycleDatabase,
  invitationId: string,
  options: PaidExpiryOptions = {},
): Promise<GraceExpiryTransition> {
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Lifecycle clock is invalid");

  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findUnique({
      where: { id: invitationId },
      select: graceInvitationSelect,
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (
      invitation.commercialState !== CommercialState.GRACE ||
      !invitation.graceEndsAt ||
      invitation.graceEndsAt > now
    ) {
      return unchangedGraceTransition(invitation);
    }

    const updated = await transaction.invitation.updateMany({
      where: {
        id: invitationId,
        commercialState: CommercialState.GRACE,
        graceEndsAt: { lte: now },
      },
      data: {
        commercialState: CommercialState.DELETION_PENDING,
        publicationState: PublicationState.UNPUBLISHED,
        version: { increment: 1 },
      },
    });

    if (updated.count !== 1) {
      const current = await transaction.invitation.findUnique({
        where: { id: invitationId },
        select: graceInvitationSelect,
      });
      if (!current) throw new DomainError(ERROR_CODES.NOT_FOUND);
      return unchangedGraceTransition(current);
    }

    await scheduleLifecycleJob(transaction, {
      type: INVITATION_PURGE_JOB,
      dedupKey: purgeJobKey(invitationId),
      invitationId,
      runAfter: now,
    });
    await writeAuditEvent(transaction, {
      invitationId,
      resourceType: "invitation",
      resourceId: invitationId,
      action: "invitation.grace_expired",
      metadata: {
        before_commercial_state: invitation.commercialState,
        after_commercial_state: CommercialState.DELETION_PENDING,
        grace_ends_at: invitation.graceEndsAt.toISOString(),
      },
      createdAt: now,
    });

    return {
      invitationId,
      previousCommercialState: invitation.commercialState,
      commercialState: CommercialState.DELETION_PENDING,
      previousPublicationState: invitation.publicationState,
      publicationState: PublicationState.UNPUBLISHED,
      graceEndsAt: invitation.graceEndsAt,
      changed: true,
    } satisfies GraceExpiryTransition;
  });

  if (result.changed && options.cache) {
    await options.cache.invalidateInvitation(result.invitationId);
  }
  return result;
}

export async function expireDueInvitationGrace(
  database: LifecycleReadDatabase & LifecycleDatabase,
  options: PaidExpiryOptions & { readonly limit?: number } = {},
): Promise<readonly GraceExpiryTransition[]> {
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Lifecycle clock is invalid");
  const limit = options.limit ?? 100;
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("Lifecycle sweep limit is invalid");

  const due = await database.invitation.findMany({
    where: {
      commercialState: CommercialState.GRACE,
      graceEndsAt: { lte: now },
    },
    orderBy: { graceEndsAt: "asc" },
    take: limit,
    select: { id: true },
  });

  return Promise.all(
    due.map(({ id }) => expireInvitationGrace(database, id, { ...options, now: () => now })),
  );
}
