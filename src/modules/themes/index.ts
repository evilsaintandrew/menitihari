import {
  CommercialState,
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { isCommerciallyEditable } from "@/modules/lifecycle";
import { ownerMembershipWhere } from "@/modules/invitations/authorization";
import { z } from "zod";

export const THEME_VERSIONS = ["1"] as const;
export const CURRENT_THEME_VERSION = "1" as const;

export const THEME_IDS = [
  "classic",
  "botanical",
  "minimal",
  "modern",
  "rustic",
  "elegant",
  "floral",
  "terracotta",
  "ocean",
  "monochrome",
] as const;

export const themeIdSchema = z.enum(THEME_IDS);
export const themeVersionSchema = z.enum(THEME_VERSIONS);
export type ThemeId = z.infer<typeof themeIdSchema>;
export type ThemeVersion = z.infer<typeof themeVersionSchema>;

const THEME_ACCENTS = [
  "rose",
  "sage",
  "sand",
  "indigo",
  "terracotta",
  "plum",
  "blush",
  "copper",
  "ocean",
  "ink",
] as const;

const FONT_PAIRINGS = [
  "serif-sans",
  "display-sans",
  "sans-serif",
  "script-sans",
] as const;

const COVER_STYLES = ["centered", "editorial", "framed", "full-bleed"] as const;
const SECTION_STYLES = ["soft", "airy", "lined", "panelled"] as const;

/** Curated presentation controls. No lifecycle or invitation business rules belong here. */
export const themeConfigSchema = z
  .object({
    accent: z.enum(THEME_ACCENTS),
    fontPairing: z.enum(FONT_PAIRINGS),
    coverStyle: z.enum(COVER_STYLES),
    sectionStyle: z.enum(SECTION_STYLES),
  })
  .strict();

export type ThemeConfig = z.infer<typeof themeConfigSchema>;

const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);

const themePreviewSchema = z
  .object({
    backgroundColor: hexColorSchema,
    foregroundColor: hexColorSchema,
    accentColor: hexColorSchema,
  })
  .strict();

export type ThemePreview = z.infer<typeof themePreviewSchema>;

export const themeDefinitionSchema = z
  .object({
    id: themeIdSchema,
    version: themeVersionSchema,
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(240),
    defaultConfig: themeConfigSchema,
    preview: themePreviewSchema,
  })
  .strict();

export interface ThemeDefinition extends z.infer<typeof themeDefinitionSchema> {}

