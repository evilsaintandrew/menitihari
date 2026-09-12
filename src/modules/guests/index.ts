import {
  CommercialState,
  GuestEventState,
  Prisma,
  QrCredentialState,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { getInvitationLifecycleCapabilities } from "@/modules/lifecycle";
import { ownerMembershipWhere } from "@/modules/invitations/authorization";
import { z } from "zod";
import {
  getInvitedPeopleCapacity,
  INVITED_PEOPLE_LIMIT,
  sumPartySizes,
  type InvitedPeopleCapacity,
} from "./capacity";
export { normalizeGuestName, normalizePhone } from "./normalization";
import { normalizeGuestName, normalizePhone } from "./normalization";

export * from "./capacity";
export * from "./import";

const optionalPhone = z
  .string()
  .trim()
  .max(40, "Nomor telepon maksimal 40 karakter.")
  .refine((value) => value === "" || /^[+()\d\s.-]+$/.test(value), "Masukkan nomor telepon yang valid.")
  .optional();

export const guestInputSchema = z
  .object({
    displayName: z.string().trim().min(1, "Masukkan nama tamu.").max(160, "Nama tamu maksimal 160 karakter."),
    phone: optionalPhone,
    groupId: z.string().trim().max(128).optional(),
    groupName: z.string().trim().max(120, "Nama grup maksimal 120 karakter.").optional(),
    notes: z.string().trim().max(1_000, "Catatan maksimal 1.000 karakter.").optional(),
    assignments: z.array(z.object({
      eventId: z.string().trim().min(1).max(128),
      maxPartySize: z.number().int().min(1, "Maksimal orang minimal 1."),
    }).strict()).min(1, "Pilih setidaknya satu acara.").superRefine((assignments, context) => {
      const eventIds = new Set<string>();
      assignments.forEach((assignment, index) => {
        if (eventIds.has(assignment.eventId)) {
          context.addIssue({ code: "custom", path: [index, "eventId"], message: "Acara tidak boleh dipilih dua kali." });
        }
        eventIds.add(assignment.eventId);
      });
    }),
  })
  .strict();

export type GuestInput = z.infer<typeof guestInputSchema>;

export interface GuestMutationResult {
  readonly guestId: string;
  readonly invitationVersion: number;
  readonly changed: boolean;
  readonly mode: "created" | "updated" | "archived" | "deleted" | "merged";
  readonly duplicateWarnings?: readonly GuestDuplicateWarning[];
  readonly sourceGuestId?: string;
  readonly targetGuestId?: string;
}

export type GuestDuplicateSignal = "PHONE" | "NAME";

export interface GuestDuplicateWarning {
  readonly guestId: string;
  readonly displayName: string;
  readonly displayPhone: string | null;
  readonly matchingSignals: readonly GuestDuplicateSignal[];
}

export interface GuestMergeConflict {
  readonly eventId: string;
  readonly eventName: string;
  readonly sourceHasRsvp: boolean;
  readonly sourceHasAttendance: boolean;
  readonly targetHasRsvp: boolean;
  readonly targetHasAttendance: boolean;
}

export interface GuestMergePreview {
  readonly source: {
    readonly id: string;
    readonly displayName: string;
    readonly displayPhone: string | null;
  };
  readonly target: {
    readonly id: string;
    readonly displayName: string;
    readonly displayPhone: string | null;
  };
  readonly conflicts: readonly GuestMergeConflict[];
}

export interface GuestGroupItem {
  readonly id: string;
  readonly name: string;
}

export interface GuestEventSummary {
  readonly id: string;
  readonly assignmentId: string;
  readonly name: string;
  readonly maxPartySize: number;
  readonly rsvpStatus: string | null;
  readonly attendanceCount: number | null;
}

export interface GuestEventOption {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly endsAt: string | null;
  readonly rsvpEnabled: boolean;
  readonly rsvpClosesAt: string | null;
  readonly rsvpClosesAtDate: string;
  readonly rsvpClosesAtTime: string;
  readonly eventActive: boolean;
  readonly rsvpWindowOpen: boolean;
}

export interface GuestManagementItem {
  readonly id: string;
  readonly displayName: string;
  readonly displayPhone: string | null;
  readonly normalizedPhone: string | null;
  readonly notes: string | null;
  readonly group: GuestGroupItem | null;
  readonly assignedEvents: readonly GuestEventSummary[];
  readonly distributionStatus: GuestDistributionStatus;
  readonly viewedAt: string | null;
  readonly duplicateWarnings?: readonly GuestDuplicateWarning[];
  readonly createdAt: string;
}

export const guestDistributionStatusSchema = z.enum(["NOT_SENT", "MARKED_SENT", "WHATSAPP_OPENED"]);
export type GuestDistributionStatus = z.infer<typeof guestDistributionStatusSchema>;
const guestBulkDistributionStatusSchema = z.enum(["NOT_SENT", "MARKED_SENT"]);

const guestBulkIdsSchema = z
  .array(z.string().trim().min(1).max(128))
  .min(1, "Pilih setidaknya satu tamu.")
  .max(500, "Pilih maksimal 500 tamu sekaligus.")
  .superRefine((guestIds, context) => {
    if (new Set(guestIds).size !== guestIds.length) {
      context.addIssue({ code: "custom", message: "Tamu yang dipilih tidak boleh berulang." });
    }
  });

export const guestBulkActionInputSchema = z
  .object({
    operation: z.enum(["GROUP", "EVENT", "DISTRIBUTION"]),
    guestIds: guestBulkIdsSchema,
    groupId: z.string().trim().max(128).nullable().optional(),
    eventId: z.string().trim().min(1).max(128).optional(),
    eventAction: z.enum(["ASSIGN", "UNASSIGN"]).optional(),
    maxPartySize: z.number().int().min(1, "Maksimal orang minimal 1.").optional(),
    distributionStatus: guestBulkDistributionStatusSchema.optional(),
    confirmHistoricalRemoval: z.boolean().default(false),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.operation === "GROUP" && input.groupId === undefined) {
      context.addIssue({ code: "custom", path: ["groupId"], message: "Pilih grup." });
    }
    if (input.operation === "EVENT") {
      if (!input.eventId) context.addIssue({ code: "custom", path: ["eventId"], message: "Pilih acara." });
      if (!input.eventAction) context.addIssue({ code: "custom", path: ["eventAction"], message: "Pilih tindakan acara." });
      if (input.eventAction === "ASSIGN" && input.maxPartySize === undefined) {
        context.addIssue({ code: "custom", path: ["maxPartySize"], message: "Masukkan maksimal orang." });
      }
    }
    if (input.operation === "DISTRIBUTION" && !input.distributionStatus) {
      context.addIssue({ code: "custom", path: ["distributionStatus"], message: "Pilih status distribusi." });
    }
  });

