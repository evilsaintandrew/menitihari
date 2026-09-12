"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { env } from "@/config/env";
import { WhatsAppTemplateType } from "@/generated/prisma/client";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  archiveGuest,
  bulkUpdateGuests,
  guestBulkActionInputSchema,
  getGuestMergePreview,
  guestInputSchema,
  guestMergeInputSchema,
  mergeGuests,
  saveGuest,
  type GuestDuplicateWarning,
  type GuestMergePreview,
} from "@/modules/guests";
import {
  overrideRsvp,
  publicRsvpApprovalInputSchema,
  ownerRsvpControlInputSchema,
  ownerRsvpOverrideInputSchema,
  setPublicRsvpApproval,
  setOwnerRsvpControl,
} from "@/modules/rsvp";
import {
  renderWhatsAppMessage,
  renderWhatsAppMessageInputSchema,
  type RenderedWhatsAppMessage,
} from "@/modules/whatsapp";
import { prisma } from "@/server/db";

export interface GuestActionState {
  readonly ok: boolean;
  readonly guestId?: string;
  readonly mode?: "created" | "updated" | "archived" | "deleted" | "merged";
  readonly duplicateWarnings?: readonly GuestDuplicateWarning[];
  readonly errorCode?: string;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly operation?: "GROUP" | "EVENT" | "DISTRIBUTION";
  readonly updatedGuestCount?: number;
  readonly requiresConfirmation?: boolean;
  readonly historicalGuestCount?: number;
  readonly historicalAssignmentCount?: number;
}

export interface GuestMergePreviewActionState {
  readonly ok: boolean;
  readonly preview?: GuestMergePreview;
  readonly errorCode?: string;
  readonly message?: string;
}

export interface RsvpActionState {
  readonly ok: boolean;
  readonly errorCode?: string;
  readonly message?: string;
}

export interface WhatsAppRenderActionState {
  readonly ok: boolean;
  readonly rendered?: RenderedWhatsAppMessage;
  readonly errorCode?: string;
  readonly message?: string;
}

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalFormValue(formData: FormData, key: string): string | undefined {
  const value = stringValue(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

function booleanValue(formData: FormData, key: string): boolean {
  return stringValue(formData, key) === "true";
}

function optionalNumber(formData: FormData, key: string): number | undefined {
  const value = stringValue(formData, key).trim();
  if (!value) return undefined;
  return Number(value);
}

function parseGuestForm(formData: FormData) {
  const eventIds = formData.getAll("eventIds").filter((value): value is string => typeof value === "string");
  return guestInputSchema.safeParse({
    displayName: stringValue(formData, "displayName"),
    phone: optionalFormValue(formData, "phone"),
    groupId: optionalFormValue(formData, "groupId"),
    groupName: optionalFormValue(formData, "groupName"),
    notes: optionalFormValue(formData, "notes"),
    assignments: eventIds.map((eventId) => ({
      eventId,
      maxPartySize: Number(stringValue(formData, `maxPartySize:${eventId}`)),
    })),
  });
}

function validationState(error: z.ZodError): GuestActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && fieldErrors[field] === undefined) fieldErrors[field] = issue.message;
  }
  return { ok: false, errorCode: "VALIDATION_FAILED", message: "Periksa kembali detail tamu.", fieldErrors };
}

function bulkValidationState(error: z.ZodError): GuestActionState {
  const state = validationState(error);
  return { ...state, message: "Periksa kembali tindakan massal dan tamu yang dipilih." };
}

async function ownerId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function saveGuestAction(
  _previousState: GuestActionState,
  formData: FormData,
): Promise<GuestActionState> {
  const parsed = parseGuestForm(formData);
  if (!parsed.success) return validationState(parsed.error);
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };

  const invitationId = stringValue(formData, "invitationId");
  const guestId = stringValue(formData, "guestId") || null;
  try {
    const result = await saveGuest(prisma, userId, invitationId, guestId, parsed.data);
    return {
      ok: true,
      guestId: result.guestId,
      mode: result.mode,
      duplicateWarnings: result.duplicateWarnings,
      message: result.mode === "created" ? "Tamu ditambahkan." : "Perubahan tamu disimpan.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) return validationState(error);
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return {
        ok: false,
        errorCode: publicError.code,
        message: publicError.code === "CAPACITY_EXCEEDED"
          ? "Kapasitas undangan maksimal 500 orang. Kurangi kapasitas tamu lain sebelum menyimpan perubahan."
          : publicError.message,
      };
    }
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Tamu belum tersimpan. Coba lagi." };
  }
}

