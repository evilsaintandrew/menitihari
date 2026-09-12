import { env } from "@/config/env";
import { DomainError } from "@/modules/errors";
import {
  activateGuest,
  guestActivationTokenSchema,
  guestSessionCookieName,
} from "@/modules/access";
import { isInvitationSlugPathSegment, resolveInvitationSlug } from "@/modules/invitations";
import { prisma } from "@/server/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const INVALID_LINK_MESSAGE = "Link undangan tidak valid atau sudah tidak berlaku.";

function invalidLinkResponse(): NextResponse {
  return new NextResponse(INVALID_LINK_MESSAGE, {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> },
) {
  const { slug, token } = await params;
  if (!isInvitationSlugPathSegment(slug) || !guestActivationTokenSchema.safeParse(token).success) {
    return invalidLinkResponse();
  }

  const resolution = await resolveInvitationSlug(prisma, slug);
  if (!resolution) return invalidLinkResponse();

  try {
    const activation = await activateGuest(prisma, token, { invitationId: resolution.invitationId });
    const destination = new URL(`/${encodeURIComponent(resolution.canonicalSlug)}`, request.url);
    const response = NextResponse.redirect(destination, 303);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(guestSessionCookieName(activation.invitationId), activation.sessionToken, {
      expires: activation.expiresAt,
      maxAge: Math.max(1, Math.floor((activation.expiresAt.getTime() - Date.now()) / 1_000)),
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: env.NODE_ENV === "production" || env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    });
    return response;
  } catch (error) {
    if (error instanceof DomainError && error.code === "FORBIDDEN") return invalidLinkResponse();
    return invalidLinkResponse();
  }
}