export type GuestBulkActionInput = z.input<typeof guestBulkActionInputSchema>;

export interface GuestBulkWarning {
  readonly code: "HISTORICAL_EVENT_UNASSIGN";
  readonly guestCount: number;
  readonly assignmentCount: number;
}

export interface GuestBulkMutationResult {
  readonly invitationVersion: number;
  readonly changed: boolean;
  readonly updatedGuestCount: number;
  readonly operation: GuestBulkActionInput["operation"];
  readonly warning?: GuestBulkWarning;
}

export interface GuestManagementData {
  readonly invitationId: string;
  readonly invitationVersion: number;
  readonly commercialState: CommercialState;
  readonly trialEndsAt: string;
  readonly activeUntil: string | null;
  readonly canEdit: boolean;
  readonly invitedPeopleCapacity: InvitedPeopleCapacity;
  readonly groups: readonly GuestGroupItem[];
  readonly events: readonly GuestEventOption[];
  readonly guests: readonly GuestManagementItem[];
}

export type GuestRsvpFilter = "ALL" | "PENDING";

export function filterGuestsByRsvp(
  guests: readonly GuestManagementItem[],
  filter: GuestRsvpFilter,
): readonly GuestManagementItem[] {
  if (filter === "ALL") return guests;
  return guests.filter((guest) => guest.assignedEvents.some((event) => event.rsvpStatus === null || event.rsvpStatus === "PENDING"));
}

export interface GuestServiceOptions {
  readonly now?: () => Date;
}

type GuestDatabase = Pick<PrismaClient, "$transaction">;
type GuestReadDatabase = Pick<PrismaClient, "invitation">;

export const guestMergeInputSchema = z
  .object({
    sourceGuestId: z.string().trim().min(1).max(128),
    targetGuestId: z.string().trim().min(1).max(128),
    conflictResolutions: z.array(z.object({
      eventId: z.string().trim().min(1).max(128),
      keep: z.enum(["SOURCE", "TARGET"]),
    }).strict()).default([]),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.sourceGuestId === input.targetGuestId) {
      context.addIssue({ code: "custom", path: ["targetGuestId"], message: "Pilih dua tamu yang berbeda." });
    }
    const eventIds = new Set<string>();
    input.conflictResolutions.forEach((resolution, index) => {
      if (eventIds.has(resolution.eventId)) {
        context.addIssue({ code: "custom", path: ["conflictResolutions", index, "eventId"], message: "Acara konflik hanya boleh dipilih sekali." });
      }
      eventIds.add(resolution.eventId);
    });
  });

export type GuestMergeInput = z.input<typeof guestMergeInputSchema>;

const managementSelect = {
  id: true,
  version: true,
  commercialState: true,
  trialEndsAt: true,
  activeUntil: true,
  guestGroups: {
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  },
  events: {
    where: { archivedAt: null },
    orderBy: { startsAt: "asc" },
    select: { id: true, name: true, timezone: true, endsAt: true, rsvpEnabled: true, rsvpClosesAt: true, cancelledAt: true },
  },
  guests: {
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      normalizedName: true,
      displayPhone: true,
      normalizedPhone: true,
      notes: true,
      distributionStatus: true,
      lastViewedAt: true,
      createdAt: true,
      group: { select: { id: true, name: true } },
      eventAssignments: {
        where: { state: GuestEventState.ACTIVE },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          event: { select: { id: true, name: true } },
          maxPartySize: true,
          rsvp: { select: { status: true, attendanceCount: true } },
        },
      },
    },
  },
} satisfies Prisma.InvitationSelect;

