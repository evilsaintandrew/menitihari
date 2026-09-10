"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  selectInvitationTheme,
  themeSelectionInputSchema,
} from "@/modules/themes";
import { nextPublicCacheInvalidator } from "@/server/public-cache";
import { prisma } from "@/server/db";
import type { ThemeSelectionActionState } from "./action-state";

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function selectThemeAction(
  invitationId: string,
  _previousState: ThemeSelectionActionState,
  formData: FormData,
): Promise<ThemeSelectionActionState> {
  const parsed = themeSelectionInputSchema.safeParse({
    themeId: formValue(formData, "themeId"),
  });
  if (!parsed.success) {
    return { ok: false, formError: "Tema yang dipilih belum dapat diproses." };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, formError: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  }

  try {
    const selection = await selectInvitationTheme(
      prisma,
      session.user.id,
      invitationId,
      parsed.data,
      { cache: nextPublicCacheInvalidator },
    );
    return {
      ok: true,
      selectedThemeId: selection.themeId,
      message: selection.changed ? "Tema undangan diperbarui." : "Tema ini sudah digunakan.",
    };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, formError: toPublicError(error).message };
    }
    return { ok: false, formError: "Tema belum tersimpan. Coba lagi." };
  }
}