export async function renderWhatsAppMessageAction(
  _previousState: WhatsAppRenderActionState,
  formData: FormData,
): Promise<WhatsAppRenderActionState> {
  const parsed = renderWhatsAppMessageInputSchema.safeParse({
    type: stringValue(formData, "type") || WhatsAppTemplateType.INVITATION,
    eventId: optionalFormValue(formData, "eventId"),
  });
  if (!parsed.success) return { ok: false, errorCode: "VALIDATION_FAILED", message: "Template pesan belum valid." };

  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };

  try {
    const rendered = await renderWhatsAppMessage(
      prisma,
      userId,
      stringValue(formData, "invitationId"),
      stringValue(formData, "guestId"),
      parsed.data,
      { baseUrl: env.NEXT_PUBLIC_APP_URL },
    );
    return { ok: true, rendered };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, errorCode: "VALIDATION_FAILED", message: "Template pesan belum valid." };
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return {
        ok: false,
        errorCode: publicError.code,
        message: publicError.code === "NOT_INVITED_TO_EVENT"
          ? "Tamu belum memiliki penugasan acara yang aktif."
          : publicError.message,
      };
    }
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Pesan personal belum dapat dibuat. Coba lagi." };
  }
}

export async function bulkUpdateGuestsAction(
  _previousState: GuestActionState,
  formData: FormData,
): Promise<GuestActionState> {
  const operation = stringValue(formData, "operation");
  const input = {
    operation,
    guestIds: formData.getAll("guestIds").filter((value): value is string => typeof value === "string"),
    groupId: operation === "GROUP" ? (optionalFormValue(formData, "groupId") ?? null) : undefined,
    eventId: operation === "EVENT" ? optionalFormValue(formData, "eventId") : undefined,
    eventAction: operation === "EVENT" ? stringValue(formData, "eventAction") : undefined,
    maxPartySize: operation === "EVENT" && stringValue(formData, "eventAction") === "ASSIGN"
      ? Number(stringValue(formData, "maxPartySize"))
      : undefined,
    distributionStatus: operation === "DISTRIBUTION" ? stringValue(formData, "distributionStatus") : undefined,
    confirmHistoricalRemoval: booleanValue(formData, "confirmHistoricalRemoval"),
  };
  const parsed = guestBulkActionInputSchema.safeParse(input);
  if (!parsed.success) return bulkValidationState(parsed.error);

  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };

  try {
    const result = await bulkUpdateGuests(prisma, userId, stringValue(formData, "invitationId"), parsed.data);
    if (result.warning) {
      return {
        ok: false,
        operation: result.operation,
        requiresConfirmation: true,
        historicalGuestCount: result.warning.guestCount,
        historicalAssignmentCount: result.warning.assignmentCount,
        errorCode: "CONFLICT",
        message: `Sebanyak ${result.warning.guestCount} tamu memiliki riwayat RSVP atau check-in pada acara ini. Konfirmasi lagi untuk menghapus penugasan tanpa menghapus riwayat.`,
      };
    }
    return {
      ok: true,
      operation: result.operation,
      updatedGuestCount: result.updatedGuestCount,
      message: result.operation === "GROUP"
        ? `Grup diperbarui untuk ${result.updatedGuestCount} tamu.`
        : result.operation === "EVENT"
          ? `Penugasan acara diperbarui untuk ${result.updatedGuestCount} tamu.`
          : `Status distribusi diperbarui untuk ${result.updatedGuestCount} tamu.`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) return bulkValidationState(error);
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return {
        ok: false,
        operation: parsed.data.operation,
        errorCode: publicError.code,
        message: publicError.code === "CAPACITY_EXCEEDED"
          ? "Kapasitas undangan maksimal 500 orang. Kurangi kapasitas tamu lain sebelum menambahkan penugasan massal."
          : publicError.code === "VALIDATION_FAILED" && parsed.data.operation === "EVENT" && parsed.data.eventAction === "ASSIGN"
            ? "Maksimal orang tidak boleh lebih kecil dari riwayat kehadiran yang sudah tercatat."
            : publicError.message,
      };
    }
    return { ok: false, operation: parsed.data.operation, errorCode: "INTERNAL_ERROR", message: "Perubahan massal belum tersimpan. Coba lagi." };
  }
}

export async function mergeGuestAction(
  _previousState: GuestActionState,
  formData: FormData,
): Promise<GuestActionState> {
  const rawResolutions = stringValue(formData, "conflictResolutions");
  let parsedResolutions: unknown = [];
  if (rawResolutions) {
    try {
      parsedResolutions = JSON.parse(rawResolutions);
    } catch {
      return { ok: false, errorCode: "VALIDATION_FAILED", message: "Pilihan riwayat duplikat tidak valid." };
    }
  }
  const parsed = guestMergeInputSchema.safeParse({
    sourceGuestId: stringValue(formData, "sourceGuestId"),
    targetGuestId: stringValue(formData, "targetGuestId"),
    conflictResolutions: parsedResolutions,
  });
  if (!parsed.success) return validationState(parsed.error);
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };

  try {
    const result = await mergeGuests(prisma, userId, stringValue(formData, "invitationId"), parsed.data);
    return {
      ok: true,
      guestId: result.guestId,
      mode: result.mode,
      message: "Tamu digabungkan. Riwayat duplikat tetap disimpan untuk peninjauan.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) return validationState(error);
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return {
        ok: false,
        errorCode: publicError.code,
        message: publicError.code === "CONFLICT"
          ? "Riwayat tamu bertabrakan. Tinjau dan pilih riwayat yang dipertahankan sebelum menggabungkan."
          : publicError.message,
      };
    }
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Tamu belum digabungkan. Coba lagi." };
  }
}

