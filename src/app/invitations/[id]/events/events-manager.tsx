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
  Field,
  FieldHint,
  FieldLabel,
  Input,
  Select,
  TextLink,
  Textarea,
} from "@/components/ui";
import type { CommercialState, EventVisibility } from "@/generated/prisma/client";
import type { EventEditorItem, InvitationEventEditorData } from "@/modules/events";

import {
  removeEventAction,
  saveEventAction,
  setPrimaryEventAction,
  type EventActionState,
} from "./actions";

const initialEventActionState: EventActionState = { ok: false };

const EVENT_VISIBILITY = {
  GENERIC: "GENERIC",
  PERSONALIZED_ONLY: "PERSONALIZED_ONLY",
} as const satisfies Record<EventVisibility, EventVisibility>;

function lifecycleLabel(state: CommercialState): string {
  return state === "TRIAL" ? "Trial" : state === "PAID_ACTIVE" ? "Aktif" : state === "GRACE" ? "Grace" : "Tidak aktif";
}

function formatEventDate(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: timezone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
  }
}

function EventActionMessage({ state }: { readonly state: EventActionState }) {
  if (state.ok || !state.message) return null;
  return <Alert tone="danger" title="Perubahan belum tersimpan">{state.message}</Alert>;
}

function PrimaryEventAction({ invitationId, event }: { readonly invitationId: string; readonly event: EventEditorItem }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setPrimaryEventAction, initialEventActionState);
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  return (
    <form action={action} className="events-primary-form">
      <input name="invitationId" type="hidden" value={invitationId} />
      <input name="eventId" type="hidden" value={event.id} />
      {event.isPrimary ? <Badge tone="success">Acara utama</Badge> : <Button disabled={pending} size="sm" type="submit" variant="secondary">Jadikan utama</Button>}
      <EventActionMessage state={state} />
    </form>
  );
}

function EventForm({ invitationId, invitationTimezone, event, canEdit }: { readonly invitationId: string; readonly invitationTimezone: string; readonly event: EventEditorItem | null; readonly canEdit: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveEventAction, initialEventActionState);
  const [expanded, setExpanded] = useState(event === null);
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  const isNew = event === null;
  const [isPrimary, setIsPrimary] = useState(event?.isPrimary ?? false);

  return (
    <Card className="events-card">
      <CardHeader>
        <div className="events-card-heading">
          <div>
            <p className="ui-overline">{isNew ? "Acara baru" : event.isPrimary ? "Acara utama" : "Acara"}</p>
            <h2>{isNew ? "Tambah acara" : event.name}</h2>
            {!isNew && <CardDescription>{formatEventDate(event.startsAt, event.timezone)} · {event.timezone}</CardDescription>}
          </div>
          {!isNew && <PrimaryEventAction event={event} invitationId={invitationId} />}
        </div>
        {!isNew && <Button aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} size="sm" variant="ghost">{expanded ? "Tutup" : "Edit acara"}</Button>}
      </CardHeader>
      {expanded && (
        <form action={action} className="events-form">
          <input name="invitationId" type="hidden" value={invitationId} />
          {!isNew && <input name="eventId" type="hidden" value={event.id} />}
          <div className="events-form-grid">
            <Field htmlFor={`${event?.id ?? "new"}-name`}>
              <FieldLabel required>Nama acara</FieldLabel>
              <Input defaultValue={event?.name ?? ""} disabled={!canEdit || pending} id={`${event?.id ?? "new"}-name`} maxLength={160} name="name" placeholder="Contoh: Resepsi" required />
            </Field>
            <Field htmlFor={`${event?.id ?? "new"}-timezone`}>
              <FieldLabel>Timezone</FieldLabel>
              <Input defaultValue={event?.timezone ?? ""} disabled={!canEdit || pending} id={`${event?.id ?? "new"}-timezone`} name="timezone" placeholder={invitationTimezone} />
              <FieldHint>Kosongkan untuk memakai {invitationTimezone}.</FieldHint>
            </Field>
            <Field htmlFor={`${event?.id ?? "new"}-start-date`}>
              <FieldLabel required>Tanggal mulai</FieldLabel>
              <Input defaultValue={event?.startDate} disabled={!canEdit || pending} id={`${event?.id ?? "new"}-start-date`} name="startDate" required type="date" />
            </Field>
            <Field htmlFor={`${event?.id ?? "new"}-start-time`}>
              <FieldLabel required>Waktu mulai</FieldLabel>
              <Input defaultValue={event?.startTime} disabled={!canEdit || pending} id={`${event?.id ?? "new"}-start-time`} name="startTime" required type="time" />
            </Field>
            <Field htmlFor={`${event?.id ?? "new"}-end-date`}>
              <FieldLabel>Tanggal selesai</FieldLabel>
              <Input defaultValue={event?.endDate} disabled={!canEdit || pending} id={`${event?.id ?? "new"}-end-date`} name="endDate" type="date" />
            </Field>
            <Field htmlFor={`${event?.id ?? "new"}-end-time`}>
              <FieldLabel>Waktu selesai</FieldLabel>
              <Input defaultValue={event?.endTime} disabled={!canEdit || pending} id={`${event?.id ?? "new"}-end-time`} name="endTime" type="time" />
            </Field>
          </div>
          <Field>
            <FieldLabel>Visibilitas acara</FieldLabel>
            <Select defaultValue={event?.visibility ?? EVENT_VISIBILITY.GENERIC} disabled={!canEdit || pending} name="visibility">
              <option value={EVENT_VISIBILITY.GENERIC}>Tampilkan di undangan umum</option>
              <option value={EVENT_VISIBILITY.PERSONALIZED_ONLY}>Khusus tamu personal</option>
            </Select>
            <FieldHint>Acara khusus tamu belum ditampilkan pada halaman umum sampai alur assignment tamu tersedia.</FieldHint>
          </Field>
          <div className="events-form-grid">
            <Field><FieldLabel>Nama venue</FieldLabel><Input defaultValue={event?.venue ?? ""} disabled={!canEdit || pending} name="venue" placeholder="Contoh: Grand Ballroom" /></Field>
            <Field><FieldLabel>Link Maps / arah</FieldLabel><Input defaultValue={event?.mapsUrl ?? ""} disabled={!canEdit || pending} inputMode="url" name="mapsUrl" placeholder="https://maps.google.com/" type="url" /></Field>
          </div>
          <Field><FieldLabel>Alamat</FieldLabel><Textarea defaultValue={event?.address ?? ""} disabled={!canEdit || pending} name="address" placeholder="Alamat lengkap venue" /></Field>
          <Field><FieldLabel>Catatan lokasi</FieldLabel><Input defaultValue={event?.locationNote ?? ""} disabled={!canEdit || pending} name="locationNote" placeholder="Parkir tersedia di basement" /></Field>
          <div className="events-form-grid">
            <Field><FieldLabel>Link livestream</FieldLabel><Input defaultValue={event?.livestreamUrl ?? ""} disabled={!canEdit || pending} inputMode="url" name="livestreamUrl" placeholder="https://youtube.com/live/..." type="url" /></Field>
            <Field><FieldLabel>Dress code</FieldLabel><Input defaultValue={event?.dressCode ?? ""} disabled={!canEdit || pending} name="dressCode" placeholder="Formal / bebas rapi" /></Field>
          </div>
          <fieldset className="events-contact-fieldset">
            <legend>Kontak acara <span>(opsional)</span></legend>
            <div className="events-form-grid">
              <Field><FieldLabel>Nama kontak</FieldLabel><Input defaultValue={event?.contact?.name ?? ""} disabled={!canEdit || pending} name="contactName" placeholder="Contoh: Rina" /></Field>
              <Field><FieldLabel>Peran</FieldLabel><Input defaultValue={event?.contact?.role ?? ""} disabled={!canEdit || pending} name="contactRole" placeholder="Wedding organizer" /></Field>
              <Field><FieldLabel>Nomor kontak</FieldLabel><Input defaultValue={event?.contact?.phone ?? ""} disabled={!canEdit || pending} name="contactPhone" placeholder="08…" type="tel" /></Field>
            </div>
          </fieldset>
          {isNew && <label className="events-primary-checkbox"><input checked={isPrimary} disabled={!canEdit || pending} name="isPrimary" onChange={(event) => setIsPrimary(event.target.checked)} type="checkbox" /> Jadikan acara utama</label>}
          <EventActionMessage state={state} />
          {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && <ul className="events-field-errors">{Object.entries(state.fieldErrors).map(([field, message]) => <li key={field}>{message}</li>)}</ul>}
          <CardFooter className="events-form-actions">
            <Button disabled={!canEdit || pending} type="submit">{pending ? "Menyimpan…" : isNew ? "Tambah acara" : "Simpan perubahan"}</Button>
            {!isNew && <RemoveEventAction canEdit={canEdit} event={event} invitationId={invitationId} />}
          </CardFooter>
        </form>
      )}
    </Card>
  );
}

