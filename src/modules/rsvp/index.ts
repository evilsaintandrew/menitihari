import {
  CommercialState,
  EventVisibility,
  GuestEventState,
  PublicRsvpApprovalState,
  Prisma,
  RsvpStatus,
  RsvpSource,
  type PrismaClient,
} from "@/generated/prisma/client";
import { issueGuestActivationCredentialInTransaction } from "@/modules/access";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { getInvitationLifecycleCapabilities, isPublishedInvitationAvailable } from "@/modules/lifecycle";
import { hasGuestDuplicateWarning, normalizeGuestName, normalizePhone } from "@/modules/guests";
import { z } from "zod";

import {
  INVITED_PEOPLE_LIMIT,
  type InvitedPeopleCapacity,
} from "@/modules/guests/capacity";

const RSVP_REASON_MAX_LENGTH = 500;

const publicRsvpPhoneSchema = z
  .string()
  .trim()
  .max(40, "Nomor telepon maksimal 40 karakter.")
  .refine((value) => value === "" || /^[+()\d\s.-]+$/.test(value), "Masukkan nomor telepon yang valid.")
  .optional();

export const publicRsvpInputSchema = z.object({
  displayName: z.string().trim().min(1, "Masukkan nama Anda.").max(160, "Nama maksimal 160 karakter."),
  phone: publicRsvpPhoneSchema,
  partySize: z.number().int().min(1, "Jumlah hadir minimal 1.").max(INVITED_PEOPLE_LIMIT, "Jumlah hadir terlalu banyak."),
}).strict();

export type PublicRsvpInput = z.input<typeof publicRsvpInputSchema>;

export const publicRsvpSettingsInputSchema = z.object({
  enabled: z.boolean(),
  requireApproval: z.boolean(),
  requirePhone: z.boolean(),
  maxPartySize: z.number().int().min(1).max(INVITED_PEOPLE_LIMIT),
  eventIds: z.array(z.string().trim().min(1).max(128)).max(5).superRefine((eventIds, context) => {
    if (new Set(eventIds).size !== eventIds.length) {
      context.addIssue({ code: "custom", message: "Acara hanya boleh dipilih sekali." });
    }
  }),
}).strict().superRefine((input, context) => {
  if (input.enabled && input.eventIds.length === 0) {
    context.addIssue({ path: ["eventIds"], code: "custom", message: "Pilih setidaknya satu acara." });
  }
});

export type PublicRsvpSettingsInput = z.input<typeof publicRsvpSettingsInputSchema>;

export interface PublicRsvpEvent {
  readonly id: string;
  readonly name: string;
  readonly startsAt: string;
}

export interface PublicRsvpData {
  readonly enabled: boolean;
  readonly approvalRequired: boolean;
  readonly requirePhone: boolean;
  readonly maxPartySize: number;
  readonly events: readonly PublicRsvpEvent[];
  readonly capacity: InvitedPeopleCapacity;
  readonly closed: boolean;
}

export interface PublicRsvpOwnerEvent {
  readonly id: string;
  readonly name: string;
  readonly startsAt: string;
  readonly rsvpEnabled: boolean;
  readonly publicRsvpEnabled: boolean;
  readonly selectable: boolean;
}

export interface PublicRsvpOwnerSettings {
  readonly invitationId: string;
  readonly enabled: boolean;
  readonly requireApproval: boolean;
  readonly requirePhone: boolean;
  readonly maxPartySize: number;
  readonly events: readonly PublicRsvpOwnerEvent[];
}

export interface PublicRsvpMutationResult {
  readonly invitationId: string;
  readonly guestId: string;
  readonly personalizedPath: string;
  readonly duplicateWarning: boolean;
  readonly approvalPending: boolean;
  readonly events: readonly PublicRsvpEvent[];
}

interface PublicRsvpEventRecord {
  readonly id: string;
  readonly name: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly rsvpEnabled: boolean;
  readonly publicRsvpEnabled: boolean;
  readonly visibility: EventVisibility;
  readonly cancelledAt: Date | null;
  readonly archivedAt: Date | null;
  readonly rsvpClosesAt: Date | null;
}

