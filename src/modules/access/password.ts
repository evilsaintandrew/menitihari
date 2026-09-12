import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import {
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import {
  isCommerciallyEditable,
  isPublicInvitationAvailable,
  isPublishedInvitationAvailable,
} from "@/modules/lifecycle";
import { ownerMembershipWhere } from "@/modules/invitations/authorization";
import { z } from "zod";

const PASSWORD_HASH_ALGORITHM = "scrypt" as const;
const PASSWORD_HASH_KEY_LENGTH = 32;
const PASSWORD_HASH_SALT_LENGTH = 16;
const PASSWORD_HASH_N = 16_384;
const PASSWORD_HASH_R = 8;
const PASSWORD_HASH_P = 1;

export const SHARED_PASSWORD_MIN_LENGTH = 8;
export const SHARED_PASSWORD_MAX_LENGTH = 128;
export const INVITATION_PASSWORD_SESSION_SECONDS = 2 * 60 * 60;

export const sharedPasswordSchema = z
  .string({ error: "Masukkan password." })
  .min(SHARED_PASSWORD_MIN_LENGTH, { error: "Password minimal 8 karakter." })
  .max(SHARED_PASSWORD_MAX_LENGTH, { error: "Password maksimal 128 karakter." });

const passwordHashPartsSchema = z.tuple([
  z.literal(PASSWORD_HASH_ALGORITHM),
  z.coerce.number().int().positive(),
  z.coerce.number().int().positive(),
  z.coerce.number().int().positive(),
  z.string().regex(/^[0-9a-f]+$/),
  z.string().regex(/^[0-9a-f]+$/),
]);

const passwordInvitationSelect = {
  id: true,
  sharedPasswordHash: true,
  accessVersion: true,
  publicationState: true,
  commercialState: true,
  genericAccessEnabled: true,
  trialEndsAt: true,
  activeUntil: true,
} satisfies Prisma.InvitationSelect;

type PasswordInvitationRecord = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof passwordInvitationSelect },
  "findUnique"
>>;

type AccessReadDatabase = Pick<PrismaClient, "invitation" | "invitationPasswordSession">;
type AccessDatabase = Pick<PrismaClient, "$transaction">;

interface ClockOptions {
  readonly now?: () => Date;
}

export interface InvitationPasswordSessionOptions extends ClockOptions {
  readonly mode?: InvitationPasswordAccessMode;
}

export interface InvitationPasswordSessionResult {
  readonly sessionToken: string;
  readonly expiresAt: Date;
  readonly accessVersion: number;
}

export interface InvitationPasswordAccess {
  readonly available: boolean;
  readonly passwordRequired: boolean;
  readonly authorized: boolean;
  readonly accessVersion: number | null;
}

export type InvitationPasswordAccessMode = "generic" | "personalized";

export interface InvitationPasswordAccessOptions {
  readonly mode?: InvitationPasswordAccessMode;
}

export interface InvitationSharingSettings {
  readonly invitationId: string;
  readonly genericAccessEnabled: boolean;
  readonly passwordEnabled: boolean;
  readonly guestSharingEnabled: boolean;
}

export interface InvitationPasswordChangeResult extends InvitationSharingSettings {
  readonly changed: boolean;
  readonly accessVersion: number;
}

