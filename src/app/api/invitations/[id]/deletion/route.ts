import { z } from "zod";

import { env } from "@/config/env";
import { auth } from "@/lib/auth";
import { DomainError, toPublicError } from "@/modules/errors";
import {
  DEFAULT_INVITATION_PURGE_WINDOW_SECONDS,
  invitationDeletionInputSchema,
  requestInvitationDeletion,
} from "@/modules/invitations";
import { nextPublicCacheInvalidator } from "@/server/public-cache";
import { prisma } from "@/server/db";

const invitationIdSchema = z.string().trim().min(1).max(128);

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    headers: { "cache-control": "no-store" },
    ...init,
  });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(env.NEXT_PUBLIC_APP_URL).origin;
}

async function currentUser(request: Request) {
  if (!sameOrigin(request)) return null;
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

function statusResponse(status: Awaited<ReturnType<typeof requestInvitationDeletion>>): Response {
  return json({
    state: status.commercialState,
    commercialState: status.commercialState,
    publicationState: status.publicationState,
    purgeAt: status.purgeAt?.toISOString() ?? null,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await currentUser(request);
  if (!user) return json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });

  const { id } = await context.params;
  const invitationId = invitationIdSchema.safeParse(id);
  if (!invitationId.success) {
    return json({ error: { code: "VALIDATION_FAILED", message: "Undangan belum dapat dihapus." } }, { status: 400 });
  }

  const parsed = invitationDeletionInputSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return json({ error: { code: "VALIDATION_FAILED", message: "Ketik HAPUS untuk melanjutkan." } }, { status: 400 });
  }

  try {
    const status = await requestInvitationDeletion(prisma, user.id, invitationId.data, {
      purgeWindowSeconds:
        env.INVITATION_PURGE_WINDOW_SECONDS ?? DEFAULT_INVITATION_PURGE_WINDOW_SECONDS,
      cache: nextPublicCacheInvalidator,
    });
    return statusResponse(status);
  } catch (error) {
    if (error instanceof DomainError) {
      const publicError = toPublicError(error);
      return json({ error: { code: publicError.code, message: publicError.message } }, {
        status: publicError.code === "NOT_FOUND" ? 404 : 409,
      });
    }
    return json({ error: { code: "INTERNAL_ERROR", message: "Undangan belum dapat dihapus. Coba lagi." } }, { status: 500 });
  }
}
