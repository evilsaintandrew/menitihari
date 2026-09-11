"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { DomainError, toPublicError } from "@/modules/errors";
import { archiveGuest, guestInputSchema, saveGuest } from "@/modules/guests";
import { prisma } from "@/server/db";

export interface GuestActionState {
  readonly ok: boolean;
  readonly guestId?: string;
  readonly mode?: "created" | "updated" | "archived" | "deleted";
  readonly errorCode?: string;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalFormValue(formData: FormData, key: string): string | undefined {
  const value = stringValue(formData, key).trim();
  return value.length > 0 ? value : undefined;
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