export interface InvitationPasswordChangeOptions extends ClockOptions {
  readonly cache?: { invalidateInvitation(invitationId: string): void | Promise<void> };
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  parameters: { readonly N: number; readonly r: number; readonly p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, { ...parameters, maxmem: 32 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** Hashes a password using a versioned, salted scrypt encoding. */
export async function hashSharedPassword(password: string): Promise<string> {
  const parsed = sharedPasswordSchema.parse(password);
  const salt = randomBytes(PASSWORD_HASH_SALT_LENGTH);
  const derivedKey = await deriveKey(parsed, salt, PASSWORD_HASH_KEY_LENGTH, {
    N: PASSWORD_HASH_N,
    r: PASSWORD_HASH_R,
    p: PASSWORD_HASH_P,
  });

  return [
    PASSWORD_HASH_ALGORITHM,
    PASSWORD_HASH_N,
    PASSWORD_HASH_R,
    PASSWORD_HASH_P,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

function decodePasswordHash(encoded: string): {
  readonly salt: Buffer;
  readonly expected: Buffer;
  readonly N: number;
  readonly r: number;
  readonly p: number;
} | null {
  const parts = passwordHashPartsSchema.safeParse(encoded.split("$"));
  if (!parts.success) return null;

  const [, N, r, p, saltHex, expectedHex] = parts.data;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (
    salt.length !== PASSWORD_HASH_SALT_LENGTH ||
    expected.length !== PASSWORD_HASH_KEY_LENGTH ||
    N !== PASSWORD_HASH_N ||
    r !== PASSWORD_HASH_R ||
    p !== PASSWORD_HASH_P
  ) return null;

  return { salt, expected, N, r, p };
}

/** Returns false for malformed, unsupported, or incorrect passwords. */
export async function verifySharedPassword(password: string, encoded: string): Promise<boolean> {
  const parsedPassword = sharedPasswordSchema.safeParse(password);
  const decoded = decodePasswordHash(encoded);
  if (!parsedPassword.success || !decoded) return false;

  const derivedKey = await deriveKey(parsedPassword.data, decoded.salt, decoded.expected.length, {
    N: decoded.N,
    r: decoded.r,
    p: decoded.p,
  });
  return timingSafeEqual(decoded.expected, derivedKey);
}

function assertValidDate(now: Date): void {
  if (!Number.isFinite(now.getTime())) throw new Error("Access clock is invalid");
}

function isInvitationAvailable(
  invitation: PasswordInvitationRecord,
  now: Date,
  mode: InvitationPasswordAccessMode,
): boolean {
  return mode === "personalized"
    ? isPublishedInvitationAvailable(invitation, now)
    : isPublicInvitationAvailable(invitation, now);
}

/** Reads only authorization state; the password hash is never returned. */
export async function getInvitationPasswordAccess(
  database: AccessReadDatabase,
  invitationId: string,
  sessionToken?: string,
  now = new Date(),
  options: InvitationPasswordAccessOptions = {},
): Promise<InvitationPasswordAccess | null> {
  assertValidDate(now);
  const mode = options.mode ?? "generic";
  const invitation = await database.invitation.findUnique({
    where: { id: invitationId },
    select: passwordInvitationSelect,
  });
  if (!invitation) return null;

  const available = isInvitationAvailable(invitation, now, mode);
  if (!available) {
    return {
      available: false,
      passwordRequired: Boolean(invitation.sharedPasswordHash),
      authorized: false,
      accessVersion: invitation.accessVersion,
    };
  }
  if (!invitation.sharedPasswordHash) {
    return {
      available: true,
      passwordRequired: false,
      authorized: true,
      accessVersion: invitation.accessVersion,
    };
  }
  if (!sessionToken || sessionToken.length > 256) {
    return {
      available: true,
      passwordRequired: true,
      authorized: false,
      accessVersion: invitation.accessVersion,
    };
  }

  const session = await database.invitationPasswordSession.findFirst({
    where: {
      invitationId,
      sessionDigest: digest(sessionToken),
      accessVersion: invitation.accessVersion,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: { id: true },
  });
  return {
    available: true,
    passwordRequired: true,
    authorized: Boolean(session),
    accessVersion: invitation.accessVersion,
  };
}

/** Creates a short-lived invitation-scoped session after server-side verification. */
export async function createInvitationPasswordSession(
  database: AccessDatabase,
  invitationId: string,
  password: string,
  options: InvitationPasswordSessionOptions = {},
): Promise<InvitationPasswordSessionResult> {
  const parsedPassword = sharedPasswordSchema.parse(password);
  const now = options.now?.() ?? new Date();
  assertValidDate(now);
  const mode = options.mode ?? "generic";
  const sessionToken = randomBytes(32).toString("base64url");
  const sessionDigest = digest(sessionToken);
  const expiresAt = new Date(now.getTime() + INVITATION_PASSWORD_SESSION_SECONDS * 1_000);

  const session = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findUnique({
      where: { id: invitationId },
      select: passwordInvitationSelect,
    });
    if (
      !invitation ||
      !isInvitationAvailable(invitation, now, mode) ||
      !invitation.sharedPasswordHash ||
      !(await verifySharedPassword(parsedPassword, invitation.sharedPasswordHash))
    ) throw new DomainError(ERROR_CODES.FORBIDDEN);

    return transaction.invitationPasswordSession.create({
      data: { invitationId, sessionDigest, accessVersion: invitation.accessVersion, expiresAt },
      select: { accessVersion: true, expiresAt: true },
    });
  });
  return { sessionToken, expiresAt: session.expiresAt, accessVersion: session.accessVersion };
}

export async function getInvitationSharingSettings(
  database: Pick<PrismaClient, "invitation">,
  userId: string,
  invitationId: string,
): Promise<InvitationSharingSettings | null> {
  const invitation = await database.invitation.findFirst({
    where: { id: invitationId, ...ownerMembershipWhere(userId) },
    select: {
      id: true,
      genericAccessEnabled: true,
      sharedPasswordHash: true,
      guestSharingEnabled: true,
    },
  });
  if (!invitation) return null;
  return {
    invitationId: invitation.id,
    genericAccessEnabled: invitation.genericAccessEnabled,
    passwordEnabled: Boolean(invitation.sharedPasswordHash),
    guestSharingEnabled: invitation.guestSharingEnabled,
  };
}

/** Bumps accessVersion atomically so prior password sessions stop authorizing. */
export async function setInvitationSharedPassword(
  database: AccessDatabase,
  userId: string,
  invitationId: string,
  password: string | null,
  options: InvitationPasswordChangeOptions = {},
): Promise<InvitationPasswordChangeResult> {
  const parsedPassword = password === null ? null : sharedPasswordSchema.parse(password);
  const passwordHash = parsedPassword === null ? null : await hashSharedPassword(parsedPassword);
  const now = options.now?.() ?? new Date();
  assertValidDate(now);

  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: {
        id: true,
        sharedPasswordHash: true,
        accessVersion: true,
        genericAccessEnabled: true,
        guestSharingEnabled: true,
        commercialState: true,
        trialEndsAt: true,
        activeUntil: true,
      },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (!isCommerciallyEditable(invitation.commercialState, invitation.trialEndsAt, now, invitation.activeUntil)) {
      throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
    }

    const currentlyEnabled = Boolean(invitation.sharedPasswordHash);
    if (parsedPassword === null && !currentlyEnabled) {
      return {
        invitationId,
        genericAccessEnabled: invitation.genericAccessEnabled,
        passwordEnabled: false,
        guestSharingEnabled: invitation.guestSharingEnabled,
        changed: false,
        accessVersion: invitation.accessVersion,
      } satisfies InvitationPasswordChangeResult;
    }

    const updated = await transaction.invitation.updateMany({
      where: { id: invitationId, ...ownerMembershipWhere(userId), accessVersion: invitation.accessVersion },
      data: {
        sharedPasswordHash: passwordHash,
        accessVersion: { increment: 1 },
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new DomainError(ERROR_CODES.STALE_VERSION, { retryable: true });

    const nextPasswordEnabled = passwordHash !== null;
    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "invitation",
      resourceId: invitationId,
      action: nextPasswordEnabled
        ? currentlyEnabled ? "invitation.password_changed" : "invitation.password_enabled"
        : "invitation.password_disabled",
      metadata: {
        before_enabled: currentlyEnabled,
        after_enabled: nextPasswordEnabled,
        before_access_version: invitation.accessVersion,
        after_access_version: invitation.accessVersion + 1,
      },
      createdAt: now,
    });

    return {
      invitationId,
      genericAccessEnabled: invitation.genericAccessEnabled,
      passwordEnabled: nextPasswordEnabled,
      guestSharingEnabled: invitation.guestSharingEnabled,
      changed: true,
      accessVersion: invitation.accessVersion + 1,
    } satisfies InvitationPasswordChangeResult;
  });

  if (result.changed && options.cache) await options.cache.invalidateInvitation(invitationId);
  return result;
}

export function invitationPasswordSessionCookieName(invitationId: string): string {
  return `menitihari_password_${digest(invitationId).slice(0, 16)}`;
}
