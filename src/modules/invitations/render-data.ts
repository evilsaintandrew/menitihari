import {
  EventVisibility,
  GuestEventState,
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  getInvitationLifecycleCapabilities,
  isPublishedInvitationAvailable,
  isPublicInvitationAvailable,
} from "@/modules/lifecycle";
import {
  invitationContentSchema,
  INVITATION_LANGUAGES,
  type InvitationContent,
} from "./content";
import { eventContactSchema, type EventContact } from "@/modules/events";
import { ownerMembershipWhere } from "./authorization";
import {
  buildPersonalizedRsvpData,
  buildPublicRsvpData,
  type PersonalizedRsvpAssignmentRecord,
  type PersonalizedRsvpData,
  type PublicRsvpData,
} from "@/modules/rsvp";
import { getInvitedPeopleCapacity } from "@/modules/guests/capacity";
import { z } from "zod";

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
  rsvpEnabled: true,
  genericAccessEnabled: true,
  guestSharingEnabled: true,
  publicRsvpEnabled: true,
  publicRsvpRequireApproval: true,
  publicRsvpRequirePhone: true,
  publicRsvpMaxPartySize: true,
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
      contactFields: true,
      rsvpEnabled: true,
      publicRsvpEnabled: true,
      rsvpClosesAt: true,
      cancelledAt: true,
      cancellationMessage: true,
      archivedAt: true,
    },
  },
} satisfies Prisma.InvitationSelect;

export type InvitationRenderRecord = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof invitationRenderSelect },
  "findUnique"
>>;

export type InvitationRenderMode = "preview" | "public" | "personalized";

export interface InvitationGuestContext {
  readonly displayName: string;
}

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
  readonly contact: EventContact | null;
  readonly cancelledAt: string | null;
  readonly cancellationMessage: string | null;
}

export interface InvitationRenderData {
  readonly invitationId: string;
  readonly mode: InvitationRenderMode;
  /** Server-authoritative guest share affordance; never included in metadata. */
  readonly guestSharingEnabled: boolean;
  readonly language: "id" | "en";
  readonly timezone: string;
  readonly themeId: string;
  readonly themeVersion: string;
  readonly themeConfig: unknown;
  readonly content: InvitationContent;
  readonly events: readonly InvitationRenderEvent[];
  readonly guest: InvitationGuestContext | null;
  readonly rsvp: PersonalizedRsvpData | null;
  readonly publicRsvp: PublicRsvpData | null;
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
  if (!("id" in value) && !("en" in value)) return value;
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
  guest: InvitationGuestContext | null = null,
): InvitationRenderData {
  const events = record.events
    .filter((event) => event.archivedAt === null)
    .filter((event) => {
      if (mode === "personalized") {
        return true;
      }
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
      contact: eventContactSchema.safeParse(event.contactFields).success
        ? eventContactSchema.parse(event.contactFields)
        : null,
      cancelledAt: toIso(event.cancelledAt),
      cancellationMessage: event.cancellationMessage,
    }));

  return {
    invitationId: record.id,
    mode,
    guestSharingEnabled: mode === "personalized" && record.guestSharingEnabled,
    language: validLanguage(record.language),
    timezone: record.timezone,
    themeId: record.themeId,
    themeVersion: record.themeVersion,
    themeConfig: record.themeConfig,
    content: buildInvitationContent(record),
    events,
    guest: mode === "personalized" ? guest : null,
    rsvp: null,
    publicRsvp: null,
  };
}

type PublicInvitationReadDatabase = Pick<PrismaClient, "invitation" | "guestEvent">;

type PersonalizedInvitationReadDatabase = Pick<PrismaClient, "guest" | "invitation">;
type InvitationPreviewReadDatabase = Pick<PrismaClient, "guest" | "invitation">;

const personalizedPreviewGuestSelect = {
  displayName: true,
  eventAssignments: {
    where: {
      state: GuestEventState.ACTIVE,
      event: { archivedAt: null },
    },
    select: {
      id: true,
      eventId: true,
      maxPartySize: true,
      rsvpEligible: true,
      checkInEligible: true,
      publicRsvpApproval: true,
      rsvp: {
        select: {
          status: true,
          attendanceCount: true,
          notAttendingReason: true,
          source: true,
        },
      },
      event: {
        select: {
          id: true,
          name: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          rsvpEnabled: true,
          rsvpClosesAt: true,
          cancelledAt: true,
        },
      },
    },
  },
} satisfies Prisma.GuestSelect;

type PersonalizedPreviewGuestRecord = NonNullable<Prisma.Result<
  PrismaClient["guest"],
  { select: typeof personalizedPreviewGuestSelect },
  "findFirst"
>>;

const invitationPreviewGuestOptionsSelect = {
  guests: {
    where: {
      archivedAt: null,
      eventAssignments: {
        some: {
          state: GuestEventState.ACTIVE,
          event: { archivedAt: null },
        },
      },
    },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  },
} satisfies Prisma.InvitationSelect;

export interface InvitationPreviewGuestOption {
  readonly id: string;
  readonly displayName: string;
}

type InvitationPreviewGuestOptionsRecord = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof invitationPreviewGuestOptionsSelect },
  "findFirst"
>>;

const previewGuestIdSchema = z.string().trim().min(1).max(128);