type ManagementRecord = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof managementSelect },
  "findFirst"
>>;

function optionalValue(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

function localDateTimeFields(value: Date | null, timezone: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, part]));
  return { date: `${fields.year}-${fields.month}-${fields.day}`, time: `${fields.hour}:${fields.minute}` };
}

type DuplicateGuestRecord = {
  readonly id: string;
  readonly displayName: string;
  readonly displayPhone: string | null;
  readonly normalizedName: string;
  readonly normalizedPhone: string | null;
};

async function findDuplicateWarnings(
  transaction: Prisma.TransactionClient,
  invitationId: string,
  normalizedName: string,
  normalizedPhone: string | null,
  guestId: string | null,
): Promise<readonly GuestDuplicateWarning[]> {
  const signals: Prisma.GuestWhereInput[] = [{ normalizedName }];
  if (normalizedPhone) signals.push({ normalizedPhone });

  const records = await transaction.guest.findMany({
    where: {
      invitationId,
      archivedAt: null,
      ...(guestId ? { id: { not: guestId } } : {}),
      OR: signals,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, displayName: true, displayPhone: true, normalizedName: true, normalizedPhone: true },
  }) as DuplicateGuestRecord[];

  return records.map((record) => ({
    guestId: record.id,
    displayName: record.displayName,
    displayPhone: record.displayPhone,
    matchingSignals: [
      ...(record.normalizedPhone && normalizedPhone && record.normalizedPhone === normalizedPhone ? ["PHONE" as const] : []),
      ...(record.normalizedName === normalizedName ? ["NAME" as const] : []),
    ],
  }));
}

async function assertEditableAndLock(
  transaction: Prisma.TransactionClient,
  userId: string,
  invitation: { id: string; version: number; commercialState: CommercialState; trialEndsAt: Date; activeUntil: Date | null },
  now: Date,
): Promise<number> {
  assertEditable(invitation, now);
  const locked = await transaction.invitation.updateMany({
    where: { id: invitation.id, version: invitation.version, ...ownerMembershipWhere(userId) },
    data: { version: { increment: 1 } },
  });
  if (locked.count !== 1) throw new DomainError(ERROR_CODES.STALE_VERSION, { retryable: true });
  return invitation.version + 1;
}

function assertEditable(
  invitation: { commercialState: CommercialState; trialEndsAt: Date; activeUntil: Date | null },
  now: Date,
): void {
  if (!getInvitationLifecycleCapabilities(invitation.commercialState, invitation.trialEndsAt, now, invitation.activeUntil).canEdit) {
    throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
  }
}

async function resolveGroup(
  transaction: Prisma.TransactionClient,
  invitationId: string,
  groupId: string | null,
  groupName: string | null,
): Promise<string | null> {
  if (groupId && groupName) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
  if (groupId) {
    const group = await transaction.guestGroup.findFirst({ where: { id: groupId, invitationId }, select: { id: true } });
    if (!group) throw new DomainError(ERROR_CODES.NOT_FOUND);
    return group.id;
  }
  if (!groupName) return null;

  const group = await transaction.guestGroup.upsert({
    where: { invitationId_name: { invitationId, name: groupName } },
    create: { invitationId, name: groupName },
    update: {},
    select: { id: true },
  });
  return group.id;
}

export async function getGuestManagementData(
  database: GuestReadDatabase,
  userId: string,
  invitationId: string,
  now = new Date(),
): Promise<GuestManagementData | null> {
  const record = await database.invitation.findFirst({
    where: { id: invitationId, ...ownerMembershipWhere(userId) },
    select: managementSelect,
  });
  if (!record) return null;
  return toManagementData(record, now);
}

