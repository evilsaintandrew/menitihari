"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  createInvitation,
  createInvitationInputSchema,
} from "@/modules/invitations";
import { prisma } from "@/server/db";

type InvitationField = "coupleDisplayName1" | "coupleDisplayName2" | "mainEventDate";

export interface CreateInvitationActionState {
  readonly ok: boolean;
  readonly invitationId?: string;
  readonly fieldErrors?: Readonly<Partial<Record<InvitationField, string>>>;
  readonly formError?: string;
}

export const initialCreateInvitationActionState: CreateInvitationActionState = { ok: false };

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createInvitationAction(
  _previousState: CreateInvitationActionState,
  formData: FormData,
): Promise<CreateInvitationActionState> {
  const parsed = createInvitationInputSchema.safeParse({
    coupleDisplayName1: formValue(formData, "coupleDisplayName1"),
    coupleDisplayName2: formValue(formData, "coupleDisplayName2"),
    mainEventDate: formValue(formData, "mainEventDate"),
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<InvitationField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        (field === "coupleDisplayName1" || field === "coupleDisplayName2" || field === "mainEventDate") &&
        fieldErrors[field] === undefined
      ) {
        fieldErrors[field] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, formError: "Sesi Anda sudah berakhir. Masuk lagi untuk membuat undangan." };
  }

  try {
    const invitation = await createInvitation(prisma, session.user.id, parsed.data);
    return { ok: true, invitationId: invitation.id };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, formError: toPublicError(error).message };
    }
    return { ok: false, formError: "Undangan belum dapat dibuat. Coba lagi." };
  }
}
