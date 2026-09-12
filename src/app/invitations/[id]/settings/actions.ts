"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { DomainError, toPublicError } from "@/modules/errors";
import { setInvitationSharedPassword, sharedPasswordSchema } from "@/modules/access";
import {
  invitationSlugInputSchema,
  updateInvitationSlug,
} from "@/modules/invitations";
import {
  publicRsvpSettingsInputSchema,
  setPublicRsvpSettings,
  type PublicRsvpOwnerSettings,
} from "@/modules/rsvp";
import { nextPublicCacheInvalidator } from "@/server/public-cache";
import { prisma } from "@/server/db";

const passwordActionInputSchema = z
  .object({
    intent: z.enum(["enable", "change", "disable"]),
    password: z.string().optional(),
    confirmation: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.intent === "disable") return;
    const passwordResult = sharedPasswordSchema.safeParse(value.password);
    if (!passwordResult.success) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: passwordResult.error.issues[0]?.message ?? "Password belum valid.",
      });
    }
    if (value.password !== value.confirmation) {
      context.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "Ulangi password dengan benar.",
      });
    }
  });

export interface InvitationSlugActionState {
  readonly ok: boolean;
  readonly canonicalSlug?: string;
  readonly message?: string;
  readonly formError?: string;
  readonly fieldErrors?: Readonly<{ slug?: string }>;
}

export const initialInvitationSlugActionState: InvitationSlugActionState = { ok: false };

export interface InvitationPasswordActionState {
  readonly ok: boolean;
  readonly passwordEnabled?: boolean;
  readonly message?: string;
  readonly formError?: string;
  readonly fieldErrors?: Readonly<{ password?: string; confirmation?: string }>;
}

export const initialInvitationPasswordActionState: InvitationPasswordActionState = { ok: false };

export interface PublicRsvpSettingsActionState {
  readonly ok: boolean;
  readonly settings?: PublicRsvpOwnerSettings;
  readonly message?: string;
  readonly formError?: string;
}

export const initialPublicRsvpSettingsActionState: PublicRsvpSettingsActionState = { ok: false };

function formString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function updateInvitationPasswordAction(
  invitationId: string,
  _previousState: InvitationPasswordActionState,
  formData: FormData,
): Promise<InvitationPasswordActionState> {
  const parsed = passwordActionInputSchema.safeParse({
    intent: formString(formData.get("intent")),
    password: formString(formData.get("password")),
    confirmation: formString(formData.get("confirmation")),
  });
  if (!parsed.success) {
    const fieldErrors: { password?: string; confirmation?: string } = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "password" || field === "confirmation") && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      ok: false,
      formError: "Password belum tersimpan.",
      ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, formError: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  }

  try {
    const result = await setInvitationSharedPassword(
      prisma,
      session.user.id,
      invitationId,
      parsed.data.intent === "disable" ? null : parsed.data.password ?? null,
      { cache: nextPublicCacheInvalidator },
    );
    revalidatePath(`/invitations/${invitationId}/settings`);
    return {
      ok: true,
      passwordEnabled: result.passwordEnabled,
      message: result.passwordEnabled
        ? parsed.data.intent === "change"
          ? "Password diperbarui. Sesi tamu dengan password lama sudah dikeluarkan."
          : "Password bersama diaktifkan."
        : "Password bersama dinonaktifkan.",
    };
  } catch (error) {
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return { ok: false, formError: publicError.message };
    }
    return { ok: false, formError: "Password belum tersimpan. Coba lagi." };
  }
}

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

export async function updatePublicRsvpSettingsAction(
  invitationId: string,
  _previousState: PublicRsvpSettingsActionState,
  formData: FormData,
): Promise<PublicRsvpSettingsActionState> {
  const eventIds = formData.getAll("eventIds").filter((value): value is string => typeof value === "string");
  const parsed = publicRsvpSettingsInputSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    requirePhone: formData.get("identityMode") === "phone",
    maxPartySize: Number(formData.get("maxPartySize")),
    eventIds,
  });
  if (!parsed.success) {
    return { ok: false, formError: parsed.error.issues[0]?.message ?? "Pengaturan RSVP belum valid." };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, formError: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan." };
  }

  try {
    const settings = await setPublicRsvpSettings(prisma, session.user.id, invitationId, parsed.data);
    revalidatePath(`/invitations/${invitationId}/settings`);
    return { ok: true, settings, message: "Pengaturan RSVP publik tersimpan." };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, formError: toPublicError(error).message };
    return { ok: false, formError: "Pengaturan RSVP belum tersimpan. Coba lagi." };
  }
}
