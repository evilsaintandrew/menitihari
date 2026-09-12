"use client";

import { useState, useTransition } from "react";

import {
  Alert,
  Button,
  Dialog,
  Field,
  FieldLabel,
  Input,
  Textarea,
} from "@/components/ui";
import type { PersonalizedRsvpData, PersonalizedRsvpEvent, QrEligibility, RsvpSummaryItem } from "@/modules/rsvp";

import {
  submitPersonalizedRsvpAction,
} from "@/app/[slug]/rsvp-actions";
import type { SubmitRsvpActionState } from "@/app/[slug]/rsvp-actions";

const initialSubmitRsvpActionState: SubmitRsvpActionState = { ok: false };

interface RsvpDraft {
  readonly status: RsvpStatusValue;
  readonly attendanceCount: number;
  readonly notAttendingReason: string;
}

const RSVP_STATUS = {
  ATTENDING: "ATTENDING",
  NOT_ATTENDING: "NOT_ATTENDING",
  PENDING: "PENDING",
} as const;

type RsvpStatusValue = (typeof RSVP_STATUS)[keyof typeof RSVP_STATUS];

function initialDrafts(data: PersonalizedRsvpData): Readonly<Record<string, RsvpDraft>> {
  return Object.fromEntries(data.events.map((event) => [event.id, {
    status: event.status === RSVP_STATUS.ATTENDING || event.status === RSVP_STATUS.NOT_ATTENDING
      ? event.status
      : RSVP_STATUS.ATTENDING,
    attendanceCount: event.attendanceCount ?? 1,
    notAttendingReason: event.notAttendingReason ?? "",
  }]));
}

function formatResponse(event: Pick<PersonalizedRsvpEvent, "status" | "attendanceCount">): string {
  if (event.status === RSVP_STATUS.ATTENDING) return `Hadir · ${event.attendanceCount ?? 1} orang`;
  if (event.status === RSVP_STATUS.NOT_ATTENDING) return "Tidak hadir";
  return "Belum RSVP";
}

function formatSummary(item: Pick<RsvpSummaryItem, "status" | "attendanceCount">): string {
  return formatResponse(item);
}

function qrEligibilityCopy(eligibility: QrEligibility | undefined): string | null {
  if (eligibility === "ELIGIBLE") return "QR check-in tersedia";
  if (eligibility === "PENDING_APPROVAL") return "Menunggu persetujuan untuk QR check-in";
  return null;
}

function formatEventDate(event: PersonalizedRsvpEvent): string {
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: event.timezone }).format(new Date(event.startsAt));
  } catch {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(event.startsAt));
  }
}

function updateDraft(
  drafts: Readonly<Record<string, RsvpDraft>>,
  event: PersonalizedRsvpEvent,
  update: Partial<RsvpDraft>,
): Readonly<Record<string, RsvpDraft>> {
  const current = drafts[event.id] ?? {
    status: RSVP_STATUS.ATTENDING,
    attendanceCount: 1,
    notAttendingReason: "",
  };
  return { ...drafts, [event.id]: { ...current, ...update } };
}

function ResponseSummary({ summary }: { readonly summary: readonly RsvpSummaryItem[] }) {
  return (
    <div className="personalized-rsvp-summary" aria-label="Ringkasan RSVP">
      {summary.map((item) => (
        <div className="personalized-rsvp-summary-row" key={item.eventId}>
          <strong>{item.eventName}</strong>
          <span>{formatSummary(item)}{qrEligibilityCopy(item.qrEligibility) ? ` · ${qrEligibilityCopy(item.qrEligibility)}` : ""}</span>
        </div>
      ))}
    </div>
  );
}

