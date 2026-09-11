"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { InvitationThemeView } from "@/components/invitations/invitation-theme-view";
import { ThemeErrorBoundary } from "@/components/invitations/theme-error-boundary";
import { Alert, Badge, Button, Card, CardContent, CardHeader, Field, FieldHint, FieldLabel, Input, Textarea, TextLink } from "@/components/ui";
import type { CommercialState, PublicationState } from "@/generated/prisma/client";
import type { InvitationContent, InvitationRenderData } from "@/modules/invitations";
import type { ResolvedThemePresentation } from "@/modules/themes";

import { saveInvitationContentAction } from "./actions";

const AUTOSAVE_DEBOUNCE_MS = 700;

type SaveState = "saved" | "saving" | "error" | "conflict";

interface InvitationEditorProps {
  readonly invitationId: string;
  readonly invitationTitle: string;
  readonly initialContent: InvitationContent;
  readonly initialVersion: number;
  readonly preview: InvitationRenderData;
  readonly theme: ResolvedThemePresentation;
  readonly publicationState: PublicationState;
  readonly commercialState: CommercialState;
  readonly canEdit: boolean;
}

function sameContent(left: InvitationContent, right: InvitationContent): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function saveStatusLabel(state: SaveState): string {
  switch (state) {
    case "saving":
      return "Menyimpan…";
    case "error":
      return "Gagal menyimpan";
    case "conflict":
      return "Versi berubah di sesi lain";
    case "saved":
      return "Tersimpan";
  }
}

function publicationLabel(state: PublicationState): string {
  return state === "PUBLISHED" ? "Published" : state === "UNPUBLISHED" ? "Offline" : "Draft";
}

function commercialLabel(state: CommercialState): string {
  return state === "TRIAL" ? "Trial" : state === "PAID_ACTIVE" ? "Paid" : state === "GRACE" ? "Grace" : "Tidak aktif";
}

