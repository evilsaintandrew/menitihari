import {
  GuestEventState,
  Prisma,
  RsvpStatus,
  type PrismaClient,
} from "@/generated/prisma/client";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { isPublishedInvitationAvailable } from "@/modules/lifecycle";
import { z } from "zod";

const RSVP_REASON_MAX_LENGTH = 500;

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
}

export interface PersonalizedRsvpData {
  readonly enabled: boolean;
  readonly events: readonly PersonalizedRsvpEvent[];
}

export interface RsvpSummaryItem {
  readonly eventId: string;
  readonly eventName: string;
  readonly status: RsvpStatus;
  readonly attendanceCount: number | null;
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
  readonly rsvp: {
    readonly status: RsvpStatus;
    readonly attendanceCount: number | null;
    readonly notAttendingReason: string | null;
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
  rsvp: { select: { status: true, attendanceCount: true, notAttendingReason: true } },
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
      await transaction.rSVP.upsert({
        where: { guestEventId: assignment.id },
        create: {
          guestEventId: assignment.id,
          status: response.status,
          attendanceCount: response.status === RsvpStatus.ATTENDING ? response.attendanceCount : null,
          notAttendingReason: response.status === RsvpStatus.NOT_ATTENDING ? response.notAttendingReason || null : null,
          source: "PERSONALIZED",
          ownerOverride: false,
          updatedBy: guestId,
        },
        update: {
          status: response.status,
          attendanceCount: response.status === RsvpStatus.ATTENDING ? response.attendanceCount : null,
          notAttendingReason: response.status === RsvpStatus.NOT_ATTENDING ? response.notAttendingReason || null : null,
          source: "PERSONALIZED",
          ownerOverride: false,
          updatedBy: guestId,
        },
      });
    }

    const summary = await transaction.guestEvent.findMany({
      where: { guestId, state: GuestEventState.ACTIVE, event: { invitationId, archivedAt: null } },
      orderBy: { event: { startsAt: "asc" } },
      select: {
        eventId: true,
        event: { select: { name: true } },
        rsvp: { select: { status: true, attendanceCount: true } },
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
      })),
    };
  });
}

export const submitRsvp = submitPersonalizedRsvp;

export * from "./rate-limit";
