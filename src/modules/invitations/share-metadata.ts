import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { isPublicInvitationAvailable } from "@/modules/lifecycle";

const shareMetadataSelect = {
  id: true,
  coupleDisplayName1: true,
  coupleDisplayName2: true,
  language: true,
  timezone: true,
  publicationState: true,
  commercialState: true,
  trialEndsAt: true,
  activeUntil: true,
  genericAccessEnabled: true,
  sharedPasswordHash: true,
  primaryEvent: {
    select: {
      startsAt: true,
      timezone: true,
    },
  },
  content: {
    select: {
      coverMediaAssetId: true,
      shareCoverMediaAssetId: true,
    },
  },
} satisfies Prisma.InvitationSelect;

export type InvitationShareMetadataRecord = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof shareMetadataSelect },
  "findUnique"
>>;

export interface InvitationShareMetadataContext {
  readonly available: boolean;
  readonly invitationId: string;
  readonly coupleDisplayName1: string;
  readonly coupleDisplayName2: string;
  readonly language: "id" | "en";
  readonly timezone: string;
  readonly primaryEventStartsAt: Date | null;
  readonly primaryEventTimezone: string;
  readonly passwordProtected: boolean;
  readonly coverMediaAssetId: string | null;
  readonly shareCoverMediaAssetId: string | null;
}

export interface InvitationShareMetadata {
  readonly title: string;
  readonly description: string;
  readonly imageAlt: string;
  readonly imagePath: string;
  readonly robots: {
    readonly index: false;
    readonly follow: false;
  };
  readonly privacyMode: "named" | "generic";
  readonly coverSource: "default" | "invitation" | "selected";
}

export function formatPrimaryEventDate(
  startsAt: Date | null,
  timezone: string,
  language: "id" | "en" = "id",
): string | null {
  if (!(startsAt instanceof Date) || !Number.isFinite(startsAt.getTime())) return null;

  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", {
      day: "numeric",
      month: "long",
      timeZone: timezone,
      year: "numeric",
    }).format(startsAt);
  } catch {
    return null;
  }
}

export function buildInvitationShareMetadata(input: {
  readonly slug: string;
  readonly coupleDisplayName1: string;
  readonly coupleDisplayName2: string;
  readonly language: "id" | "en";
  readonly timezone: string;
  readonly primaryEventStartsAt: Date | null;
  readonly primaryEventTimezone?: string;
  readonly available?: boolean;
  readonly passwordProtected: boolean;
  readonly coverMediaAssetId?: string | null;
  readonly shareCoverMediaAssetId?: string | null;
}): InvitationShareMetadata {
  const imagePath = `/${encodeURIComponent(input.slug)}/opengraph-image`;
  const privacyMode = input.passwordProtected || input.available === false ? "generic" : "named";
  const coverSource = privacyMode === "generic"
    ? "default"
    : input.shareCoverMediaAssetId
      ? "selected"
      : input.coverMediaAssetId
        ? "invitation"
        : "default";

  if (privacyMode === "generic") {
    return {
      title: "Undangan pernikahan",
      description: "Buka undangan untuk melihat detail acara.",
      imageAlt: "Undangan pernikahan",
      imagePath,
      robots: { index: false, follow: false },
      privacyMode,
      coverSource,
    };
  }

  const coupleNames = `${input.coupleDisplayName1} & ${input.coupleDisplayName2}`;
  const primaryDate = formatPrimaryEventDate(
    input.primaryEventStartsAt,
    input.primaryEventTimezone ?? input.timezone,
    input.language,
  );

  return {
    title: coupleNames,
    description: primaryDate
      ? `Undangan pernikahan ${coupleNames} pada ${primaryDate}.`
      : `Undangan pernikahan ${coupleNames}.`,
    imageAlt: `Undangan pernikahan ${coupleNames}`,
    imagePath,
    robots: { index: false, follow: false },
    privacyMode,
    coverSource,
  };
}

export function buildInvitationShareMetadataContext(
  record: InvitationShareMetadataRecord,
  now = new Date(),
): InvitationShareMetadataContext {
  const available = isPublicInvitationAvailable({
    publicationState: record.publicationState,
    commercialState: record.commercialState,
    genericAccessEnabled: record.genericAccessEnabled,
    trialEndsAt: record.trialEndsAt,
    activeUntil: record.activeUntil,
  }, now);

  return {
    available,
    invitationId: record.id,
    coupleDisplayName1: record.coupleDisplayName1,
    coupleDisplayName2: record.coupleDisplayName2,
    language: record.language === "en" ? "en" : "id",
    timezone: record.timezone,
    primaryEventStartsAt: record.primaryEvent?.startsAt ?? null,
    primaryEventTimezone: record.primaryEvent?.timezone ?? record.timezone,
    passwordProtected: Boolean(record.sharedPasswordHash),
    coverMediaAssetId: record.content?.coverMediaAssetId ?? null,
    shareCoverMediaAssetId: record.content?.shareCoverMediaAssetId ?? null,
  };
}

type ShareMetadataReadDatabase = Pick<PrismaClient, "invitation">;

export async function getInvitationShareMetadataContext(
  database: ShareMetadataReadDatabase,
  invitationId: string,
  now = new Date(),
): Promise<InvitationShareMetadataContext | null> {
  const record = await database.invitation.findUnique({
    where: { id: invitationId },
    select: shareMetadataSelect,
  });
  return record ? buildInvitationShareMetadataContext(record, now) : null;
}

export function isShareMetadataPubliclyNamed(context: InvitationShareMetadataContext): boolean {
  return context.available && !context.passwordProtected;
}
