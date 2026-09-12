import {
  CommercialState,
  GuestEventState,
  RsvpStatus,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { getInvitationLifecycleCapabilities } from "@/modules/lifecycle";
import { ownerMembershipWhere } from "@/modules/invitations/authorization";
import { localDateTimeToInstant } from "@/modules/events";
import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const ownerRsvpControlInputSchema = z
  .object({
    eventId: z.string().trim().min(1).max(128),
    action: z.enum(["CLOSE", "REOPEN", "SCHEDULE"]),
    closesAtDate: z.string().trim().regex(DATE_PATTERN, "Masukkan tanggal penutupan yang valid.").optional(),
    closesAtTime: z.string().trim().regex(TIME_PATTERN, "Masukkan waktu penutupan yang valid.").optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.action === "SCHEDULE" && (!input.closesAtDate || !input.closesAtTime)) {
      context.addIssue({ code: "custom", path: ["closesAtDate"], message: "Masukkan tanggal dan waktu penutupan RSVP." });
    }
    if (input.action !== "SCHEDULE" && (input.closesAtDate || input.closesAtTime)) {
      context.addIssue({ code: "custom", path: ["closesAtDate"], message: "Jadwal hanya diperlukan untuk menutup pada waktu tertentu." });
    }
  });

export type OwnerRsvpControlInput = z.input<typeof ownerRsvpControlInputSchema>;

export const ownerRsvpOverrideInputSchema = z
  .object({
    guestEventId: z.string().trim().min(1).max(128),
    status: z.enum([RsvpStatus.PENDING, RsvpStatus.ATTENDING, RsvpStatus.NOT_ATTENDING]),
    attendanceCount: z.number().int().min(1).max(500).optional().nullable(),
    notAttendingReason: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.status === RsvpStatus.ATTENDING && (input.attendanceCount === undefined || input.attendanceCount === null)) {
      context.addIssue({ code: "custom", path: ["attendanceCount"], message: "Masukkan jumlah hadir." });
    }
    if (input.status !== RsvpStatus.ATTENDING && input.attendanceCount !== undefined && input.attendanceCount !== null) {
      context.addIssue({ code: "custom", path: ["attendanceCount"], message: "Jumlah hadir hanya berlaku untuk jawaban hadir." });
    }
    if (input.status !== RsvpStatus.NOT_ATTENDING && input.notAttendingReason !== undefined && input.notAttendingReason !== null && input.notAttendingReason.trim() !== "") {
      context.addIssue({ code: "custom", path: ["notAttendingReason"], message: "Alasan hanya berlaku untuk jawaban tidak hadir." });
    }
  });

export type OwnerRsvpOverrideInput = z.input<typeof ownerRsvpOverrideInputSchema>;

export interface RsvpControlMutationResult {
  readonly invitationId: string;
  readonly eventId: string;
  readonly action: OwnerRsvpControlInput["action"];
  readonly rsvpClosesAt: Date | null;
  readonly changed: boolean;
}

export interface RsvpOverrideMutationResult {
  readonly invitationId: string;
  readonly guestEventId: string;
  readonly rsvpId: string;
  readonly status: RsvpStatus;
  readonly attendanceCount: number | null;
  readonly changed: boolean;
}

interface RsvpServiceOptions {
  readonly now?: () => Date;
}

type RsvpDatabase = Pick<PrismaClient, "$transaction">;

function assertValidClock(now: Date): void {
  if (!Number.isFinite(now.getTime())) throw new Error("RSVP clock is invalid");
}

function assertInvitationCanEdit(invitation: {
  readonly commercialState: CommercialState;
  readonly trialEndsAt: Date;
  readonly activeUntil: Date | null;
}, now: Date): void {
  if (!getInvitationLifecycleCapabilities(invitation.commercialState, invitation.trialEndsAt, now, invitation.activeUntil).canEdit) {
    throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
  }
}

function parseScheduledClose(
  input: OwnerRsvpControlInput,
  timezone: string,
): Date {
  if (!input.closesAtDate || !input.closesAtTime) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
  return localDateTimeToInstant(input.closesAtDate, input.closesAtTime, timezone);
}

/**
 * Changes the owner-controlled RSVP window for one active event. The close
 * boundary is persisted server-side; guest submissions re-read it in their
 * own transaction before accepting a response.
 */
