"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { PublicationState } from "@/generated/prisma/client";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  publishInvitation,
  unpublishInvitation,
} from "@/modules/invitations";
import { nextPublicCacheInvalidator } from "@/server/public-cache";
import { prisma } from "@/server/db";

const publicationActionInputSchema = z.object({
  invitationId: z.string().trim().min(1).max(128),
  intent: z.enum(["publish", "unpublish"]),
});

export interface PublicationActionState {
  readonly ok: boolean;
  readonly publicationState?: PublicationState;
  readonly message?: string;
  readonly formError?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export const initialPublicationActionState: PublicationActionState = { ok: false };

export async function publicationAction(
  invitationId: string,
  _previousState: PublicationActionState,
  formData: FormData,
): Promise<PublicationActionState> {
  const parsed = publicationActionInputSchema.safeParse({
    invitationId,
    intent: formData.get("intent"),
  });
  if (!parsed.success) {
    return { ok: false, formError: "Aksi publikasi belum dapat diproses." };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, formError: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  }

  try {
    const transition =
      parsed.data.intent === "publish"
        ? await publishInvitation(prisma, session.user.id, parsed.data.invitationId, {
            cache: nextPublicCacheInvalidator,
          })
        : await unpublishInvitation(prisma, session.user.id, parsed.data.invitationId, {
            cache: nextPublicCacheInvalidator,
          });

    return {
      ok: true,
      publicationState: transition.publicationState,
      message:
        transition.publicationState === PublicationState.PUBLISHED
          ? "Undangan dipublikasikan."
          : "Undangan disembunyikan dari akses publik.",
    };
  } catch (error) {
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      const fieldErrors = publicError.details
        ? Object.fromEntries(
            Object.entries(publicError.details).map(([field, messages]) => [field, messages[0]]),
          )
        : undefined;
      return {
        ok: false,
        formError: publicError.message,
        ...(fieldErrors ? { fieldErrors } : {}),
      };
    }

    return { ok: false, formError: "Perubahan publikasi belum tersimpan. Coba lagi." };
  }
}
