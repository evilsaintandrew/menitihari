import { z } from "zod";

import { env } from "@/config/env";
import { AccountDeletionState } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import {
  cancelAccountDeletion,
  getAccountDeletionStatus,
  requestAccountDeletion,
} from "@/modules/auth/account-deletion";
import { prisma } from "@/server/db";

const deletionRequestSchema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal("HAPUS AKUN"),
});

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

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });

  const status = await getAccountDeletionStatus(prisma, user.id);
  if (!status) return json({ error: { code: "NOT_FOUND" } }, { status: 404 });

  return json({
    state: status.state,
    cancellableUntil: status.cancellableUntil?.toISOString() ?? null,
  });
}

export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });

  const parsed = deletionRequestSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return json({ error: { code: "VALIDATION_FAILED", message: "Konfirmasi belum benar." } }, { status: 400 });
  }
  if (env.ACCOUNT_DELETION_COOLING_OFF_SECONDS === undefined) {
    return json({ error: { code: "INTERNAL_ERROR" } }, { status: 503 });
  }

  const context = await auth.$context;
  const account = await context.internalAdapter.findCredentialAccount(user.id);
  if (!account?.password || !(await context.password.verify({ hash: account.password, password: parsed.data.password }))) {
    return json({ error: { code: "FORBIDDEN", message: "Password saat ini tidak benar." } }, { status: 403 });
  }

  try {
    const status = await requestAccountDeletion(prisma, user.id, {
      coolingOffSeconds: env.ACCOUNT_DELETION_COOLING_OFF_SECONDS,
    });
    return json({
      state: status.state,
      cancellableUntil: status.cancellableUntil?.toISOString() ?? null,
    });
  } catch {
    return json({ error: { code: "CONFLICT", message: "Penghapusan akun belum dapat dijadwalkan." } }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) return json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });

  try {
    const status = await cancelAccountDeletion(prisma, user.id);
    if (status.state !== AccountDeletionState.ACTIVE) {
      return json({ error: { code: "CONFLICT", message: "Masa pembatalan sudah berakhir." } }, { status: 409 });
    }
    return json({ state: status.state, cancellableUntil: null });
  } catch {
    return json({ error: { code: "CONFLICT", message: "Penghapusan akun belum dapat dibatalkan." } }, { status: 409 });
  }
}
