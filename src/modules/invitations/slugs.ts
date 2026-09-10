import type { PrismaClient } from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { isCommerciallyEditable } from "@/modules/lifecycle";
import { z } from "zod";

import { ownerMembershipWhere } from "./authorization";
import type { PublicCacheInvalidator } from "./publication";

export const INVITATION_SLUG_MAX_LENGTH = 80;

const invitationSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reservedInvitationSlugs = new Set([
  "_next",
  "account",
  "api",
  "favicon.ico",
  "forgot-password",
  "health",
  "invitations",
  "login",
  "ready",
  "reset-password",
  "signup",
  "verify-email",
]);

export function normalizeInvitationSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, INVITATION_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

export function suggestInvitationSlug(coupleDisplayName1: string, coupleDisplayName2: string): string {
  return normalizeInvitationSlug(`${coupleDisplayName1} ${coupleDisplayName2}`) || "undangan";
}

export const invitationSlugInputSchema = z
  .string({ error: "Masukkan alamat link undangan." })
  .trim()
  .min(1, { error: "Masukkan alamat link undangan." })
  .max(INVITATION_SLUG_MAX_LENGTH, { error: "Alamat link terlalu panjang." })
  .transform(normalizeInvitationSlug)
  .refine((value) => invitationSlugPattern.test(value), {
    error: "Gunakan huruf kecil, angka, dan tanda hubung (-).",
  })
  .refine((value) => !reservedInvitationSlugs.has(value), {
    error: "Alamat link ini tidak dapat digunakan.",
  });

export type InvitationSlugInput = z.infer<typeof invitationSlugInputSchema>;

export interface InvitationSlugSnapshot {
  readonly invitationId: string;
  readonly canonicalSlug: string;
  readonly aliases: readonly string[];
}

export interface InvitationSlugUpdate {
  readonly invitationId: string;
  readonly previousSlug: string;
  readonly canonicalSlug: string;
  readonly changed: boolean;
}

export interface InvitationSlugServiceOptions {
  readonly cache: PublicCacheInvalidator;
}

type InvitationSlugReadDatabase = Pick<PrismaClient, "invitationSlug">;
type InvitationSlugDatabase = Pick<PrismaClient, "$transaction">;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function getInvitationSlugForOwner(
  database: InvitationSlugReadDatabase,
  userId: string,
  invitationId: string,
): Promise<InvitationSlugSnapshot | null> {
  const slugs = await database.invitationSlug.findMany({
    where: {
      invitationId,
      invitation: ownerMembershipWhere(userId),
    },
    orderBy: [{ isCanonical: "desc" }, { createdAt: "asc" }],
    select: { slug: true, isCanonical: true },
  });

  const canonical = slugs.find((slug) => slug.isCanonical);
  if (!canonical) return null;

  return {
    invitationId,
    canonicalSlug: canonical.slug,
    aliases: slugs.filter((slug) => !slug.isCanonical).map((slug) => slug.slug),
  };
}

export interface PublicSlugResolution {
  readonly invitationId: string;
  readonly requestedSlug: string;
  readonly canonicalSlug: string;
  readonly isCanonical: boolean;
}

export async function resolveInvitationSlug(
  database: InvitationSlugReadDatabase,
  slug: string,
): Promise<PublicSlugResolution | null> {
  const record = await database.invitationSlug.findUnique({
    where: { slug },
    select: {
      invitationId: true,
      slug: true,
      isCanonical: true,
      invitation: {
        select: {
          slugs: {
            where: { isCanonical: true },
            select: { slug: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!record) return null;
  const canonical = record.isCanonical ? record.slug : record.invitation.slugs[0]?.slug;
  if (!canonical) return null;

  return {
    invitationId: record.invitationId,
    requestedSlug: record.slug,
    canonicalSlug: canonical,
    isCanonical: record.isCanonical,
  };
}

export function isInvitationSlugPathSegment(value: string): boolean {
  return invitationSlugPattern.test(value) && !reservedInvitationSlugs.has(value);
}

async function updateCanonicalSlug(
  database: InvitationSlugDatabase,
  userId: string,
  invitationId: string,
  canonicalSlug: InvitationSlugInput,
): Promise<InvitationSlugUpdate> {
  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: {
        id: true,
        commercialState: true,
        trialEndsAt: true,
        activeUntil: true,
        slugs: {
          where: { isCanonical: true },
          select: { id: true, slug: true },
          take: 1,
        },
      },
    });

    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (!isCommerciallyEditable(
      invitation.commercialState,
      invitation.trialEndsAt,
      new Date(),
      invitation.activeUntil,
    )) {
      throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
    }

    const current = invitation.slugs[0];
    if (!current) throw new DomainError(ERROR_CODES.CONFLICT);
    if (current.slug === canonicalSlug) {
      return {
        invitationId,
        previousSlug: current.slug,
        canonicalSlug: current.slug,
        changed: false,
      };
    }

    await transaction.invitationSlug.update({
      where: { id: current.id },
      data: { isCanonical: false },
    });

    await transaction.invitationSlug.create({
      data: {
        invitationId,
        slug: canonicalSlug,
        isCanonical: true,
      },
    });

    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "invitation",
      resourceId: invitationId,
      action: "invitation.slug_changed",
      metadata: { before_slug: current.slug, after_slug: canonicalSlug },
    });

    return {
      invitationId,
      previousSlug: current.slug,
      canonicalSlug,
      changed: true,
    };
  });
}

export async function updateInvitationSlug(
  database: InvitationSlugDatabase,
  userId: string,
  invitationId: string,
  input: unknown,
  options: InvitationSlugServiceOptions,
): Promise<InvitationSlugUpdate> {
  const canonicalSlug = invitationSlugInputSchema.parse(input);

  try {
    const result = await updateCanonicalSlug(database, userId, invitationId, canonicalSlug);
    if (result.changed) await options.cache.invalidateInvitation(invitationId);
    return result;
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new DomainError(ERROR_CODES.CONFLICT);
    throw error;
  }
}

export { isUniqueConstraintError };
