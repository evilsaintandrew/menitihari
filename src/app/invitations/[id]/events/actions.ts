"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  cancelEvent,
  eventCancellationSchema,
  eventInputSchema,
  removeEvent,
  saveEvent,
  setPrimaryEvent,
} from "@/modules/events";
import { nextPublicCacheInvalidator } from "@/server/public-cache";
import { prisma } from "@/server/db";

export interface EventActionState {
  readonly ok: boolean;
  readonly eventId?: string;
  readonly errorCode?: string;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function booleanValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function parseEventForm(formData: FormData) {
  return eventInputSchema.safeParse({
    name: stringValue(formData, "name"),
    startDate: stringValue(formData, "startDate"),
    startTime: stringValue(formData, "startTime"),
    endDate: stringValue(formData, "endDate") || undefined,
    endTime: stringValue(formData, "endTime") || undefined,
    timezone: stringValue(formData, "timezone") || undefined,
    visibility: stringValue(formData, "visibility") || undefined,
    venue: stringValue(formData, "venue") || undefined,
    address: stringValue(formData, "address") || undefined,
    mapsUrl: stringValue(formData, "mapsUrl") || undefined,
    locationNote: stringValue(formData, "locationNote") || undefined,
    livestreamUrl: stringValue(formData, "livestreamUrl") || undefined,
    dressCode: stringValue(formData, "dressCode") || undefined,
    contactName: stringValue(formData, "contactName") || undefined,
    contactRole: stringValue(formData, "contactRole") || undefined,
    contactPhone: stringValue(formData, "contactPhone") || undefined,
    isPrimary: booleanValue(formData, "isPrimary"),
  });
}

function validationState(error: z.ZodError): EventActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && fieldErrors[field] === undefined) fieldErrors[field] = issue.message;
  }
  return { ok: false, errorCode: "VALIDATION_FAILED", message: "Periksa kembali detail acara.", fieldErrors };
}

function cancellationValidationState(error: z.ZodError): EventActionState {
  return {
    ok: false,
    errorCode: "VALIDATION_FAILED",
    message: error.issues[0]?.message ?? "Pesan pembatalan belum valid.",
  };
}

async function ownerId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function saveEventAction(
  _previousState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const parsed = parseEventForm(formData);
  if (!parsed.success) return validationState(parsed.error);
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };

  const invitationId = stringValue(formData, "invitationId");
  const eventId = stringValue(formData, "eventId") || null;
  try {
    const result = await saveEvent(prisma, userId, invitationId, eventId, parsed.data, { cache: nextPublicCacheInvalidator });
    return { ok: true, eventId: result.eventId, message: eventId ? "Acara diperbarui." : "Acara ditambahkan." };
  } catch (error) {
    if (error instanceof z.ZodError) return validationState(error);
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return { ok: false, errorCode: publicError.code, message: publicError.code === "VALIDATION_FAILED" && error.details?.events ? "Maksimal 5 acara per undangan." : publicError.message };
    }
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Acara belum tersimpan. Coba lagi." };
  }
}

export async function setPrimaryEventAction(
  _previousState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  try {
    await setPrimaryEvent(prisma, userId, stringValue(formData, "invitationId"), stringValue(formData, "eventId"), { cache: nextPublicCacheInvalidator });
    return { ok: true, message: "Acara utama diperbarui." };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, errorCode: toPublicError(error).code, message: toPublicError(error).message };
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Acara utama belum diperbarui. Coba lagi." };
  }
}

export async function removeEventAction(
  _previousState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  try {
    const result = await removeEvent(prisma, userId, stringValue(formData, "invitationId"), stringValue(formData, "eventId"), { cache: nextPublicCacheInvalidator });
    return { ok: true, eventId: result.eventId, message: result.mode === "archived" ? "Acara diarsipkan karena memiliki riwayat." : "Acara dihapus." };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, errorCode: toPublicError(error).code, message: toPublicError(error).message };
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Acara belum dihapus. Coba lagi." };
  }
}

export async function cancelEventAction(
  _previousState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const parsed = eventCancellationSchema.safeParse({
    message: stringValue(formData, "message") || undefined,
  });
  if (!parsed.success) return cancellationValidationState(parsed.error);
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  try {
    const result = await cancelEvent(
      prisma,
      userId,
      stringValue(formData, "invitationId"),
      stringValue(formData, "eventId"),
      parsed.data,
      { cache: nextPublicCacheInvalidator },
    );
    return { ok: true, eventId: result.eventId, message: "Acara ditandai sebagai dibatalkan." };
  } catch (error) {
    if (error instanceof z.ZodError) return cancellationValidationState(error);
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return { ok: false, errorCode: publicError.code, message: publicError.message };
    }
    return { ok: false, errorCode: "INTERNAL_ERROR", message: "Status acara belum diperbarui. Coba lagi." };
  }
}
