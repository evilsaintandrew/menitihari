import {
  Prisma,
  WhatsAppTemplateType,
  type PrismaClient,
} from "@/generated/prisma/client";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { getInvitationLifecycleCapabilities } from "@/modules/lifecycle";
import { ownerMembershipWhere } from "@/modules/invitations/authorization";
import { z } from "zod";

/** The template body is user-authored content, but remains bounded for wa.me URLs. */
export const WHATSAPP_TEMPLATE_MAX_BODY_LENGTH = 4_096;

/**
 * Placeholder names are an internal contract shared with the renderer ticket.
 * They intentionally contain presentation-safe values only; credentials and
 * guest contact details never belong in a WhatsApp template.
 */
export const WHATSAPP_TEMPLATE_PLACEHOLDERS = [
  "guest_name",
  "couple_name",
  "invitation_url",
  "event_name",
  "event_date",
  "event_time",
  "event_venue",
] as const;

export type WhatsAppTemplatePlaceholder = (typeof WHATSAPP_TEMPLATE_PLACEHOLDERS)[number];
export type WhatsAppTemplateKind = WhatsAppTemplateType;

const placeholderSet = new Set<string>(WHATSAPP_TEMPLATE_PLACEHOLDERS);
const placeholderPattern = /\{([^{}]*)\}/g;
const templateTypes = [
  WhatsAppTemplateType.INVITATION,
  WhatsAppTemplateType.RSVP_REMINDER,
  WhatsAppTemplateType.EVENT_REMINDER,
] as const;

export const whatsappTemplateTypeSchema = z.nativeEnum(WhatsAppTemplateType);

export const whatsappTemplateBodySchema = z
  .string()
  .trim()
  .min(1, "Template tidak boleh kosong.")
  .max(WHATSAPP_TEMPLATE_MAX_BODY_LENGTH, "Template terlalu panjang.")
  .superRefine((body, context) => {
    const placeholders = [...body.matchAll(placeholderPattern)];
    const unmatchedBraces = body.replace(placeholderPattern, "");
    if (/[{}]/.test(unmatchedBraces)) {
      context.addIssue({
        code: "custom",
        message: "Gunakan placeholder dengan format {nama_placeholder}.",
      });
    }

    for (const match of placeholders) {
      const placeholder = match[1];
      if (!placeholderSet.has(placeholder)) {
        context.addIssue({
          code: "custom",
          message: `Placeholder {${placeholder}} tidak didukung.`,
        });
      }
    }
  });

export const updateWhatsAppTemplateInputSchema = z
  .object({ body: whatsappTemplateBodySchema })
  .strict();

export type UpdateWhatsAppTemplateInput = z.infer<typeof updateWhatsAppTemplateInputSchema>;

export interface WhatsAppTemplateItem {
  readonly id: string;
  readonly invitationId: string;
  readonly type: WhatsAppTemplateType;
  readonly body: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpdateWhatsAppTemplateResult extends WhatsAppTemplateItem {
  readonly changed: boolean;
}

export const DEFAULT_WHATSAPP_TEMPLATES: Readonly<Record<WhatsAppTemplateType, string>> = {
  [WhatsAppTemplateType.INVITATION]:
    "Kepada {guest_name}, kami mengundang Anda ke pernikahan {couple_name}. Lihat undangan: {invitation_url}",
  [WhatsAppTemplateType.RSVP_REMINDER]:
    "Halo {guest_name}, mohon konfirmasi kehadiran Anda di undangan {couple_name}: {invitation_url}",
  [WhatsAppTemplateType.EVENT_REMINDER]:
    "Halo {guest_name}, jangan lupa menghadiri {event_name} pada {event_date} pukul {event_time} di {event_venue}. Lihat detail: {invitation_url}",
};

const templateSelect = {
  id: true,
  invitationId: true,
  type: true,
  body: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WhatsAppTemplateSelect;

type TemplateRecord = Prisma.WhatsAppTemplateGetPayload<{ select: typeof templateSelect }>;
type TemplateReadDatabase = Pick<PrismaClient, "whatsAppTemplate">;
type TemplateDatabase = Pick<PrismaClient, "$transaction">;

/** Return unique placeholder names in their first-appearance order. */
export function extractWhatsAppTemplatePlaceholders(body: string): readonly WhatsAppTemplatePlaceholder[] {
  const values: WhatsAppTemplatePlaceholder[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(placeholderPattern)) {
    const placeholder = match[1];
    if (placeholderSet.has(placeholder) && !seen.has(placeholder)) {
      seen.add(placeholder);
      values.push(placeholder as WhatsAppTemplatePlaceholder);
    }
  }
  return values;
}

export function isWhatsAppTemplateType(value: string): value is WhatsAppTemplateType {
  return templateTypes.includes(value as WhatsAppTemplateType);
}

export function defaultWhatsAppTemplateBody(type: WhatsAppTemplateType): string {
  return DEFAULT_WHATSAPP_TEMPLATES[type];
}

export function defaultWhatsAppTemplateRows(invitationId: string): Prisma.WhatsAppTemplateCreateManyInput[] {
  return templateTypes.map((type) => ({
    invitationId,
    type,
    body: defaultWhatsAppTemplateBody(type),
  }));
}

function toTemplateItem(template: TemplateRecord): WhatsAppTemplateItem {
  return template;
}

/** Read the invitation's complete template set through the owner boundary. */
export async function getWhatsAppTemplates(
  database: TemplateReadDatabase,
  userId: string,
  invitationId: string,
): Promise<readonly WhatsAppTemplateItem[] | null> {
  const ownedInvitation = await database.whatsAppTemplate.findFirst({
    where: {
      invitationId,
      invitation: ownerMembershipWhere(userId),
    },
    select: { invitationId: true },
  });
  if (!ownedInvitation) return null;

  const templates = await database.whatsAppTemplate.findMany({
    where: { invitationId },
    select: templateSelect,
  });
  return templates
    .sort((left, right) => templateTypes.indexOf(left.type) - templateTypes.indexOf(right.type))
    .map(toTemplateItem);
}

/** Update one owner template while the invitation remains commercially editable. */
export async function updateWhatsAppTemplate(
  database: TemplateDatabase,
  userId: string,
  invitationId: string,
  type: WhatsAppTemplateType,
  input: UpdateWhatsAppTemplateInput,
  now = new Date(),
): Promise<UpdateWhatsAppTemplateResult> {
  const parsedType = whatsappTemplateTypeSchema.parse(type);
  const parsed = updateWhatsAppTemplateInputSchema.parse(input);
  if (!Number.isFinite(now.getTime())) throw new Error("WhatsApp template clock is invalid");

  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { commercialState: true, trialEndsAt: true, activeUntil: true },
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

    const current = await transaction.whatsAppTemplate.findUnique({
      where: { invitationId_type: { invitationId, type: parsedType } },
      select: templateSelect,
    });
    if (!current) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const updated = await transaction.whatsAppTemplate.update({
      where: { invitationId_type: { invitationId, type: parsedType } },
      data: { body: parsed.body },
      select: templateSelect,
    });

    return {
      ...toTemplateItem(updated),
      changed: current.body !== updated.body,
    };
  });
}