function RsvpEventFields({
  event,
  draft,
  disabled,
  onChange,
}: {
  readonly event: PersonalizedRsvpEvent;
  readonly draft: RsvpDraft;
  readonly disabled: boolean;
  readonly onChange: (update: Partial<RsvpDraft>) => void;
}) {
  return (
    <fieldset className="personalized-rsvp-event-fields" disabled={disabled}>
      <legend>
        <strong>{event.name}</strong>
        <span>{formatEventDate(event)}</span>
      </legend>
      <div className="personalized-rsvp-choices" role="radiogroup" aria-label={`Jawaban untuk ${event.name}`}>
        <label className="personalized-rsvp-choice">
          <input
            checked={draft.status === RSVP_STATUS.ATTENDING}
            name={`status-choice:${event.id}`}
            onChange={() => onChange({ status: RSVP_STATUS.ATTENDING })}
            type="radio"
          />
          <span>Hadir</span>
        </label>
        <label className="personalized-rsvp-choice">
          <input
            checked={draft.status === RSVP_STATUS.NOT_ATTENDING}
            name={`status-choice:${event.id}`}
            onChange={() => onChange({ status: RSVP_STATUS.NOT_ATTENDING })}
            type="radio"
          />
          <span>Tidak hadir</span>
        </label>
      </div>
      {draft.status === RSVP_STATUS.ATTENDING && (
        <Field htmlFor={`attendance-count:${event.id}`}>
          <FieldLabel>Jumlah hadir</FieldLabel>
          <div className="personalized-rsvp-count-control">
            <Button
              aria-label={`Kurangi jumlah hadir untuk ${event.name}`}
              disabled={draft.attendanceCount <= 1}
              onClick={() => onChange({ attendanceCount: Math.max(1, draft.attendanceCount - 1) })}
              size="sm"
              variant="secondary"
            >
              −
            </Button>
            <Input
              aria-label={`Jumlah hadir untuk ${event.name}`}
              id={`attendance-count:${event.id}`}
              max={event.maxPartySize}
              min={1}
              onChange={(change) => onChange({ attendanceCount: Number(change.target.value) || 1 })}
              type="number"
              value={draft.attendanceCount}
            />
            <Button
              aria-label={`Tambah jumlah hadir untuk ${event.name}`}
              disabled={draft.attendanceCount >= event.maxPartySize}
              onClick={() => onChange({ attendanceCount: Math.min(event.maxPartySize, draft.attendanceCount + 1) })}
              size="sm"
              variant="secondary"
            >
              +
            </Button>
            <span className="personalized-rsvp-count-max">Maks. {event.maxPartySize}</span>
          </div>
        </Field>
      )}
      {draft.status === RSVP_STATUS.NOT_ATTENDING && (
        <Field htmlFor={`not-attending-reason:${event.id}`}>
          <FieldLabel>Pesan/alasan <span>(opsional)</span></FieldLabel>
          <Textarea
            id={`not-attending-reason:${event.id}`}
            maxLength={500}
            name={`notAttendingReason:${event.id}`}
            onChange={(change) => onChange({ notAttendingReason: change.target.value })}
            placeholder="Tulis pesan untuk pasangan, bila perlu"
            value={draft.notAttendingReason}
          />
        </Field>
      )}
    </fieldset>
  );
}

function RsvpForm({
  data,
  drafts,
  pending,
  state,
  formAction,
  onChange,
}: {
  readonly data: PersonalizedRsvpData;
  readonly drafts: Readonly<Record<string, RsvpDraft>>;
  readonly pending: boolean;
  readonly state: SubmitRsvpActionState;
  readonly formAction: (payload: FormData) => void;
  readonly onChange: (event: PersonalizedRsvpEvent, update: Partial<RsvpDraft>) => void;
}) {
  const openEvents = data.events.filter((event) => event.canRespond);
  return (
    <form action={formAction} className="personalized-rsvp-form" noValidate>
      {state.message && !state.ok && <Alert tone="danger" title="RSVP belum tersimpan">{state.message}</Alert>}
      {data.events.map((event) => event.canRespond ? (
        <div key={event.id}>
          <input name="eventIds" type="hidden" value={event.id} />
          <input name={`status:${event.id}`} type="hidden" value={drafts[event.id]?.status ?? RSVP_STATUS.ATTENDING} />
          <input name={`attendanceCount:${event.id}`} type="hidden" value={drafts[event.id]?.status === RSVP_STATUS.ATTENDING ? drafts[event.id]?.attendanceCount ?? 1 : ""} />
          <RsvpEventFields
            disabled={pending}
            draft={drafts[event.id] ?? { status: RSVP_STATUS.ATTENDING, attendanceCount: 1, notAttendingReason: "" }}
            event={event}
            onChange={(update) => onChange(event, update)}
          />
          <input name={`notAttendingReason:${event.id}`} type="hidden" value={drafts[event.id]?.notAttendingReason ?? ""} />
        </div>
      ) : (
        <div className="personalized-rsvp-closed-event" key={event.id}>
          <div>
            <strong>{event.name}</strong>
            <span>{formatResponse(event)}</span>
          </div>
          <span>RSVP sudah ditutup</span>
        </div>
      ))}
      {openEvents.length > 0 && (
        <Button disabled={pending} fullWidth type="submit">
          {pending ? "Menyimpan…" : "Simpan RSVP"}
        </Button>
      )}
    </form>
  );
}