function isPublicRsvpEventOpen(event: PublicRsvpEventRecord, now: Date): boolean {
  return event.publicRsvpEnabled &&
    event.rsvpEnabled &&
    event.visibility === EventVisibility.GENERIC &&
    event.cancelledAt === null &&
    event.archivedAt === null &&
    (event.endsAt === null || event.endsAt.getTime() > now.getTime()) &&
    (event.rsvpClosesAt === null || event.rsvpClosesAt.getTime() > now.getTime());
}

export function buildPublicRsvpData(
  input: {
    readonly genericAccessEnabled: boolean;
    readonly publicRsvpEnabled: boolean;
    readonly publicRsvpRequireApproval: boolean;
    readonly publicRsvpRequirePhone: boolean;
    readonly publicRsvpMaxPartySize: number;
  },
  events: readonly PublicRsvpEventRecord[],
  capacity: InvitedPeopleCapacity,
  now = new Date(),
): PublicRsvpData {
  const acceptingEvents = events
    .filter((event) => isPublicRsvpEventOpen(event, now))
    .filter((event) => Number.isFinite(event.startsAt.getTime()))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
    .map((event) => ({ id: event.id, name: event.name, startsAt: event.startsAt.toISOString() }));
  const enabled = input.genericAccessEnabled && input.publicRsvpEnabled;
  return {
    enabled,
    approvalRequired: input.publicRsvpRequireApproval,
    requirePhone: input.publicRsvpRequirePhone,
    maxPartySize: input.publicRsvpMaxPartySize,
    events: acceptingEvents,
    capacity,
    closed: !enabled || acceptingEvents.length === 0 || capacity.used >= capacity.limit,
  };
}

const personalizedRsvpResponseSchema = z.object({
  eventId: z.string().trim().min(1).max(128),
  status: z.enum([RsvpStatus.ATTENDING, RsvpStatus.NOT_ATTENDING]),
  attendanceCount: z.number().int().min(1).max(500).optional().nullable(),
  notAttendingReason: z.string().trim().max(RSVP_REASON_MAX_LENGTH).optional().nullable(),
}).strict().superRefine((response, context) => {
  if (response.status === RsvpStatus.ATTENDING && (response.attendanceCount === undefined || response.attendanceCount === null)) {
    context.addIssue({ path: ["attendanceCount"], code: "custom", message: "Masukkan jumlah yang hadir." });
  }
  if (response.status === RsvpStatus.NOT_ATTENDING && response.attendanceCount !== undefined && response.attendanceCount !== null) {
    context.addIssue({ path: ["attendanceCount"], code: "custom", message: "Jumlah hadir tidak berlaku untuk jawaban tidak hadir." });
  }
});

export const personalizedRsvpInputSchema = z.object({
  responses: z.array(personalizedRsvpResponseSchema).min(1, "Pilih jawaban RSVP.").max(5).superRefine((responses, context) => {
    const eventIds = new Set<string>();
    responses.forEach((response, index) => {
      if (eventIds.has(response.eventId)) {
        context.addIssue({ path: [index, "eventId"], code: "custom", message: "Acara hanya boleh dipilih sekali." });
      }
      eventIds.add(response.eventId);
    });
  }),
}).strict();

export type PersonalizedRsvpInput = z.input<typeof personalizedRsvpInputSchema>;

export interface PersonalizedRsvpEvent {
  readonly id: string;
  readonly name: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly timezone: string;
  readonly maxPartySize: number;
  readonly status: RsvpStatus;
  readonly attendanceCount: number | null;
  readonly notAttendingReason: string | null;
  readonly canRespond: boolean;
  readonly qrEligibility: QrEligibility;
}

export type QrEligibility = "ELIGIBLE" | "PENDING_APPROVAL" | "NOT_ELIGIBLE";

export interface PersonalizedRsvpData {
  readonly enabled: boolean;
  readonly events: readonly PersonalizedRsvpEvent[];
}

export interface RsvpSummaryItem {
  readonly eventId: string;
  readonly eventName: string;
  readonly status: RsvpStatus;
  readonly attendanceCount: number | null;
  readonly qrEligibility?: QrEligibility;
}

export interface RsvpMutationResult {
  readonly invitationId: string;
  readonly guestId: string;
  readonly summary: readonly RsvpSummaryItem[];
}