function toManagementData(record: ManagementRecord, now: Date): GuestManagementData {
  const guests = record.guests.map((guest) => ({
    id: guest.id,
    displayName: guest.displayName,
    displayPhone: guest.displayPhone,
    normalizedPhone: guest.normalizedPhone,
    notes: guest.notes,
    distributionStatus: guest.distributionStatus,
    viewedAt: guest.lastViewedAt,
    group: guest.group,
    assignedEvents: guest.eventAssignments.map((assignment) => ({
      id: assignment.event.id,
      assignmentId: assignment.id,
      name: assignment.event.name,
      maxPartySize: assignment.maxPartySize,
      rsvpStatus: assignment.rsvp?.status ?? null,
      attendanceCount: assignment.rsvp?.attendanceCount ?? null,
    })),
    normalizedName: guest.normalizedName,
    createdAt: guest.createdAt.toISOString(),
  }));

  return {
    invitationId: record.id,
    invitationVersion: record.version,
    commercialState: record.commercialState,
    trialEndsAt: record.trialEndsAt.toISOString(),
    activeUntil: record.activeUntil?.toISOString() ?? null,
    canEdit: getInvitationLifecycleCapabilities(record.commercialState, record.trialEndsAt, now, record.activeUntil).canEdit,
    invitedPeopleCapacity: getInvitedPeopleCapacity(
      sumPartySizes(record.guests.flatMap((guest) => guest.eventAssignments)),
    ),
    groups: record.guestGroups,
    events: record.events.map((event) => {
      const close = localDateTimeFields(event.rsvpClosesAt, event.timezone);
      return {
        id: event.id,
        name: event.name,
        timezone: event.timezone,
        endsAt: event.endsAt?.toISOString() ?? null,
        rsvpEnabled: event.rsvpEnabled,
        rsvpClosesAt: event.rsvpClosesAt?.toISOString() ?? null,
        rsvpClosesAtDate: close.date,
        rsvpClosesAtTime: close.time,
        eventActive: event.cancelledAt === null && (event.endsAt === null || event.endsAt.getTime() > now.getTime()),
        rsvpWindowOpen: event.rsvpEnabled && event.cancelledAt === null && (event.endsAt === null || event.endsAt.getTime() > now.getTime()) && (event.rsvpClosesAt === null || event.rsvpClosesAt.getTime() > now.getTime()),
      };
    }),
    guests: guests.map((guest) => ({
      id: guest.id,
      displayName: guest.displayName,
      displayPhone: guest.displayPhone,
      normalizedPhone: guest.normalizedPhone,
      notes: guest.notes,
      group: guest.group,
      assignedEvents: guest.assignedEvents,
      distributionStatus: guest.distributionStatus === "MARKED_SENT"
        ? "MARKED_SENT"
        : guest.distributionStatus === "WHATSAPP_OPENED"
          ? "WHATSAPP_OPENED"
          : "NOT_SENT",
      viewedAt: guest.viewedAt?.toISOString() ?? null,
      duplicateWarnings: guests
        .filter((candidate) => candidate.id !== guest.id)
        .map((candidate) => ({
          candidate,
          matchingSignals: [
            ...(candidate.normalizedPhone && guest.normalizedPhone && candidate.normalizedPhone === guest.normalizedPhone ? ["PHONE" as const] : []),
            ...(candidate.normalizedName === guest.normalizedName ? ["NAME" as const] : []),
          ],
        }))
        .filter(({ matchingSignals }) => matchingSignals.length > 0)
        .map(({ candidate, matchingSignals }) => ({
          guestId: candidate.id,
          displayName: candidate.displayName,
          displayPhone: candidate.displayPhone,
          matchingSignals,
        })),
      createdAt: guest.createdAt,
    })),
  };
}

export async function saveGuest(
  database: GuestDatabase,
  userId: string,
  invitationId: string,
  guestId: string | null,
  input: GuestInput,
  options: GuestServiceOptions = {},
): Promise<GuestMutationResult> {
  const parsed = guestInputSchema.parse(input);
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Guest clock is invalid");

  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, version: true, commercialState: true, trialEndsAt: true, activeUntil: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const currentGuest = guestId
      ? await transaction.guest.findFirst({ where: { id: guestId, invitationId, archivedAt: null }, select: { id: true } })
      : null;
    if (guestId && !currentGuest) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const normalizedPhone = normalizePhone(parsed.phone);
    const groupId = await resolveGroup(transaction, invitationId, optionalValue(parsed.groupId), optionalValue(parsed.groupName));
    const eventIds = parsed.assignments.map((assignment) => assignment.eventId);
    const events = await transaction.event.findMany({
      where: { invitationId, archivedAt: null, id: { in: eventIds } },
      select: { id: true },
    });
    const existingEventIds = new Set(events.map((event) => event.id));
    if (eventIds.some((eventId) => !existingEventIds.has(eventId))) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const duplicateWarnings = await findDuplicateWarnings(
      transaction,
      invitationId,
      normalizeGuestName(parsed.displayName),
      normalizedPhone,
      guestId,
    );

    const existingAssignments = guestId
      ? await transaction.guestEvent.findMany({
        where: { guestId },
        select: {
          id: true,
          eventId: true,
          state: true,
          maxPartySize: true,
          rsvp: { select: { status: true, attendanceCount: true } },
          attendance: { select: { actualCount: true } },
        },
      })
      : [];
    const existingByEventId = new Map(existingAssignments.map((assignment) => [assignment.eventId, assignment]));
    for (const assignment of parsed.assignments) {
      const existing = existingByEventId.get(assignment.eventId);
      if (!existing || existing.maxPartySize === assignment.maxPartySize) continue;
      const rsvpCount = existing.rsvp?.status === "ATTENDING" ? existing.rsvp.attendanceCount : null;
      const actualCount = existing.attendance?.actualCount ?? null;
      if ((rsvpCount !== null && rsvpCount > assignment.maxPartySize) || (actualCount !== null && actualCount > assignment.maxPartySize)) {
        throw new DomainError(ERROR_CODES.VALIDATION_FAILED, {
          details: { assignments: ["Maksimal orang tidak boleh lebih kecil dari jumlah kehadiran yang sudah tercatat."] },
        });
      }
    }
    const invitationVersion = await assertEditableAndLock(transaction, userId, invitation, now);
    const currentCapacity = await transaction.guestEvent.aggregate({
      where: {
        state: GuestEventState.ACTIVE,
        guest: { invitationId, archivedAt: null },
      },
      _sum: { maxPartySize: true },
    });
    const currentGuestCapacity = sumPartySizes(
      existingAssignments.filter(({ state }) => state === GuestEventState.ACTIVE),
    );
    const requestedGuestCapacity = sumPartySizes(parsed.assignments);
    if ((currentCapacity._sum.maxPartySize ?? 0) - currentGuestCapacity + requestedGuestCapacity > INVITED_PEOPLE_LIMIT) {
      throw new DomainError(ERROR_CODES.CAPACITY_EXCEEDED);
    }
    const data = {
      displayName: parsed.displayName,
      normalizedName: normalizeGuestName(parsed.displayName),
      normalizedPhone,
      displayPhone: optionalValue(parsed.phone),
      notes: optionalValue(parsed.notes),
      groupId,
    };

    if (guestId) {
      await transaction.guest.update({ where: { id: guestId }, data });
      await writeAuditEvent(transaction, {
        actorId: userId,
        invitationId,
        resourceType: "guest",
        resourceId: guestId,
        action: "guest.updated",
        metadata: { has_contact: normalizedPhone !== null, has_group: groupId !== null },
      });
      await syncGuestEventAssignments(transaction, guestId, parsed.assignments, existingAssignments, now);
      return { guestId, invitationVersion, changed: true, mode: "updated", duplicateWarnings } satisfies GuestMutationResult;
    }

    const created = await transaction.guest.create({ data: { ...data, invitationId } });
    await syncGuestEventAssignments(transaction, created.id, parsed.assignments, [], now);
    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "guest",
      resourceId: created.id,
      action: "guest.created",
      metadata: { has_contact: normalizedPhone !== null, has_group: groupId !== null },
    });
    return { guestId: created.id, invitationVersion, changed: true, mode: "created", duplicateWarnings } satisfies GuestMutationResult;
  });

  return result;
}

