"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { env } from "@/config/env";
import {
  getGuestSessionAccess,
  guestSessionCookieName,
  issueGuestShareLink,
} from "@/modules/access";
import { DomainError, toPublicError } from "@/modules/errors";
import { buildPersonalizedInvitationUrl } from "@/modules/whatsapp";
import { prisma } from "@/server/db";

const invitationIdSchema = z.string().trim().min(1).max(128);
const shareIntentSchema = z.enum(["share", "copy"]);

export interface GuestShareActionState {
  readonly ok: boolean;
  readonly intent?: "share" | "copy";
  readonly url?: string;
  readonly message?: string;
}

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export async function issueGuestShareLinkAction(
  invitationId: string,
  _previousState: GuestShareActionState,
  formData: FormData,
): Promise<GuestShareActionState> {
  const parsedInvitationId = invitationIdSchema.safeParse(invitationId);
  const parsedIntent = shareIntentSchema.safeParse(stringValue(formData.get("intent")));
  if (!parsedInvitationId.success || !parsedIntent.success) {
    return { ok: false, message: "Aksi berbagi belum valid. Coba lagi." };
  }

  const sessionToken = (await cookies()).get(guestSessionCookieName(parsedInvitationId.data))?.value;
  const session = await getGuestSessionAccess(prisma, parsedInvitationId.data, sessionToken);
  if (!session?.authorized) {
    return { ok: false, intent: parsedIntent.data, message: "Sesi undangan sudah berakhir. Buka kembali link undangan Anda." };
  }

  try {
    const issued = await issueGuestShareLink(prisma, parsedInvitationId.data, sessionToken ?? "");
    return {
      ok: true,
      intent: parsedIntent.data,
      url: buildPersonalizedInvitationUrl(env.NEXT_PUBLIC_APP_URL, issued.slug, issued.token),
    };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, intent: parsedIntent.data, message: toPublicError(error).message };
    return { ok: false, intent: parsedIntent.data, message: "Link belum dapat disiapkan. Coba lagi." };
  }
}
