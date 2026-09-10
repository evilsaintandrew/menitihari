import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, TextLink } from "@/components/ui";
import { InvitationDeletionSection } from "@/components/invitations/invitation-deletion-section";
import { auth } from "@/lib/auth";
import {
  getInvitationDeletionStatus,
  getInvitationForOwner,
  getInvitationSlugForOwner,
} from "@/modules/invitations";
import { prisma } from "@/server/db";

import { InvitationSlugForm } from "./slug-form";

export default async function InvitationSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const [slug, deletionStatus, invitation] = await Promise.all([
    getInvitationSlugForOwner(prisma, session.user.id, id),
    getInvitationDeletionStatus(prisma, session.user.id, id),
    getInvitationForOwner(prisma, session.user.id, id),
  ]);
  if (!slug || !deletionStatus || !invitation) notFound();

  return (
    <main className="auth-page invitation-settings-page">
      <div className="auth-container invitation-settings-container">
        <header className="auth-header">
          <TextLink href={`/invitations/${id}/themes`} aria-label="Kembali ke tema">←</TextLink>
          <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span> Menitihari</span>
        </header>
        <Card>
          <CardHeader>
            <p className="ui-overline">Settings / Sharing &amp; Privacy</p>
            <h1 className="auth-title">Alamat link publik</h1>
            <p className="ui-card-description">Pilih alamat yang mudah dibagikan. Perubahan tidak menghapus link lama.</p>
          </CardHeader>
          <CardContent>
            <InvitationSlugForm invitationId={id} canonicalSlug={slug.canonicalSlug} />
            <InvitationDeletionSection
              commercialState={deletionStatus.commercialState}
              invitationId={id}
              invitationTitle={`${invitation.coupleDisplayName1} & ${invitation.coupleDisplayName2}`}
              purgeAt={deletionStatus.purgeAt?.toISOString() ?? null}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
