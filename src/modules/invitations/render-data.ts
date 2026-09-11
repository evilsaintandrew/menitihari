import {
  EventVisibility,
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  getInvitationLifecycleCapabilities,
  isPublicInvitationAvailable,
} from "@/modules/lifecycle";
import {
  invitationContentSchema,
  INVITATION_LANGUAGES,
  type InvitationContent,
} from "./content";
import { ownerMembershipWhere } from "./authorization";

const invitationRenderSelect = {
  id: true,
  coupleDisplayName1: true,
  coupleDisplayName2: true,
  fullNames: true,
  parentFields: true,
  language: true,
  timezone: true,
  themeId: true,
  themeVersion: true,
  themeConfig: true,
  publicationState: true,
  commercialState: true,
  trialEndsAt: true,
  activeUntil: true,
  genericAccessEnabled: true,
  content: {
    select: {
      opening: true,
      closing: true,
      quoteOrPrayer: true,
      hashtag: true,
      sections: true,
      sectionOrder: true,
      coverMediaAssetId: true,
      shareCoverMediaAssetId: true,
    },
  },
  events: {
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      visibility: true,
      venue: true,
      address: true,
      mapsUrl: true,
      locationNote: true,
      livestreamUrl: true,
      dressCode: true,
      cancelledAt: true,
      archivedAt: true,
    },
  },
} satisfies Prisma.InvitationSelect;

export type InvitationRenderRecord = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof invitationRenderSelect },
  "findUnique"
>>;

export type InvitationRenderMode = "preview" | "public";

export interface InvitationRenderEvent {
  readonly id: string;
  readonly name: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly timezone: string;
  readonly venue: string | null;
  readonly address: string | null;
  readonly mapsUrl: string | null;
  readonly locationNote: string | null;
  readonly livestreamUrl: string | null;
  readonly dressCode: string | null;
}

export interface InvitationRenderData {
  readonly invitationId: string;
  readonly mode: InvitationRenderMode;
  readonly language: "id" | "en";
  readonly timezone: string;
  readonly themeId: string;
  readonly themeVersion: string;
  readonly themeConfig: unknown;
  readonly content: InvitationContent;
  readonly events: readonly InvitationRenderEvent[];
}

export interface PublicInvitationPageData {
  readonly available: boolean;
  readonly renderData: InvitationRenderData | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function languageValue(value: unknown, language: string): unknown {
  if (!isRecord(value)) return value;
  return value[language] ?? value.id ?? value.en;
}

function validLanguage(value: string): "id" | "en" {
  return (INVITATION_LANGUAGES as readonly string[]).includes(value)
    ? (value as "id" | "en")
    : "id";
}

function buildInvitationContent(record: InvitationRenderRecord): InvitationContent {
  const language = validLanguage(record.language);
  const sectionValues = isRecord(record.content?.sections)
    ? record.content.sections
    : {};
  const candidate = {
    language,
    core: {
      coupleDisplayName1: record.coupleDisplayName1,
      coupleDisplayName2: record.coupleDisplayName2,
    },
    optional: {
      fullNames: languageValue(record.fullNames ?? sectionValues.fullNames, language),
      parentFields: languageValue(record.parentFields ?? sectionValues.parentFields, language),
      opening: languageValue(record.content?.opening ?? sectionValues.opening, language),
      closing: languageValue(record.content?.closing ?? sectionValues.closing, language),
      quoteOrPrayer: languageValue(
        record.content?.quoteOrPrayer ?? sectionValues.quoteOrPrayer,
        language,
      ),
      hashtag: record.content?.hashtag ?? sectionValues.hashtag,
      socialLinks: languageValue(sectionValues.socialLinks, language),
      loveStory: languageValue(sectionValues.loveStory, language),
    },
    sectionOrder: record.content?.sectionOrder ?? undefined,
    coverMediaAssetId: record.content?.coverMediaAssetId ?? undefined,
    shareCoverMediaAssetId: record.content?.shareCoverMediaAssetId ?? undefined,
  };
  const parsed = invitationContentSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  // Persisted JSON can predate the current content contract. Keep the core
  // invitation renderable and discard only malformed optional presentation data.
  return invitationContentSchema.parse({
    language,
    core: candidate.core,
  });
}

function toIso(value: Date | null): string | null {
  return value instanceof Date && Number.isFinite(value.getTime())
    ? value.toISOString()
    : null;
}

export function buildInvitationRenderData(
  record: InvitationRenderRecord,
  mode: InvitationRenderMode,
): InvitationRenderData {
  const events = record.events
    .filter((event) => event.cancelledAt === null && event.archivedAt === null)
    // Owner preview is the generic public view. A future guest-preview mode
    // must provide an explicitly scoped guest model rather than widening this
    // shared public renderer input.
    .filter((event) => {
      if (mode === "preview" || mode === "public") {
        return event.visibility === EventVisibility.GENERIC;
      }
      return false;
    })
    .filter((event) => toIso(event.startsAt) !== null)
    .map((event) => ({
      id: event.id,
      name: event.name,
      startsAt: toIso(event.startsAt) as string,
      endsAt: toIso(event.endsAt),
      timezone: event.timezone,
      venue: event.venue,
      address: event.address,
      mapsUrl: event.mapsUrl,
      locationNote: event.locationNote,
      livestreamUrl: event.livestreamUrl,
      dressCode: event.dressCode,
    }));

  return {
    invitationId: record.id,
    mode,
    language: validLanguage(record.language),
    timezone: record.timezone,
    themeId: record.themeId,
    themeVersion: record.themeVersion,
    themeConfig: record.themeConfig,
    content: buildInvitationContent(record),
    events,
  };
}

type InvitationRenderReadDatabase = Pick<PrismaClient, "invitation">;

export async function getPublicInvitationPageData(
  database: InvitationRenderReadDatabase,
  invitationId: string,
  now = new Date(),
): Promise<PublicInvitationPageData | null> {
  const record = await database.invitation.findUnique({
    where: { id: invitationId },
    select: invitationRenderSelect,
  });
  if (!record) return null;

  const available = isPublicInvitationAvailable(record, now);
  return {
    available,
    renderData: available ? buildInvitationRenderData(record, "public") : null,
  };
}

export async function getInvitationPreviewRenderData(
  database: InvitationRenderReadDatabase,
  userId: string,
  invitationId: string,
): Promise<InvitationRenderData | null> {
  const record = await database.invitation.findFirst({
    where: { id: invitationId, ...ownerMembershipWhere(userId) },
    select: invitationRenderSelect,
  });
  if (!record) return null;

  const capabilities = getInvitationLifecycleCapabilities(
    record.commercialState,
    record.trialEndsAt,
    new Date(),
    record.activeUntil,
  );
  return capabilities.canPreviewPrivately
    ? buildInvitationRenderData(record, "preview")
    : null;
}
