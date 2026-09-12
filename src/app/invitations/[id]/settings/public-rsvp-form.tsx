"use client";

import { useActionState, useState } from "react";

import { Alert, Badge, Button, Checkbox, Field, FieldHint, FieldLabel, Input, Radio } from "@/components/ui";
import type { PublicRsvpOwnerSettings } from "@/modules/rsvp";

import {
  updatePublicRsvpSettingsAction,
} from "./actions";
import type { PublicRsvpSettingsActionState } from "./actions";

const initialPublicRsvpSettingsActionState: PublicRsvpSettingsActionState = { ok: false };

export function PublicRsvpForm({
  invitationId,
  settings,
}: {
  readonly invitationId: string;
  readonly settings: PublicRsvpOwnerSettings;
}) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [approvalMode, setApprovalMode] = useState(settings.requireApproval ? "approval" : "automatic");
  const [identityMode, setIdentityMode] = useState(settings.requirePhone ? "phone" : "name");
  const [maxPartySize, setMaxPartySize] = useState(String(settings.maxPartySize));
  const [eventIds, setEventIds] = useState(() => new Set(settings.events.filter((event) => event.publicRsvpEnabled).map((event) => event.id)));
  const [state, formAction, pending] = useActionState(
    updatePublicRsvpSettingsAction.bind(null, invitationId),
    initialPublicRsvpSettingsActionState,
  );

  return (
    <section className="invitation-sharing-section public-rsvp-settings" aria-labelledby="public-rsvp-settings-title">
      <div className="invitation-sharing-control-heading">
        <div>
          <p className="ui-overline">RSVP publik</p>
          <h2 id="public-rsvp-settings-title">Pendaftaran umum</h2>
          <p className="ui-card-description">Izinkan tamu mengisi RSVP dari undangan umum dan menerima link personal.</p>
        </div>
        <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "On" : "Off"}</Badge>
      </div>
      {state.formError && <Alert tone="danger" title="Perubahan belum tersimpan">{state.formError}</Alert>}
      {state.ok && state.message && <Alert tone="success" title="Tersimpan">{state.message}</Alert>}
      <form action={formAction} className="invitation-settings-form" noValidate>
        <Checkbox
          checked={enabled}
          label="Aktifkan RSVP publik"
          description="Tamu dapat mendaftar tanpa link personal sebelumnya."
          name="enabled"
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <div className="public-rsvp-identity-choice">
          <FieldLabel>Data yang diminta</FieldLabel>
          <Radio
            checked={identityMode === "name"}
            label="Nama saja"
            name="identityMode"
            onChange={() => setIdentityMode("name")}
            value="name"
          />
          <Radio
            checked={identityMode === "phone"}
            description="Nomor telepon disimpan privat dan tidak ditampilkan di undangan."
            label="Nama + nomor telepon"
            name="identityMode"
            onChange={() => setIdentityMode("phone")}
            value="phone"
          />
        </div>
        <div className="public-rsvp-identity-choice">
          <FieldLabel>Persetujuan QR / check-in</FieldLabel>
          <Radio
            checked={approvalMode === "automatic"}
            label="Otomatis setelah RSVP"
            name="approvalMode"
            onChange={() => setApprovalMode("automatic")}
            value="automatic"
          />
          <Radio
            checked={approvalMode === "approval"}
            description="Tamu menunggu persetujuan Anda sebelum QR dapat digunakan."
            label="Perlu persetujuan pasangan"
            name="approvalMode"
            onChange={() => setApprovalMode("approval")}
            value="approval"
          />
        </div>
        <Field htmlFor="public-rsvp-max-party-size">
          <FieldLabel required>Maksimal orang per pendaftaran</FieldLabel>
          <Input
            id="public-rsvp-max-party-size"
            max={500}
            min={1}
            name="maxPartySize"
            onChange={(event) => setMaxPartySize(event.target.value)}
            required
            type="number"
            value={maxPartySize}
          />
          <FieldHint>Maksimal 500 orang dan tetap mengikuti kapasitas undangan.</FieldHint>
        </Field>
        <div className="public-rsvp-event-options">
          <FieldLabel required>Acara yang menerima RSVP</FieldLabel>
          {settings.events.map((event) => {
            const checked = eventIds.has(event.id);
            return (
              <Checkbox
                checked={checked}
                description={!event.selectable ? "Acara harus umum dan RSVP-nya aktif." : undefined}
                disabled={!event.selectable}
                key={event.id}
                label={event.name}
                name="eventIds"
                onChange={(change) => setEventIds((current) => {
                  const next = new Set(current);
                  if (change.target.checked) next.add(event.id); else next.delete(event.id);
                  return next;
                })}
                value={event.id}
              />
            );
          })}
          {settings.events.length === 0 && <p className="ui-field-hint">Tambahkan acara terlebih dahulu.</p>}
        </div>
        <Button disabled={pending} type="submit" fullWidth>
          {pending ? "Menyimpan..." : "Simpan pengaturan RSVP"}
        </Button>
      </form>
    </section>
  );
}
