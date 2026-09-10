import {
  CommercialState,
  InvitationRole,
  Prisma,
  PublicationState,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { z } from "zod";
import { ownerMembershipWhere } from "./authorization";
import {
  INVITATION_SLUG_MAX_LENGTH,
  isUniqueConstraintError,
  suggestInvitationSlug,
} from "./slugs";

export * from "./publication";
export * from "./slugs";
export * from "./deletion";
export { publicInvitationCacheTag } from "./public-cache";
export { ownerMembershipWhere } from "./authorization";

export const INVITATION_TRIAL_DAYS = 3;
export const INVITATION_TRIAL_DURATION_MS = INVITATION_TRIAL_DAYS * 24 * 60 * 60 * 1_000;
export const LAUNCH_PRICE_AMOUNT = 79_000;
export const LAUNCH_PRICE_CURRENCY = "IDR";
export const DEFAULT_INVITATION_LANGUAGE = "id";
export const DEFAULT_INVITATION_TIMEZONE = "Asia/Jakarta";
export const DEFAULT_INVITATION_THEME_ID = "classic";
export const DEFAULT_INVITATION_THEME_VERSION = "1";
export const DEFAULT_PRIMARY_EVENT_NAME = "Acara Utama";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const createInvitationInputSchema = z.object({
  coupleDisplayName1: z
    .string({ error: "Masukkan nama tampilan pasangan pertama." })
    .trim()
    .min(1, { error: "Masukkan nama tampilan pasangan pertama." })
    .max(120, { error: "Nama tampilan terlalu panjang." }),
  coupleDisplayName2: z
    .string({ error: "Masukkan nama tampilan pasangan kedua." })
    .trim()
    .min(1, { error: "Masukkan nama tampilan pasangan kedua." })
    .max(120, { error: "Nama tampilan terlalu panjang." }),
  mainEventDate: z
    .string({ error: "Pilih tanggal acara utama." })
    .trim()
    .regex(isoDatePattern, { error: "Masukkan tanggal acara yang valid." })
    .refine(isValidCalendarDate, { error: "Masukkan tanggal acara yang valid." }),
}).strict();

export type CreateInvitationInput = z.infer<typeof createInvitationInputSchema>;

export interface CreatedInvitation {
  readonly id: string;
  readonly ownerFacingTitle: string;
  readonly coupleDisplayName1: string;
  readonly coupleDisplayName2: string;
  readonly publicationState: PublicationState;
  readonly commercialState: CommercialState;
  readonly trialStartedAt: Date;
  readonly trialEndsAt: Date;
  readonly priceLockedAmount: string;
  readonly currency: string;
  readonly primaryEventId: string;
  readonly slug: string;
}

export interface CreateInvitationOptions {
  readonly now?: () => Date;
}

type InvitationDatabase = Pick<PrismaClient, "$transaction">;

type InvitationReadDatabase = Pick<PrismaClient, "invitation">;

export function calculateTrialEndsAt(trialStartedAt: Date): Date {
  return new Date(trialStartedAt.getTime() + INVITATION_TRIAL_DURATION_MS);
}

/** Convert the date-only WF-04 input to midnight in the invitation timezone. */
export function mainEventDateToInstant(mainEventDate: string): Date {
  return new Date(`${mainEventDate}T00:00:00+07:00`);
}

/** Invitation ownership policy: callers authorize through OWNER membership. */
export async function getInvitationForOwner(
  database: InvitationReadDatabase,
  userId: string,
  invitationId: string,
): Promise<{ readonly coupleDisplayName1: string; readonly coupleDisplayName2: string } | null> {
  return database.invitation.findFirst({
    where: {
      id: invitationId,
      ...ownerMembershipWhere(userId),
    },
    select: { coupleDisplayName1: true, coupleDisplayName2: true },
  });
}

export async function createInvitation(
  database: InvitationDatabase,
  userId: string,
  input: CreateInvitationInput,
  options: CreateInvitationOptions = {},
): Promise<CreatedInvitation> {
  const parsed = createInvitationInputSchema.parse(input);
  const trialStartedAt = options.now?.() ?? new Date();
  const trialEndsAt = calculateTrialEndsAt(trialStartedAt);
  const ownerFacingTitle = `${parsed.coupleDisplayName1} & ${parsed.coupleDisplayName2}`;
  const mainEventStartsAt = mainEventDateToInstant(parsed.mainEventDate);
  const suggestedSlug = suggestInvitationSlug(parsed.coupleDisplayName1, parsed.coupleDisplayName2);

  if (!Number.isFinite(trialStartedAt.getTime())) {
    throw new Error("Invitation creation clock is invalid");
  }

  for (let slugAttempt = 0; slugAttempt < 100; slugAttempt += 1) {
    try {
      return await database.$transaction(async (transaction) => {
    const owner = await transaction.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, deletionState: true },
    });

    if (!owner || !owner.emailVerified || owner.deletionState !== "ACTIVE") {
      throw new DomainError(ERROR_CODES.FORBIDDEN);
    }

    const invitation = await transaction.invitation.create({
      data: {
        ownerFacingTitle,
        coupleDisplayName1: parsed.coupleDisplayName1,
        coupleDisplayName2: parsed.coupleDisplayName2,
        language: DEFAULT_INVITATION_LANGUAGE,
        timezone: DEFAULT_INVITATION_TIMEZONE,
        themeId: DEFAULT_INVITATION_THEME_ID,
        themeVersion: DEFAULT_INVITATION_THEME_VERSION,
        themeConfig: {},
        publicationState: PublicationState.DRAFT,
        commercialState: CommercialState.TRIAL,
        trialStartedAt,
        trialEndsAt,
        priceLockedAmount: LAUNCH_PRICE_AMOUNT.toFixed(2),
        currency: LAUNCH_PRICE_CURRENCY,
      },
    });

    const slug = slugCandidateForCreation(suggestedSlug, slugAttempt);
    await transaction.invitationSlug.create({
      data: { invitationId: invitation.id, slug, isCanonical: true },
    });

    await transaction.invitationMember.create({
      data: { invitationId: invitation.id, userId, role: InvitationRole.OWNER },
    });

    const primaryEvent = await transaction.event.create({
      data: {
        invitationId: invitation.id,
        name: DEFAULT_PRIMARY_EVENT_NAME,
        startsAt: mainEventStartsAt,
        timezone: DEFAULT_INVITATION_TIMEZONE,
        isPrimary: true,
      },
    });

    await transaction.invitationContent.create({ data: { invitationId: invitation.id } });

    const linkedInvitation = await transaction.invitation.update({
      where: { id: invitation.id },
      data: { primaryEventId: primaryEvent.id },
      select: {
        id: true,
        ownerFacingTitle: true,
        coupleDisplayName1: true,
        coupleDisplayName2: true,
        publicationState: true,
        commercialState: true,
        trialStartedAt: true,
        trialEndsAt: true,
        priceLockedAmount: true,
        currency: true,
        primaryEventId: true,
        slugs: {
          where: { isCanonical: true },
          select: { slug: true },
          take: 1,
        },
      },
    });

    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId: linkedInvitation.id,
      resourceType: "invitation",
      resourceId: linkedInvitation.id,
      action: "invitation.created",
    });

    if (!linkedInvitation.primaryEventId || !linkedInvitation.priceLockedAmount || !linkedInvitation.slugs[0]) {
      throw new Error("Invitation creation did not persist required commercial fields");
    }

    return {
      ...linkedInvitation,
      priceLockedAmount: new Prisma.Decimal(linkedInvitation.priceLockedAmount).toFixed(2),
      primaryEventId: linkedInvitation.primaryEventId,
      slug: linkedInvitation.slugs[0].slug,
    };
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && slugAttempt < 99) continue;
      throw error;
    }
  }

  throw new Error("Invitation slug allocation exhausted");
}

function slugCandidateForCreation(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = `-${attempt + 1}`;
  return `${base.slice(0, INVITATION_SLUG_MAX_LENGTH - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
