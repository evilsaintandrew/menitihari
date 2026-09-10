import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Card, CardHeader, TextLink } from "@/components/ui";
import { ThemePicker } from "@/components/themes/theme-picker";
import { auth } from "@/lib/auth";
import { getInvitationThemePicker, THEME_REGISTRY } from "@/modules/themes";
import { prisma } from "@/server/db";

export default async function InvitationThemeHandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const invitation = await getInvitationThemePicker(prisma, session.user.id, id);
  if (!invitation) notFound();

  return (
    <main className="auth-page invitation-theme-page">
      <div className="auth-container invitation-theme-container">
        <header className="auth-header">
          <TextLink href="/invitations" aria-label="Kembali ke daftar undangan">←</TextLink>
          <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span> Menitihari</span>
        </header>
        <Card>
          <CardHeader>
            <p className="ui-overline">Langkah berikutnya</p>
            <h1 className="auth-title">Pilih tema</h1>
            <p className="ui-card-description">Pilih tampilan untuk undangan Anda. Semua tema tersedia selama masa trial dan masa aktif berbayar.</p>
          </CardHeader>
        </Card>
        <ThemePicker
          canEdit={invitation.canEdit}
          coupleName={`${invitation.coupleDisplayName1} & ${invitation.coupleDisplayName2}`}
          invitationId={invitation.invitationId}
          selectedThemeId={invitation.selectedThemeId}
          selectedThemeVersion={invitation.selectedThemeVersion}
          themes={THEME_REGISTRY}
        />
        <div className="invitation-theme-back-link">
          <TextLink href={`/invitations/${id}/settings`}>Atur alamat link publik</TextLink>
          <TextLink href="/invitations">Kembali ke daftar undangan</TextLink>
        </div>
      </div>
    </main>
  );
}
