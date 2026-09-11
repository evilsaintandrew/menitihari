import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  getInvitationEditorSnapshot,
  getInvitationPreviewRenderData,
} from "@/modules/invitations";
import { getInvitationShareCoverOptions } from "@/modules/media";
import { resolveThemeForRender } from "@/modules/themes";
import { prisma } from "@/server/db";

import { InvitationEditor } from "./invitation-editor";

export default async function InvitationEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const [snapshot, preview, shareCoverOptions] = await Promise.all([
    getInvitationEditorSnapshot(prisma, session.user.id, id),
    getInvitationPreviewRenderData(prisma, session.user.id, id),
    getInvitationShareCoverOptions(prisma, session.user.id, id),
  ]);
  if (!snapshot || !preview) notFound();

  return (
    <InvitationEditor
      invitationId={snapshot.invitationId}
      invitationTitle={snapshot.ownerFacingTitle}
      initialContent={preview.content}
      initialVersion={snapshot.version}
      preview={preview}
      theme={resolveThemeForRender(preview.themeId, preview.themeVersion, preview.themeConfig)}
      publicationState={snapshot.publicationState}
      commercialState={snapshot.commercialState}
      canEdit={snapshot.canEdit}
      shareCoverOptions={shareCoverOptions}
    />
  );
}
