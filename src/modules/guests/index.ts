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

const PHONE_CHARACTERS = /^[+()\d\s.-]+$/;

const optionalPhone = z
  .string()
  .trim()
  .max(40, "Nomor telepon maksimal 40 karakter.")
  .refine((value) => value === "" || PHONE_CHARACTERS.test(value), "Masukkan nomor telepon yang valid.")
  .optional();

export const guestInputSchema = z
  .object({
    displayName: z.string().trim().min(1, "Masukkan nama tamu.").max(160, "Nama tamu maksimal 160 karakter."),
    phone: optionalPhone,
    groupId: z.string().trim().max(128).optional(),
    groupName: z.string().trim().max(120, "Nama grup maksimal 120 karakter.").optional(),
    notes: z.string().trim().max(1_000, "Catatan maksimal 1.000 karakter.").optional(),
  })
  .strict();

export type GuestInput = z.infer<typeof guestInputSchema>;

export interface GuestMutationResult {
  readonly guestId: string;
  readonly invitationVersion: number;
  readonly changed: boolean;
  readonly mode: "created" | "updated" | "archived" | "deleted";
}

export interface GuestGroupItem {
  readonly id: string;
  readonly name: string;
}

export interface GuestEventSummary {
  readonly id: string;
  readonly name: string;
  readonly rsvpStatus: string | null;
  readonly attendanceCount: number | null;
}

export interface GuestManagementItem {
  readonly id: string;
  readonly displayName: string;
  readonly displayPhone: string | null;
  readonly normalizedPhone: string | null;
  readonly notes: string | null;
  readonly group: GuestGroupItem | null;
  readonly assignedEvents: readonly GuestEventSummary[];
  readonly createdAt: string;
}

export interface GuestManagementData {
  readonly invitationId: string;
  readonly invitationVersion: number;
  readonly commercialState: CommercialState;
  readonly trialEndsAt: string;
  readonly activeUntil: string | null;
  readonly canEdit: boolean;
  readonly groups: readonly GuestGroupItem[];
  readonly guests: readonly GuestManagementItem[];
}

export interface GuestServiceOptions {
  readonly now?: () => Date;
}

type GuestDatabase = Pick<PrismaClient, "$transaction">;
type GuestReadDatabase = Pick<PrismaClient, "invitation">;

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
  guests: {
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      displayPhone: true,
      normalizedPhone: true,
      notes: true,
      createdAt: true,
      group: { select: { id: true, name: true } },
      eventAssignments: {
        where: { state: GuestEventState.ACTIVE },
        orderBy: { createdAt: "asc" },
        select: {
          event: { select: { id: true, name: true } },
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

/** Normalize Indonesian/local phone input into a stable E.164-like value. */
export function normalizePhone(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const trimmed = value.trim();
  if (!PHONE_CHARACTERS.test(trimmed)) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);

  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 8 || digits.length > 15) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);

  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8") && digits.length <= 12) digits = `62${digits}`;

  if (digits.length < 8 || digits.length > 15) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
  return `+${digits}`;
}

function optionalValue(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
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
  return {
    invitationId: record.id,
    invitationVersion: record.version,
    commercialState: record.commercialState,
    trialEndsAt: record.trialEndsAt.toISOString(),
    activeUntil: record.activeUntil?.toISOString() ?? null,
    canEdit: getInvitationLifecycleCapabilities(record.commercialState, record.trialEndsAt, now, record.activeUntil).canEdit,
    groups: record.guestGroups,
    guests: record.guests.map((guest) => ({
      id: guest.id,
      displayName: guest.displayName,
      displayPhone: guest.displayPhone,
      normalizedPhone: guest.normalizedPhone,
      notes: guest.notes,
      group: guest.group,
      assignedEvents: guest.eventAssignments.map((assignment) => ({
        id: assignment.event.id,
        name: assignment.event.name,
        rsvpStatus: assignment.rsvp?.status ?? null,
        attendanceCount: assignment.rsvp?.attendanceCount ?? null,
      })),
      createdAt: guest.createdAt.toISOString(),
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
    const invitationVersion = await assertEditableAndLock(transaction, userId, invitation, now);
    const data = {
      displayName: parsed.displayName,
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
      return { guestId, invitationVersion, changed: true, mode: "updated" } satisfies GuestMutationResult;
    }

    const created = await transaction.guest.create({ data: { ...data, invitationId } });
    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "guest",
      resourceId: created.id,
      action: "guest.created",
      metadata: { has_contact: normalizedPhone !== null, has_group: groupId !== null },
    });
    return { guestId: created.id, invitationVersion, changed: true, mode: "created" } satisfies GuestMutationResult;
  });

  return result;
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
