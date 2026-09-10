import { z } from "zod";

/** Languages supported by one invitation. An invitation has one language. */
export const INVITATION_LANGUAGES = ["id", "en"] as const;
export const invitationLanguageSchema = z.enum(INVITATION_LANGUAGES);
export type InvitationLanguage = z.infer<typeof invitationLanguageSchema>;

const DISPLAY_NAME_MAX_LENGTH = 120;
const SHORT_TEXT_MAX_LENGTH = 240;
const LONG_TEXT_MAX_LENGTH = 5_000;
const URL_MAX_LENGTH = 2_048;
const MEDIA_ASSET_ID_MAX_LENGTH = 128;
export const MAX_LOVE_STORY_MILESTONES = 5;

const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(DISPLAY_NAME_MAX_LENGTH);

const shortTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(SHORT_TEXT_MAX_LENGTH);

const longTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(LONG_TEXT_MAX_LENGTH);

const optionalShortTextSchema = shortTextSchema.optional();
const optionalLongTextSchema = longTextSchema.optional();

/** Required presentation-neutral identity content. */
export const invitationCoreSectionSchema = z
  .object({
    coupleDisplayName1: displayNameSchema,
    coupleDisplayName2: displayNameSchema,
  })
  .strict();

export type InvitationCoreSection = z.infer<typeof invitationCoreSectionSchema>;

const personNamesSchema = z
  .object({
    person1: optionalShortTextSchema,
    person2: optionalShortTextSchema,
  })
  .strict();

const parentDetailsSchema = z
  .object({
    father: optionalShortTextSchema,
    mother: optionalShortTextSchema,
  })
  .strict();

const parentFieldsSchema = z
  .object({
    person1: parentDetailsSchema.optional(),
    person2: parentDetailsSchema.optional(),
  })
  .strict();

const socialLinksSchema = z
  .object({
    instagram: z.url().max(URL_MAX_LENGTH).optional(),
    facebook: z.url().max(URL_MAX_LENGTH).optional(),
    tiktok: z.url().max(URL_MAX_LENGTH).optional(),
    youtube: z.url().max(URL_MAX_LENGTH).optional(),
    website: z.url().max(URL_MAX_LENGTH).optional(),
  })
  .strict();

export const loveStoryMilestoneSchema = z
  .object({
    date: optionalShortTextSchema,
    title: shortTextSchema,
    description: optionalLongTextSchema,
  })
  .strict();

export type LoveStoryMilestone = z.infer<typeof loveStoryMilestoneSchema>;

const loveStorySchema = z
  .object({
    milestones: z.array(loveStoryMilestoneSchema).max(MAX_LOVE_STORY_MILESTONES),
  })
  .strict();

/** Optional semantic content. Theme-specific values do not belong here. */
export const invitationOptionalSectionsSchema = z
  .object({
    fullNames: personNamesSchema.optional(),
    parentFields: parentFieldsSchema.optional(),
    opening: optionalLongTextSchema,
    closing: optionalLongTextSchema,
    quoteOrPrayer: optionalLongTextSchema,
    hashtag: optionalShortTextSchema,
    socialLinks: socialLinksSchema.optional(),
    loveStory: loveStorySchema.optional(),
  })
  .strict();

export type InvitationOptionalSections = z.infer<typeof invitationOptionalSectionsSchema>;

export const INVITATION_SECTION_IDS = [
  "couple",
  "events",
  "opening_closing",
  "love_story",
  "gallery",
  "music",
  "gift",
  "rsvp",
  "guestbook",
] as const;

export const invitationSectionIdSchema = z.enum(INVITATION_SECTION_IDS);
export type InvitationSectionId = z.infer<typeof invitationSectionIdSchema>;

const sectionOrderSchema = z
  .array(invitationSectionIdSchema)
  .max(INVITATION_SECTION_IDS.length)
  .superRefine((sectionIds, context) => {
    if (new Set(sectionIds).size !== sectionIds.length) {
      context.addIssue({
        code: "custom",
        message: "sectionOrder must not contain duplicate sections",
      });
    }
  });

const mediaAssetIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MEDIA_ASSET_ID_MAX_LENGTH);

/**
 * Presentation-neutral invitation content shared by preview and public
 * rendering. Theme id, version, and configuration are intentionally absent.
 */
export const invitationContentSchema = z
  .object({
    language: invitationLanguageSchema,
    core: invitationCoreSectionSchema,
    optional: invitationOptionalSectionsSchema.default({}),
    sectionOrder: sectionOrderSchema.optional(),
    coverMediaAssetId: mediaAssetIdSchema.optional(),
    shareCoverMediaAssetId: mediaAssetIdSchema.optional(),
  })
  .strict();

export type InvitationContent = z.infer<typeof invitationContentSchema>;

export function parseInvitationContent(value: unknown): InvitationContent {
  return invitationContentSchema.parse(value);
}