interface RsvpEventRecord {
  readonly id: string;
  readonly name: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly timezone: string;
  readonly rsvpEnabled: boolean;
  readonly rsvpClosesAt: Date | null;
  readonly cancelledAt: Date | null;
}

export interface PersonalizedRsvpAssignmentRecord {
  readonly id: string;
  readonly eventId: string;
  readonly maxPartySize: number;
  readonly rsvpEligible: boolean;
  readonly checkInEligible: boolean;
  readonly publicRsvpApproval: PublicRsvpApprovalState;
  readonly rsvp: {
    readonly status: RsvpStatus;
    readonly attendanceCount: number | null;
    readonly notAttendingReason: string | null;
    readonly source: RsvpSource;
  } | null;
  readonly event: RsvpEventRecord;
}

function isoOrNull(value: Date | null): string | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function isRsvpOpen(
  invitationEnabled: boolean,
  assignment: PersonalizedRsvpAssignmentRecord,
  now: Date,
): boolean {
  return invitationEnabled &&
    assignment.rsvpEligible &&
    assignment.event.rsvpEnabled &&
    assignment.event.cancelledAt === null &&
    (assignment.event.endsAt === null || assignment.event.endsAt.getTime() > now.getTime()) &&
    (assignment.event.rsvpClosesAt === null || assignment.event.rsvpClosesAt.getTime() > now.getTime());
}

function getQrEligibility(
  assignment: Pick<PersonalizedRsvpAssignmentRecord, "publicRsvpApproval" | "checkInEligible" | "rsvp">,
): QrEligibility {
  if (assignment.rsvp?.status !== RsvpStatus.ATTENDING || !assignment.checkInEligible) {
    return assignment.rsvp?.source === RsvpSource.PUBLIC && assignment.publicRsvpApproval === PublicRsvpApprovalState.PENDING
      ? "PENDING_APPROVAL"
      : "NOT_ELIGIBLE";
  }
  return "ELIGIBLE";
}

export function buildPersonalizedRsvpData(
  invitationEnabled: boolean,
  assignments: readonly PersonalizedRsvpAssignmentRecord[],
  now = new Date(),
): PersonalizedRsvpData {
  return {
    enabled: invitationEnabled,
    events: assignments
      .filter((assignment) => isoOrNull(assignment.event.startsAt) !== null)
      .slice()
      .sort((left, right) => left.event.startsAt.getTime() - right.event.startsAt.getTime())
      .map((assignment) => ({
        id: assignment.eventId,
        name: assignment.event.name,
        startsAt: assignment.event.startsAt.toISOString(),
        endsAt: isoOrNull(assignment.event.endsAt),
        timezone: assignment.event.timezone,
        maxPartySize: assignment.maxPartySize,
        status: assignment.rsvp?.status ?? RsvpStatus.PENDING,
        attendanceCount: assignment.rsvp?.status === RsvpStatus.ATTENDING
          ? assignment.rsvp.attendanceCount
          : null,
        notAttendingReason: assignment.rsvp?.status === RsvpStatus.NOT_ATTENDING
          ? assignment.rsvp.notAttendingReason
          : null,
        canRespond: isRsvpOpen(invitationEnabled, assignment, now),
        qrEligibility: getQrEligibility(assignment),
      })),
  };
}

type RsvpDatabase = Pick<PrismaClient, "$transaction">;

const invitationSelect = {
  id: true,
  publicationState: true,
  commercialState: true,
  trialEndsAt: true,
  activeUntil: true,
  rsvpEnabled: true,
} satisfies Prisma.InvitationSelect;

const assignmentSelect = {
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
} satisfies Prisma.GuestEventSelect;

function assertValidClock(now: Date): void {
  if (!Number.isFinite(now.getTime())) throw new Error("RSVP clock is invalid");
}

function assertRsvpOpen(
  invitation: { readonly rsvpEnabled: boolean },
  assignment: PersonalizedRsvpAssignmentRecord,
  now: Date,
): void {
  if (!isRsvpOpen(invitation.rsvpEnabled, assignment, now)) {
    throw new DomainError(ERROR_CODES.RSVP_CLOSED);
  }
}

/**
 * Persists all submitted personalized responses in one transaction. The
 * guest/event relationship and every RSVP window are re-read from PostgreSQL
 * so a client cannot answer for another guest or bypass a close boundary.
 */
