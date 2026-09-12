import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { InvitationRenderer } from "@/components/invitations/invitation-renderer";
import { Badge, TextLink } from "@/components/ui";
import { auth } from "@/lib/auth";
import {
  getInvitationPreviewGuestOptions,
  getInvitationPreviewRenderData,
} from "@/modules/invitations";
import { prisma } from "@/server/db";

import { InvitationPreviewModeForm } from "./preview-mode-form";

const previewQuerySchema = z.object({
  guestId: z.string().trim().min(1).max(128).optional(),
}).strict();

function parseGuestId(value: string | string[] | undefined): string | undefined {
  const parsed = previewQuerySchema.safeParse({
    guestId: typeof value === "string" ? value : undefined,
  });
  return parsed.success ? parsed.data.guestId : undefined;
}

export default async function InvitationPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guestId?: string | string[] }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const query = await searchParams;
  const selectedGuestId = parseGuestId(query.guestId);
  const [renderData, guestOptions] = await Promise.all([
    getInvitationPreviewRenderData(prisma, session.user.id, id, selectedGuestId),
    getInvitationPreviewGuestOptions(prisma, session.user.id, id),
  ]);
  if (!renderData || !guestOptions) notFound();

  const isPersonalizedPreview = renderData.mode === "personalized";

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
      {guestOptions.length > 0 && (
        <InvitationPreviewModeForm
          guestOptions={guestOptions}
          invitationId={id}
          selectedGuestId={selectedGuestId}
        />
      )}
      {isPersonalizedPreview && (
        <div className="invitation-preview-context" role="status">
          <strong>OWNER PREVIEW</strong>
          <span>Mode tamu ini hanya terlihat oleh Anda dan tidak menggunakan link aktivasi tamu.</span>
        </div>
      )}
      <div className="invitation-preview-toolbar" role="status">
        <span>Pratinjau menggunakan renderer yang sama dengan halaman publik.</span>
        <span>Mode: {isPersonalizedPreview ? `Preview as Guest · ${renderData.guest?.displayName ?? "Tamu"}` : "Generic"}</span>
      </div>
      <div className="invitation-preview-viewport">
        <InvitationRenderer invitation={renderData} />
      </div>
    </main>
  );
}