export function InvitationEditor({
  invitationId,
  invitationTitle,
  initialContent,
  initialVersion,
  preview,
  theme,
  publicationState,
  commercialState,
  canEdit,
}: InvitationEditorProps) {
  const [draft, setDraft] = useState<InvitationContent>(initialContent);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const draftRef = useRef(draft);
  const versionRef = useRef(initialVersion);
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);

  const flushLatestRef = useRef<() => Promise<void>>(async () => undefined);
  const flushLatest = useCallback(async () => {
    if (!canEdit || !dirtyRef.current) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }

    const snapshot = draftRef.current;
    const revision = revisionRef.current;
    const expectedVersion = versionRef.current;
    inFlightRef.current = true;
    queuedRef.current = false;
    setSaveState("saving");
    setErrorMessage(null);

    try {
      const result = await saveInvitationContentAction(invitationId, expectedVersion, snapshot);
      if (result.ok && result.version !== undefined) {
        versionRef.current = result.version;
        if (revisionRef.current === revision && sameContent(draftRef.current, snapshot)) {
          dirtyRef.current = false;
          setSaveState("saved");
        } else {
          setSaveState("saving");
          window.setTimeout(() => void flushLatestRef.current(), 0);
        }
      } else if (result.conflict) {
        queuedRef.current = false;
        setSaveState("conflict");
        setErrorMessage("Versi undangan berubah di sesi lain. Perubahan lokal Anda tetap dipertahankan.");
      } else {
        queuedRef.current = false;
        setSaveState("error");
        setErrorMessage(result.message ?? "Perubahan belum tersimpan. Coba lagi.");
      }
    } catch {
      queuedRef.current = false;
      setSaveState("error");
      setErrorMessage("Perubahan belum tersimpan. Coba lagi.");
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current) window.setTimeout(() => void flushLatestRef.current(), 0);
    }
  }, [canEdit, invitationId]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    flushLatestRef.current = flushLatest;
  }, [flushLatest]);

  useEffect(() => {
    if (!canEdit || !dirtyRef.current) return;
    const timer = window.setTimeout(() => void flushLatestRef.current(), AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [canEdit, draft]);

  const livePreview = useMemo(
    () => ({ ...preview, content: draft }),
    [draft, preview],
  );

  function updateDraft(next: InvitationContent) {
    revisionRef.current += 1;
    dirtyRef.current = true;
    setSaveState("saving");
    setErrorMessage(null);
    setDraft(next);
  }

  function updateCore(field: "coupleDisplayName1" | "coupleDisplayName2", value: string) {
    updateDraft({ ...draftRef.current, core: { ...draftRef.current.core, [field]: value } });
  }

  function updateOptional(field: "opening" | "closing", value: string) {
    updateDraft({
      ...draftRef.current,
      optional: { ...draftRef.current.optional, [field]: value || undefined },
    });
  }

  function retrySave() {
    dirtyRef.current = true;
    setSaveState("saving");
    void flushLatestRef.current();
  }

  function reloadLatest() {
    const confirmed = window.confirm("Muat versi terbaru dan hapus perubahan lokal yang belum tersimpan?");
    if (confirmed) window.location.reload();
  }

  const statusTone = saveState === "saved" ? "success" : saveState === "conflict" ? "warning" : saveState === "error" ? "danger" : "info";

  return (
    <main className="invitation-editor-page">
      <header className="invitation-editor-header">
        <div className="invitation-editor-heading">
          <TextLink href="/invitations" aria-label="Kembali ke daftar undangan">←</TextLink>
          <div>
            <p className="ui-overline">Invitation Editor</p>
            <h1>{invitationTitle}</h1>
            <div className="invitation-editor-badges">
              <Badge tone={commercialState === "TRIAL" || commercialState === "PAID_ACTIVE" ? "info" : "warning"}>{commercialLabel(commercialState)}</Badge>
              <Badge tone={publicationState === "PUBLISHED" ? "success" : "neutral"}>{publicationLabel(publicationState)}</Badge>
            </div>
          </div>
        </div>
        <div className="invitation-editor-header-actions">
          <span className={`invitation-editor-save-status invitation-editor-save-status-${statusTone}`} aria-live="polite" role="status">
            <span aria-hidden="true">{saveState === "saved" ? "✓" : saveState === "saving" ? "•" : "!"}</span> {saveStatusLabel(saveState)}
          </span>
          <TextLink className="ui-button ui-button-secondary" href={`/invitations/${invitationId}/preview`}>Preview</TextLink>
          <TextLink className="ui-button ui-button-primary" href={`/invitations/${invitationId}/publish`}>Publish</TextLink>
        </div>
      </header>

      {!canEdit && (
        <Alert className="invitation-editor-lock" tone="warning" title="Editor hanya-baca">
          Masa aktif undangan ini tidak mengizinkan perubahan. Data tetap aman dan dapat dilihat melalui preview.
        </Alert>
      )}

      {saveState === "error" && errorMessage && (
        <Alert className="invitation-editor-save-alert" tone="danger" title="Gagal menyimpan">
          <p>{errorMessage}</p>
          <Button className="invitation-editor-inline-action" onClick={retrySave} size="sm" variant="secondary">Coba lagi</Button>
        </Alert>
      )}

      {saveState === "conflict" && (
        <Alert className="invitation-editor-save-alert" tone="warning" title="Versi undangan berubah di sesi lain">
          <p>Perubahan lokal Anda belum ditimpa. Muat versi terbaru hanya setelah Anda siap menghapus perubahan lokal ini.</p>
          <Button className="invitation-editor-inline-action" onClick={reloadLatest} size="sm" variant="secondary">Muat versi terbaru</Button>
        </Alert>
      )}

      <div className="invitation-editor-layout">
        <section aria-label="Kontrol editor" className="invitation-editor-controls">
          <Card>
            <CardHeader>
              <p className="ui-overline">Quick Setup</p>
              <h2 className="ui-card-title">Lengkapi bagian penting</h2>
              <p className="ui-card-description">Perubahan tersimpan otomatis setelah Anda berhenti mengetik.</p>
            </CardHeader>
            <CardContent className="invitation-editor-form">
              <div className="invitation-editor-section-heading">
                <h3>Couple</h3>
                <Badge tone="success">✓</Badge>
              </div>
              <Field>
                <FieldLabel required>Nama tampilan pasangan 1</FieldLabel>
                <Input aria-label="Nama tampilan pasangan 1" disabled={!canEdit} maxLength={120} onChange={(event) => updateCore("coupleDisplayName1", event.target.value)} value={draft.core.coupleDisplayName1} />
              </Field>
              <Field>
                <FieldLabel required>Nama tampilan pasangan 2</FieldLabel>
                <Input aria-label="Nama tampilan pasangan 2" disabled={!canEdit} maxLength={120} onChange={(event) => updateCore("coupleDisplayName2", event.target.value)} value={draft.core.coupleDisplayName2} />
              </Field>
              <div className="invitation-editor-section-heading invitation-editor-section-heading-spaced">
                <h3>Opening &amp; Closing</h3>
              </div>
              <Field>
                <FieldLabel>Opening</FieldLabel>
                <Textarea aria-label="Opening" disabled={!canEdit} maxLength={5000} onChange={(event) => updateOptional("opening", event.target.value)} placeholder="Tulis pembuka undangan…" value={draft.optional.opening ?? ""} />
                <FieldHint>Pesan pembuka yang tampil sebelum rangkaian acara.</FieldHint>
              </Field>
              <Field>
                <FieldLabel>Closing</FieldLabel>
                <Textarea aria-label="Closing" disabled={!canEdit} maxLength={5000} onChange={(event) => updateOptional("closing", event.target.value)} placeholder="Tulis penutup undangan…" value={draft.optional.closing ?? ""} />
                <FieldHint>Pesan penutup untuk tamu.</FieldHint>
              </Field>
              <div className="invitation-editor-quick-rows" aria-label="Bagian undangan">
                <div><span>Events</span><Badge tone="warning">! Lengkapi berikutnya</Badge></div>
                <div><span>Appearance</span><TextLink href={`/invitations/${invitationId}/themes`}>Atur tema →</TextLink></div>
                <div><span>Sharing &amp; Privacy</span><TextLink href={`/invitations/${invitationId}/settings`}>Kelola →</TextLink></div>
              </div>
            </CardContent>
          </Card>
        </section>
        <aside aria-label="Live invitation preview" className="invitation-editor-preview-pane">
          <div className="invitation-editor-preview-heading">
            <div><p className="ui-overline">Live Preview</p><h2>Undangan Anda</h2></div>
            <Badge tone="warning">Owner preview</Badge>
          </div>
          <div className="invitation-editor-preview-viewport">
            <ThemeErrorBoundary themeName={theme.definition.name}>
              <InvitationThemeView invitation={livePreview} theme={theme} />
            </ThemeErrorBoundary>
          </div>
        </aside>
      </div>

      <nav aria-label="Aksi editor" className="invitation-editor-sticky-actions">
        <TextLink className="ui-button ui-button-secondary" href={`/invitations/${invitationId}/preview`}>Preview</TextLink>
        <TextLink className="ui-button ui-button-primary" href={`/invitations/${invitationId}/publish`}>Publish</TextLink>
      </nav>
    </main>
  );
}