function RemoveEventAction({ invitationId, event, canEdit }: { readonly invitationId: string; readonly event: EventEditorItem; readonly canEdit: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(removeEventAction, initialEventActionState);
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  return (
    <form action={action} onSubmit={(submitEvent) => { if (!window.confirm(`Hapus acara “${event.name}”?`)) submitEvent.preventDefault(); }}>
      <input name="invitationId" type="hidden" value={invitationId} />
      <input name="eventId" type="hidden" value={event.id} />
      <Button disabled={!canEdit || pending} type="submit" variant="danger">{pending ? "Menghapus…" : "Hapus acara"}</Button>
      <EventActionMessage state={state} />
    </form>
  );
}

export function EventsManager({ data }: { readonly data: InvitationEventEditorData }) {
  const activeEvents = data.events;
  return (
    <main className="events-page">
      <header className="events-header">
        <div>
          <TextLink aria-label="Kembali ke editor" href={`/invitations/${data.invitationId}/edit`}>← Editor</TextLink>
          <p className="ui-overline">Quick Setup / Events</p>
          <h1>Rangkaian acara</h1>
          <p className="events-lede">Atur sampai {5} acara untuk undangan Anda. Waktu disimpan dengan timezone masing-masing acara.</p>
        </div>
        <div className="events-header-badges"><Badge tone={data.canEdit ? "info" : "warning"}>{lifecycleLabel(data.commercialState)}</Badge><Badge tone={activeEvents.length >= 5 ? "warning" : "neutral"}>{activeEvents.length}/5 acara</Badge></div>
      </header>
      {!data.canEdit && <Alert className="events-lock" tone="warning" title="Pengaturan acara hanya-baca">Masa aktif undangan ini tidak mengizinkan perubahan. Data acara tetap tersedia.</Alert>}
      <section aria-label="Daftar acara" className="events-list">
        {activeEvents.map((event) => <EventForm canEdit={data.canEdit} event={event} invitationId={data.invitationId} invitationTimezone={data.invitationTimezone} key={event.id} />)}
        {activeEvents.length < 5 && <EventForm canEdit={data.canEdit} event={null} invitationId={data.invitationId} invitationTimezone={data.invitationTimezone} />}
      </section>
    </main>
  );
}
