import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isInvitationSlugPathSegment, resolveInvitationSlug } from "@/modules/invitations";
import { prisma } from "@/server/db";

export async function proxy(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return NextResponse.next();

  let slug: string;
  try {
    slug = decodeURIComponent(segments[0]);
  } catch {
    return NextResponse.next();
  }
  if (!isInvitationSlugPathSegment(slug)) return NextResponse.next();

  const resolution = await resolveInvitationSlug(prisma, slug);
  if (!resolution || resolution.isCanonical) return NextResponse.next();

  const canonicalUrl = request.nextUrl.clone();
  canonicalUrl.pathname = `/${resolution.canonicalSlug}`;
  return NextResponse.redirect(canonicalUrl, 301);
}

export const config = {
  matcher: "/:slug",
};
