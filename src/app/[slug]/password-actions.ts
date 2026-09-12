"use server";

import { cookies, headers } from "next/headers";

import { env } from "@/config/env";
import {
  createInvitationPasswordSession,
  invitationPasswordRateLimiter,
  invitationPasswordSessionCookieName,
  sharedPasswordSchema,
} from "@/modules/access";
import { DomainError } from "@/modules/errors";
import { prisma } from "@/server/db";

export interface InvitationPasswordGateState {
  readonly ok: boolean;
  readonly formError?: string;
  readonly fieldError?: string;
}

export const initialInvitationPasswordGateState: InvitationPasswordGateState = { ok: false };

function formString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function requestIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
}

export async function submitInvitationPasswordAction(
  invitationId: string,
  _previousState: InvitationPasswordGateState,
  formData: FormData,
): Promise<InvitationPasswordGateState> {
  const password = formString(formData.get("password"));
  const parsed = sharedPasswordSchema.safeParse(password);
  if (!parsed.success) {
    return { ok: false, fieldError: parsed.error.issues[0]?.message ?? "Password belum valid." };
  }

  const requestHeaders = await headers();
  const limit = invitationPasswordRateLimiter.consume({
    ip: requestIp(requestHeaders),
    invitationId,
  });
  if (!limit.allowed) {
    return {
      ok: false,
      formError: `Terlalu banyak percobaan. Coba lagi dalam ${limit.retryAfterSeconds ?? 1} detik.`,
    };
  }

  try {
    const session = await createInvitationPasswordSession(prisma, invitationId, parsed.data);
    const cookieStore = await cookies();
    cookieStore.set(invitationPasswordSessionCookieName(invitationId), session.sessionToken, {
      expires: session.expiresAt,
      httpOnly: true,
      maxAge: Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1_000)),
      path: "/",
      sameSite: "lax",
      secure: env.NODE_ENV === "production" || env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError && error.code === "FORBIDDEN") {
      return { ok: false, formError: "Password belum benar." };
    }
    return { ok: false, formError: "Undangan belum dapat dibuka. Coba lagi." };
  }
}
