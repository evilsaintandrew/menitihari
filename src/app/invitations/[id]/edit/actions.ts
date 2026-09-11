"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  saveInvitationContent,
  type InvitationContent,
} from "@/modules/invitations";
import { nextPublicCacheInvalidator } from "@/server/public-cache";
import { prisma } from "@/server/db";

export interface SaveInvitationContentActionState {
  readonly ok: boolean;
  readonly version?: number;
  readonly errorCode?: string;
  readonly conflict?: boolean;
  readonly retryable?: boolean;
  readonly message?: string;
}

export const initialSaveInvitationContentActionState: SaveInvitationContentActionState = { ok: false };

export async function saveInvitationContentAction(
  invitationId: string,
  expectedVersion: number,
  content: InvitationContent,
): Promise<SaveInvitationContentActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return {
      ok: false,
      errorCode: "UNAUTHENTICATED",
      message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan.",
    };
  }

  try {
    const result = await saveInvitationContent(
      prisma,
      session.user.id,
      invitationId,
      { expectedVersion, content },
      { cache: nextPublicCacheInvalidator },
    );
    return { ok: true, version: result.version, message: "Perubahan tersimpan." };
  } catch (error) {
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return {
        ok: false,
        errorCode: publicError.code,
        conflict: publicError.code === "STALE_VERSION",
        retryable: publicError.retryable,
        message: publicError.message,
      };
    }
    return {
      ok: false,
      errorCode: "INTERNAL_ERROR",
      retryable: true,
      message: "Perubahan belum tersimpan. Coba lagi.",
    };
  }
}
