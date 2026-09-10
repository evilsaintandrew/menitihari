import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Alert, Badge, Card, CardContent, CardHeader, TextLink } from "@/components/ui";
import { auth } from "@/lib/auth";
import {
  getInvitationPublishReadiness,
  type PublishRequirement,
} from "@/modules/invitations";
import { prisma } from "@/server/db";

import { PublishForm } from "./publish-form";

const requirementLabels: Readonly<Record<PublishRequirement, string>> = {
  coupleNames: "Nama pasangan",
  primaryEvent: "Acara utama & tanggal",
  theme: "Tema",
};

export default async function PublishReadinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const readiness = await getInvitationPublishReadiness(prisma, session.user.id, id);
  if (!readiness) notFound();

  const isPublished = readiness.publicationState === "PUBLISHED";
  const isCommerciallyEditable = readiness.commercialStateAllowsPublication;
  const canPublish = isCommerciallyEditable && readiness.missingRequirements.length === 0;

  return (
    <main className="auth-page invitation-publish-page">
      <div className="auth-container invitation-publish-container">
        <header className="auth-header">
          <TextLink href={`/invitations/${id}/themes`} aria-label="Kembali ke tema">←</TextLink>
          <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span> Menitihari</span>
        </header>
        <Card>
          <CardHeader>
            <p className="ui-overline">Publish Readiness</p>
            <h1 className="auth-title">Siap dipublikasikan?</h1>
            <p className="ui-card-description">
              {readiness.coupleDisplayName1} &amp; {readiness.coupleDisplayName2}
            </p>
          </CardHeader>
          <CardContent className="invitation-publish-content">
            <div className="invitation-publish-status">
              <span>Status publikasi</span>
              <Badge tone={isPublished ? "success" : "neutral"}>
                {isPublished ? "Published" : readiness.publicationState === "UNPUBLISHED" ? "Offline" : "Draft"}
              </Badge>
            </div>

            {!isCommerciallyEditable && (
              <Alert tone="warning" title="Publikasi sedang dikunci">
                {readiness.commercialState === "TRIAL_EXPIRED"
                  ? "Trial undangan ini sudah berakhir. Undangan publik sedang offline dan editor hanya-baca. Data yang sudah dibuat tetap tersimpan."
                  : "Status komersial undangan ini tidak mengizinkan perubahan publikasi saat ini."}
              </Alert>
            )}

            <div className="invitation-publish-checklist" aria-label="Syarat publikasi">
              {(Object.keys(requirementLabels) as PublishRequirement[]).map((requirement) => {
                const valid = readiness.requirements[requirement];
                return (
                  <div className="invitation-publish-check" key={requirement}>
                    <span aria-hidden="true" className={valid ? "invitation-publish-checkmark" : "invitation-publish-warning"}>
                      {valid ? "✓" : "!"}
                    </span>
                    <span>{requirementLabels[requirement]}</span>
                    {!valid && <TextLink href={`/invitations/${id}/themes`}>Lengkapi</TextLink>}
                  </div>
                );
              })}
            </div>

            <div className="invitation-publish-privacy">
              <h2>Akses publik</h2>
              <p>Siapa pun yang memiliki link dapat membuka konten yang ditandai publik.</p>
              <p>Undangan tidak diindeks mesin cari.</p>
            </div>

            {!canPublish && !isPublished && isCommerciallyEditable && (
              <p className="ui-field-error" id="publish-disabled-hint">
                Lengkapi syarat di atas sebelum mempublikasikan undangan.
              </p>
            )}

            <PublishForm
              invitationId={readiness.invitationId}
              publicationState={readiness.publicationState}
              canPublish={canPublish}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
