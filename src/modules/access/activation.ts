import { createHash, randomBytes } from "node:crypto";

import {
  CommercialState,
  GuestAccessCredentialState,
  Prisma,
  PublicationState,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { ownerMembershipWhere } from "@/modules/invitations/authorization";
import { z } from "zod";

/** The raw token is deliberately only ever returned by credential issuance. */
export const guestActivationTokenSchema = z
  .string()
  .trim()
  .min(43)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

/** Guest sessions use the same short-lived baseline as shared-password access. */
export const GUEST_SESSION_SECONDS = 2 * 60 * 60;

interface ClockOptions {
  readonly now?: () => Date;
}

export interface GuestActivationOptions extends ClockOptions {
  /** Optional route context check; the token's invitation remains authoritative. */
  readonly invitationId?: string;
}

export interface GuestActivationCredentialResult {
  readonly guestId: string;
  readonly invitationId: string;
  readonly token: string;
  readonly version: number;
  readonly createdAt: Date;
}

export interface GuestActivationResult {
  readonly guestId: string;
  readonly invitationId: string;
  readonly sessionToken: string;
  readonly accessVersion: number;
  readonly expiresAt: Date;
}

export interface GuestSessionAccess {
  readonly invitationId: string;
  readonly accessVersion: number;
  readonly authorized: boolean;
  readonly guestId: string | null;
  readonly expiresAt: Date | null;
}

type AccessDatabase = Pick<PrismaClient, "$transaction">;
type AccessReadDatabase = Pick<PrismaClient, "invitation" | "guestSession">;

const activationCredentialSelect = {
  id: true,
  guestId: true,
  version: true,
  state: true,
  usedAt: true,
  revokedAt: true,
  expiresAt: true,
  guest: {
    select: {
      id: true,
      invitationId: true,
      archivedAt: true,
      invitation: {
        select: {
          id: true,
          accessVersion: true,
          publicationState: true,
          commercialState: true,
          trialEndsAt: true,
          activeUntil: true,
        },
      },
    },
  },
} satisfies Prisma.GuestActivationCredentialSelect;

const guestSessionInvitationSelect = {
  id: true,
  accessVersion: true,
} satisfies Prisma.InvitationSelect;

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Exposed for credential-link builders; this function never returns a raw token. */
export function digestGuestActivationToken(token: string): string {
  return digest(guestActivationTokenSchema.parse(token));
}

function assertValidDate(now: Date): void {
  if (!Number.isFinite(now.getTime())) throw new Error("Guest access clock is invalid");
}

function isPersonalizedInvitationAvailable(
  invitation: {
    readonly publicationState: PublicationState;
    readonly commercialState: CommercialState;
    readonly trialEndsAt: Date;
    readonly activeUntil: Date | null;
  },
  now: Date,
): boolean {
  if (invitation.publicationState !== PublicationState.PUBLISHED) return false;
  return (
    invitation.commercialState === CommercialState.TRIAL &&
    invitation.trialEndsAt.getTime() > now.getTime()
  ) || (
    invitation.commercialState === CommercialState.PAID_ACTIVE &&
    invitation.activeUntil !== null &&
    invitation.activeUntil.getTime() > now.getTime()
  );
}

function isInvitationEditable(
  invitation: {
    readonly commercialState: CommercialState;
    readonly trialEndsAt: Date;
    readonly activeUntil: Date | null;
  },
  now: Date,
): boolean {
  return (
    invitation.commercialState === CommercialState.TRIAL &&
    invitation.trialEndsAt.getTime() > now.getTime()
  ) || (
    invitation.commercialState === CommercialState.PAID_ACTIVE &&
    invitation.activeUntil !== null &&
    invitation.activeUntil.getTime() > now.getTime()
  );
}

function invalidActivation(): never {
  throw new DomainError(ERROR_CODES.FORBIDDEN);
}

/**
 * Creates a credential inside a caller-owned transaction. The raw token is
 * returned only to the caller that is issuing the link; only its digest is
 * persisted.
 */
export async function issueGuestActivationCredentialInTransaction(
  transaction: Prisma.TransactionClient,
  invitationId: string,
  guestId: string,
  now: Date,
  actorId: string | null = null,
): Promise<GuestActivationCredentialResult> {
  const token = randomBytes(32).toString("base64url");
  const tokenDigest = digest(token);

  const latest = await transaction.guestActivationCredential.findFirst({
    where: { guestId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  await transaction.guestActivationCredential.updateMany({
    where: { guestId, state: GuestAccessCredentialState.ISSUED, usedAt: null, revokedAt: null },
    data: { state: GuestAccessCredentialState.REVOKED, revokedAt: now },
  });

  const created = await transaction.guestActivationCredential.create({
    data: { guestId, version, digest: tokenDigest, state: GuestAccessCredentialState.ISSUED },
    select: { version: true, createdAt: true },
  });

  await writeAuditEvent(transaction, {
    actorId,
    invitationId,
    resourceType: "guest",
    resourceId: guestId,
    action: "guest.activation_issued",
    metadata: { version: created.version },
    createdAt: now,
  });

  return { guestId, invitationId, token, version: created.version, createdAt: created.createdAt };
}

/**
 * Issues a new guest activation credential. Existing issued credentials are
 * revoked in the same transaction, so regeneration makes the previous link
 * unusable without retaining the raw token.
 */
export async function issueGuestActivationCredential(
  database: AccessDatabase,
  userId: string,
  invitationId: string,
  guestId: string,
  options: ClockOptions = {},
): Promise<GuestActivationCredentialResult> {
  const now = options.now?.() ?? new Date();
  assertValidDate(now);

  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, version: true, commercialState: true, trialEndsAt: true, activeUntil: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (!isInvitationEditable(invitation, now)) {
      throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
    }

    const guest = await transaction.guest.findFirst({
      where: { id: guestId, invitationId, archivedAt: null },
      select: { id: true },
    });
    if (!guest) throw new DomainError(ERROR_CODES.NOT_FOUND);

    // Touching the invitation first serializes credential issuance with other
    // invitation-owned mutations and gives this credential a monotonic version.
    await transaction.invitation.update({
      where: { id: invitationId },
      data: { version: { increment: 1 } },
    });

    const credential = await issueGuestActivationCredentialInTransaction(transaction, invitationId, guestId, now, userId);
    return credential;
  });
}

export const regenerateGuestActivationCredential = issueGuestActivationCredential;
export const createGuestActivationCredential = issueGuestActivationCredential;

/**
 * Atomically consumes an issued credential and creates a scoped guest session.
 * The conditional update is the single-use guard under concurrent requests.
 */
export async function activateGuest(
  database: AccessDatabase,
  rawToken: string,
  options: GuestActivationOptions = {},
): Promise<GuestActivationResult> {
  const parsedToken = guestActivationTokenSchema.safeParse(rawToken);
  if (!parsedToken.success) invalidActivation();

  const now = options.now?.() ?? new Date();
  assertValidDate(now);
  const tokenDigest = digest(parsedToken.data);
  const sessionToken = randomBytes(32).toString("base64url");
  const sessionDigest = digest(sessionToken);
  const expiresAt = new Date(now.getTime() + GUEST_SESSION_SECONDS * 1_000);

  return database.$transaction(async (transaction) => {
    const credential = await transaction.guestActivationCredential.findUnique({
      where: { digest: tokenDigest },
      select: activationCredentialSelect,
    });
    const invitation = credential?.guest.invitation;
    if (
      !credential ||
      credential.guest.archivedAt !== null ||
      credential.guest.invitationId !== invitation?.id ||
      !invitation ||
      (options.invitationId !== undefined && invitation.id !== options.invitationId) ||
      !isPersonalizedInvitationAvailable(invitation, now)
    ) invalidActivation();

    if (
      credential.state !== GuestAccessCredentialState.ISSUED ||
      credential.usedAt !== null ||
      credential.revokedAt !== null
    ) invalidActivation();
    if (credential.expiresAt !== null && credential.expiresAt.getTime() <= now.getTime()) {
      await transaction.guestActivationCredential.updateMany({
        where: { id: credential.id, state: GuestAccessCredentialState.ISSUED, usedAt: null, revokedAt: null },
        data: { state: GuestAccessCredentialState.EXPIRED },
      });
      invalidActivation();
    }

    const consumed = await transaction.guestActivationCredential.updateMany({
      where: {
        id: credential.id,
        digest: tokenDigest,
        state: GuestAccessCredentialState.ISSUED,
        usedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { state: GuestAccessCredentialState.USED, usedAt: now },
    });
    if (consumed.count !== 1) invalidActivation();

    await transaction.guestSession.create({
      data: {
        guestId: credential.guestId,
        invitationId: invitation.id,
        sessionDigest,
        accessVersion: invitation.accessVersion,
        expiresAt,
      },
    });

    return {
      guestId: credential.guestId,
      invitationId: invitation.id,
      sessionToken,
      accessVersion: invitation.accessVersion,
      expiresAt,
    };
  });
}

export const consumeGuestActivation = activateGuest;

/** Reads a session without returning guest PII or any credential material. */
export async function getGuestSessionAccess(
  database: AccessReadDatabase,
  invitationId: string,
  sessionToken: string | undefined,
  now = new Date(),
): Promise<GuestSessionAccess | null> {
  assertValidDate(now);
  const invitation = await database.invitation.findUnique({
    where: { id: invitationId },
    select: guestSessionInvitationSelect,
  });
  if (!invitation) return null;

  if (!sessionToken || sessionToken.length > 256) {
    return { invitationId, accessVersion: invitation.accessVersion, authorized: false, guestId: null, expiresAt: null };
  }

  const session = await database.guestSession.findFirst({
    where: {
      invitationId,
      sessionDigest: digest(sessionToken),
      accessVersion: invitation.accessVersion,
      revokedAt: null,
      expiresAt: { gt: now },
      guest: { invitationId, archivedAt: null },
    },
    select: { guestId: true, expiresAt: true },
  });

  return {
    invitationId,
    accessVersion: invitation.accessVersion,
    authorized: Boolean(session),
    guestId: session?.guestId ?? null,
    expiresAt: session?.expiresAt ?? null,
  };
}

export function guestSessionCookieName(invitationId: string): string {
  return `menitihari_guest_${digest(invitationId).slice(0, 16)}`;
}