export async function submitPersonalizedRsvp(
  database: RsvpDatabase,
  invitationId: string,
  guestId: string,
  input: PersonalizedRsvpInput,
  options: { readonly now?: () => Date } = {},
): Promise<RsvpMutationResult> {
  const parsed = personalizedRsvpInputSchema.parse(input);
  const now = options.now?.() ?? new Date();
  assertValidClock(now);

  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, publicationState: "PUBLISHED" },
      select: invitationSelect,
    });
    if (!invitation || !isPublishedInvitationAvailable(invitation, now)) {
      throw new DomainError(ERROR_CODES.NOT_FOUND);
    }

    const assignments = await transaction.guestEvent.findMany({
      where: {
        guestId,
        state: GuestEventState.ACTIVE,
        eventId: { in: parsed.responses.map((response) => response.eventId) },
        guest: { id: guestId, invitationId, archivedAt: null },
        event: { invitationId, archivedAt: null },
      },
      select: assignmentSelect,
    }) as PersonalizedRsvpAssignmentRecord[];
    if (assignments.length !== parsed.responses.length) {
      throw new DomainError(ERROR_CODES.NOT_INVITED_TO_EVENT);
    }

    const assignmentsByEventId = new Map(assignments.map((assignment) => [assignment.eventId, assignment]));
    for (const response of parsed.responses) {
      const assignment = assignmentsByEventId.get(response.eventId);
      if (!assignment) throw new DomainError(ERROR_CODES.NOT_INVITED_TO_EVENT);
      assertRsvpOpen(invitation, assignment, now);
      if (response.status === RsvpStatus.ATTENDING && (response.attendanceCount === null || response.attendanceCount === undefined || response.attendanceCount > assignment.maxPartySize)) {
        throw new DomainError(ERROR_CODES.VALIDATION_FAILED, {
          details: { attendance_count: ["Jumlah hadir melebihi batas acara."] },
        });
      }
    }

    for (const response of parsed.responses) {
      const assignment = assignmentsByEventId.get(response.eventId)!;
      const isPublicRsvp = assignment.rsvp?.source === RsvpSource.PUBLIC;
      const nextCheckInEligible = isPublicRsvp &&
        response.status === RsvpStatus.ATTENDING &&
        assignment.publicRsvpApproval === PublicRsvpApprovalState.APPROVED;
      await transaction.rSVP.upsert({
        where: { guestEventId: assignment.id },
        create: {
          guestEventId: assignment.id,
          status: response.status,
          attendanceCount: response.status === RsvpStatus.ATTENDING ? response.attendanceCount : null,
          notAttendingReason: response.status === RsvpStatus.NOT_ATTENDING ? response.notAttendingReason || null : null,
          source: isPublicRsvp ? RsvpSource.PUBLIC : RsvpSource.PERSONALIZED,
          ownerOverride: false,
          updatedBy: guestId,
        },
        update: {
          status: response.status,
          attendanceCount: response.status === RsvpStatus.ATTENDING ? response.attendanceCount : null,
          notAttendingReason: response.status === RsvpStatus.NOT_ATTENDING ? response.notAttendingReason || null : null,
          source: isPublicRsvp ? RsvpSource.PUBLIC : RsvpSource.PERSONALIZED,
          ownerOverride: false,
          updatedBy: guestId,
        },
      });
      if (isPublicRsvp && assignment.checkInEligible !== nextCheckInEligible) {
        await transaction.guestEvent.update({
          where: { id: assignment.id },
          data: { checkInEligible: nextCheckInEligible },
        });
        await writeAuditEvent(transaction, {
          actorId: null,
          invitationId,
          resourceType: "guest_event",
          resourceId: assignment.id,
          action: "guest.public_rsvp_eligibility_updated",
          metadata: {
            approval_state: assignment.publicRsvpApproval,
            previous_check_in_eligible: assignment.checkInEligible,
            check_in_eligible: nextCheckInEligible,
            rsvp_status: response.status,
          },
          createdAt: now,
        });
      }
    }

    const summary = await transaction.guestEvent.findMany({
      where: { guestId, state: GuestEventState.ACTIVE, event: { invitationId, archivedAt: null } },
      orderBy: { event: { startsAt: "asc" } },
      select: {
        eventId: true,
        checkInEligible: true,
        publicRsvpApproval: true,
        event: { select: { name: true } },
        rsvp: { select: { status: true, source: true, attendanceCount: true } },
      },
    });

    return {
      invitationId,
      guestId,
      summary: summary.map((item) => ({
        eventId: item.eventId,
        eventName: item.event.name,
        status: item.rsvp?.status ?? RsvpStatus.PENDING,
        attendanceCount: item.rsvp?.status === RsvpStatus.ATTENDING ? item.rsvp.attendanceCount : null,
        qrEligibility: item.rsvp?.status === RsvpStatus.ATTENDING && item.rsvp.source === RsvpSource.PUBLIC && item.checkInEligible
          ? "ELIGIBLE"
          : item.rsvp?.status === RsvpStatus.ATTENDING && item.rsvp.source === RsvpSource.PUBLIC && item.publicRsvpApproval === PublicRsvpApprovalState.PENDING
            ? "PENDING_APPROVAL"
            : "NOT_ELIGIBLE",
      })),
    };
  });
}