export function PersonalizedRsvp({
  invitationId,
  data,
}: {
  readonly invitationId: string;
  readonly data: PersonalizedRsvpData | null;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState(() => data ? initialDrafts(data) : {});
  const [state, setState] = useState<SubmitRsvpActionState>(initialSubmitRsvpActionState);
  const [pending, startTransition] = useTransition();

  if (!data || !data.enabled || data.events.length === 0) return null;

  const hasSavedResponse = data.events.some((event) => event.status !== RSVP_STATUS.PENDING);
  const hasOpenEvents = data.events.some((event) => event.canRespond);
  const showConfirmation = Boolean(state.ok && state.result && !editing);
  const formAction = (formData: FormData) => {
    setEditing(true);
    startTransition(async () => {
      const result = await submitPersonalizedRsvpAction(invitationId, state, formData);
      setState(result);
      setEditing(false);
    });
  };

  return (
    <section className="personalized-rsvp-card" aria-labelledby="personalized-rsvp-heading">
      <p className="invitation-renderer-kicker">RSVP</p>
      <h2 id="personalized-rsvp-heading">Konfirmasi kehadiran Anda</h2>
      {hasSavedResponse && <ResponseSummary summary={data.events.map((event) => ({ eventId: event.id, eventName: event.name, status: event.status, attendanceCount: event.attendanceCount }))} />}
      {hasOpenEvents ? (
        <Button onClick={() => { setEditing(true); setOpen(true); }}>
          {hasSavedResponse ? "Ubah RSVP" : "Konfirmasi Kehadiran"}
        </Button>
      ) : (
        <p className="personalized-rsvp-closed-copy">RSVP sudah ditutup</p>
      )}
      <Dialog
        className="personalized-rsvp-dialog"
        description="Jawaban Anda disimpan untuk setiap acara yang Anda hadiri."
        onClose={() => setOpen(false)}
        open={open && !showConfirmation}
        title="Konfirmasi Kehadiran"
      >
        <RsvpForm
          data={data}
          drafts={drafts}
          formAction={formAction}
          onChange={(event, update) => setDrafts((current) => updateDraft(current, event, update))}
          pending={pending}
          state={state}
        />
      </Dialog>
      <Dialog
        className="personalized-rsvp-dialog personalized-rsvp-confirmation-dialog"
        onClose={() => setOpen(false)}
        open={open && showConfirmation && Boolean(state.result)}
        title="RSVP berhasil diperbarui"
      >
        {state.result && (
          <>
            <ResponseSummary summary={state.result.summary} />
            <p className="personalized-rsvp-confirmation-copy">Terima kasih, jawaban Anda sudah tersimpan.</p>
            {state.result.summary.some((item) => item.qrEligibility === "ELIGIBLE") && <p>QR check-in Anda sudah tersedia.</p>}
            {state.result.summary.some((item) => item.qrEligibility === "PENDING_APPROVAL") && <p>Menunggu persetujuan untuk QR check-in.</p>}
            <div className="personalized-rsvp-confirmation-actions">
              <Button onClick={() => setOpen(false)} variant="secondary">Kembali ke Undangan</Button>
              {hasOpenEvents && <Button onClick={() => { setEditing(true); }} variant="ghost">Ubah RSVP</Button>}
            </div>
          </>
        )}
      </Dialog>
    </section>
  );
}