export async function setOwnerRsvpControl(
  database: RsvpDatabase,
  userId: string,
  invitationId: string,
  input: OwnerRsvpControlInput,
  options: RsvpServiceOptions = {},
): Promise<RsvpControlMutationResult> {
  const parsed = ownerRsvpControlInputSchema.parse(input);
  const now = options.now?.() ?? new Date();
  assertValidClock(now);

  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, commercialState: true, trialEndsAt: true, activeUntil: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    assertInvitationCanEdit(invitation, now);

    const event = await transaction.event.findFirst({
      where: { id: parsed.eventId, invitationId, archivedAt: null },
      select: { id: true, timezone: true, endsAt: true, cancelledAt: true, rsvpEnabled: true, rsvpClosesAt: true },
    });
    if (!event) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (!event.rsvpEnabled || event.cancelledAt !== null || (event.endsAt !== null && event.endsAt.getTime() <= now.getTime())) {
      throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
    }

    const closesAt = parsed.action === "CLOSE"
      ? now
      : parsed.action === "REOPEN"
        ? null
        : parseScheduledClose(parsed, event.timezone);

    if (closesAt !== null) {
      if (parsed.action === "SCHEDULE" && closesAt.getTime() <= now.getTime()) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
      if (event.endsAt !== null && closesAt.getTime() > event.endsAt.getTime()) {
        throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
      }
    }

    const changed = event.rsvpClosesAt?.getTime() !== closesAt?.getTime();
    if (changed) {
      await transaction.event.update({ where: { id: event.id }, data: { rsvpClosesAt: closesAt } });
      await writeAuditEvent(transaction, {
        actorId: userId,
        invitationId,
        resourceType: "event",
        resourceId: event.id,
        action: "rsvp.control_updated",
        metadata: { control_action: parsed.action, has_closes_at: closesAt !== null },
      });
    }

    return { invitationId, eventId: event.id, action: parsed.action, rsvpClosesAt: closesAt, changed } satisfies RsvpControlMutationResult;
  });
}

/**
 * Owner override deliberately does not call the guest-window check. It is the
 * audited exception that lets the owner correct a response after close while
 * preserving all normal assignment and party-size constraints.
 */
export async function overrideRsvp(
  database: RsvpDatabase,
  userId: string,
  invitationId: string,
  input: OwnerRsvpOverrideInput,
  options: RsvpServiceOptions = {},
): Promise<RsvpOverrideMutationResult> {
  const parsed = ownerRsvpOverrideInputSchema.parse(input);
  const now = options.now?.() ?? new Date();
  assertValidClock(now);

  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: { id: true, commercialState: true, trialEndsAt: true, activeUntil: true },
    });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    assertInvitationCanEdit(invitation, now);

    const assignment = await transaction.guestEvent.findFirst({
      where: {
        id: parsed.guestEventId,
        state: GuestEventState.ACTIVE,
        guest: { invitationId, archivedAt: null },
        event: { invitationId, archivedAt: null },
      },
      select: {
        id: true,
        maxPartySize: true,
        rsvp: { select: { id: true, status: true, attendanceCount: true } },
      },
    });
    if (!assignment) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (parsed.status === RsvpStatus.ATTENDING && parsed.attendanceCount! > assignment.maxPartySize) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, {
        details: { attendance_count: ["Jumlah hadir melebihi batas acara."] },
      });
    }

    const nextAttendanceCount = parsed.status === RsvpStatus.ATTENDING ? parsed.attendanceCount! : null;
    const nextReason = parsed.status === RsvpStatus.NOT_ATTENDING ? parsed.notAttendingReason?.trim() || null : null;
    const rsvp = await transaction.rSVP.upsert({
      where: { guestEventId: assignment.id },
      create: {
        guestEventId: assignment.id,
        status: parsed.status,
        attendanceCount: nextAttendanceCount,
        notAttendingReason: nextReason,
        source: "OWNER",
        ownerOverride: true,
        updatedBy: userId,
      },
      update: {
        status: parsed.status,
        attendanceCount: nextAttendanceCount,
        notAttendingReason: nextReason,
        source: "OWNER",
        ownerOverride: true,
        updatedBy: userId,
      },
      select: { id: true },
    });

    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "rsvp",
      resourceId: rsvp.id,
      action: "rsvp.owner_overridden",
      metadata: {
        status: parsed.status,
        previous_status: assignment.rsvp?.status ?? RsvpStatus.PENDING,
        has_attendance_count: nextAttendanceCount !== null,
      },
    });

    return {
      invitationId,
      guestEventId: assignment.id,
      rsvpId: rsvp.id,
      status: parsed.status,
      attendanceCount: nextAttendanceCount,
      changed: assignment.rsvp?.status !== parsed.status || assignment.rsvp?.attendanceCount !== nextAttendanceCount,
    } satisfies RsvpOverrideMutationResult;
  });
}