const launchThemeDefinitions = [
  {
    id: "classic",
    version: "1",
    name: "Klasik Mutiara",
    description: "Hangat, seimbang, dan cocok untuk cerita pernikahan yang tak lekang waktu.",
    defaultConfig: { accent: "rose", fontPairing: "serif-sans", coverStyle: "centered", sectionStyle: "soft" },
    preview: { backgroundColor: "#fff8f5", foregroundColor: "#402b35", accentColor: "#bd7185" },
  },
  {
    id: "botanical",
    version: "1",
    name: "Botanical",
    description: "Nuansa daun yang tenang dengan ruang lapang untuk momen-momen penting.",
    defaultConfig: { accent: "sage", fontPairing: "serif-sans", coverStyle: "editorial", sectionStyle: "airy" },
    preview: { backgroundColor: "#f5f8f1", foregroundColor: "#294437", accentColor: "#6d956d" },
  },
  {
    id: "minimal",
    version: "1",
    name: "Minimal",
    description: "Bersih dan ringan agar nama serta tanggal acara menjadi pusat perhatian.",
    defaultConfig: { accent: "sand", fontPairing: "sans-serif", coverStyle: "centered", sectionStyle: "airy" },
    preview: { backgroundColor: "#fbfaf7", foregroundColor: "#30302d", accentColor: "#b59e77" },
  },
  {
    id: "modern",
    version: "1",
    name: "Modern",
    description: "Kontras segar dan tata letak tegas untuk pasangan dengan gaya kontemporer.",
    defaultConfig: { accent: "indigo", fontPairing: "display-sans", coverStyle: "full-bleed", sectionStyle: "panelled" },
    preview: { backgroundColor: "#f2f4ff", foregroundColor: "#242947", accentColor: "#5969d8" },
  },
  {
    id: "rustic",
    version: "1",
    name: "Rustic",
    description: "Palet bumi dan detail sederhana untuk suasana perayaan yang akrab.",
    defaultConfig: { accent: "terracotta", fontPairing: "serif-sans", coverStyle: "framed", sectionStyle: "lined" },
    preview: { backgroundColor: "#fbf3e9", foregroundColor: "#553a2b", accentColor: "#be7853" },
  },
  {
    id: "elegant",
    version: "1",
    name: "Elegan",
    description: "Kesan formal yang lembut dengan tipografi berkarakter dan aksen mewah.",
    defaultConfig: { accent: "plum", fontPairing: "display-sans", coverStyle: "editorial", sectionStyle: "lined" },
    preview: { backgroundColor: "#f8f4fa", foregroundColor: "#38253d", accentColor: "#8e629c" },
  },
  {
    id: "floral",
    version: "1",
    name: "Floral",
    description: "Ceria dan romantis dengan warna lembut untuk kisah yang penuh bunga.",
    defaultConfig: { accent: "blush", fontPairing: "script-sans", coverStyle: "full-bleed", sectionStyle: "soft" },
    preview: { backgroundColor: "#fff4f8", foregroundColor: "#552b43", accentColor: "#df86a8" },
  },
  {
    id: "terracotta",
    version: "1",
    name: "Senja",
    description: "Hangat seperti cahaya sore, dengan karakter santai dan penuh keakraban.",
    defaultConfig: { accent: "copper", fontPairing: "serif-sans", coverStyle: "framed", sectionStyle: "panelled" },
    preview: { backgroundColor: "#fff1e7", foregroundColor: "#5a3025", accentColor: "#c96c49" },
  },
  {
    id: "ocean",
    version: "1",
    name: "Samudra",
    description: "Teduh dan lapang dengan warna biru yang memberi rasa damai.",
    defaultConfig: { accent: "ocean", fontPairing: "sans-serif", coverStyle: "full-bleed", sectionStyle: "airy" },
    preview: { backgroundColor: "#eff8fa", foregroundColor: "#234451", accentColor: "#4c9eb0" },
  },
  {
    id: "monochrome",
    version: "1",
    name: "Monokrom",
    description: "Modern, fokus, dan tak lekang oleh waktu dengan permainan hitam-putih.",
    defaultConfig: { accent: "ink", fontPairing: "display-sans", coverStyle: "editorial", sectionStyle: "lined" },
    preview: { backgroundColor: "#f4f4f2", foregroundColor: "#222222", accentColor: "#5e5e5a" },
  },
] as const;

export const themeRegistrySchema = z
  .array(themeDefinitionSchema)
  .length(THEME_IDS.length)
  .superRefine((themes, context) => {
    if (new Set(themes.map((theme) => theme.id)).size !== themes.length) {
      context.addIssue({ code: "custom", message: "Theme ids must be unique" });
    }
  });

/** The complete launch registry consumed by the theme picker and future renderers. */
export const THEME_REGISTRY: readonly ThemeDefinition[] = Object.freeze(
  themeRegistrySchema.parse(launchThemeDefinitions),
);

/** Alias that makes the launch scope explicit at call sites. */
export const LAUNCH_THEMES = THEME_REGISTRY;

const themesById = new Map(THEME_REGISTRY.map((theme) => [theme.id, theme]));

export function getThemeDefinition(
  themeId: string,
  themeVersion = CURRENT_THEME_VERSION,
): ThemeDefinition | null {
  const theme = themesById.get(themeId as ThemeId);
  return theme?.version === themeVersion ? theme : null;
}

export function getDefaultThemeConfig(themeId: ThemeId): ThemeConfig {
  return getThemeDefinition(themeId)?.defaultConfig ?? THEME_REGISTRY[0].defaultConfig;
}

export function parseThemeConfig(value: unknown): ThemeConfig {
  return themeConfigSchema.parse(value);
}

export const themeSelectionInputSchema = z
  .object({
    themeId: themeIdSchema,
    themeConfig: themeConfigSchema.optional(),
  })
  .strict();

export type ThemeSelectionInput = z.infer<typeof themeSelectionInputSchema>;

export function resolveThemeSelection(input: ThemeSelectionInput): {
  readonly theme: ThemeDefinition;
  readonly themeConfig: ThemeConfig;
} {
  const theme = getThemeDefinition(input.themeId);
  if (!theme) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);

  return { theme, themeConfig: input.themeConfig ?? theme.defaultConfig };
}

export function canUseTheme(
  commercialState: CommercialState,
  trialEndsAt: Date | null | undefined,
  activeUntil: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!Number.isFinite(now.getTime())) return false;
  return isCommerciallyEditable(commercialState, trialEndsAt, now, activeUntil);
}

