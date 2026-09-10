import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  EmptyState,
  TextLink,
} from "@/components/ui";
import {
  CommercialState,
  PublicationState,
} from "@/generated/prisma/client";
import {
  getInvitationExpiry,
  sectionInvitationDashboard,
  type InvitationDashboardItem,
} from "@/modules/invitations/dashboard";
import type { BadgeTone } from "@/components/ui/badge";

const lifecycleLabels: Readonly<Record<CommercialState, string>> = {
  [CommercialState.TRIAL]: "Trial",
  [CommercialState.TRIAL_EXPIRED]: "Trial berakhir",
  [CommercialState.PAID_ACTIVE]: "Aktif",
  [CommercialState.GRACE]: "Grace",
  [CommercialState.DELETION_PENDING]: "Akan dihapus",
  [CommercialState.DELETED]: "Dihapus",
};

const lifecycleTones: Readonly<Record<CommercialState, BadgeTone>> = {
  [CommercialState.TRIAL]: "info",
  [CommercialState.TRIAL_EXPIRED]: "warning",
  [CommercialState.PAID_ACTIVE]: "success",
  [CommercialState.GRACE]: "warning",
  [CommercialState.DELETION_PENDING]: "danger",
  [CommercialState.DELETED]: "danger",
} as const;

export function InvitationDashboard({
  invitations,
}: {
  invitations: readonly InvitationDashboardItem[];
}) {
  const sections = sectionInvitationDashboard(invitations);

  return (
    <main className="invitation-dashboard-page">
      <header className="invitation-dashboard-header">
        <div>
          <p className="ui-overline">Workspace pemilik</p>
          <h1>Undangan Anda</h1>
          <p className="invitation-dashboard-lede">
            Pantau status, masa berlaku, dan langkah berikutnya untuk semua undangan Anda.
          </p>
        </div>
        <TextLink className="ui-button ui-button-primary" href="/invitations/new">
          Buat Undangan Baru
        </TextLink>
      </header>

      {invitations.length === 0 ? (
        <Card>
          <EmptyState
            action={
              <TextLink className="ui-button ui-button-primary" href="/invitations/new">
                Mulai Buat Undangan
              </TextLink>
            }
            description="Buat undangan pertama Anda. Trial 3 hari dimulai saat undangan dibuat."
            title="Belum ada undangan"
          />
        </Card>
      ) : (
        <div className="invitation-dashboard-sections">
          <section aria-labelledby="active-invitations-title">
            <div className="invitation-dashboard-section-heading">
              <div>
                <p className="ui-overline">Perlu perhatian sekarang</p>
                <h2 id="active-invitations-title">Trial &amp; undangan aktif</h2>
              </div>
              <span className="ui-muted">{sections.active.length} undangan</span>
            </div>
            {sections.active.length > 0 ? (
              <div className="invitation-dashboard-grid">
                {sections.active.map((invitation) => (
                  <InvitationDashboardCard invitation={invitation} key={invitation.id} />
                ))}
              </div>
            ) : (
              <Card className="invitation-dashboard-empty-card">
                <CardContent>
                  <p>Belum ada trial atau undangan aktif. Riwayat Anda tetap tersedia di bawah.</p>
                </CardContent>
              </Card>
            )}
          </section>

          {sections.history.length > 0 && (
            <section aria-labelledby="invitation-history-title">
              <div className="invitation-dashboard-section-heading">
                <div>
                  <p className="ui-overline">Riwayat lifecycle</p>
                  <h2 id="invitation-history-title">Expired, grace &amp; penghapusan</h2>
                </div>
                <span className="ui-muted">{sections.history.length} undangan</span>
              </div>
              <div className="invitation-dashboard-grid invitation-dashboard-grid-history">
                {sections.history.map((invitation) => (
                  <InvitationDashboardCard invitation={invitation} key={invitation.id} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function InvitationDashboardCard({
  invitation,
}: {
  invitation: InvitationDashboardItem;
}) {
  const expiry = getInvitationExpiry(invitation);
  const isDeleted = invitation.commercialState === CommercialState.DELETED;
  const isDeletionPending = invitation.commercialState === CommercialState.DELETION_PENDING;
  const isPublished = invitation.publicationState === PublicationState.PUBLISHED;

  return (
    <Card className="invitation-dashboard-card">
      <CardHeader>
        <div className="invitation-dashboard-card-topline">
          <div>
            <p className="ui-overline">{invitation.ownerFacingTitle}</p>
            <h3>{invitation.coupleDisplayName1} &amp; {invitation.coupleDisplayName2}</h3>
          </div>
          <Badge tone={lifecycleTones[invitation.commercialState]}>
            {lifecycleLabels[invitation.commercialState]}
          </Badge>
        </div>
        <CardDescription>
          <span className="invitation-dashboard-publication">
            <Badge tone={isPublished ? "success" : "neutral"}>
              {isPublished ? "Published" : invitation.publicationState === PublicationState.UNPUBLISHED ? "Offline" : "Draft"}
            </Badge>
            {invitation.canonicalSlug ? ` /${invitation.canonicalSlug}` : " Alamat publik belum tersedia"}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="invitation-dashboard-card-content">
        <dl className="invitation-dashboard-meta">
          <div>
            <dt>{isDeletionPending ? "Dijadwalkan dihapus" : isDeleted ? "Status akhir" : "Berlaku sampai"}</dt>
            <dd>{expiry ? formatLifecycleDate(expiry) : "Sudah dihapus"}</dd>
          </div>
          {invitation.commercialState === CommercialState.GRACE && invitation.activeUntil && (
            <div>
              <dt>Masa aktif berakhir</dt>
              <dd>{formatLifecycleDate(invitation.activeUntil)}</dd>
            </div>
          )}
        </dl>
        {invitation.commercialState === CommercialState.TRIAL && (
          <p className="invitation-dashboard-hint">Trial berjalan. Aktifkan sebelum tanggal di atas agar undangan tetap online.</p>
        )}
        {invitation.commercialState === CommercialState.GRACE && (
          <p className="invitation-dashboard-hint">Undangan publik offline. Preview pribadi dan export tersedia selama grace.</p>
        )}
        {invitation.commercialState === CommercialState.DELETION_PENDING && (
          <p className="invitation-dashboard-hint">Undangan offline dan menunggu purge sesuai jadwal server.</p>
        )}
      </CardContent>
      {!isDeleted && (
        <CardFooter className="invitation-dashboard-card-actions">
          <TextLink className="ui-button ui-button-secondary" href={`/invitations/${invitation.id}/publish`}>
            Kelola Undangan
          </TextLink>
          {invitation.canonicalSlug && isPublished && (
            <TextLink href={`/${invitation.canonicalSlug}`}>Buka Undangan</TextLink>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

function formatLifecycleDate(value: Date): string {
  return value.toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}
