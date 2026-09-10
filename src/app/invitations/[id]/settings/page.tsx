import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, TextLink } from "@/components/ui";
import { auth } from "@/lib/auth";
import { getInvitationSlugForOwner } from "@/modules/invitations";
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
  const slug = await getInvitationSlugForOwner(prisma, session.user.id, id);
  if (!slug) notFound();

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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
