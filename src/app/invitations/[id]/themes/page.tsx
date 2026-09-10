import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, TextLink } from "@/components/ui";
import { auth } from "@/lib/auth";
import { getInvitationForOwner } from "@/modules/invitations";
import { prisma } from "@/server/db";

export default async function InvitationThemeHandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const invitation = await getInvitationForOwner(prisma, session.user.id, id);
  if (!invitation) notFound();

  return (
    <main className="auth-page invitation-create-page">
      <div className="auth-container invitation-create-container">
        <header className="auth-header">
          <TextLink href="/invitations" aria-label="Kembali ke daftar undangan">←</TextLink>
          <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span> Menitihari</span>
        </header>
        <Card>
          <CardHeader>
            <p className="ui-overline">Langkah berikutnya</p>
            <h1 className="auth-title">Pilih tema</h1>
            <p className="ui-card-description">Undangan {invitation.coupleDisplayName1} &amp; {invitation.coupleDisplayName2} berhasil dibuat sebagai draft trial.</p>
          </CardHeader>
          <CardContent className="invitation-theme-handoff">
            <p>Semua 10 tema termasuk dalam trial. Pemilih tema akan tersedia di langkah berikutnya.</p>
            <TextLink className="ui-button ui-button-primary" href={`/invitations/${id}/publish`}>Lihat kesiapan publikasi</TextLink>
            <TextLink className="ui-button ui-button-secondary" href={`/invitations/${id}/settings`}>Atur alamat link publik</TextLink>
            <TextLink className="ui-button ui-button-secondary" href="/invitations">Kembali ke daftar undangan</TextLink>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