type ExistingGuestEventAssignment = {
  readonly id: string;
  readonly eventId: string;
  readonly state: GuestEventState;
  readonly maxPartySize: number;
  readonly rsvp: { readonly status: string; readonly attendanceCount: number | null } | null;
  readonly attendance: { readonly actualCount: number | null } | null;
};

async function syncGuestEventAssignments(
  transaction: Prisma.TransactionClient,
  guestId: string,
  assignments: readonly { eventId: string; maxPartySize: number }[],
  existingAssignments: readonly ExistingGuestEventAssignment[],
  now: Date,
): Promise<void> {
  const requestedEventIds = new Set(assignments.map((assignment) => assignment.eventId));
  for (const existing of existingAssignments) {
    if (!requestedEventIds.has(existing.eventId) && existing.state === GuestEventState.ACTIVE) {
      await transaction.guestEvent.update({
        where: { id: existing.id },
        data: { state: GuestEventState.REMOVED, removedAt: now },
      });
    }
  }

  for (const assignment of assignments) {
    const existing = existingAssignments.find((candidate) => candidate.eventId === assignment.eventId);
    if (existing) {
      await transaction.guestEvent.update({
        where: { id: existing.id },
        data: { state: GuestEventState.ACTIVE, maxPartySize: assignment.maxPartySize, removedAt: null },
      });
    } else {
      await transaction.guestEvent.create({
        data: { guestId, eventId: assignment.eventId, maxPartySize: assignment.maxPartySize },
      });
    }
  }
}

type BulkGuestEventRecord = {
  readonly id: string;
  readonly state: GuestEventState;
  readonly maxPartySize: number;
  readonly rsvp: { readonly status: string; readonly attendanceCount: number | null } | null;
  readonly attendance: { readonly actualCount: number | null } | null;
};

function eventHistoryCount(assignments: readonly BulkGuestEventRecord[]): number {
  return assignments.filter((assignment) => assignment.rsvp !== null || assignment.attendance !== null).length;
}

function historyCountForAssignment(assignment: BulkGuestEventRecord): number {
  const rsvpCount = assignment.rsvp?.status === "ATTENDING" ? assignment.rsvp.attendanceCount ?? 0 : 0;
  return Math.max(rsvpCount, assignment.attendance?.actualCount ?? 0);
}

/**
 * Apply one explicit operation to a bounded set of active guests.
 *
 * The read/warning path intentionally returns before the invitation version
 * lock. A second submit must carry explicit confirmation before historical
 * event assignments are removed.
 */
