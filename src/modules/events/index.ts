import {
  CommercialState,
  EventVisibility,
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { getInvitationLifecycleCapabilities } from "@/modules/lifecycle";
import { DEFAULT_INVITATION_TIMEZONE } from "@/modules/invitations/timezone";
import { ownerMembershipWhere } from "@/modules/invitations/authorization";
import { z } from "zod";

export const MAX_EVENTS_PER_INVITATION = 5;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalUrl = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => value === "" || /^https?:\/\//i.test(value), {
    message: "Gunakan link http:// atau https://.",
  })
  .optional();

export const eventContactSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    role: optionalText(120),
    phone: optionalText(40),
  })
  .strict();

export type EventContact = z.infer<typeof eventContactSchema>;

export const eventInputSchema = z
  .object({
    name: z.string().trim().min(1, "Masukkan nama acara.").max(160),
    startDate: z.string().trim().regex(DATE_PATTERN, "Masukkan tanggal acara yang valid."),
    startTime: z.string().trim().regex(TIME_PATTERN, "Masukkan waktu acara yang valid."),
    endDate: z.string().trim().regex(DATE_PATTERN, "Masukkan tanggal selesai yang valid.").optional(),
    endTime: z.string().trim().regex(TIME_PATTERN, "Masukkan waktu selesai yang valid.").optional(),
    timezone: z.string().trim().max(64).optional(),
    visibility: z.nativeEnum(EventVisibility).default(EventVisibility.GENERIC),
    venue: optionalText(240),
    address: optionalText(500),
    mapsUrl: optionalUrl,
    locationNote: optionalText(500),
    livestreamUrl: optionalUrl,
    dressCode: optionalText(240),
    contactName: optionalText(120),
    contactRole: optionalText(120),
    contactPhone: optionalText(40),
    isPrimary: z.boolean().default(false),
  })
  .strict();

export type EventInput = z.infer<typeof eventInputSchema>;

export const eventCancellationSchema = z
  .object({
    message: z.string().trim().max(500, "Pesan pembatalan maksimal 500 karakter.").optional(),
  })
  .strict();

export type EventCancellationInput = z.infer<typeof eventCancellationSchema>;

export interface EventMutationResult {
  readonly eventId: string;
  readonly invitationVersion: number;
  readonly changed: boolean;
  readonly mode: "created" | "updated" | "cancelled" | "archived" | "deleted" | "primary";
}

export interface EventEditorItem {
  readonly id: string;
  readonly name: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly startDate: string;
  readonly startTime: string;
  readonly endDate: string;
  readonly endTime: string;
  readonly timezone: string;
  readonly isPrimary: boolean;
  readonly visibility: EventVisibility;
  readonly cancelledAt: string | null;
  readonly cancellationMessage: string | null;
  readonly venue: string | null;
  readonly address: string | null;
  readonly mapsUrl: string | null;
  readonly locationNote: string | null;
  readonly livestreamUrl: string | null;
  readonly dressCode: string | null;
  readonly contact: EventContact | null;
}

export interface InvitationEventEditorData {
  readonly invitationId: string;
  readonly invitationTimezone: string;
  readonly invitationVersion: number;
  readonly commercialState: CommercialState;
  readonly trialEndsAt: string;
  readonly activeUntil: string | null;
  readonly canEdit: boolean;
  readonly events: readonly EventEditorItem[];
}

export interface EventServiceOptions {
  readonly cache?: { invalidateInvitation(invitationId: string): void | Promise<void> };
  readonly now?: () => Date;
}

type EventDatabase = Pick<PrismaClient, "$transaction">;
type EventReadDatabase = Pick<PrismaClient, "invitation">;

const editorSelect = {
  id: true,
  ownerFacingTitle: true,
  timezone: true,
  version: true,
  commercialState: true,
  trialEndsAt: true,
  activeUntil: true,
  events: {
    where: { archivedAt: null },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      isPrimary: true,
      visibility: true,
      cancelledAt: true,
      cancellationMessage: true,
      venue: true,
      address: true,
      mapsUrl: true,
      locationNote: true,
      livestreamUrl: true,
      dressCode: true,
      contactFields: true,
    },
  },
} satisfies Prisma.InvitationSelect;

type EditorRecord = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof editorSelect },
  "findFirst"
>>;

function isValidCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function timezoneParts(instant: Date, timezone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
}

