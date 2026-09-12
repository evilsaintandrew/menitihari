"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";

import {
  getGuestSessionAccess,
  guestSessionCookieName,
} from "@/modules/access";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  personalizedRsvpInputSchema,
  rsvpRateLimiter,
  submitPersonalizedRsvp,
  type RsvpMutationResult,
} from "@/modules/rsvp";
import { prisma } from "@/server/db";

export interface SubmitRsvpActionState {
  readonly ok: boolean;
  readonly errorCode?: string;
  readonly retryable?: boolean;
  readonly message?: string;
  readonly result?: RsvpMutationResult;
}

export const initialSubmitRsvpActionState: SubmitRsvpActionState = { ok: false };

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function optionalNumber(formData: FormData, key: string): number | undefined {
  const value = stringValue(formData.get(key)).trim();
  if (!value) return undefined;
  return Number(value);
}

function optionalText(formData: FormData, key: string): string | undefined {
  const value = stringValue(formData.get(key)).trim();
  return value || undefined;
}

function requestIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
}

function parseForm(formData: FormData) {
  const eventIds = formData.getAll("eventIds").filter((value): value is string => typeof value === "string");
  return personalizedRsvpInputSchema.safeParse({
    responses: eventIds.map((eventId) => ({
      eventId,
      status: stringValue(formData.get(`status:${eventId}`)),
      attendanceCount: optionalNumber(formData, `attendanceCount:${eventId}`),
      notAttendingReason: optionalText(formData, `notAttendingReason:${eventId}`),
    })),
  });
}

export async function submitPersonalizedRsvpAction(
  invitationId: string,
  _previousState: SubmitRsvpActionState,
  formData: FormData,
): Promise<SubmitRsvpActionState> {
  const parsedInvitationId = z.string().trim().min(1).max(128).safeParse(invitationId);
  if (!parsedInvitationId.success) {
    return { ok: false, errorCode: "VALIDATION_FAILED", message: "Undangan belum dapat diproses." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, errorCode: "VALIDATION_FAILED", message: "Periksa kembali jawaban RSVP Anda." };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(guestSessionCookieName(parsedInvitationId.data))?.value;
  const access = await getGuestSessionAccess(prisma, parsedInvitationId.data, sessionToken);
  if (!access?.authorized || !access.guestId) {
    return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi undangan sudah berakhir. Buka kembali link undangan Anda." };
  }

  const limit = rsvpRateLimiter.consume({
    ip: requestIp(await headers()),
    invitationId: parsedInvitationId.data,
    guestId: access.guestId,
  });
  if (!limit.allowed) {
    return {
      ok: false,
      errorCode: "RATE_LIMITED",
      retryable: true,
      message: `Terlalu banyak percobaan. Coba lagi dalam ${limit.retryAfterSeconds ?? 1} detik.`,
    };
  }

  try {
    const result = await submitPersonalizedRsvp(
      prisma,
      parsedInvitationId.data,
      access.guestId,
      parsed.data,
    );
    return { ok: true, result, message: "RSVP berhasil diperbarui." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, errorCode: "VALIDATION_FAILED", message: "Periksa kembali jawaban RSVP Anda." };
    }
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return {
        ok: false,
        errorCode: publicError.code,
        retryable: publicError.retryable,
        message: publicError.message,
      };
    }
    return { ok: false, errorCode: "INTERNAL_ERROR", retryable: true, message: "RSVP belum tersimpan. Coba lagi." };
  }
}