export async function bulkUpdateGuests(
  database: GuestDatabase,
  userId: string,
  invitationId: string,
  input: GuestBulkActionInput,
  options: GuestServiceOptions = {},
): Promise<GuestBulkMutationResult> {
  const parsed = guestBulkActionInputSchema.parse(input);
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Guest clock is invalid");

  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, version: true, commercialState: true, trialEndsAt: true, activeUntil: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    assertEditable(invitation, now);

    const selectedGuests = await transaction.guest.findMany({
      where: { invitationId, archivedAt: null, id: { in: parsed.guestIds } },
      select: { id: true },
    });
    if (selectedGuests.length !== parsed.guestIds.length) throw new DomainError(ERROR_CODES.NOT_FOUND);

    if (parsed.operation === "GROUP") {
      if (parsed.groupId) {
        const group = await transaction.guestGroup.findFirst({ where: { id: parsed.groupId, invitationId }, select: { id: true } });
        if (!group) throw new DomainError(ERROR_CODES.NOT_FOUND);
      }
    }

    let event: { id: string } | null = null;
    let eventAssignments: BulkGuestEventRecord[] = [];
    if (parsed.operation === "EVENT") {
      event = await transaction.event.findFirst({ where: { id: parsed.eventId, invitationId, archivedAt: null }, select: { id: true } });
      if (!event) throw new DomainError(ERROR_CODES.NOT_FOUND);
      eventAssignments = await transaction.guestEvent.findMany({
        where: { guestId: { in: parsed.guestIds }, eventId: event.id },
        select: {
          id: true,
          state: true,
          maxPartySize: true,
          rsvp: { select: { status: true, attendanceCount: true } },
          attendance: { select: { actualCount: true } },
        },
      }) as BulkGuestEventRecord[];

      if (parsed.eventAction === "UNASSIGN") {
        const activeHistoricalAssignments = eventAssignments.filter(
          (assignment) => assignment.state === GuestEventState.ACTIVE && historyCountForAssignment(assignment) > 0,
        );
        if (activeHistoricalAssignments.length > 0 && !parsed.confirmHistoricalRemoval) {
          return {
            invitationVersion: invitation.version,
            changed: false,
            updatedGuestCount: 0,
            operation: parsed.operation,
            warning: {
              code: "HISTORICAL_EVENT_UNASSIGN",
              guestCount: activeHistoricalAssignments.length,
              assignmentCount: activeHistoricalAssignments.length,
            },
          } satisfies GuestBulkMutationResult;
        }
      }

      if (parsed.eventAction === "ASSIGN") {
        for (const assignment of eventAssignments) {
          if (assignment.state === GuestEventState.ACTIVE && historyCountForAssignment(assignment) > (parsed.maxPartySize ?? 0)) {
            throw new DomainError(ERROR_CODES.VALIDATION_FAILED, {
              details: { maxPartySize: ["Maksimal orang tidak boleh lebih kecil dari jumlah kehadiran yang sudah tercatat."] },
            });
          }
        }
      }
    }

    const invitationVersion = await assertEditableAndLock(transaction, userId, invitation, now);

    if (parsed.operation === "GROUP") {
      await transaction.guest.updateMany({
        where: { invitationId, archivedAt: null, id: { in: parsed.guestIds } },
        data: { groupId: parsed.groupId ?? null },
      });
    } else if (parsed.operation === "DISTRIBUTION") {
      await transaction.guest.updateMany({
        where: { invitationId, archivedAt: null, id: { in: parsed.guestIds } },
        data: { distributionStatus: parsed.distributionStatus === "MARKED_SENT" ? "MARKED_SENT" : null },
      });
    } else if (parsed.eventAction === "UNASSIGN") {
      await transaction.guestEvent.updateMany({
        where: { guestId: { in: parsed.guestIds }, eventId: event!.id, state: GuestEventState.ACTIVE },
        data: { state: GuestEventState.REMOVED, removedAt: now },
      });
    } else {
      const maxPartySize = parsed.maxPartySize!;
      const currentCapacity = await transaction.guestEvent.aggregate({
        where: {
          state: GuestEventState.ACTIVE,
          guest: { invitationId, archivedAt: null },
        },
        _sum: { maxPartySize: true },
      });
      const selectedActiveCapacity = eventAssignments
        .filter((assignment) => assignment.state === GuestEventState.ACTIVE)
        .reduce((total, assignment) => total + assignment.maxPartySize, 0);
      if ((currentCapacity._sum.maxPartySize ?? 0) - selectedActiveCapacity + maxPartySize * parsed.guestIds.length > INVITED_PEOPLE_LIMIT) {
        throw new DomainError(ERROR_CODES.CAPACITY_EXCEEDED);
      }

      const existingAssignments = await transaction.guestEvent.findMany({
        where: { guestId: { in: parsed.guestIds }, eventId: event!.id },
        select: { id: true, guestId: true, state: true, maxPartySize: true },
      });
      for (const assignment of existingAssignments) {
        await transaction.guestEvent.update({
          where: { id: assignment.id },
          data: { state: GuestEventState.ACTIVE, maxPartySize, removedAt: null },
        });
      }
      for (const guestId of parsed.guestIds) {
        if (!existingAssignments.some((assignment) => assignment.guestId === guestId)) {
          await transaction.guestEvent.create({ data: { guestId, eventId: event!.id, maxPartySize } });
        }
      }
    }

    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "guest",
      resourceId: invitationId,
      action: "guests.bulk_updated",
      metadata: {
        operation: parsed.operation,
        guest_count: parsed.guestIds.length,
        ...(parsed.operation === "EVENT" ? { event_action: parsed.eventAction!, event_history_count: eventHistoryCount(eventAssignments) } : {}),
        ...(parsed.operation === "DISTRIBUTION" ? { distribution_status: parsed.distributionStatus! } : {}),
      },
    });

    return {
      invitationVersion,
      changed: true,
      updatedGuestCount: parsed.guestIds.length,
      operation: parsed.operation,
    } satisfies GuestBulkMutationResult;
  });
}