function timezoneOffsetMs(instant: Date, timezone: string): number {
  const parts = timezoneParts(instant, timezone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant.getTime();
}

/** Convert a browser datetime-local value into an instant in the event timezone. */
export function localDateTimeToInstant(date: string, time: string, timezone: string): Date {
  if (!DATE_PATTERN.test(date) || !isValidCalendarDate(date) || !TIME_PATTERN.test(time) || !isValidTimeZone(timezone)) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClockMs = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(wallClockMs);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = new Date(wallClockMs - timezoneOffsetMs(instant, timezone));
  }
  return instant;
}

function formatDatePart(instant: Date, timezone: string, part: "year" | "month" | "day" | "hour" | "minute"): string {
  const value = timezoneParts(instant, timezone)[part];
  return String(value).padStart(2, "0");
}

export function eventDateTimeFields(instant: Date, timezone: string): { date: string; time: string } {
  return {
    date: `${formatDatePart(instant, timezone, "year")}-${formatDatePart(instant, timezone, "month")}-${formatDatePart(instant, timezone, "day")}`,
    time: `${formatDatePart(instant, timezone, "hour")}:${formatDatePart(instant, timezone, "minute")}`,
  };
}

function optionalValue(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

function parseEventDates(input: EventInput, timezone: string): { startsAt: Date; endsAt: Date | null } {
  if (!isValidCalendarDate(input.startDate)) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
  const startsAt = localDateTimeToInstant(input.startDate, input.startTime, timezone);
  const hasEndDate = Boolean(input.endDate);
  const hasEndTime = Boolean(input.endTime);
  if (hasEndDate !== hasEndTime || (input.endDate && !isValidCalendarDate(input.endDate))) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
  }
  const endsAt = input.endDate && input.endTime
    ? localDateTimeToInstant(input.endDate, input.endTime, timezone)
    : null;
  if (endsAt && endsAt <= startsAt) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
  return { startsAt, endsAt };
}

function parseContact(input: EventInput): EventContact | null {
  const name = optionalValue(input.contactName);
  const role = optionalValue(input.contactRole);
  const phone = optionalValue(input.contactPhone);
  if (!name && !role && !phone) return null;
  if (!name) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
  return eventContactSchema.parse({ name, ...(role ? { role } : {}), ...(phone ? { phone } : {}) });
}

function eventData(input: EventInput, timezone: string, dates: { startsAt: Date; endsAt: Date | null }, includePrimary: boolean): Prisma.EventUncheckedCreateWithoutInvitationInput {
  const contact = parseContact(input);
  return {
    name: input.name,
    startsAt: dates.startsAt,
    endsAt: dates.endsAt,
    timezone,
    ...(includePrimary ? { isPrimary: input.isPrimary } : {}),
    visibility: input.visibility,
    venue: optionalValue(input.venue),
    address: optionalValue(input.address),
    mapsUrl: optionalValue(input.mapsUrl),
    locationNote: optionalValue(input.locationNote),
    livestreamUrl: optionalValue(input.livestreamUrl),
    dressCode: optionalValue(input.dressCode),
    contactFields: contact ? (contact as Prisma.InputJsonValue) : Prisma.JsonNull,
  };
}

function validateInput(input: EventInput, invitationTimezone: string): { parsed: EventInput; timezone: string; dates: { startsAt: Date; endsAt: Date | null } } {
  const parsed = eventInputSchema.parse(input);
  const timezone = parsed.timezone || invitationTimezone || DEFAULT_INVITATION_TIMEZONE;
  if (!isValidTimeZone(timezone)) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
  return { parsed, timezone, dates: parseEventDates(parsed, timezone) };
}

async function assertEditableAndLock(
  transaction: Prisma.TransactionClient,
  userId: string,
  invitation: { id: string; version: number; commercialState: CommercialState; trialEndsAt: Date; activeUntil: Date | null },
  now: Date,
): Promise<number> {
  if (!getInvitationLifecycleCapabilities(invitation.commercialState, invitation.trialEndsAt, now, invitation.activeUntil).canEdit) {
    throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
  }
  const locked = await transaction.invitation.updateMany({
    where: { id: invitation.id, version: invitation.version, ...ownerMembershipWhere(userId) },
    data: { version: { increment: 1 } },
  });
  if (locked.count !== 1) throw new DomainError(ERROR_CODES.STALE_VERSION, { retryable: true });
  return invitation.version + 1;
}

async function invalidate(options: EventServiceOptions, invitationId: string, changed: boolean): Promise<void> {
  if (changed && options.cache) await options.cache.invalidateInvitation(invitationId);
}