export const submitRsvp = submitPersonalizedRsvp;

const publicRsvpOwnerSelect = {
  id: true,
  publicRsvpEnabled: true,
  publicRsvpRequireApproval: true,
  publicRsvpRequirePhone: true,
  publicRsvpMaxPartySize: true,
  events: {
    where: { archivedAt: null },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      name: true,
      startsAt: true,
      rsvpEnabled: true,
      publicRsvpEnabled: true,
      visibility: true,
      cancelledAt: true,
      archivedAt: true,
    },
  },
} satisfies Prisma.InvitationSelect;

type PublicRsvpOwnerRecord = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof publicRsvpOwnerSelect },
  "findFirst"
>>;

function selectablePublicRsvpEvent(
  event: Pick<PublicRsvpOwnerRecord["events"][number], "rsvpEnabled" | "visibility" | "cancelledAt" | "archivedAt">,
): boolean {
  return event.visibility === EventVisibility.GENERIC &&
    event.rsvpEnabled &&
    event.cancelledAt === null &&
    event.archivedAt === null;
}

function toPublicRsvpOwnerSettings(record: PublicRsvpOwnerRecord): PublicRsvpOwnerSettings {
  return {
    invitationId: record.id,
    enabled: record.publicRsvpEnabled,
    requireApproval: record.publicRsvpRequireApproval,
    requirePhone: record.publicRsvpRequirePhone,
    maxPartySize: record.publicRsvpMaxPartySize,
    events: record.events.map((event) => ({
      id: event.id,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      rsvpEnabled: event.rsvpEnabled,
      publicRsvpEnabled: event.publicRsvpEnabled,
      selectable: selectablePublicRsvpEvent(event),
    })),
  };
}

export async function getPublicRsvpSettingsForOwner(
  database: Pick<PrismaClient, "invitation">,
  userId: string,
  invitationId: string,
): Promise<PublicRsvpOwnerSettings | null> {
  const record = await database.invitation.findFirst({
    where: { id: invitationId, members: { some: { userId, role: "OWNER" } } },
    select: publicRsvpOwnerSelect,
  });
  return record ? toPublicRsvpOwnerSettings(record) : null;
}

function assertInvitationCanEditPublicRsvp(
  invitation: {
    readonly commercialState: CommercialState;
    readonly trialEndsAt: Date;
    readonly activeUntil: Date | null;
  },
  now: Date,
): void {
  if (!getInvitationLifecycleCapabilities(invitation.commercialState, invitation.trialEndsAt, now, invitation.activeUntil).canEdit) {
    throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
  }
}

