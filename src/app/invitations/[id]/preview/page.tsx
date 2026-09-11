import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { InvitationRenderer } from "@/components/invitations/invitation-renderer";
import { Badge, TextLink } from "@/components/ui";
import { auth } from "@/lib/auth";
import { getInvitationPreviewRenderData } from "@/modules/invitations";
import { prisma } from "@/server/db";

export default async function InvitationPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const renderData = await getInvitationPreviewRenderData(prisma, session.user.id, id);
  if (!renderData) notFound();

  return (
    <main className="invitation-preview-page">
      <header className="invitation-preview-header">
        <TextLink href={`/invitations/${id}/publish`} aria-label="Kembali ke kesiapan publikasi">×</TextLink>
        <div>
          <p className="ui-overline">Preview</p>
          <h1>Undangan Anda</h1>
        </div>
        <div className="invitation-preview-actions">
          <Badge tone="warning">OWNER PREVIEW — tidak terlihat tamu</Badge>
          <TextLink className="ui-button ui-button-primary" href={`/invitations/${id}/publish`}>Publish</TextLink>
        </div>
      </header>
      <div className="invitation-preview-toolbar" role="status">
        <span>Pratinjau menggunakan renderer yang sama dengan halaman publik.</span>
        <span>Mode: Generic</span>
      </div>
      <div className="invitation-preview-viewport">
        <InvitationRenderer invitation={renderData} />
      </div>
    </main>
  );
}
