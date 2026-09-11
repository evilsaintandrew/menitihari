"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  EmptyState,
  Field,
  FieldHint,
  FieldLabel,
  Input,
  Select,
  TextLink,
  Textarea,
} from "@/components/ui";
import type { GuestManagementData, GuestManagementItem } from "@/modules/guests";

import { archiveGuestAction, saveGuestAction, type GuestActionState } from "./actions";

const initialActionState: GuestActionState = { ok: false };
const DEFAULT_MAX_PARTY_SIZE = "1";

function lifecycleLabel(state: GuestManagementData["commercialState"]): string {
  return state === "TRIAL" ? "Trial" : state === "PAID_ACTIVE" ? "Aktif" : state === "GRACE" ? "Grace" : "Tidak aktif";
}

function GuestActionMessage({ state }: { readonly state: GuestActionState }) {
  if (state.ok || !state.message) return null;
  return <Alert role="alert" tone="danger" title="Perubahan belum tersimpan">{state.message}</Alert>;
}

function GuestForm({
  invitationId,
  groups,
  events,
  guest,
  canEdit,
  onSaved,
}: {
  readonly invitationId: string;
  readonly groups: GuestManagementData["groups"];
  readonly events: GuestManagementData["events"];
  readonly guest: GuestManagementItem | null;
  readonly canEdit: boolean;
  readonly onSaved?: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveGuestAction, initialActionState);
  const [groupId, setGroupId] = useState(guest?.group?.id ?? "");
  const [selectedEvents, setSelectedEvents] = useState<Record<string, boolean>>(() => Object.fromEntries((guest?.assignedEvents ?? []).map((event) => [event.id, true])));
  const [maxPartySizes, setMaxPartySizes] = useState<Record<string, string>>(() => Object.fromEntries((guest?.assignedEvents ?? []).map((event) => [event.id, String(event.maxPartySize)])));
  useEffect(() => {
    if (state.ok) {
      onSaved?.();
      router.refresh();
    }
  }, [onSaved, router, state.ok]);

  return (
    <form action={action} className="guests-form">
      <input name="invitationId" type="hidden" value={invitationId} />
      {guest && <input name="guestId" type="hidden" value={guest.id} />}
      <div className="guests-form-grid">
        <Field htmlFor={`${guest?.id ?? "new"}-display-name`}>
          <FieldLabel required>Nama tamu / penerima</FieldLabel>
          <Input defaultValue={guest?.displayName ?? ""} disabled={!canEdit || pending} id={`${guest?.id ?? "new"}-display-name`} maxLength={160} name="displayName" placeholder="Contoh: Keluarga Santoso" required />
        </Field>
        <Field htmlFor={`${guest?.id ?? "new"}-phone`}>
          <FieldLabel>Nomor WhatsApp <span>(opsional)</span></FieldLabel>
          <Input defaultValue={guest?.displayPhone ?? ""} disabled={!canEdit || pending} id={`${guest?.id ?? "new"}-phone`} inputMode="tel" maxLength={40} name="phone" placeholder="08xx atau +62…" type="tel" />
          <FieldHint>Nomor akan disimpan dalam format internasional untuk distribusi.</FieldHint>
        </Field>
      </div>
      <div className="guests-form-grid">
        <Field htmlFor={`${guest?.id ?? "new"}-group-id`}>
          <FieldLabel>Grup <span>(opsional)</span></FieldLabel>
          <Select disabled={!canEdit || pending} id={`${guest?.id ?? "new"}-group-id`} name="groupId" onChange={(event) => setGroupId(event.target.value)} value={groupId}>
            <option value="">Tanpa grup</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </Select>
        </Field>
        <Field htmlFor={`${guest?.id ?? "new"}-group-name`}>
          <FieldLabel>Atau buat grup baru <span>(opsional)</span></FieldLabel>
          <Input disabled={!canEdit || pending || Boolean(groupId)} id={`${guest?.id ?? "new"}-group-name`} name="groupName" placeholder="Contoh: Keluarga" />
          <FieldHint>Pilih grup yang ada atau isi nama grup baru, bukan keduanya.</FieldHint>
        </Field>
      </div>
      <Field htmlFor={`${guest?.id ?? "new"}-notes`}>
        <FieldLabel>Catatan <span>(opsional)</span></FieldLabel>
        <Textarea defaultValue={guest?.notes ?? ""} disabled={!canEdit || pending} id={`${guest?.id ?? "new"}-notes`} maxLength={1_000} name="notes" placeholder="Catatan internal untuk pemilik undangan" />
      </Field>
      <fieldset className="guests-event-fieldset">
        <legend>Acara yang diundang <span>(pilih minimal satu)</span></legend>
        {events.length === 0 ? (
          <p className="ui-muted">Tambahkan acara terlebih dahulu sebelum mengundang tamu.</p>
        ) : (
          <div className="guests-event-list">
            {events.map((event) => {
              const selected = selectedEvents[event.id] ?? false;
              return (
                <div className="guests-event-row" key={event.id}>
                  <label className="guests-event-checkbox">
                    <input
                      checked={selected}
                      disabled={!canEdit || pending}
                      name="eventIds"
                      onChange={(changeEvent) => setSelectedEvents((current) => ({ ...current, [event.id]: changeEvent.target.checked }))}
                      type="checkbox"
                      value={event.id}
                    />
                    <span>{event.name}</span>
                  </label>
                  {selected && (
                    <label className="guests-event-capacity">
                      <span>Maks. orang</span>
                      <Input
                        aria-label={`Maksimal orang untuk ${event.name}`}
                        disabled={!canEdit || pending}
                        inputMode="numeric"
                        min={1}
                        name={`maxPartySize:${event.id}`}
                        onChange={(changeEvent) => setMaxPartySizes((current) => ({ ...current, [event.id]: changeEvent.target.value }))}
                        type="number"
                        value={maxPartySizes[event.id] ?? DEFAULT_MAX_PARTY_SIZE}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </fieldset>
      <GuestActionMessage state={state} />
      {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && <ul className="guests-field-errors">{Object.entries(state.fieldErrors).map(([field, message]) => <li key={field}>{field}: {message}</li>)}</ul>}
      <CardFooter className="guests-form-actions">
        <Button disabled={!canEdit || pending} type="submit">{pending ? "Menyimpan…" : guest ? "Simpan perubahan" : "Simpan tamu"}</Button>
        {!canEdit && <span className="ui-muted">Masa aktif ini hanya-baca.</span>}
      </CardFooter>
    </form>
  );
}

function ArchiveGuestAction({ invitationId, guest, canEdit }: { readonly invitationId: string; readonly guest: GuestManagementItem; readonly canEdit: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(archiveGuestAction, initialActionState);
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  return (
    <form action={action} onSubmit={(event) => { if (!window.confirm(`Hapus “${guest.displayName}”? Tamu dengan riwayat akan diarsipkan agar datanya tetap aman.`)) event.preventDefault(); }}>
      <input name="invitationId" type="hidden" value={invitationId} />
      <input name="guestId" type="hidden" value={guest.id} />
      <Button disabled={!canEdit || pending} size="sm" type="submit" variant="danger">{pending ? "Memproses…" : "Hapus"}</Button>
      <GuestActionMessage state={state} />
    </form>
  );
}

function GuestCard({ invitationId, groups, events, guest, canEdit }: { readonly invitationId: string; readonly groups: GuestManagementData["groups"]; readonly events: GuestManagementData["events"]; readonly guest: GuestManagementItem; readonly canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const rsvpSummary = guest.assignedEvents.length === 0
    ? "Belum ada acara"
    : guest.assignedEvents.map((event) => `${event.name} (${event.maxPartySize} orang): ${event.rsvpStatus === "ATTENDING" ? `Hadir${event.attendanceCount ? ` ${event.attendanceCount}` : ""}` : event.rsvpStatus === "NOT_ATTENDING" ? "Tidak hadir" : "Belum"}`).join(" · ");

  return (
    <Card className="guests-card">
      <CardHeader>
        <div className="guests-card-heading">
          <div>
            <p className="ui-overline">{guest.group?.name ?? "Tanpa grup"}</p>
            <h2>{guest.displayName}</h2>
            <CardDescription>{guest.displayPhone ?? "Nomor WhatsApp belum diisi"}</CardDescription>
          </div>
          <Badge tone={guest.assignedEvents.length > 0 ? "info" : "neutral"}>{guest.assignedEvents.length} acara</Badge>
        </div>
      </CardHeader>
      <CardContent className="guests-card-content">
        <dl className="guests-card-meta">
          <div><dt>Acara</dt><dd>{guest.assignedEvents.length > 0 ? guest.assignedEvents.map((event) => event.name).join(" + ") : "Belum ditetapkan"}</dd></div>
          <div><dt>RSVP</dt><dd>{rsvpSummary}</dd></div>
        </dl>
        {guest.notes && <p className="guests-card-notes">Catatan: {guest.notes}</p>}
      </CardContent>
      {editing && <GuestForm canEdit={canEdit} events={events} groups={groups} guest={guest} invitationId={invitationId} onSaved={() => setEditing(false)} />}
      {!editing && <CardFooter className="guests-card-actions">
        <Button disabled={!canEdit} onClick={() => setEditing(true)} size="sm" variant="secondary">Edit</Button>
        <ArchiveGuestAction canEdit={canEdit} guest={guest} invitationId={invitationId} />
      </CardFooter>}
    </Card>
  );
}

export function GuestsManager({ data }: { readonly data: GuestManagementData }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(data.guests.length === 0);
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const guests = data.guests.filter((guest) => {
    if (!normalizedQuery) return true;
    return [guest.displayName, guest.displayPhone ?? "", guest.group?.name ?? ""].some((value) => value.toLocaleLowerCase("id-ID").includes(normalizedQuery));
  });

  return (
    <main className="guests-page">
      <header className="guests-header">
        <div>
          <TextLink aria-label="Kembali ke editor" href={`/invitations/${data.invitationId}/edit`}>← Editor</TextLink>
          <p className="ui-overline">Guests / Tamu</p>
          <h1>Tamu undangan</h1>
          <p className="guests-lede">Kelola nama penerima, grup keluarga, dan informasi kontak untuk distribusi undangan personal.</p>
        </div>
        <div className="guests-header-badges"><Badge tone={data.canEdit ? "info" : "warning"}>{lifecycleLabel(data.commercialState)}</Badge><Badge tone="neutral">{data.guests.length} tamu aktif</Badge></div>
      </header>
      {!data.canEdit && <Alert className="guests-lock" tone="warning" title="Daftar tamu hanya-baca">Masa aktif undangan ini tidak mengizinkan perubahan. Data tamu tetap tersedia.</Alert>}
      <section aria-label="Kontrol tamu" className="guests-toolbar">
        <Input aria-label="Cari tamu" onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, nomor, atau grup…" type="search" value={query} />
        <Button disabled={!data.canEdit} onClick={() => setAdding((value) => !value)}>{adding ? "Tutup form" : "Tambah tamu"}</Button>
      </section>
      {adding && <Card className="guests-add-card"><CardHeader><p className="ui-overline">WF-11</p><h2>Tambah tamu</h2><CardDescription>Simpan satu penerima atau party dengan penugasan acara dan kapasitas yang jelas.</CardDescription></CardHeader><GuestForm canEdit={data.canEdit} events={data.events} groups={data.groups} guest={null} invitationId={data.invitationId} onSaved={() => setAdding(false)} /></Card>}
      {data.guests.length === 0 ? (
        <Card><EmptyState action={<Button onClick={() => setAdding(true)}>Tambah tamu</Button>} description="Tambahkan nama penerima untuk mulai menyiapkan daftar tamu undangan." title="Belum ada tamu" /></Card>
      ) : guests.length === 0 ? (
        <Card><EmptyState description="Coba kata kunci lain atau hapus pencarian." title="Tamu tidak ditemukan" /></Card>
      ) : (
        <section aria-label="Daftar tamu" className="guests-list">{guests.map((guest) => <GuestCard canEdit={data.canEdit} events={data.events} groups={data.groups} guest={guest} invitationId={data.invitationId} key={guest.id} />)}</section>
      )}
    </main>
  );
}