export async function getInvitationEventEditorData(
  database: EventReadDatabase,
  userId: string,
  invitationId: string,
  now = new Date(),
): Promise<InvitationEventEditorData | null> {
  const record = await database.invitation.findFirst({
    where: { id: invitationId, ...ownerMembershipWhere(userId) },
    select: editorSelect,
  });
  if (!record) return null;
  return {
    invitationId: record.id,
    invitationTimezone: record.timezone || DEFAULT_INVITATION_TIMEZONE,
    invitationVersion: record.version,
    commercialState: record.commercialState,
    trialEndsAt: record.trialEndsAt.toISOString(),
    activeUntil: record.activeUntil?.toISOString() ?? null,
    canEdit: getInvitationLifecycleCapabilities(record.commercialState, record.trialEndsAt, now, record.activeUntil).canEdit,
    events: record.events.map(toEditorItem),
  };
}

function toEditorItem(event: EditorRecord["events"][number]): EventEditorItem {
  const start = eventDateTimeFields(event.startsAt, event.timezone);
  const end = event.endsAt ? eventDateTimeFields(event.endsAt, event.timezone) : null;
  const contact = eventContactSchema.safeParse(event.contactFields);
  return {
    id: event.id,
    name: event.name,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    startDate: start.date,
    startTime: start.time,
    endDate: end?.date ?? "",
    endTime: end?.time ?? "",
    timezone: event.timezone,
    isPrimary: event.isPrimary,
    visibility: event.visibility,
    cancelledAt: event.cancelledAt?.toISOString() ?? null,
    cancellationMessage: event.cancellationMessage,
    venue: event.venue,
    address: event.address,
    mapsUrl: event.mapsUrl,
    locationNote: event.locationNote,
    livestreamUrl: event.livestreamUrl,
    dressCode: event.dressCode,
    contact: contact.success ? contact.data : null,
  };
}

export async function saveEvent(
  database: EventDatabase,
  userId: string,
  invitationId: string,
  eventId: string | null,
  input: EventInput,
  options: EventServiceOptions = {},
): Promise<EventMutationResult> {
  const parsedInput = eventInputSchema.parse(input);
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Event clock is invalid");

  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, version: true, timezone: true, commercialState: true, trialEndsAt: true, activeUntil: true, primaryEventId: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const currentEvent = eventId
      ? await transaction.event.findFirst({ where: { id: eventId, invitationId, archivedAt: null }, select: { id: true, isPrimary: true } })
      : null;
    if (eventId && !currentEvent) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const validated = validateInput(parsedInput, invitation.timezone);
    const invitationVersion = await assertEditableAndLock(transaction, userId, invitation, now);
    const activeEventCount = await transaction.event.count({ where: { invitationId, archivedAt: null } });
    if (!eventId && activeEventCount >= MAX_EVENTS_PER_INVITATION) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, { details: { events: ["Maksimal 5 acara per undangan."] } });
    }

    const shouldBecomePrimary = !eventId && (validated.parsed.isPrimary || activeEventCount === 0 || invitation.primaryEventId === null);
    const data = eventData(validated.parsed, validated.timezone, validated.dates, true);
    if (eventId) {
      await transaction.event.update({ where: { id: eventId }, data: { ...data, isPrimary: shouldBecomePrimary ? true : undefined } });
      if (validated.parsed.isPrimary) {
        await transaction.event.updateMany({ where: { invitationId, id: { not: eventId } }, data: { isPrimary: false } });
        await transaction.invitation.update({ where: { id: invitationId }, data: { primaryEventId: eventId } });
      }
    } else {
      const created = await transaction.event.create({ data: { ...data, invitationId, isPrimary: shouldBecomePrimary } });
      if (shouldBecomePrimary) {
        await transaction.event.updateMany({ where: { invitationId, id: { not: created.id } }, data: { isPrimary: false } });
        await transaction.invitation.update({ where: { id: invitationId }, data: { primaryEventId: created.id } });
      }
      await writeAuditEvent(transaction, { actorId: userId, invitationId, resourceType: "event", resourceId: created.id, action: "event.created", metadata: { is_primary: shouldBecomePrimary } });
      return { eventId: created.id, invitationVersion, changed: true, mode: "created" } satisfies EventMutationResult;
    }

    await writeAuditEvent(transaction, { actorId: userId, invitationId, resourceType: "event", resourceId: eventId, action: "event.updated", metadata: { primary_changed: validated.parsed.isPrimary } });
    return { eventId, invitationVersion, changed: true, mode: "updated" } satisfies EventMutationResult;
  });

  await invalidate(options, invitationId, result.changed);
  return result;
}

