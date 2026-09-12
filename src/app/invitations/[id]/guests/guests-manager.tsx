"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormEvent } from "react";
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
  Progress,
  Select,
  TextLink,
  Textarea,
} from "@/components/ui";
import type { GuestManagementData, GuestManagementItem, GuestRsvpFilter } from "@/modules/guests";

import {
  archiveGuestAction,
  bulkUpdateGuestsAction,
  getGuestMergePreviewAction,
  mergeGuestAction,
  overrideRsvpAction,
  saveGuestAction,
  setRsvpControlAction,
  type GuestActionState,
  type GuestMergePreviewActionState,
  type RsvpActionState,
} from "./actions";

const initialActionState: GuestActionState = { ok: false };
const initialMergePreviewState: GuestMergePreviewActionState = { ok: false };
const initialRsvpActionState: RsvpActionState = { ok: false };
const DEFAULT_MAX_PARTY_SIZE = "1";

function lifecycleLabel(state: GuestManagementData["commercialState"]): string {
  return state === "TRIAL" ? "Trial" : state === "PAID_ACTIVE" ? "Aktif" : state === "GRACE" ? "Grace" : "Tidak aktif";
}

function distributionLabel(status: GuestManagementItem["distributionStatus"]): string {
  return status === "MARKED_SENT" ? "Ditandai Terkirim" : status === "WHATSAPP_OPENED" ? "WhatsApp Dibuka" : "Belum Dikirim";
}

function hasHistoricalAssignment(guest: GuestManagementItem, eventId: string): boolean {
  return guest.assignedEvents.some((event) => event.id === eventId && (event.rsvpStatus !== null || event.attendanceCount !== null));
}

function filterGuestsByRsvp(guests: readonly GuestManagementItem[], filter: GuestRsvpFilter): readonly GuestManagementItem[] {
  if (filter === "ALL") return guests;
  return guests.filter((guest) => guest.assignedEvents.some((event) => event.rsvpStatus === null || event.rsvpStatus === "PENDING"));
}

function GuestActionMessage({ state }: { readonly state: GuestActionState }) {
  if (state.ok || !state.message) return null;
  return <Alert role="alert" tone="danger" title="Perubahan belum tersimpan">{state.message}</Alert>;
}

function RsvpActionMessage({ state }: { readonly state: RsvpActionState }) {
  if (!state.message) return null;
  return <Alert role={state.ok ? "status" : "alert"} tone={state.ok ? "success" : "danger"} title={state.ok ? "RSVP diperbarui" : "Perubahan RSVP belum tersimpan"}>{state.message}</Alert>;
}

