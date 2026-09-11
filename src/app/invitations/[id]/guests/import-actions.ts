"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  GuestImportInputError,
  confirmGuestImportForOwner,
  runGuestImportWorker,
  setGuestImportRowIncluded,
  startGuestImport,
} from "@/modules/guests";
import { prisma } from "@/server/db";

export interface GuestImportActionState {
  readonly ok: boolean;
  readonly importId?: string;
  readonly errorCode?: string;
  readonly message?: string;
}

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function ownerId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

function errorState(error: unknown): GuestImportActionState {
  if (error instanceof GuestImportInputError) return { ok: false, errorCode: error.code, message: error.message };
  if (error instanceof DomainError) {
    const publicError = toPublicError(error);
    return {
      ok: false,
      errorCode: publicError.code,
      message: publicError.code === "CAPACITY_EXCEEDED"
        ? "Kapasitas berubah. Keluarkan beberapa baris lalu coba konfirmasi lagi."
        : publicError.message,
    };
  }
  if (error instanceof z.ZodError) return { ok: false, errorCode: "VALIDATION_FAILED", message: "Detail import belum valid." };
  return { ok: false, errorCode: "INTERNAL_ERROR", message: "Import belum dapat diproses. Coba lagi." };
}

function scheduleWorker(): void {
  setTimeout(() => { void runGuestImportWorker(prisma, undefined, { maxJobs: 100 }); }, 0);
}

export async function startGuestImportAction(
  _previousState: GuestImportActionState,
  formData: FormData,
): Promise<GuestImportActionState> {
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, errorCode: "VALIDATION_FAILED", message: "Pilih file CSV atau Excel terlebih dahulu." };
  try {
    const result = await startGuestImport(prisma, userId, stringValue(formData, "invitationId"), { filename: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
    scheduleWorker();
    return { ok: true, importId: result.importId, message: "File sedang diperiksa. Anda boleh meninggalkan halaman ini." };
  } catch (error) {
    return errorState(error);
  }
}

export async function setGuestImportRowStateAction(
  _previousState: GuestImportActionState,
  formData: FormData,
): Promise<GuestImportActionState> {
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  const include = stringValue(formData, "include") === "true";
  try {
    await setGuestImportRowIncluded(prisma, userId, stringValue(formData, "importId"), stringValue(formData, "rowId"), include);
    refresh();
    return { ok: true, message: include ? "Baris akan diimport." : "Baris dikecualikan." };
  } catch (error) {
    return errorState(error);
  }
}

export async function confirmGuestImportAction(
  _previousState: GuestImportActionState,
  formData: FormData,
): Promise<GuestImportActionState> {
  const userId = await ownerId();
  if (!userId) return { ok: false, errorCode: "UNAUTHENTICATED", message: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  const importId = stringValue(formData, "importId");
  try {
    await confirmGuestImportForOwner(prisma, userId, importId);
    scheduleWorker();
    refresh();
    return { ok: true, importId, message: "Import sedang diproses di latar belakang." };
  } catch (error) {
    return errorState(error);
  }
}