const themePickerSelect = {
  id: true,
  coupleDisplayName1: true,
  coupleDisplayName2: true,
  themeId: true,
  themeVersion: true,
  themeConfig: true,
  commercialState: true,
  trialEndsAt: true,
  activeUntil: true,
} satisfies Prisma.InvitationSelect;

type ThemePickerInvitation = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof themePickerSelect },
  "findFirst"
>>;

type ThemeReadDatabase = Pick<PrismaClient, "invitation">;
type ThemeDatabase = Pick<PrismaClient, "$transaction">;

export interface ThemePickerData {
  readonly invitationId: string;
  readonly coupleDisplayName1: string;
  readonly coupleDisplayName2: string;
  readonly selectedThemeId: string;
  readonly selectedThemeVersion: string;
  readonly commercialState: CommercialState;
  readonly canEdit: boolean;
}

export async function getInvitationThemePicker(
  database: ThemeReadDatabase,
  userId: string,
  invitationId: string,
  options: { readonly now?: Date } = {},
): Promise<ThemePickerData | null> {
  const invitation = await database.invitation.findFirst({
    where: { id: invitationId, ...ownerMembershipWhere(userId) },
    select: themePickerSelect,
  });
  if (!invitation) return null;

  return toThemePickerData(invitation, options.now ?? new Date());
}

function toThemePickerData(invitation: ThemePickerInvitation, now: Date): ThemePickerData {
  return {
    invitationId: invitation.id,
    coupleDisplayName1: invitation.coupleDisplayName1,
    coupleDisplayName2: invitation.coupleDisplayName2,
    selectedThemeId: invitation.themeId,
    selectedThemeVersion: invitation.themeVersion,
    commercialState: invitation.commercialState,
    canEdit: canUseTheme(invitation.commercialState, invitation.trialEndsAt, invitation.activeUntil, now),
  };
}

export interface ThemeSelectionCacheInvalidator {
  invalidateInvitation(invitationId: string): void | Promise<void>;
}

export interface ThemeSelectionOptions {
  readonly cache?: ThemeSelectionCacheInvalidator;
  readonly now?: () => Date;
}

export interface ThemeSelectionResult {
  readonly invitationId: string;
  readonly previousThemeId: string;
  readonly themeId: ThemeId;
  readonly themeVersion: ThemeVersion;
  readonly themeConfig: ThemeConfig;
  readonly changed: boolean;
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function selectInvitationTheme(
  database: ThemeDatabase,
  userId: string,
  invitationId: string,
  input: ThemeSelectionInput,
  options: ThemeSelectionOptions = {},
): Promise<ThemeSelectionResult> {
  const parsedInput = themeSelectionInputSchema.parse(input);
  const { theme, themeConfig } = resolveThemeSelection(parsedInput);
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Theme selection clock is invalid");

  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { ...themePickerSelect, version: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);

    if (!canUseTheme(invitation.commercialState, invitation.trialEndsAt, invitation.activeUntil, now)) {
      throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
    }

    const currentConfig = themeConfigSchema.safeParse(invitation.themeConfig);
    const unchanged =
      invitation.themeId === theme.id &&
      invitation.themeVersion === theme.version &&
      currentConfig.success &&
      sameJsonValue(currentConfig.data, themeConfig);

    if (unchanged) {
      return {
        invitationId,
        previousThemeId: invitation.themeId,
        themeId: theme.id,
        themeVersion: theme.version,
        themeConfig,
        changed: false,
      } satisfies ThemeSelectionResult;
    }

    const updated = await transaction.invitation.updateMany({
      where: {
        id: invitationId,
        ...ownerMembershipWhere(userId),
        version: invitation.version,
      },
      data: {
        themeId: theme.id,
        themeVersion: theme.version,
        themeConfig: themeConfig as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new DomainError(ERROR_CODES.STALE_VERSION, { retryable: true });

    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "invitation",
      resourceId: invitationId,
      action: "invitation.theme_changed",
      metadata: {
        before_theme: invitation.themeId,
        after_theme: theme.id,
        before_version: invitation.themeVersion,
        after_version: theme.version,
      },
    });

    return {
      invitationId,
      previousThemeId: invitation.themeId,
      themeId: theme.id,
      themeVersion: theme.version,
      themeConfig,
      changed: true,
    } satisfies ThemeSelectionResult;
  });

  if (result.changed && options.cache) {
    await options.cache.invalidateInvitation(result.invitationId);
  }

  return result;
}