export async function getGuestMergePreviewAction(
  _previousState: GuestMergePreviewActionState,
  formData: FormData,
): Promise<GuestMergePreviewActionState> {
  const sourceGuestId = stringValue(formData, "sourceGuestId");
  const targetGuestId = stringValue(formData, "targetGuestId");
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };

  try {
    const preview = await getGuestMergePreview(prisma, userId, stringValue(formData, "invitationId"), { sourceGuestId, targetGuestId });
    return { ok: true, preview };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, errorCode: "VALIDATION_FAILED", message: "Pilih dua tamu yang berbeda." };
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return { ok: false, errorCode: publicError.code, message: publicError.message };
    }
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Riwayat duplikat belum dapat dimuat. Coba lagi." };
  }
}

export async function archiveGuestAction(
  _previousState: GuestActionState,
  formData: FormData,
): Promise<GuestActionState> {
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };

  try {
    const result = await archiveGuest(prisma, userId, stringValue(formData, "invitationId"), stringValue(formData, "guestId"));
    return {
      ok: true,
      guestId: result.guestId,
      mode: result.mode,
      message: result.mode === "archived" ? "Tamu diarsipkan karena memiliki riwayat." : "Tamu dihapus.",
    };
  } catch (error) {
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return { ok: false, errorCode: publicError.code, message: publicError.message };
    }
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Tamu belum dihapus. Coba lagi." };
  }
}

export async function setRsvpControlAction(
  _previousState: RsvpActionState,
  formData: FormData,
): Promise<RsvpActionState> {
  const parsed = ownerRsvpControlInputSchema.safeParse({
    eventId: stringValue(formData, "eventId"),
    action: stringValue(formData, "action"),
    closesAtDate: stringValue(formData, "closesAtDate") || undefined,
    closesAtTime: stringValue(formData, "closesAtTime") || undefined,
  });
  if (!parsed.success) return { ok: false, errorCode: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Jadwal RSVP belum valid." };
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };

  try {
    await setOwnerRsvpControl(prisma, userId, stringValue(formData, "invitationId"), parsed.data);
    return { ok: true, message: parsed.data.action === "REOPEN" ? "RSVP dibuka kembali." : parsed.data.action === "CLOSE" ? "RSVP ditutup." : "Jadwal penutupan RSVP disimpan." };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, errorCode: "VALIDATION_FAILED", message: "Jadwal RSVP belum valid." };
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return { ok: false, errorCode: publicError.code, message: publicError.code === "LIFECYCLE_LOCKED" ? "RSVP hanya dapat dikontrol saat acara dan undangan masih aktif." : publicError.message };
    }
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Kontrol RSVP belum tersimpan. Coba lagi." };
  }
}

export async function overrideRsvpAction(
  _previousState: RsvpActionState,
  formData: FormData,
): Promise<RsvpActionState> {
  const parsed = ownerRsvpOverrideInputSchema.safeParse({
    guestEventId: stringValue(formData, "guestEventId"),
    status: stringValue(formData, "status"),
    attendanceCount: optionalNumber(formData, "attendanceCount"),
    notAttendingReason: stringValue(formData, "notAttendingReason") || undefined,
  });
  if (!parsed.success) return { ok: false, errorCode: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Jawaban RSVP belum valid." };
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };

  try {
    await overrideRsvp(prisma, userId, stringValue(formData, "invitationId"), parsed.data);
    return { ok: true, message: "Override RSVP disimpan dan dicatat." };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, errorCode: "VALIDATION_FAILED", message: "Jawaban RSVP belum valid." };
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return { ok: false, errorCode: publicError.code, message: publicError.code === "VALIDATION_FAILED" ? "Jumlah hadir melebihi kapasitas tamu untuk acara ini." : publicError.message };
    }
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Override RSVP belum tersimpan. Coba lagi." };
  }
}

export async function setPublicRsvpApprovalAction(
  _previousState: RsvpActionState,
  formData: FormData,
): Promise<RsvpActionState> {
  const parsed = publicRsvpApprovalInputSchema.safeParse({
    guestEventId: stringValue(formData, "guestEventId"),
    decision: stringValue(formData, "decision"),
  });
  if (!parsed.success) return { ok: false, errorCode: "VALIDATION_FAILED", message: "Keputusan persetujuan belum valid." };
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };

  try {
    await setPublicRsvpApproval(prisma, userId, stringValue(formData, "invitationId"), parsed.data);
    return { ok: true, message: parsed.data.decision === "APPROVE" ? "QR check-in tamu disetujui." : "QR check-in tamu ditolak." };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, errorCode: "VALIDATION_FAILED", message: "Keputusan persetujuan belum valid." };
    if (error instanceof DomainError) return { ok: false, errorCode: toPublicError(error).code, message: toPublicError(error).message };
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Persetujuan QR belum tersimpan. Coba lagi." };
  }
}
