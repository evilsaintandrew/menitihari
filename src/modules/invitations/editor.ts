import { CommercialState, Prisma, PublicationState, type PrismaClient } from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { getInvitationLifecycleCapabilities, isCommerciallyEditable } from "@/modules/lifecycle";
import { getThemeDefinition, isThemeConfigSupported, themeConfigSchema } from "@/modules/themes";
import { z } from "zod";

import { ownerMembershipWhere } from "./authorization";
import { invitationContentSchema, type InvitationContent } from "./content";

/**
 * Autosave sends a complete validated content snapshot. The invitation
 * version is checked in the same transaction as the content write.
 */
export const saveInvitationContentInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    content: invitationContentSchema,
    themeConfig: themeConfigSchema.optional(),
  })
  .strict();

export type SaveInvitationContentInput = z.infer<typeof saveInvitationContentInputSchema>;

export interface InvitationEditorCacheInvalidator {
  invalidateInvitation(invitationId: string): void | Promise<void>;
}

export interface SaveInvitationContentOptions {
  readonly cache?: InvitationEditorCacheInvalidator;
  readonly now?: () => Date;
}

export interface SaveInvitationContentResult {
  readonly invitationId: string;
  readonly version: number;
  readonly changed: boolean;
}

export interface InvitationEditorSnapshot {
  readonly invitationId: string;
  readonly ownerFacingTitle: string;
  readonly version: number;
  readonly publicationState: PublicationState;
  readonly commercialState: CommercialState;
  readonly trialEndsAt: Date;
  readonly activeUntil: Date | null;
  readonly canEdit: boolean;
}

const editorSnapshotSelect = {
  id: true,
  ownerFacingTitle: true,
  version: true,
  publicationState: true,
  commercialState: true,
  trialEndsAt: true,
  activeUntil: true,
  themeId: true,
  themeVersion: true,
  themeConfig: true,
} satisfies Prisma.InvitationSelect;

type EditorSnapshotRecord = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof editorSnapshotSelect },
  "findFirst"
>>;

type EditorReadDatabase = Pick<PrismaClient, "invitation">;
type EditorDatabase = Pick<PrismaClient, "$transaction">;

export async function getInvitationEditorSnapshot(
  database: EditorReadDatabase,
  userId: string,
  invitationId: string,
  now = new Date(),
): Promise<InvitationEditorSnapshot | null> {
  const invitation = await database.invitation.findFirst({
    where: { id: invitationId, ...ownerMembershipWhere(userId) },
    select: editorSnapshotSelect,
  });
  if (!invitation) return null;
  return toEditorSnapshot(invitation, now);
}

function toEditorSnapshot(
  invitation: EditorSnapshotRecord,
  now: Date,
): InvitationEditorSnapshot {
  return {
    invitationId: invitation.id,
    ownerFacingTitle: invitation.ownerFacingTitle,
    version: invitation.version,
    publicationState: invitation.publicationState,
    commercialState: invitation.commercialState,
    trialEndsAt: invitation.trialEndsAt,
    activeUntil: invitation.activeUntil,
    canEdit: isCommerciallyEditable(
      invitation.commercialState,
      invitation.trialEndsAt,
      now,
      invitation.activeUntil,
    ),
  };
}

function nullableJson(value: unknown): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  return value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function contentSections(content: InvitationContent): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  const sections = {
    ...(content.optional.socialLinks ? { socialLinks: content.optional.socialLinks } : {}),
    ...(content.optional.loveStory ? { loveStory: content.optional.loveStory } : {}),
  };
  return Object.keys(sections).length > 0 ? sections : Prisma.JsonNull;
}

export async function saveInvitationContent(
  database: EditorDatabase,
  userId: string,
  invitationId: string,
  input: SaveInvitationContentInput,
  options: SaveInvitationContentOptions = {},
): Promise<SaveInvitationContentResult> {
  const parsed = saveInvitationContentInputSchema.parse(input);
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Editor clock is invalid");

  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: {
        ...editorSnapshotSelect,
        version: true,
      },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);

    if (!getInvitationLifecycleCapabilities(
      invitation.commercialState,
      invitation.trialEndsAt,
      now,
      invitation.activeUntil,
    ).canEdit) {
      throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
    }

    const theme = getThemeDefinition(invitation.themeId, invitation.themeVersion);
    const persistedThemeConfig = themeConfigSchema.safeParse(invitation.themeConfig);
    const themeConfig = parsed.themeConfig ?? (persistedThemeConfig.success ? persistedThemeConfig.data : null);
    if (!theme || !themeConfig || !isThemeConfigSupported(theme, themeConfig)) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
    }

    const updated = await transaction.invitation.updateMany({
      where: {
        id: invitationId,
        ...ownerMembershipWhere(userId),
        version: parsed.expectedVersion,
      },
      data: {
        ownerFacingTitle: `${parsed.content.core.coupleDisplayName1} & ${parsed.content.core.coupleDisplayName2}`,
        coupleDisplayName1: parsed.content.core.coupleDisplayName1,
        coupleDisplayName2: parsed.content.core.coupleDisplayName2,
        language: parsed.content.language,
        fullNames: nullableJson(parsed.content.optional.fullNames),
        parentFields: nullableJson(parsed.content.optional.parentFields),
        themeConfig: themeConfig as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new DomainError(ERROR_CODES.STALE_VERSION, { retryable: true });
    }

    await transaction.invitationContent.upsert({
      where: { invitationId },
      create: {
        invitationId,
        opening: nullableJson(parsed.content.optional.opening),
        closing: nullableJson(parsed.content.optional.closing),
        quoteOrPrayer: nullableJson(parsed.content.optional.quoteOrPrayer),
        hashtag: parsed.content.optional.hashtag ?? null,
        sections: contentSections(parsed.content),
        sectionOrder: nullableJson(parsed.content.sectionOrder),
        coverMediaAssetId: parsed.content.coverMediaAssetId ?? null,
        shareCoverMediaAssetId: parsed.content.shareCoverMediaAssetId ?? null,
      },
      update: {
        opening: nullableJson(parsed.content.optional.opening),
        closing: nullableJson(parsed.content.optional.closing),
        quoteOrPrayer: nullableJson(parsed.content.optional.quoteOrPrayer),
        hashtag: parsed.content.optional.hashtag ?? null,
        sections: contentSections(parsed.content),
        sectionOrder: nullableJson(parsed.content.sectionOrder),
        coverMediaAssetId: parsed.content.coverMediaAssetId ?? null,
        shareCoverMediaAssetId: parsed.content.shareCoverMediaAssetId ?? null,
      },
    });

    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "invitation",
      resourceId: invitationId,
      action: "invitation.content_saved",
      metadata: {
        before_version: invitation.version,
        after_version: parsed.expectedVersion + 1,
      },
    });

    return {
      invitationId,
      version: parsed.expectedVersion + 1,
      changed: true,
    } satisfies SaveInvitationContentResult;
  });

  if (result.changed && options.cache) {
    await options.cache.invalidateInvitation(result.invitationId);
  }

  return result;
}