function DuplicateWarning({ warnings }: { readonly warnings: GuestActionState["duplicateWarnings"] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <Alert role="status" tone="warning" title="Kemungkinan duplikat terdeteksi">
      <p>Tamu tetap disimpan sebagai entri terpisah. Tinjau dan gabungkan secara manual setelah memastikan riwayatnya benar.</p>
      <ul>
        {warnings.map((warning) => (
          <li key={warning.guestId}>
            {warning.displayName}{warning.displayPhone ? ` (${warning.displayPhone})` : ""} — sinyal cocok: {warning.matchingSignals.join(" dan ")}
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function GuestMergePanel({
  invitationId,
  sourceGuestId,
  target,
  canEdit,
}: {
  readonly invitationId: string;
  readonly sourceGuestId: string;
  readonly target: NonNullable<GuestManagementItem["duplicateWarnings"]>[number];
  readonly canEdit: boolean;
}) {
  const router = useRouter();
  const [previewState, previewAction, previewPending] = useActionState(getGuestMergePreviewAction, initialMergePreviewState);
  const [mergeState, mergeAction, mergePending] = useActionState(mergeGuestAction, initialActionState);
  const [choices, setChoices] = useState<Record<string, "SOURCE" | "TARGET">>({});
  const preview = previewState.preview;

  useEffect(() => {
    if (mergeState.ok) router.refresh();
  }, [mergeState.ok, router]);

  if (!preview) {
    return (
      <div className="guests-duplicate-panel">
        <p className="ui-muted">Kemungkinan duplikat: <strong>{target.displayName}</strong>. Sinyal cocok: {target.matchingSignals.join(" dan ")}.</p>
        <form action={previewAction}>
          <input name="invitationId" type="hidden" value={invitationId} />
          <input name="sourceGuestId" type="hidden" value={sourceGuestId} />
          <input name="targetGuestId" type="hidden" value={target.guestId} />
          <Button disabled={!canEdit || previewPending} size="sm" type="submit" variant="secondary">{previewPending ? "Memuat riwayat…" : "Tinjau merge"}</Button>
        </form>
        {previewState.message && <Alert role="alert" tone="danger" title="Tinjauan belum tersedia">{previewState.message}</Alert>}
      </div>
    );
  }

  const conflictResolutions = preview.conflicts.map((conflict) => ({ eventId: conflict.eventId, keep: choices[conflict.eventId] ?? "TARGET" }));
  return (
    <div className="guests-duplicate-panel">
      <p><strong>Peninjauan merge:</strong> {preview.source.displayName} → {preview.target.displayName}</p>
      {preview.conflicts.length === 0 ? (
        <p className="ui-muted">Tidak ada riwayat RSVP/check-in yang bertabrakan. Penugasan acara yang tidak konflik akan dipindahkan.</p>
      ) : (
        <div className="guests-merge-conflicts">
          <p>Pilih riwayat yang dianggap utama untuk setiap acara yang bertabrakan. Riwayat lain tetap disimpan.</p>
          {preview.conflicts.map((conflict) => (
            <fieldset key={conflict.eventId}>
              <legend>{conflict.eventName}</legend>
              <label><input checked={(choices[conflict.eventId] ?? "TARGET") === "TARGET"} disabled={mergePending} name={`keep:${conflict.eventId}`} onChange={() => setChoices((current) => ({ ...current, [conflict.eventId]: "TARGET" }))} type="radio" /> Riwayat tamu utama</label>
              <label><input checked={choices[conflict.eventId] === "SOURCE"} disabled={mergePending} name={`keep:${conflict.eventId}`} onChange={() => setChoices((current) => ({ ...current, [conflict.eventId]: "SOURCE" }))} type="radio" /> Riwayat duplikat</label>
            </fieldset>
          ))}
        </div>
      )}
      <form action={mergeAction}>
        <input name="invitationId" type="hidden" value={invitationId} />
        <input name="sourceGuestId" type="hidden" value={sourceGuestId} />
        <input name="targetGuestId" type="hidden" value={target.guestId} />
        <input name="conflictResolutions" type="hidden" value={JSON.stringify(conflictResolutions)} />
        <Button disabled={!canEdit || mergePending} size="sm" type="submit">{mergePending ? "Menggabungkan…" : "Gabungkan setelah tinjauan"}</Button>
      </form>
      <GuestActionMessage state={mergeState} />
    </div>
  );
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
      <DuplicateWarning warnings={state.duplicateWarnings} />
      {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && <ul className="guests-field-errors">{Object.entries(state.fieldErrors).map(([field, message]) => <li key={field}>{field}: {message}</li>)}</ul>}
      <CardFooter className="guests-form-actions">
        <Button disabled={!canEdit || pending} type="submit">{pending ? "Menyimpan…" : guest ? "Simpan perubahan" : "Simpan tamu"}</Button>
        {!canEdit && <span className="ui-muted">Masa aktif ini hanya-baca.</span>}
      </CardFooter>
    </form>
  );
}

function BulkActionBar({
  data,
  selectedGuestIds,
  onComplete,
}: {
  readonly data: GuestManagementData;
  readonly selectedGuestIds: readonly string[];
  readonly onComplete: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(bulkUpdateGuestsAction, initialActionState);
  const [operation, setOperation] = useState<"GROUP" | "EVENT" | "DISTRIBUTION">("GROUP");
  const [eventAction, setEventAction] = useState<"ASSIGN" | "UNASSIGN">("ASSIGN");
  const [eventId, setEventId] = useState(data.events[0]?.id ?? "");
  const [maxPartySize, setMaxPartySize] = useState("1");
  const selectedGuests = data.guests.filter((guest) => selectedGuestIds.includes(guest.id));
  const historicalGuestCount = operation === "EVENT" && eventAction === "UNASSIGN"
    ? selectedGuests.filter((guest) => hasHistoricalAssignment(guest, eventId)).length
    : 0;

  useEffect(() => {
    if (!state.ok) return;
    onComplete();
    router.refresh();
  }, [onComplete, router, state.ok]);

  useEffect(() => {
    const confirmation = document.getElementById("bulk-confirm-historical-removal") as HTMLInputElement | null;
    if (state.requiresConfirmation && confirmation) confirmation.value = "true";
  }, [state.requiresConfirmation]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    if (operation !== "EVENT" || eventAction !== "UNASSIGN" || historicalGuestCount === 0) return;
    const confirmation = event.currentTarget.elements.namedItem("confirmHistoricalRemoval");
    if (!(confirmation instanceof HTMLInputElement) || confirmation.value === "true") return;
    if (!window.confirm(`${historicalGuestCount} tamu memiliki riwayat RSVP atau check-in pada acara ini. Penugasan akan dihapus, tetapi riwayat tetap disimpan. Lanjutkan?`)) {
      event.preventDefault();
      return;
    }
    confirmation.value = "true";
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }

  return (
    <Card className="guests-bulk-card">
      <CardHeader>
        <div className="guests-bulk-heading">
          <div>
            <p className="ui-overline">Aksi massal</p>
            <h2>{selectedGuestIds.length} tamu dipilih</h2>
          </div>
          <Button onClick={onComplete} size="sm" variant="ghost">Batalkan pilihan</Button>
        </div>
        <CardDescription>Pilih satu tindakan untuk semua tamu. Setiap perubahan tetap divalidasi oleh server.</CardDescription>
      </CardHeader>
      <form action={action} className="guests-bulk-form" onSubmit={submit}>
        <input name="invitationId" type="hidden" value={data.invitationId} />
        <input id="bulk-confirm-historical-removal" key={`${operation}-${eventId}-${eventAction}-${selectedGuestIds.join(",")}`} name="confirmHistoricalRemoval" type="hidden" defaultValue="false" />
        {selectedGuestIds.map((guestId) => <input key={guestId} name="guestIds" type="hidden" value={guestId} />)}
        <Field htmlFor="bulk-operation">
          <FieldLabel>Tindakan</FieldLabel>
          <Select disabled={!data.canEdit || pending} id="bulk-operation" name="operation" onChange={(change) => setOperation(change.target.value as typeof operation)} value={operation}>
            <option value="GROUP">Ubah grup</option>
            <option value="EVENT">Acara</option>
            <option value="DISTRIBUTION">Status distribusi</option>
          </Select>
        </Field>
        {operation === "GROUP" && (
          <Field htmlFor="bulk-group-id">
            <FieldLabel>Grup baru</FieldLabel>
            <Select disabled={!data.canEdit || pending} id="bulk-group-id" name="groupId" defaultValue="">
              <option value="">Tanpa grup</option>
              {data.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </Select>
          </Field>
        )}
        {operation === "EVENT" && (
          <div className="guests-bulk-event-fields">
            <Field htmlFor="bulk-event-action">
              <FieldLabel>Tindakan acara</FieldLabel>
              <Select disabled={!data.canEdit || pending} id="bulk-event-action" name="eventAction" onChange={(change) => setEventAction(change.target.value as typeof eventAction)} value={eventAction}>
                <option value="ASSIGN">Tetapkan acara</option>
                <option value="UNASSIGN">Hapus penugasan</option>
              </Select>
            </Field>
            <Field htmlFor="bulk-event-id">
              <FieldLabel>Acara</FieldLabel>
              <Select disabled={!data.canEdit || pending || data.events.length === 0} id="bulk-event-id" name="eventId" onChange={(change) => setEventId(change.target.value)} value={eventId}>
                {data.events.length === 0 ? <option value="">Belum ada acara</option> : data.events.map((eventOption) => <option key={eventOption.id} value={eventOption.id}>{eventOption.name}</option>)}
              </Select>
            </Field>
            {eventAction === "ASSIGN" && (
              <Field htmlFor="bulk-max-party-size">
                <FieldLabel>Maks. orang</FieldLabel>
                <Input disabled={!data.canEdit || pending} id="bulk-max-party-size" min={1} name="maxPartySize" onChange={(change) => setMaxPartySize(change.target.value)} type="number" value={maxPartySize} />
              </Field>
            )}
          </div>
        )}
        {operation === "DISTRIBUTION" && (
          <Field htmlFor="bulk-distribution-status">
            <FieldLabel>Status baru</FieldLabel>
            <Select disabled={!data.canEdit || pending} id="bulk-distribution-status" name="distributionStatus" defaultValue="MARKED_SENT">
              <option value="MARKED_SENT">Ditandai Terkirim</option>
              <option value="NOT_SENT">Belum Dikirim</option>
            </Select>
          </Field>
        )}
        {state.requiresConfirmation && <Alert role="alert" tone="warning" title="Konfirmasi diperlukan">{state.message}</Alert>}
        {!state.requiresConfirmation && <GuestActionMessage state={state} />}
        <Button disabled={!data.canEdit || pending || data.events.length === 0 && operation === "EVENT"} type="submit">{pending ? "Memproses…" : "Terapkan ke tamu terpilih"}</Button>
      </form>
    </Card>
  );
}

function RsvpControlCard({ invitationId, event, canEdit }: { readonly invitationId: string; readonly event: GuestManagementData["events"][number]; readonly canEdit: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setRsvpControlAction, initialRsvpActionState);
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  const status = !event.rsvpEnabled ? "Nonaktif" : event.rsvpWindowOpen ? "Terbuka" : "Tertutup";

  return (
    <Card className="guests-rsvp-control-card">
      <CardHeader>
        <div className="guests-rsvp-control-heading">
          <div>
            <p className="ui-overline">Kontrol RSVP</p>
            <h2>{event.name}</h2>
          </div>
          <Badge tone={event.rsvpWindowOpen ? "success" : "warning"}>{status}</Badge>
        </div>
        <CardDescription>
          {event.rsvpClosesAt
            ? `Ditutup ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone }).format(new Date(event.rsvpClosesAt))}.`
            : "Tanpa jadwal penutupan; RSVP otomatis berhenti setelah acara berakhir."}
        </CardDescription>
      </CardHeader>
      <div className="guests-rsvp-control-body">
        <form action={action} className="guests-rsvp-schedule-form">
          <input name="invitationId" type="hidden" value={invitationId} />
          <input name="eventId" type="hidden" value={event.id} />
          <input name="action" type="hidden" value="SCHEDULE" />
          <Field htmlFor={`rsvp-close-date-${event.id}`}>
            <FieldLabel>Tutup pada <span>(opsional)</span></FieldLabel>
            <div className="guests-rsvp-date-fields">
              <Input defaultValue={event.rsvpClosesAtDate} disabled={!canEdit || pending} id={`rsvp-close-date-${event.id}`} name="closesAtDate" type="date" />
              <Input aria-label={`Waktu penutupan RSVP ${event.name}`} defaultValue={event.rsvpClosesAtTime} disabled={!canEdit || pending} name="closesAtTime" type="time" />
            </div>
            <FieldHint>Waktu mengikuti zona {event.timezone}.</FieldHint>
          </Field>
          <Button disabled={!canEdit || pending || !event.eventActive} type="submit">{pending ? "Menyimpan…" : "Simpan jadwal"}</Button>
        </form>
        <div className="guests-rsvp-control-actions">
          <form action={action}>
            <input name="invitationId" type="hidden" value={invitationId} />
            <input name="eventId" type="hidden" value={event.id} />
            <input name="action" type="hidden" value={event.rsvpWindowOpen ? "CLOSE" : "REOPEN"} />
            <Button disabled={!canEdit || pending || !event.eventActive} type="submit" variant="secondary">{event.rsvpWindowOpen ? "Tutup sekarang" : "Buka kembali"}</Button>
          </form>
        </div>
        <RsvpActionMessage state={state} />
      </div>
    </Card>
  );
}

function GuestRsvpOverride({ invitationId, event, canEdit }: { readonly invitationId: string; readonly event: GuestManagementItem["assignedEvents"][number]; readonly canEdit: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(overrideRsvpAction, initialRsvpActionState);
  const [status, setStatus] = useState(event.rsvpStatus ?? "PENDING");
  const [attendanceCount, setAttendanceCount] = useState(String(event.attendanceCount ?? 1));
  const [reason, setReason] = useState("");
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  return (
    <div className="guests-rsvp-override">
      <div className="guests-rsvp-override-heading">
        <strong>{event.name}</strong>
        <span>Owner override · tercatat di audit</span>
      </div>
      <form action={action} className="guests-rsvp-override-form">
        <input name="invitationId" type="hidden" value={invitationId} />
        <input name="guestEventId" type="hidden" value={event.assignmentId} />
        <Field htmlFor={`override-status-${event.assignmentId}`}>
          <FieldLabel>Jawaban</FieldLabel>
          <Select disabled={!canEdit || pending} id={`override-status-${event.assignmentId}`} name="status" onChange={(change) => setStatus(change.target.value)} value={status}>
            <option value="PENDING">Belum RSVP</option>
            <option value="ATTENDING">Hadir</option>
            <option value="NOT_ATTENDING">Tidak hadir</option>
          </Select>
        </Field>
        {status === "ATTENDING" && (
          <Field htmlFor={`override-count-${event.assignmentId}`}>
            <FieldLabel>Jumlah hadir</FieldLabel>
            <Input disabled={!canEdit || pending} id={`override-count-${event.assignmentId}`} max={event.maxPartySize} min={1} name="attendanceCount" onChange={(change) => setAttendanceCount(change.target.value)} type="number" value={attendanceCount} />
          </Field>
        )}
        {status === "NOT_ATTENDING" && (
          <Field htmlFor={`override-reason-${event.assignmentId}`}>
            <FieldLabel>Alasan <span>(opsional)</span></FieldLabel>
            <Input disabled={!canEdit || pending} id={`override-reason-${event.assignmentId}`} maxLength={500} name="notAttendingReason" onChange={(change) => setReason(change.target.value)} value={reason} />
          </Field>
        )}
        <Button disabled={!canEdit || pending} size="sm" type="submit">{pending ? "Menyimpan…" : "Simpan override"}</Button>
      </form>
      <RsvpActionMessage state={state} />
    </div>
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

function GuestCard({ invitationId, groups, events, guest, canEdit, selected, onToggle }: { readonly invitationId: string; readonly groups: GuestManagementData["groups"]; readonly events: GuestManagementData["events"]; readonly guest: GuestManagementItem; readonly canEdit: boolean; readonly selected: boolean; readonly onToggle: (guestId: string) => void }) {
  const [editing, setEditing] = useState(false);
  const rsvpSummary = guest.assignedEvents.length === 0
    ? "Belum ada acara"
    : guest.assignedEvents.map((event) => `${event.name} (${event.maxPartySize} orang): ${event.rsvpStatus === "ATTENDING" ? `Hadir${event.attendanceCount ? ` ${event.attendanceCount}` : ""}` : event.rsvpStatus === "NOT_ATTENDING" ? "Tidak hadir" : "Belum"}`).join(" · ");

  return (
    <Card className="guests-card">
      <CardHeader>
        <div className="guests-card-heading">
          <div>
            <label className="guests-selection-control"><input aria-label={`Pilih ${guest.displayName}`} checked={selected} onChange={() => onToggle(guest.id)} type="checkbox" /><span>Pilih tamu</span></label>
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
          <div><dt>Distribusi</dt><dd>{distributionLabel(guest.distributionStatus)} · {guest.viewedAt ? "Dilihat" : "Belum Dilihat"}</dd></div>
        </dl>
        {guest.notes && <p className="guests-card-notes">Catatan: {guest.notes}</p>}
        {canEdit && guest.assignedEvents.length > 0 && (
          <div className="guests-rsvp-override-list" aria-label={`Override RSVP ${guest.displayName}`}>
            {guest.assignedEvents.map((event) => <GuestRsvpOverride canEdit={canEdit} event={event} invitationId={invitationId} key={event.assignmentId} />)}
          </div>
        )}
      </CardContent>
      {editing && <GuestForm canEdit={canEdit} events={events} groups={groups} guest={guest} invitationId={invitationId} onSaved={() => setEditing(false)} />}
      {!editing && canEdit && guest.duplicateWarnings?.map((warning) => <GuestMergePanel invitationId={invitationId} key={warning.guestId} sourceGuestId={guest.id} target={warning} canEdit={canEdit} />)}
      {!editing && <CardFooter className="guests-card-actions">
        <Button disabled={!canEdit} onClick={() => setEditing(true)} size="sm" variant="secondary">Edit</Button>
        <ArchiveGuestAction canEdit={canEdit} guest={guest} invitationId={invitationId} />
      </CardFooter>}
    </Card>
  );
}

export function GuestsManager({ data }: { readonly data: GuestManagementData }) {
  const [query, setQuery] = useState("");
  const [rsvpFilter, setRsvpFilter] = useState<GuestRsvpFilter>("ALL");
  const [adding, setAdding] = useState(data.guests.length === 0);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const guests = filterGuestsByRsvp(data.guests, rsvpFilter).filter((guest) => {
    if (!normalizedQuery) return true;
    return [guest.displayName, guest.displayPhone ?? "", guest.group?.name ?? ""].some((value) => value.toLocaleLowerCase("id-ID").includes(normalizedQuery));
  });
  const visibleGuestIds = guests.map((guest) => guest.id);
  const allVisibleSelected = visibleGuestIds.length > 0 && visibleGuestIds.every((guestId) => selectedIds.has(guestId));
  const toggleGuest = (guestId: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(guestId)) next.delete(guestId); else next.add(guestId);
    return next;
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
      <section aria-label="Kapasitas tamu" className="guests-capacity-card">
        <div className="guests-capacity-heading">
          <div>
            <p className="ui-overline">Kapasitas undangan</p>
            <h2>{data.invitedPeopleCapacity.used} / {data.invitedPeopleCapacity.limit} orang diundang</h2>
          </div>
          <Badge tone={data.invitedPeopleCapacity.remaining === 0 ? "danger" : data.invitedPeopleCapacity.isNearLimit ? "warning" : "success"}>
            {data.invitedPeopleCapacity.remaining === 0 ? "Penuh" : `Sisa ${data.invitedPeopleCapacity.remaining}`}
          </Badge>
        </div>
        <Progress label="Kapasitas tamu" value={(data.invitedPeopleCapacity.used / data.invitedPeopleCapacity.limit) * 100} />
        {data.invitedPeopleCapacity.isNearLimit && (
          <p className="guests-capacity-warning" role="status">
            {data.invitedPeopleCapacity.remaining === 0
              ? "Kapasitas 500 orang sudah penuh. Kurangi penugasan yang ada sebelum menambahkan tamu atau kapasitas baru."
              : `Kapasitas tamu hampir penuh. Sisa ${data.invitedPeopleCapacity.remaining} orang.`}
          </p>
        )}
      </section>
      {data.events.length > 0 && <section aria-label="Kontrol RSVP" className="guests-rsvp-controls">{data.events.map((event) => <RsvpControlCard canEdit={data.canEdit} event={event} invitationId={data.invitationId} key={event.id} />)}</section>}
      <section aria-label="Kontrol tamu" className="guests-toolbar">
        <Input aria-label="Cari tamu" onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, nomor, atau grup…" type="search" value={query} />
        <div className="guests-toolbar-actions"><Field htmlFor="guest-rsvp-filter"><FieldLabel>Filter RSVP</FieldLabel><Select id="guest-rsvp-filter" onChange={(event) => setRsvpFilter(event.target.value as GuestRsvpFilter)} value={rsvpFilter}><option value="ALL">Semua tamu</option><option value="PENDING">Belum RSVP</option></Select></Field><label className="guests-select-all"><input aria-label="Pilih semua tamu yang tampil" checked={allVisibleSelected} onChange={() => setSelectedIds((current) => allVisibleSelected ? new Set([...current].filter((guestId) => !visibleGuestIds.includes(guestId))) : new Set([...current, ...visibleGuestIds]))} type="checkbox" /><span>Pilih tampil</span></label><TextLink className="ui-button ui-button-secondary" href={`/invitations/${data.invitationId}/guests/import`}>Import</TextLink><Button disabled={!data.canEdit} onClick={() => setAdding((value) => !value)}>{adding ? "Tutup form" : "Tambah tamu"}</Button></div>
      </section>
      {selectedIds.size > 0 && <BulkActionBar data={data} onComplete={() => setSelectedIds(new Set())} selectedGuestIds={[...selectedIds]} />}
      {adding && <Card className="guests-add-card"><CardHeader><p className="ui-overline">WF-11</p><h2>Tambah tamu</h2><CardDescription>Simpan satu penerima atau party dengan penugasan acara dan kapasitas yang jelas.</CardDescription></CardHeader><GuestForm canEdit={data.canEdit} events={data.events} groups={data.groups} guest={null} invitationId={data.invitationId} onSaved={() => setAdding(false)} /></Card>}
      {data.guests.length === 0 ? (
        <Card><EmptyState action={<Button onClick={() => setAdding(true)}>Tambah tamu</Button>} description="Tambahkan nama penerima untuk mulai menyiapkan daftar tamu undangan." title="Belum ada tamu" /></Card>
      ) : guests.length === 0 ? (
        <Card><EmptyState description={rsvpFilter === "PENDING" ? "Semua tamu yang memiliki penugasan acara sudah memberikan jawaban." : "Coba kata kunci lain atau hapus pencarian."} title={rsvpFilter === "PENDING" ? "Tidak ada tamu yang belum RSVP" : "Tamu tidak ditemukan"} /></Card>
      ) : (
        <section aria-label="Daftar tamu" className="guests-list">{guests.map((guest) => <GuestCard canEdit={data.canEdit} events={data.events} groups={data.groups} guest={guest} invitationId={data.invitationId} key={guest.id} onToggle={toggleGuest} selected={selectedIds.has(guest.id)} />)}</section>
      )}
    </main>
  );
}
