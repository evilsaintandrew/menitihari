import { notFound, permanentRedirect } from "next/navigation";

import { InvitationRenderer } from "@/components/invitations/invitation-renderer";
import { Card, CardHeader } from "@/components/ui";
import {
  getPublicInvitationPageData,
  resolveInvitationSlug,
  isInvitationSlugPathSegment,
} from "@/modules/invitations";
import { prisma } from "@/server/db";

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

  const pageData = await getPublicInvitationPageData(prisma, resolution.invitationId);
  if (!pageData) notFound();

  return (
    <main className="public-invitation-page">
      {pageData.available && pageData.renderData ? (
        <InvitationRenderer invitation={pageData.renderData} />
      ) : (
        <Card>
          <CardHeader>
            <p className="ui-overline">Menitihari</p>
            <h1 className="auth-title">Undangan ini sudah tidak tersedia</h1>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
