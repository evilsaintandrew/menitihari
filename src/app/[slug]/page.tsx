import { notFound, permanentRedirect } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui";
import { isPublicInvitationAvailable } from "@/modules/lifecycle";
import { resolveInvitationSlug, isInvitationSlugPathSegment } from "@/modules/invitations";
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

  const invitation = await prisma.invitation.findUnique({
    where: { id: resolution.invitationId },
    select: {
      coupleDisplayName1: true,
      coupleDisplayName2: true,
      publicationState: true,
      commercialState: true,
      trialEndsAt: true,
      activeUntil: true,
      genericAccessEnabled: true,
      primaryEvent: { select: { startsAt: true } },
    },
  });

  if (!invitation) notFound();

  const available = isPublicInvitationAvailable(invitation);

  return (
    <main className="public-invitation-page">
      <Card>
        <CardHeader>
          <p className="ui-overline">Menitihari</p>
          <h1 className="auth-title">
            {available
              ? `${invitation.coupleDisplayName1} & ${invitation.coupleDisplayName2}`
              : "Undangan ini sudah tidak tersedia"}
          </h1>
        </CardHeader>
        {available && invitation.primaryEvent && (
          <CardContent>
            <p>Acara utama</p>
            <p>{invitation.primaryEvent.startsAt.toLocaleDateString("id-ID")}</p>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
