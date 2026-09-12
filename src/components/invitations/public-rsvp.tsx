"use client";

import { useState, useTransition } from "react";

import {
  Alert,
  Button,
  Dialog,
  Field,
  FieldLabel,
  Input,
  TextLink,
} from "@/components/ui";
import type { PublicRsvpData } from "@/modules/rsvp";

import {
  submitPublicRsvpAction,
  type SubmitPublicRsvpActionState,
} from "@/app/[slug]/rsvp-actions";

const initialSubmitPublicRsvpActionState: SubmitPublicRsvpActionState = { ok: false };

export function PublicRsvp({
  invitationId,
  data,
}: {
  readonly invitationId: string;
  readonly data: PublicRsvpData | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SubmitPublicRsvpActionState>(initialSubmitPublicRsvpActionState);
  const [pending, startTransition] = useTransition();

  if (!data || !data.enabled) return null;

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await submitPublicRsvpAction(invitationId, state, formData);
      setState(result);
    });
  };

  return (
    <section className="public-rsvp-card" aria-labelledby="public-rsvp-heading">
      <p className="invitation-renderer-kicker">RSVP</p>
      <h2 id="public-rsvp-heading">Konfirmasi kehadiran</h2>
      {data.closed ? (
        <p className="personalized-rsvp-closed-copy">RSVP sudah ditutup</p>
      ) : (
        <>
          <p className="public-rsvp-copy">Isi data singkat untuk mendapatkan undangan personal Anda.</p>
          <Button onClick={() => setOpen(true)}>Konfirmasi Kehadiran</Button>
        </>
      )}
      <Dialog
        className="personalized-rsvp-dialog public-rsvp-dialog"
        description="Data ini digunakan untuk mencatat kehadiran Anda. Nomor telepon tidak ditampilkan di undangan."
        onClose={() => setOpen(false)}
        open={open && !state.result}
        title="Konfirmasi Kehadiran"
      >
        <form action={submit} className="public-rsvp-form" noValidate>
          {state.message && !state.ok && <Alert tone="danger" title="RSVP belum tersimpan">{state.message}</Alert>}
          <Field htmlFor="public-rsvp-name">
            <FieldLabel required>Nama</FieldLabel>
            <Input aria-label="Nama" autoComplete="name" id="public-rsvp-name" maxLength={160} name="displayName" required />
          </Field>
          {data.requirePhone && (
            <Field htmlFor="public-rsvp-phone">
              <FieldLabel required>Nomor telepon</FieldLabel>
              <Input aria-label="Nomor telepon" autoComplete="tel" id="public-rsvp-phone" maxLength={40} name="phone" required type="tel" />
            </Field>
          )}
          <Field htmlFor="public-rsvp-party-size">
            <FieldLabel required>Jumlah hadir</FieldLabel>
            <Input
              aria-label="Jumlah hadir"
              defaultValue={1}
              id="public-rsvp-party-size"
              max={data.maxPartySize}
              min={1}
              name="partySize"
              required
              type="number"
            />
            <span className="ui-field-hint">Maksimal {data.maxPartySize} orang.</span>
          </Field>
          <div aria-labelledby="public-rsvp-events-label" className="public-rsvp-events" role="group">
            <strong id="public-rsvp-events-label">Acara</strong>
            <ul>
              {data.events.map((event) => <li key={event.id}>{event.name}</li>)}
            </ul>
          </div>
          <Button disabled={pending} fullWidth type="submit">
            {pending ? "Menyimpan…" : "Kirim RSVP"}
          </Button>
        </form>
      </Dialog>
      <Dialog
        className="personalized-rsvp-dialog public-rsvp-dialog public-rsvp-confirmation-dialog"
        onClose={() => { setOpen(false); setState(initialSubmitPublicRsvpActionState); }}
        open={open && Boolean(state.result)}
        title="RSVP berhasil dibuat"
      >
        {state.result && (
          <div className="public-rsvp-confirmation">
            <p>Terima kasih. Jawaban Anda sudah tersimpan.</p>
            <p className="public-rsvp-event-summary"><strong>Acara:</strong> {state.result.events.map((event) => event.name).join(", ")}</p>
            {state.result.approvalPending && (
              <p role="status">Menunggu persetujuan untuk QR check-in.</p>
            )}
            {state.result.duplicateWarning && (
              <Alert tone="warning" title="Perlu diperiksa">Data ini mungkin sudah pernah didaftarkan. Pasangan dapat memeriksanya tanpa menggabungkan data secara otomatis.</Alert>
            )}
            <TextLink href={state.result.personalizedPath}>Buka undangan personal</TextLink>
          </div>
        )}
      </Dialog>
    </section>
  );
}
