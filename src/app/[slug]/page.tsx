import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";

import { InvitationRenderer } from "@/components/invitations/invitation-renderer";
import { Card, CardHeader } from "@/components/ui";
import {
  getGuestSessionAccess,
  guestSessionCookieName,
  getInvitationPasswordAccess,
  invitationPasswordSessionCookieName,
} from "@/modules/access";
import {
  getPublicInvitationPageData,
  getPersonalizedInvitationPageData,
  getInvitationShareMetadataContext,
  buildInvitationShareMetadata,
  resolveInvitationSlug,
  isInvitationSlugPathSegment,
} from "@/modules/invitations";
import { prisma } from "@/server/db";

import { InvitationPasswordGate } from "./password-gate";

const unavailableShareMetadata: Metadata = {
  title: "Undangan pernikahan",
  description: "Buka undangan untuk melihat detail acara.",
  robots: { index: false, follow: false },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isInvitationSlugPathSegment(slug)) return unavailableShareMetadata;

  const resolution = await resolveInvitationSlug(prisma, slug);
  if (!resolution) return unavailableShareMetadata;

  const context = await getInvitationShareMetadataContext(prisma, resolution.invitationId);
  if (!context) return unavailableShareMetadata;

  const shareMetadata = buildInvitationShareMetadata({
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

  return {
    title: shareMetadata.title,
    description: shareMetadata.description,
    robots: shareMetadata.robots,
    openGraph: {
      type: "website",
      title: shareMetadata.title,
      description: shareMetadata.description,
      url: `/${encodeURIComponent(resolution.canonicalSlug)}`,
      images: [{ url: shareMetadata.imagePath, alt: shareMetadata.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: shareMetadata.title,
      description: shareMetadata.description,
      images: [shareMetadata.imagePath],
    },
  };
}

export default async function PublicInvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isInvitationSlugPathSegment(slug)) notFound();

  const resolution = await resolveInvitationSlug(prisma, slug);
  if (!resolution) notFound();
  if (!resolution.isCanonical) permanentRedirect(`/${resolution.canonicalSlug}`);

  const passwordCookie = (await cookies()).get(
    invitationPasswordSessionCookieName(resolution.invitationId),
  );
  const guestCookie = (await cookies()).get(guestSessionCookieName(resolution.invitationId));
  const guestSession = await getGuestSessionAccess(
    prisma,
    resolution.invitationId,
    guestCookie?.value,
  );
  const personalized = guestSession?.authorized === true && guestSession.guestId !== null;
  const access = await getInvitationPasswordAccess(
    prisma,
    resolution.invitationId,
    passwordCookie?.value,
    new Date(),
    { mode: personalized ? "personalized" : "generic" },
  );
  if (!access) notFound();
  if (!access.available) {
    return (
      <main className="public-invitation-page">
        <Card>
          <CardHeader>
            <p className="ui-overline">Menitihari</p>
            <h1 className="auth-title">Undangan ini sudah tidak tersedia</h1>
          </CardHeader>
        </Card>
      </main>
    );
  }
  if (access.passwordRequired && !access.authorized) {
    return (
      <main className="public-invitation-page">
        <InvitationPasswordGate
          invitationId={resolution.invitationId}
          mode={personalized ? "personalized" : "generic"}
        />
      </main>
    );
  }

  const renderData = personalized
    ? await getPersonalizedInvitationPageData(
      prisma,
      resolution.invitationId,
      guestSession.guestId,
    )
    : (await getPublicInvitationPageData(prisma, resolution.invitationId))?.renderData ?? null;
  if (!renderData) notFound();

  return (
    <main className="public-invitation-page">
      <InvitationRenderer invitation={renderData} />
    </main>
  );
}