export async function archiveGuest(
  database: GuestDatabase,
  userId: string,
  invitationId: string,
  guestId: string,
  options: GuestServiceOptions = {},
): Promise<GuestMutationResult> {
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Guest clock is invalid");

  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, version: true, commercialState: true, trialEndsAt: true, activeUntil: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const guest = await transaction.guest.findFirst({
      where: { id: guestId, invitationId, archivedAt: null },
      select: {
        id: true,
        archivedAt: true,
        lastViewedAt: true,
        distributionStatus: true,
        eventAssignments: { select: { id: true, rsvp: { select: { id: true } }, attendance: { select: { id: true } } } },
        activationCredentials: { select: { id: true } },
        sessions: { select: { id: true } },
        wishes: { select: { id: true } },
        qrCredentials: { select: { id: true } },
      },
    });
    if (!guest) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const invitationVersion = await assertEditableAndLock(transaction, userId, invitation, now);
    const hasHistory = Boolean(
      guest.lastViewedAt ||
      guest.distributionStatus ||
      guest.activationCredentials.length > 0 ||
      guest.sessions.length > 0 ||
      guest.wishes.length > 0 ||
      guest.qrCredentials.length > 0 ||
      guest.eventAssignments.some(({ rsvp, attendance }) => rsvp !== null || attendance !== null),
    );

    if (!hasHistory) {
      await transaction.guest.delete({ where: { id: guestId } });
      await writeAuditEvent(transaction, {
        actorId: userId,
        invitationId,
        resourceType: "guest",
        resourceId: guestId,
        action: "guest.deleted",
        metadata: { had_history: false },
      });
      return { guestId, invitationVersion, changed: true, mode: "deleted" } satisfies GuestMutationResult;
    }

    await transaction.guest.update({ where: { id: guestId }, data: { archivedAt: now } });
    await transaction.guestEvent.updateMany({ where: { guestId, state: GuestEventState.ACTIVE }, data: { state: GuestEventState.REMOVED, removedAt: now } });
    await transaction.guestActivationCredential.updateMany({ where: { guestId }, data: { state: "REVOKED", revokedAt: now } });
    await transaction.guestSession.updateMany({ where: { guestId, revokedAt: null }, data: { revokedAt: now } });
    await transaction.qRCredential.updateMany({ where: { guestId, state: QrCredentialState.ACTIVE }, data: { state: QrCredentialState.REVOKED, revokedAt: now } });
    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "guest",
      resourceId: guestId,
      action: "guest.archived",
      metadata: { had_history: true },
    });
    return { guestId, invitationVersion, changed: true, mode: "archived" } satisfies GuestMutationResult;
  });
}

const mergeGuestSelect = {
  id: true,
  displayName: true,
  displayPhone: true,
  eventAssignments: {
    select: {
      id: true,
      eventId: true,
      state: true,
      maxPartySize: true,
      event: { select: { name: true } },
      rsvp: { select: { id: true } },
      attendance: { select: { id: true } },
    },
  },
} satisfies Prisma.GuestSelect;

type MergeGuestRecord = NonNullable<Prisma.Result<
  PrismaClient["guest"],
  { select: typeof mergeGuestSelect },
  "findFirst"
>>;

function hasGuestHistory(assignment: Pick<MergeGuestRecord["eventAssignments"][number], "rsvp" | "attendance">): boolean {
  return assignment.rsvp !== null || assignment.attendance !== null;
}

function mergeConflicts(
  source: MergeGuestRecord,
  target: MergeGuestRecord,
): readonly GuestMergeConflict[] {
  const targetByEventId = new Map(target.eventAssignments.map((assignment) => [assignment.eventId, assignment]));
  return source.eventAssignments.flatMap((sourceAssignment) => {
    const targetAssignment = targetByEventId.get(sourceAssignment.eventId);
    if (!targetAssignment || (!hasGuestHistory(sourceAssignment) && !hasGuestHistory(targetAssignment))) return [];
    return [{
      eventId: sourceAssignment.eventId,
      eventName: sourceAssignment.event.name,
      sourceHasRsvp: sourceAssignment.rsvp !== null,
      sourceHasAttendance: sourceAssignment.attendance !== null,
      targetHasRsvp: targetAssignment.rsvp !== null,
      targetHasAttendance: targetAssignment.attendance !== null,
    }];
  });
}

function toMergePreview(
  source: MergeGuestRecord,
  target: MergeGuestRecord,
): GuestMergePreview {
  return {
    source: { id: source.id, displayName: source.displayName, displayPhone: source.displayPhone },
    target: { id: target.id, displayName: target.displayName, displayPhone: target.displayPhone },
    conflicts: mergeConflicts(source, target),
  };
}

async function loadMergeGuests(
  transaction: Prisma.TransactionClient,
  invitationId: string,
  sourceGuestId: string,
  targetGuestId: string,
): Promise<{ source: MergeGuestRecord; target: MergeGuestRecord }> {
  const [source, target] = await Promise.all([
    transaction.guest.findFirst({ where: { id: sourceGuestId, invitationId, archivedAt: null }, select: mergeGuestSelect }),
    transaction.guest.findFirst({ where: { id: targetGuestId, invitationId, archivedAt: null }, select: mergeGuestSelect }),
  ]);
  if (!source || !target) throw new DomainError(ERROR_CODES.NOT_FOUND);
  return { source, target };
}

