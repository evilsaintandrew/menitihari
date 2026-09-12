import { Button, Select } from "@/components/ui";
import type { InvitationPreviewGuestOption } from "@/modules/invitations";

export function InvitationPreviewModeForm({
  invitationId,
  guestOptions,
  selectedGuestId,
}: {
  readonly invitationId: string;
  readonly guestOptions: readonly InvitationPreviewGuestOption[];
  readonly selectedGuestId?: string;
}) {
  return (
    <form action={`/invitations/${invitationId}/preview`} className="invitation-preview-mode-form" method="get">
      <label className="invitation-preview-mode-label" htmlFor="invitation-preview-mode">Tampilkan sebagai</label>
      <div className="invitation-preview-mode-control">
        <Select defaultValue={selectedGuestId ?? ""} id="invitation-preview-mode" name="guestId">
          <option value="">Generic</option>
          {guestOptions.map((guest) => <option key={guest.id} value={guest.id}>{guest.displayName}</option>)}
        </Select>
        <Button size="sm" type="submit" variant="secondary">Tampilkan</Button>
      </div>
    </form>
  );
}