export async function setPrimaryEvent(
  database: EventDatabase,
  userId: string,
  invitationId: string,
  eventId: string,
  options: EventServiceOptions = {},
): Promise<EventMutationResult> {
  const now = options.now?.() ?? new Date();
  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, version: true, commercialState: true, trialEndsAt: true, activeUntil: true, primaryEventId: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (invitation.primaryEventId === eventId) return { eventId, invitationVersion: invitation.version, changed: false, mode: "primary" } satisfies EventMutationResult;
    const event = await transaction.event.findFirst({ where: { id: eventId, invitationId, archivedAt: null }, select: { id: true } });
    if (!event) throw new DomainError(ERROR_CODES.NOT_FOUND);
    const invitationVersion = await assertEditableAndLock(transaction, userId, invitation, now);
    await transaction.event.updateMany({ where: { invitationId }, data: { isPrimary: false } });
    await transaction.event.update({ where: { id: eventId }, data: { isPrimary: true } });
    await transaction.invitation.update({ where: { id: invitationId }, data: { primaryEventId: eventId } });
    await writeAuditEvent(transaction, { actorId: userId, invitationId, resourceType: "event", resourceId: eventId, action: "event.primary_changed", metadata: { changed: true } });
    return { eventId, invitationVersion, changed: true, mode: "primary" } satisfies EventMutationResult;
  });
  await invalidate(options, invitationId, result.changed);
  return result;
}

export async function cancelEvent(
  database: EventDatabase,
  userId: string,
  invitationId: string,
  eventId: string,
  input: EventCancellationInput,
  options: EventServiceOptions = {},
): Promise<EventMutationResult> {
  const parsedInput = eventCancellationSchema.parse(input);
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Event clock is invalid");

  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, version: true, commercialState: true, trialEndsAt: true, activeUntil: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const event = await transaction.event.findFirst({
      where: { id: eventId, invitationId, archivedAt: null },
      select: { id: true, cancelledAt: true },
    });
    if (!event) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (event.cancelledAt !== null) {
      return { eventId, invitationVersion: invitation.version, changed: false, mode: "cancelled" } satisfies EventMutationResult;
    }

    const invitationVersion = await assertEditableAndLock(transaction, userId, invitation, now);
    await transaction.event.update({
      where: { id: eventId },
      data: {
        cancelledAt: now,
        cancellationMessage: optionalValue(parsedInput.message),
      },
    });
    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "event",
      resourceId: eventId,
      action: "event.cancelled",
      metadata: { has_notice: Boolean(parsedInput.message) },
      createdAt: now,
    });
    return { eventId, invitationVersion, changed: true, mode: "cancelled" } satisfies EventMutationResult;
  });

  await invalidate(options, invitationId, result.changed);
  return result;
}

export async function removeEvent(
  database: EventDatabase,
  userId: string,
  invitationId: string,
  eventId: string,
  options: EventServiceOptions = {},
): Promise<EventMutationResult> {
  const now = options.now?.() ?? new Date();
  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, version: true, commercialState: true, trialEndsAt: true, activeUntil: true, primaryEventId: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    const event = await transaction.event.findFirst({
      where: { id: eventId, invitationId, archivedAt: null },
      select: { id: true, isPrimary: true, cancelledAt: true, guestEvents: { select: { rsvp: { select: { id: true } }, attendance: { select: { id: true } } } } },
    });
    if (!event) throw new DomainError(ERROR_CODES.NOT_FOUND);
    const invitationVersion = await assertEditableAndLock(transaction, userId, invitation, now);
    const hasHistory = event.cancelledAt !== null || event.guestEvents.some(({ rsvp, attendance }) => rsvp !== null || attendance !== null);
    const nextPrimary = event.isPrimary || invitation.primaryEventId === eventId
      ? await transaction.event.findFirst({ where: { invitationId, id: { not: eventId }, archivedAt: null }, orderBy: { startsAt: "asc" }, select: { id: true } })
      : null;
    if (hasHistory) {
      await transaction.event.update({ where: { id: eventId }, data: { archivedAt: now, isPrimary: false } });
    } else {
      await transaction.event.delete({ where: { id: eventId } });
    }
    if (event.isPrimary || invitation.primaryEventId === eventId) {
      await transaction.event.updateMany({ where: { invitationId }, data: { isPrimary: false } });
      if (nextPrimary) await transaction.event.update({ where: { id: nextPrimary.id }, data: { isPrimary: true } });
      await transaction.invitation.update({ where: { id: invitationId }, data: { primaryEventId: nextPrimary?.id ?? null } });
    }
    await writeAuditEvent(transaction, { actorId: userId, invitationId, resourceType: "event", resourceId: eventId, action: hasHistory ? "event.archived" : "event.deleted", metadata: { had_history: hasHistory } });
    return { eventId, invitationVersion, changed: true, mode: hasHistory ? "archived" : "deleted" } satisfies EventMutationResult;
  });
  await invalidate(options, invitationId, result.changed);
  return result;
}