/** Read the conflicts that an owner must review before merging two guests. */
export async function getGuestMergePreview(
  database: Pick<PrismaClient, "$transaction">,
  userId: string,
  invitationId: string,
  input: Pick<GuestMergeInput, "sourceGuestId" | "targetGuestId">,
): Promise<GuestMergePreview> {
  const pair = guestMergeInputSchema.pick({ sourceGuestId: true, targetGuestId: true }).parse(input);
  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    const guests = await loadMergeGuests(transaction, invitationId, pair.sourceGuestId, pair.targetGuestId);
    return toMergePreview(guests.source, guests.target);
  });
}

/**
 * Merge a duplicate into the explicitly chosen target guest.
 *
 * Source relations are retained when histories conflict. This deliberately
 * makes the source an archived historical record instead of destructively
 * folding one RSVP/check-in history over another.
 */
export async function mergeGuests(
  database: GuestDatabase,
  userId: string,
  invitationId: string,
  input: GuestMergeInput,
  options: GuestServiceOptions = {},
): Promise<GuestMutationResult> {
  const parsed = guestMergeInputSchema.parse(input);
  const now = options.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Guest clock is invalid");

  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, version: true, commercialState: true, trialEndsAt: true, activeUntil: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const guests = await loadMergeGuests(transaction, invitationId, parsed.sourceGuestId, parsed.targetGuestId);
    const conflicts = mergeConflicts(guests.source, guests.target);
    const conflictIds = new Set(conflicts.map((conflict) => conflict.eventId));
    const resolutions = new Map(parsed.conflictResolutions.map((resolution) => [resolution.eventId, resolution.keep]));
    const missing = conflicts.filter((conflict) => !resolutions.has(conflict.eventId)).map((conflict) => conflict.eventId);
    const extra = parsed.conflictResolutions.filter((resolution) => !conflictIds.has(resolution.eventId)).map((resolution) => resolution.eventId);
    if (missing.length > 0 || extra.length > 0) {
      throw new DomainError(ERROR_CODES.CONFLICT, {
        details: {
          ...(missing.length > 0 ? { conflicts: missing } : {}),
          ...(extra.length > 0 ? { resolutions: extra } : {}),
        },
      });
    }

    const invitationVersion = await assertEditableAndLock(transaction, userId, invitation, now);
    const targetEventIds = new Set(guests.target.eventAssignments.map((assignment) => assignment.eventId));
    let movedAssignmentCount = 0;
    let retainedHistoryCount = 0;

    for (const sourceAssignment of guests.source.eventAssignments) {
      const targetAssignmentExists = targetEventIds.has(sourceAssignment.eventId);
      if (!targetAssignmentExists) {
        await transaction.guestEvent.update({ where: { id: sourceAssignment.id }, data: { guestId: guests.target.id } });
        movedAssignmentCount += 1;
        continue;
      }

      if (hasGuestHistory(sourceAssignment)) {
        await transaction.guestEvent.update({
          where: { id: sourceAssignment.id },
          data: { state: GuestEventState.REMOVED, removedAt: now },
        });
        retainedHistoryCount += 1;
      } else {
        await transaction.guestEvent.delete({ where: { id: sourceAssignment.id } });
      }
    }

    await transaction.guest.update({
      where: { id: guests.source.id },
      data: { archivedAt: now, mergedIntoGuestId: guests.target.id, mergedAt: now },
    });
    await transaction.guestActivationCredential.updateMany({ where: { guestId: guests.source.id }, data: { state: "REVOKED", revokedAt: now } });
    await transaction.guestSession.updateMany({ where: { guestId: guests.source.id, revokedAt: null }, data: { revokedAt: now } });
    await transaction.qRCredential.updateMany({ where: { guestId: guests.source.id, state: QrCredentialState.ACTIVE }, data: { state: QrCredentialState.REVOKED, revokedAt: now } });
    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "guest",
      resourceId: guests.target.id,
      action: "guest.merged",
      metadata: {
        source_guest_id: guests.source.id,
        conflict_count: conflicts.length,
        resolved_conflict_count: parsed.conflictResolutions.length,
        source_resolution_count: parsed.conflictResolutions.filter((resolution) => resolution.keep === "SOURCE").length,
        target_resolution_count: parsed.conflictResolutions.filter((resolution) => resolution.keep === "TARGET").length,
        source_resolution_events: parsed.conflictResolutions.filter((resolution) => resolution.keep === "SOURCE").map((resolution) => resolution.eventId),
        target_resolution_events: parsed.conflictResolutions.filter((resolution) => resolution.keep === "TARGET").map((resolution) => resolution.eventId),
        moved_assignment_count: movedAssignmentCount,
        retained_history_count: retainedHistoryCount,
      },
    });

    return {
      guestId: guests.target.id,
      targetGuestId: guests.target.id,
      sourceGuestId: guests.source.id,
      invitationVersion,
      changed: true,
      mode: "merged",
    } satisfies GuestMutationResult;
  });
}

export const mergeGuest = mergeGuests;
