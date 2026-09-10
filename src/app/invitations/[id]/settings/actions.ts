"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  invitationSlugInputSchema,
  updateInvitationSlug,
} from "@/modules/invitations";
import { nextPublicCacheInvalidator } from "@/server/public-cache";
import { prisma } from "@/server/db";

export interface InvitationSlugActionState {
  readonly ok: boolean;
  readonly canonicalSlug?: string;
  readonly message?: string;
  readonly formError?: string;
  readonly fieldErrors?: Readonly<{ slug?: string }>;
}

export const initialInvitationSlugActionState: InvitationSlugActionState = { ok: false };

export async function updateInvitationSlugAction(
  invitationId: string,
  _previousState: InvitationSlugActionState,
  formData: FormData,
): Promise<InvitationSlugActionState> {
  const parsed = invitationSlugInputSchema.safeParse(formData.get("slug"));
  if (!parsed.success) {
    return { ok: false, fieldErrors: { slug: parsed.error.issues[0]?.message ?? "Alamat link tidak valid." } };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, formError: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  }

  try {
    const result = await updateInvitationSlug(
      prisma,
      session.user.id,
      invitationId,
      parsed.data,
      { cache: nextPublicCacheInvalidator },
    );
    return {
      ok: true,
      canonicalSlug: result.canonicalSlug,
      message: result.changed ? "Alamat link diperbarui." : "Alamat link sudah tersimpan.",
    };
  } catch (error) {
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return {
        ok: false,
        formError: publicError.message,
        ...(publicError.details?.slug?.[0] ? { fieldErrors: { slug: publicError.details.slug[0] } } : {}),
      };
    }
    return { ok: false, formError: "Alamat link belum tersimpan. Coba lagi." };
  }
}
