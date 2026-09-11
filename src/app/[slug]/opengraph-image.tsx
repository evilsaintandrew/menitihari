import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import {
  buildInvitationShareMetadata,
  formatPrimaryEventDate,
  getInvitationShareMetadataContext,
  isShareMetadataPubliclyNamed,
  resolveInvitationSlug,
  isInvitationSlugPathSegment,
} from "@/modules/invitations";
import { prisma } from "@/server/db";

export const alt = "Undangan pernikahan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

function fallbackImage() {
  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#fff8f5", color: "#402b35", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", padding: "80px", textAlign: "center", width: "100%" }}>
      <div style={{ color: "#bd7185", fontSize: 28, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>Menitihari</div>
      <div style={{ fontSize: 64, fontWeight: 700, marginTop: 28 }}>Undangan pernikahan</div>
    </div>,
    size,
  );
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isInvitationSlugPathSegment(slug)) notFound();

  const resolution = await resolveInvitationSlug(prisma, slug);
  if (!resolution) return fallbackImage();

  const context = await getInvitationShareMetadataContext(prisma, resolution.invitationId);
  if (!context) return fallbackImage();

  const metadata = buildInvitationShareMetadata({
    slug: resolution.canonicalSlug,
    coupleDisplayName1: context.coupleDisplayName1,
    coupleDisplayName2: context.coupleDisplayName2,
    language: context.language,
    timezone: context.timezone,
    primaryEventStartsAt: context.primaryEventStartsAt,
    primaryEventTimezone: context.primaryEventTimezone,
    available: context.available,
    passwordProtected: context.passwordProtected,
    coverMediaAssetId: context.coverMediaAssetId,
    shareCoverMediaAssetId: context.shareCoverMediaAssetId,
  });
  const isNamed = isShareMetadataPubliclyNamed(context);
  const date = isNamed
    ? formatPrimaryEventDate(context.primaryEventStartsAt, context.primaryEventTimezone, context.language)
    : null;

  return new ImageResponse(
    <div style={{ alignItems: "center", background: metadata.coverSource === "selected" ? "#fffdfb" : "#fff8f5", color: "#402b35", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", padding: "80px", textAlign: "center", width: "100%" }}>
      <div style={{ color: "#bd7185", fontSize: 28, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>Menitihari</div>
      <div style={{ fontSize: 64, fontWeight: 700, marginTop: 28 }}>{metadata.title}</div>
      {date && <div style={{ fontSize: 30, marginTop: 26 }}>{date}</div>}
    </div>,
    size,
  );
}