export async function setPublicRsvpSettings(
  database: RsvpDatabase,
  userId: string,
  invitationId: string,
  input: PublicRsvpSettingsInput,
  options: { readonly now?: () => Date } = {},
): Promise<PublicRsvpOwnerSettings> {
  const parsed = publicRsvpSettingsInputSchema.parse(input);
  const now = options.now?.() ?? new Date();
  assertValidClock(now);

  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, members: { some: { userId, role: "OWNER" } } },
      select: { id: true, commercialState: true, trialEndsAt: true, activeUntil: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    assertInvitationCanEditPublicRsvp(invitation, now);

    const events = await transaction.event.findMany({
      where: { invitationId, id: { in: parsed.eventIds } },
      select: { id: true, rsvpEnabled: true, visibility: true, cancelledAt: true, archivedAt: true },
    });
    if (events.length !== parsed.eventIds.length || events.some((event) => !selectablePublicRsvpEvent(event))) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, { details: { event_ids: ["Pilih acara publik yang masih aktif dan mendukung RSVP."] } });
    }

    await transaction.invitation.update({
      where: { id: invitationId },
      data: {
        publicRsvpEnabled: parsed.enabled,
        publicRsvpRequireApproval: parsed.requireApproval,
        publicRsvpRequirePhone: parsed.requirePhone,
        publicRsvpMaxPartySize: parsed.maxPartySize,
        version: { increment: 1 },
      },
    });
    await transaction.event.updateMany({
      where: { invitationId, archivedAt: null },
      data: { publicRsvpEnabled: false },
    });
    if (parsed.eventIds.length > 0) {
      await transaction.event.updateMany({
        where: { invitationId, id: { in: parsed.eventIds }, archivedAt: null },
        data: { publicRsvpEnabled: true },
      });
    }

    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "invitation",
      resourceId: invitationId,
      action: "invitation.public_rsvp_updated",
      metadata: {
        enabled: parsed.enabled,
        require_approval: parsed.requireApproval,
        require_contact_number: parsed.requirePhone,
        max_party_size: parsed.maxPartySize,
        event_count: parsed.eventIds.length,
      },
      createdAt: now,
    });

    const updated = await transaction.invitation.findFirst({
      where: { id: invitationId },
      select: publicRsvpOwnerSelect,
    });
    if (!updated) throw new DomainError(ERROR_CODES.NOT_FOUND);
    return toPublicRsvpOwnerSettings(updated);
  });
}

type PublicRsvpMutationOptions = { readonly now?: () => Date };

