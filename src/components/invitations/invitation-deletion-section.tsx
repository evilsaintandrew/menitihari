"use client";

import { useState, type FormEvent } from "react";

import {
  Alert,
  BottomSheet,
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  TextLink,
} from "@/components/ui";

interface InvitationDeletionSectionProps {
  readonly invitationId: string;
  readonly invitationTitle: string;
  readonly commercialState: string;
  readonly purgeAt: string | null;
}

interface DeletionResponse {
  readonly state?: string;
  readonly purgeAt?: string | null;
  readonly error?: { readonly message?: string };
}

export function InvitationDeletionSection({
  invitationId,
  invitationTitle,
  commercialState: initialCommercialState,
  purgeAt: initialPurgeAt,
}: InvitationDeletionSectionProps) {
  const [commercialState, setCommercialState] = useState(initialCommercialState);
  const [purgeAt, setPurgeAt] = useState(initialPurgeAt);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [confirmationError, setConfirmationError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  const isPending = commercialState === "DELETION_PENDING";

  function closeDialog() {
    if (pending) return;
    setOpen(false);
    setConfirmation("");
    setConfirmationError(undefined);
  }

  async function deleteInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    if (confirmation !== "HAPUS") {
      setConfirmationError("Ketik HAPUS untuk melanjutkan.");
      return;
    }

    setConfirmationError(undefined);
    setPending(true);
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/deletion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const value = (await response.json().catch(() => undefined)) as DeletionResponse | undefined;
      if (!response.ok || !value?.state) {
        setMessage(value?.error?.message ?? "Undangan belum dapat dihapus. Coba lagi.");
        return;
      }

      setCommercialState(value.state);
      setPurgeAt(value.purgeAt ?? null);
      setOpen(false);
      setConfirmation("");
      setMessage("Undangan sudah offline dan penghapusan datanya dijadwalkan.");
    } catch {
      setMessage("Undangan belum dapat dihapus. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  if (isPending) {
    return (
      <section aria-labelledby="invitation-deletion-title" className="invitation-deletion-section">
        <div>
          <h2 id="invitation-deletion-title">Penghapusan undangan dijadwalkan</h2>
          <p>Link publik sudah offline. Data dan media akan diproses untuk dihapus.</p>
        </div>
        {purgeAt && (
          <Alert tone="warning">
            Penghapusan terjadwal: <time dateTime={purgeAt}>{formatDeadline(purgeAt)}</time> WIB.
          </Alert>
        )}
        {message && <Alert tone="success">{message}</Alert>}
      </section>
    );
  }

  return (
    <section aria-labelledby="invitation-deletion-title" className="invitation-deletion-section">
      <div>
        <p className="ui-overline">Danger Zone</p>
        <h2 id="invitation-deletion-title">Hapus Undangan</h2>
        <p>Menghapus undangan akan membuat link publik langsung offline dan memulai proses penghapusan data. Pembayaran tidak otomatis direfund.</p>
      </div>
      <div className="invitation-deletion-export-offer">
        <strong>Simpan data terlebih dahulu?</strong>
        <p>Export data adalah pilihan dan tidak wajib sebelum menghapus undangan.</p>
        <TextLink href={`/invitations/${encodeURIComponent(invitationId)}/export`}>Export Data Dulu</TextLink>
      </div>
      {message && <Alert tone="danger">{message}</Alert>}
      <Button disabled={pending} onClick={() => setOpen(true)} variant="danger">
        Hapus Undangan…
      </Button>
      <BottomSheet
        description="Tindakan ini membuat undangan offline dan menjadwalkan penghapusan data/media. Pembayaran tidak otomatis direfund."
        onClose={closeDialog}
        open={open}
        title={`Hapus “${invitationTitle}”?`}
      >
        <form className="invitation-deletion-form" noValidate onSubmit={deleteInvitation}>
          <ul className="invitation-deletion-consequences">
            <li>Link publik langsung offline.</li>
            <li>Data dan media dijadwalkan untuk dihapus.</li>
            <li>Tidak ada refund otomatis.</li>
          </ul>
          <Field htmlFor="invitation-deletion-confirmation">
            <FieldLabel required>Ketik HAPUS untuk mengonfirmasi</FieldLabel>
            <Input
              aria-describedby={confirmationError ? "invitation-deletion-confirmation-error" : undefined}
              aria-invalid={confirmationError ? "true" : undefined}
              autoComplete="off"
              id="invitation-deletion-confirmation"
              onChange={(event) => setConfirmation(event.target.value)}
              required
              value={confirmation}
            />
            {confirmationError && <FieldError id="invitation-deletion-confirmation-error">{confirmationError}</FieldError>}
          </Field>
          <div className="invitation-deletion-actions">
            <Button disabled={pending} type="submit" variant="danger">
              {pending ? "Menghapus…" : "Hapus Undangan"}
            </Button>
            <Button disabled={pending} onClick={closeDialog} type="button" variant="ghost">Batal</Button>
          </div>
        </form>
      </BottomSheet>
    </section>
  );
}

function formatDeadline(value: string): string {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}