function buildPersonalizedPreviewRenderData(
  record: InvitationRenderRecord,
  guest: PersonalizedPreviewGuestRecord,
): InvitationRenderData {
  const assignedEventIds = new Set(guest.eventAssignments.map(({ eventId }) => eventId));
  const renderData = buildInvitationRenderData(
    {
      ...record,
      events: record.events.filter(({ id }) => assignedEventIds.has(id)),
    },
    "personalized",
    { displayName: guest.displayName },
  );

  // Owner preview is read-only. The personalized invitation renderer remains
  // the presentation entry point, but guest RSVP mutations require a guest
  // session and therefore are intentionally not exposed in this context.
  return { ...renderData, guestSharingEnabled: false, rsvp: null };
}

export async function getPublicInvitationPageData(
  database: PublicInvitationReadDatabase,
  invitationId: string,
  now = new Date(),
): Promise<PublicInvitationPageData | null> {
  const record = await database.invitation.findUnique({
    where: { id: invitationId },
    select: invitationRenderSelect,
  });
  if (!record) return null;

  const available = isPublicInvitationAvailable(record, now);
  if (!available) return { available: false, renderData: null };

  const capacityRecord = await database.guestEvent.aggregate({
    where: { state: "ACTIVE", guest: { invitationId, archivedAt: null } },
    _sum: { maxPartySize: true },
  });
  const capacity = getInvitedPeopleCapacity(capacityRecord._sum.maxPartySize ?? 0);
  const renderData = buildInvitationRenderData(record, "public");
  return {
    available: true,
    renderData: {
      ...renderData,
      publicRsvp: buildPublicRsvpData(
        record,
        record.events,
        capacity,
        now,
      ),
    },
  };
}

export async function getInvitationPreviewRenderData(
  database: InvitationPreviewReadDatabase,
  userId: string,
  invitationId: string,
  guestId?: string,
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
  if (!capabilities.canPreviewPrivately) return null;
  if (guestId === undefined) return buildInvitationRenderData(record, "preview");
  const parsedGuestId = previewGuestIdSchema.safeParse(guestId);
  if (!parsedGuestId.success) return null;

  const guest = await database.guest.findFirst({
    where: {
      id: parsedGuestId.data,
      invitationId,
      archivedAt: null,
      eventAssignments: {
        some: {
          state: GuestEventState.ACTIVE,
          event: { invitationId, archivedAt: null },
        },
      },
    },
    select: personalizedPreviewGuestSelect,
  }) as PersonalizedPreviewGuestRecord | null;
  if (!guest) return null;

  return buildPersonalizedPreviewRenderData(record, guest);
}

export async function getInvitationPreviewGuestOptions(
  database: Pick<PrismaClient, "invitation">,
  userId: string,
  invitationId: string,
): Promise<readonly InvitationPreviewGuestOption[] | null> {
  const record = await database.invitation.findFirst({
    where: { id: invitationId, ...ownerMembershipWhere(userId) },
    select: invitationPreviewGuestOptionsSelect,
  }) as InvitationPreviewGuestOptionsRecord | null;
  return record?.guests ?? null;
}

/**
 * Composes only data authorized by the already-validated guest session.
 * This path deliberately does not use the generic public read or cache tag.
 */
export async function getPersonalizedInvitationPageData(
  database: PersonalizedInvitationReadDatabase,
  invitationId: string,
  guestId: string,
  now = new Date(),
): Promise<InvitationRenderData | null> {
  const guest = await database.guest.findFirst({
    where: { id: guestId, invitationId, archivedAt: null },
    select: {
      displayName: true,
      eventAssignments: {
        where: {
          state: "ACTIVE",
          event: { invitationId, archivedAt: null },
        },
        select: {
          id: true,
          eventId: true,
          maxPartySize: true,
          rsvpEligible: true,
          checkInEligible: true,
          publicRsvpApproval: true,
          rsvp: { select: { status: true, attendanceCount: true, notAttendingReason: true, source: true } },
          event: {
            select: {
              id: true,
              name: true,
              startsAt: true,
              endsAt: true,
              timezone: true,
              rsvpEnabled: true,
              rsvpClosesAt: true,
              cancelledAt: true,
            },
          },
        },
      },
    },
  });
  if (!guest) return null;

  const eventIds = guest.eventAssignments.map(({ eventId }) => eventId);
  const record = await database.invitation.findFirst({
    where: {
      id: invitationId,
      publicationState: "PUBLISHED",
      events: { some: { id: { in: eventIds }, archivedAt: null } },
    },
    select: {
      ...invitationRenderSelect,
      rsvpEnabled: true,
      events: {
        where: { id: { in: eventIds }, archivedAt: null },
        orderBy: { startsAt: "asc" },
        select: invitationRenderSelect.events.select,
      },
    },
  });
  if (!record || !isPublishedInvitationAvailable(record, now)) return null;

  const renderData = buildInvitationRenderData(record, "personalized", { displayName: guest.displayName });
  const pageData = {
    ...renderData,
    rsvp: buildPersonalizedRsvpData(
      record.rsvpEnabled,
      guest.eventAssignments as PersonalizedRsvpAssignmentRecord[],
      now,
    ),
  };

  // A successful personalized render is the only read signal the owner gets.
  // This is deliberately after the invitation/lifecycle checks and outside the
  // owner-preview path, which uses getInvitationPreviewRenderData above.
  await database.guest.updateMany({
    where: { id: guestId, invitationId, archivedAt: null },
    data: { lastViewedAt: now },
  });

  return pageData;
}