export async function submitPublicRsvp(
  database: RsvpDatabase,
  invitationId: string,
  input: PublicRsvpInput,
  options: PublicRsvpMutationOptions = {},
): Promise<PublicRsvpMutationResult> {
  const parsed = publicRsvpInputSchema.parse(input);
  const now = options.now?.() ?? new Date();
  assertValidClock(now);
  const normalizedName = normalizeGuestName(parsed.displayName);
  const normalizedPhone = normalizePhone(parsed.phone);

  return database.$transaction(async (transaction) => {
    const locked = await transaction.invitation.updateMany({
      where: { id: invitationId },
      data: { version: { increment: 1 } },
    });
    if (locked.count !== 1) throw new DomainError(ERROR_CODES.NOT_FOUND);

    const invitation = await transaction.invitation.findUnique({
      where: { id: invitationId },
      select: {
        id: true,
        genericAccessEnabled: true,
        publicRsvpEnabled: true,
        publicRsvpRequireApproval: true,
        publicRsvpRequirePhone: true,
        publicRsvpMaxPartySize: true,
        publicationState: true,
        commercialState: true,
        trialEndsAt: true,
        activeUntil: true,
      },
    });
    if (!invitation ||
      !invitation.genericAccessEnabled ||
      !invitation.publicRsvpEnabled ||
      !isPublishedInvitationAvailable(invitation, now)) {
      throw new DomainError(ERROR_CODES.RSVP_CLOSED);
    }
    if (invitation.publicRsvpRequirePhone && !normalizedPhone) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, { details: { phone: ["Nomor telepon wajib diisi."] } });
    }
    if (parsed.partySize > invitation.publicRsvpMaxPartySize) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, { details: { party_size: ["Jumlah hadir melebihi batas RSVP publik."] } });
    }

    const events = await transaction.event.findMany({
      where: {
        invitationId,
        archivedAt: null,
        publicRsvpEnabled: true,
        rsvpEnabled: true,
        visibility: EventVisibility.GENERIC,
        cancelledAt: null,
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        rsvpEnabled: true,
        publicRsvpEnabled: true,
        visibility: true,
        cancelledAt: true,
        archivedAt: true,
        rsvpClosesAt: true,
      },
    }) as PublicRsvpEventRecord[];
    const openEvents = events.filter((event) => isPublicRsvpEventOpen(event, now));
    if (openEvents.length === 0) throw new DomainError(ERROR_CODES.RSVP_CLOSED);

    const currentCapacity = await transaction.guestEvent.aggregate({
      where: { state: GuestEventState.ACTIVE, guest: { invitationId, archivedAt: null } },
      _sum: { maxPartySize: true },
    });
    const requestedCapacity = invitation.publicRsvpMaxPartySize * openEvents.length;
    if ((currentCapacity._sum.maxPartySize ?? 0) + requestedCapacity > INVITED_PEOPLE_LIMIT) {
      throw new DomainError(ERROR_CODES.CAPACITY_EXCEEDED);
    }

    const duplicateWarning = await hasGuestDuplicateWarning(transaction, invitationId, normalizedName, normalizedPhone);
    const publicRsvpApproval = invitation.publicRsvpRequireApproval
      ? PublicRsvpApprovalState.PENDING
      : PublicRsvpApprovalState.APPROVED;
    const guest = await transaction.guest.create({
      data: {
        invitationId,
        displayName: parsed.displayName,
        normalizedName,
        normalizedPhone,
        displayPhone: parsed.phone?.trim() || null,
        defaultMaxPartySize: invitation.publicRsvpMaxPartySize,
      },
      select: { id: true },
    });
    for (const event of openEvents) {
      const assignment = await transaction.guestEvent.create({
        data: {
          guestId: guest.id,
          eventId: event.id,
          maxPartySize: invitation.publicRsvpMaxPartySize,
          rsvpEligible: true,
          checkInEligible: publicRsvpApproval === PublicRsvpApprovalState.APPROVED,
          publicRsvpApproval,
        },
        select: { id: true },
      });
      await transaction.rSVP.create({
        data: {
          guestEventId: assignment.id,
          status: RsvpStatus.ATTENDING,
          attendanceCount: parsed.partySize,
          source: "PUBLIC",
          ownerOverride: false,
          updatedBy: null,
        },
      });
      await writeAuditEvent(transaction, {
        actorId: null,
        invitationId,
        resourceType: "guest_event",
        resourceId: assignment.id,
        action: "guest.public_rsvp_eligibility_updated",
        metadata: {
          approval_state: publicRsvpApproval,
          previous_approval_state: PublicRsvpApprovalState.PENDING,
          check_in_eligible: publicRsvpApproval === PublicRsvpApprovalState.APPROVED,
          rsvp_status: RsvpStatus.ATTENDING,
        },
        createdAt: now,
      });
    }

    const slug = await transaction.invitationSlug.findFirst({
      where: { invitationId, isCanonical: true },
      select: { slug: true },
    });
    if (!slug) throw new DomainError(ERROR_CODES.NOT_FOUND);
    const credential = await issueGuestActivationCredentialInTransaction(transaction, invitationId, guest.id, now);

    await writeAuditEvent(transaction, {
      actorId: null,
      invitationId,
      resourceType: "guest",
      resourceId: guest.id,
      action: "guest.public_rsvp_created",
      metadata: {
        event_count: openEvents.length,
        party_size: parsed.partySize,
        duplicate_warning: duplicateWarning,
      },
      createdAt: now,
    });

    return {
      invitationId,
      guestId: guest.id,
      personalizedPath: `/${encodeURIComponent(slug.slug)}/g/${credential.token}`,
      duplicateWarning,
      approvalPending: publicRsvpApproval === PublicRsvpApprovalState.PENDING,
      events: openEvents.map((event) => ({ id: event.id, name: event.name, startsAt: event.startsAt.toISOString() })),
    } satisfies PublicRsvpMutationResult;
  });
}

export * from "./rate-limit";
export {
  overrideRsvp,
  publicRsvpApprovalInputSchema,
  ownerRsvpControlInputSchema,
  ownerRsvpOverrideInputSchema,
  setPublicRsvpApproval,
  setOwnerRsvpControl,
  type OwnerRsvpControlInput,
  type OwnerRsvpOverrideInput,
  type PublicRsvpApprovalInput,
  type PublicRsvpApprovalMutationResult,
  type RsvpControlMutationResult,
  type RsvpOverrideMutationResult,
} from "./owner-controls";
