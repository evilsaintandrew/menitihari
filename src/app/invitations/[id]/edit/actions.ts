"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  saveInvitationContent,
  type InvitationContent,
} from "@/modules/invitations";
import { nextPublicCacheInvalidator } from "@/server/public-cache";
import { prisma } from "@/server/db";
import type { ThemeConfig } from "@/modules/themes";

export interface SaveInvitationContentActionState {
  readonly ok: boolean;
  readonly version?: number;
  readonly errorCode?: string;
  readonly conflict?: boolean;
  readonly retryable?: boolean;
  readonly message?: string;
}

export async function saveInvitationContentAction(
  invitationId: string,
  expectedVersion: number,
  content: InvitationContent,
  themeConfig?: ThemeConfig,
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
      { expectedVersion, content, themeConfig },
      { cache: nextPublicCacheInvalidator },
    );
    return { ok: true, version: result.version, message: "Perubahan tersimpan." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        errorCode: "VALIDATION_FAILED",
        message: "Kontrol tampilan atau isi undangan belum valid.",
      };
    }
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
