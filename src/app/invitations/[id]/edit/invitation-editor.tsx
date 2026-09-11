"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { InvitationThemeView } from "@/components/invitations/invitation-theme-view";
import { ThemeErrorBoundary } from "@/components/invitations/theme-error-boundary";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Field,
  FieldHint,
  FieldLabel,
  Input,
  Select,
  Textarea,
  TextLink,
} from "@/components/ui";
import type { CommercialState, PublicationState } from "@/generated/prisma/client";
import {
  INVITATION_CORE_SECTION_IDS,
  INVITATION_SECTION_OPTIONS,
  MAX_LOVE_STORY_MILESTONES,
  normalizeInvitationSectionOrder,
  invitationContentSchema,
  type InvitationContent,
  type LoveStoryMilestone,
  type InvitationSectionId,
  type InvitationSectionOption,
} from "@/modules/invitations/content";
import type { InvitationRenderData } from "@/modules/invitations/render-data";
import {
  type ResolvedThemePresentation,
  type ThemeConfig,
} from "@/modules/themes";
import { COVER_STYLE_OPTIONS, FONT_PAIRING_OPTIONS } from "@/modules/themes/options";

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

function sameThemeConfig(left: ThemeConfig, right: ThemeConfig): boolean {
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

function defaultEditorSectionOrder(content: InvitationContent): InvitationSectionId[] {
  if (content.sectionOrder) return normalizeInvitationSectionOrder(content.sectionOrder);

  const order: InvitationSectionId[] = [...INVITATION_CORE_SECTION_IDS];
  if (content.optional.opening || content.optional.closing || content.optional.quoteOrPrayer) {
    order.push("opening_closing");
  }
  if (content.optional.loveStory) order.push("love_story");
  // WF-06 enables RSVP by default; domain-owned RSVP content can refine this later.
  order.push("rsvp");
  return order;
}

interface SectionRowProps {
  readonly option: InvitationSectionOption;
  readonly enabled: boolean;
  readonly canEdit: boolean;
  readonly position: number;
  readonly activeCount: number;
  readonly onToggle: (sectionId: InvitationSectionId, enabled: boolean) => void;
  readonly onMove: (sectionId: InvitationSectionId, direction: -1 | 1) => void;
}

function SectionRow({ option, enabled, canEdit, position, activeCount, onToggle, onMove }: SectionRowProps) {
  const isCore = !option.optional;
  return (
    <li className={`invitation-editor-section-row${enabled ? " invitation-editor-section-row-enabled" : ""}`} data-section-id={option.id}>
      <div className="invitation-editor-section-row-main">
        {isCore ? (
          <span aria-hidden="true" className="invitation-editor-section-grip">⋮⋮</span>
        ) : (
          <Checkbox
            aria-label={`Aktifkan ${option.label}`}
            checked={enabled}
            disabled={!canEdit}
            label=""
            onChange={(event) => onToggle(option.id, event.target.checked)}
          />
        )}
        <span className="invitation-editor-section-copy">
          <strong>{option.label}</strong>
          <span>{option.description}</span>
        </span>
        {!isCore && <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "On" : "Off"}</Badge>}
      </div>
      <div className="invitation-editor-section-move-actions">
        <Button aria-label={`Naikkan ${option.label}`} disabled={!canEdit || !enabled || isCore || position <= 0} onClick={() => onMove(option.id, -1)} size="sm" variant="ghost">↑</Button>
        <Button aria-label={`Turunkan ${option.label}`} disabled={!canEdit || !enabled || isCore || position >= activeCount - 1} onClick={() => onMove(option.id, 1)} size="sm" variant="ghost">↓</Button>
      </div>
    </li>
  );
}

interface AppearanceControlsProps {
  readonly theme: ResolvedThemePresentation;
  readonly themeConfig: ThemeConfig;
  readonly canEdit: boolean;
  readonly onChange: (config: ThemeConfig) => void;
}

function AppearanceControls({ theme, themeConfig, canEdit, onChange }: AppearanceControlsProps) {
  return (
    <section aria-labelledby="appearance-heading" className="invitation-editor-appearance">
      <div className="invitation-editor-section-heading">
        <div>
          <h3 id="appearance-heading">Appearance</h3>
          <p className="invitation-editor-control-description">Pilihan terkurasi dari tema {theme.definition.name}.</p>
        </div>
      </div>
      <Field>
        <FieldLabel>Aksen warna</FieldLabel>
        <div aria-label="Pilihan aksen warna" className="invitation-editor-accent-options" role="group">
          {theme.definition.accentOptions.map((accent) => (
            <Button
              aria-label={`Aksen ${accent.label}`}
              aria-pressed={themeConfig.accent === accent.id}
              className="invitation-editor-accent-option"
              disabled={!canEdit}
              key={accent.id}
              onClick={() => onChange({ ...themeConfig, accent: accent.id })}
              style={{ "--editor-accent-option": accent.color } as CSSProperties}
              title={accent.label}
              variant={themeConfig.accent === accent.id ? "primary" : "secondary"}
            >
              <span aria-hidden="true" className="invitation-editor-accent-swatch" />
              {accent.label}
            </Button>
          ))}
        </div>
        <FieldHint>Aksen yang tersedia mengikuti tema dan tidak mengubah isi undangan.</FieldHint>
      </Field>
      <Field>
        <FieldLabel>Pasangan font</FieldLabel>
        <Select aria-label="Pasangan font" disabled={!canEdit} id="font-pairing" onChange={(event) => onChange({ ...themeConfig, fontPairing: event.target.value as ThemeConfig["fontPairing"] })} value={themeConfig.fontPairing}>
          {FONT_PAIRING_OPTIONS.map((font) => <option key={font.id} value={font.id}>{font.label} — {font.description}</option>)}
        </Select>
      </Field>
      <Field>
        <FieldLabel>Cover</FieldLabel>
        <Select aria-label="Cover" disabled={!canEdit} id="cover-style" onChange={(event) => onChange({ ...themeConfig, coverStyle: event.target.value as ThemeConfig["coverStyle"] })} value={themeConfig.coverStyle}>
          {COVER_STYLE_OPTIONS.map((cover) => <option key={cover.id} value={cover.id}>{cover.label} — {cover.description}</option>)}
        </Select>
        <FieldHint>Pilih komposisi cover yang paling sesuai dengan tema Anda.</FieldHint>
      </Field>
    </section>
  );
}

type PersonId = "person1" | "person2";
type SocialLinkId = "instagram" | "facebook" | "tiktok" | "youtube" | "website";

const socialLinkOptions: readonly { id: SocialLinkId; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "website", label: "Website" },
];

function OptionalDetailsFields({
  content,
  canEdit,
  onFullNameChange,
  onParentChange,
  onSocialLinkChange,
}: {
  readonly content: InvitationContent;
  readonly canEdit: boolean;
  readonly onFullNameChange: (person: PersonId, value: string) => void;
  readonly onParentChange: (person: PersonId, parent: "father" | "mother", value: string) => void;
  readonly onSocialLinkChange: (platform: SocialLinkId, value: string) => void;
}) {
  const fullNames = content.optional.fullNames;
  const parents = content.optional.parentFields;
  const socialLinks = content.optional.socialLinks;

  return (
    <div className="invitation-editor-optional-details">
      <div className="invitation-editor-subsection-heading">
        <h4>Detail pasangan <span>(opsional)</span></h4>
        <p>Tambahkan nama lengkap, orang tua, dan tautan sosial bila diperlukan.</p>
      </div>
      <div className="invitation-editor-person-grid">
        <Field>
          <FieldLabel>Nama lengkap pasangan 1</FieldLabel>
          <Input
            aria-label="Nama lengkap pasangan 1"
            disabled={!canEdit}
            maxLength={240}
            onChange={(event) => onFullNameChange("person1", event.target.value)}
            placeholder="Contoh: Alya Putri"
            value={fullNames?.person1 ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel>Nama lengkap pasangan 2</FieldLabel>
          <Input
            aria-label="Nama lengkap pasangan 2"
            disabled={!canEdit}
            maxLength={240}
            onChange={(event) => onFullNameChange("person2", event.target.value)}
            placeholder="Contoh: Bima Pratama"
            value={fullNames?.person2 ?? ""}
          />
        </Field>
      </div>
      <div className="invitation-editor-person-grid">
        {(["person1", "person2"] as const).map((person, index) => (
          <fieldset className="invitation-editor-parent-group" key={person}>
            <legend>Orang tua pasangan {index + 1}</legend>
            <Field>
              <FieldLabel>Nama ayah</FieldLabel>
              <Input
                aria-label={`Nama ayah pasangan ${index + 1}`}
                disabled={!canEdit}
                maxLength={240}
                onChange={(event) => onParentChange(person, "father", event.target.value)}
                placeholder="Opsional"
                value={parents?.[person]?.father ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel>Nama ibu</FieldLabel>
              <Input
                aria-label={`Nama ibu pasangan ${index + 1}`}
                disabled={!canEdit}
                maxLength={240}
                onChange={(event) => onParentChange(person, "mother", event.target.value)}
                placeholder="Opsional"
                value={parents?.[person]?.mother ?? ""}
              />
            </Field>
          </fieldset>
        ))}
      </div>
      <div className="invitation-editor-subsection-heading invitation-editor-subsection-heading-spaced">
        <h4>Tautan sosial <span>(opsional)</span></h4>
        <p>Bagikan akun pasangan di halaman undangan.</p>
      </div>
      <div className="invitation-editor-social-grid">
        {socialLinkOptions.map(({ id, label }) => (
          <Field key={id}>
            <FieldLabel>{label}</FieldLabel>
            <Input
              aria-label={label}
              disabled={!canEdit}
              inputMode="url"
              maxLength={2048}
              onChange={(event) => onSocialLinkChange(id, event.target.value)}
              placeholder="https://"
              type="url"
              value={socialLinks?.[id] ?? ""}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function LoveStoryFields({
  content,
  canEdit,
  onChange,
}: {
  readonly content: InvitationContent;
  readonly canEdit: boolean;
  readonly onChange: (milestones: LoveStoryMilestone[]) => void;
}) {
  const milestones = content.optional.loveStory?.milestones ?? [];
  const canAddMilestone = canEdit && milestones.length < MAX_LOVE_STORY_MILESTONES;

  return (
    <section aria-labelledby="love-story-heading" className="invitation-editor-love-story">
      <div className="invitation-editor-section-heading">
        <div>
          <h3 id="love-story-heading">Love Story</h3>
          <p className="invitation-editor-control-description">Ceritakan perjalanan pasangan dalam maksimal {MAX_LOVE_STORY_MILESTONES} momen.</p>
        </div>
        <Badge tone="neutral">{milestones.length}/{MAX_LOVE_STORY_MILESTONES}</Badge>
      </div>
      {milestones.length === 0 && <p className="invitation-editor-empty-hint">Belum ada momen. Tambahkan momen pertama untuk mulai bercerita.</p>}
      <div className="invitation-editor-milestone-list">
        {milestones.map((milestone, index) => (
          <fieldset className="invitation-editor-milestone" key={`milestone-${index}`}>
            <legend>Momen {index + 1}</legend>
            <Field>
              <FieldLabel>Tahun atau tanggal</FieldLabel>
              <Input
                aria-label={`Tanggal momen ${index + 1}`}
                disabled={!canEdit}
                maxLength={240}
                onChange={(event) => onChange(milestones.map((item, itemIndex) => itemIndex === index ? { ...item, date: event.target.value || undefined } : item))}
                placeholder="Contoh: 2020"
                value={milestone.date ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel required>Judul momen</FieldLabel>
              <Input
                aria-label={`Judul momen ${index + 1}`}
                aria-invalid={!milestone.title.trim()}
                disabled={!canEdit}
                maxLength={240}
                onChange={(event) => onChange(milestones.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))}
                placeholder="Contoh: Pertama bertemu"
                value={milestone.title}
              />
            </Field>
            <Field>
              <FieldLabel>Cerita singkat</FieldLabel>
              <Textarea
                aria-label={`Cerita momen ${index + 1}`}
                disabled={!canEdit}
                maxLength={5000}
                onChange={(event) => onChange(milestones.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value || undefined } : item))}
                placeholder="Ceritakan momen ini…"
                value={milestone.description ?? ""}
              />
            </Field>
            <Button disabled={!canEdit} onClick={() => onChange(milestones.filter((_, itemIndex) => itemIndex !== index))} size="sm" variant="ghost">Hapus momen</Button>
          </fieldset>
        ))}
      </div>
      <Button disabled={!canAddMilestone} onClick={() => onChange([...milestones, { date: undefined, title: "", description: undefined }])} size="sm" variant="secondary">
        + Tambah momen
      </Button>
      {!canAddMilestone && milestones.length >= MAX_LOVE_STORY_MILESTONES && <FieldHint>Anda sudah mencapai batas {MAX_LOVE_STORY_MILESTONES} momen.</FieldHint>}
    </section>
  );
}

export function InvitationEditor({ invitationId, invitationTitle, initialContent, initialVersion, preview, theme, publicationState, commercialState, canEdit }: InvitationEditorProps) {
  const [draft, setDraft] = useState<InvitationContent>(initialContent);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(theme.config);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const draftRef = useRef(draft);
  const themeConfigRef = useRef(themeConfig);
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
    const snapshotThemeConfig = themeConfigRef.current;
    const revision = revisionRef.current;
    const expectedVersion = versionRef.current;
    inFlightRef.current = true;
    queuedRef.current = false;
    setSaveState("saving");
    setErrorMessage(null);

    try {
      const parsedSnapshot = invitationContentSchema.safeParse(snapshot);
      if (!parsedSnapshot.success) {
        queuedRef.current = false;
        setSaveState("error");
        setErrorMessage("Lengkapi kolom yang wajib diisi sebelum menyimpan.");
        return;
      }

      const result = await saveInvitationContentAction(invitationId, expectedVersion, parsedSnapshot.data, snapshotThemeConfig);
      if (result.ok && result.version !== undefined) {
        versionRef.current = result.version;
        if (revisionRef.current === revision && sameContent(draftRef.current, snapshot) && sameThemeConfig(themeConfigRef.current, snapshotThemeConfig)) {
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

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { themeConfigRef.current = themeConfig; }, [themeConfig]);
  useEffect(() => { flushLatestRef.current = flushLatest; }, [flushLatest]);
  useEffect(() => {
    if (!canEdit || !dirtyRef.current) return;
    const timer = window.setTimeout(() => void flushLatestRef.current(), AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [canEdit, draft, themeConfig]);

  const livePreview = useMemo(() => ({ ...preview, content: draft }), [draft, preview]);
  const liveTheme = useMemo(() => ({ ...theme, config: themeConfig }), [theme, themeConfig]);
  const activeSectionOrder = useMemo(() => defaultEditorSectionOrder(draft), [draft]);
  const activeSectionSet = useMemo(() => new Set(activeSectionOrder), [activeSectionOrder]);
  const orderedSectionOptions = useMemo(() => [
    ...INVITATION_SECTION_OPTIONS.filter(({ id }) => activeSectionSet.has(id)),
    ...INVITATION_SECTION_OPTIONS.filter(({ id }) => !activeSectionSet.has(id)),
  ], [activeSectionSet]);

  function updateEditor(nextContent: InvitationContent, nextThemeConfig = themeConfigRef.current) {
    revisionRef.current += 1;
    dirtyRef.current = true;
    themeConfigRef.current = nextThemeConfig;
    setSaveState("saving");
    setErrorMessage(null);
    setDraft(nextContent);
    setThemeConfig(nextThemeConfig);
  }

  function updateCore(field: "coupleDisplayName1" | "coupleDisplayName2", value: string) {
    updateEditor({ ...draftRef.current, core: { ...draftRef.current.core, [field]: value } });
  }

  function updateOptional(field: "opening" | "closing", value: string) {
    updateEditor({ ...draftRef.current, optional: { ...draftRef.current.optional, [field]: value || undefined } });
  }

  function updateQuoteOrHashtag(field: "quoteOrPrayer" | "hashtag", value: string) {
    updateEditor({ ...draftRef.current, optional: { ...draftRef.current.optional, [field]: value || undefined } });
  }

  function updateFullName(person: PersonId, value: string) {
    const nextFullNames = { ...draftRef.current.optional.fullNames, [person]: value || undefined };
    const hasValue = Object.values(nextFullNames).some(Boolean);
    updateEditor({
      ...draftRef.current,
      optional: { ...draftRef.current.optional, fullNames: hasValue ? nextFullNames : undefined },
    });
  }

  function updateParent(person: PersonId, parent: "father" | "mother", value: string) {
    const nextPerson = { ...draftRef.current.optional.parentFields?.[person], [parent]: value || undefined };
    const nextParents = { ...draftRef.current.optional.parentFields, [person]: nextPerson };
    const hasValue = Object.values(nextParents).some((details) => details && Object.values(details).some(Boolean));
    updateEditor({
      ...draftRef.current,
      optional: { ...draftRef.current.optional, parentFields: hasValue ? nextParents : undefined },
    });
  }

  function updateSocialLink(platform: SocialLinkId, value: string) {
    const nextSocialLinks = { ...draftRef.current.optional.socialLinks, [platform]: value || undefined };
    const hasValue = Object.values(nextSocialLinks).some(Boolean);
    updateEditor({
      ...draftRef.current,
      optional: { ...draftRef.current.optional, socialLinks: hasValue ? nextSocialLinks : undefined },
    });
  }

  function updateLoveStory(milestones: LoveStoryMilestone[]) {
    updateEditor({
      ...draftRef.current,
      optional: {
        ...draftRef.current.optional,
        loveStory: milestones.length > 0 ? { milestones } : undefined,
      },
    });
  }

  function updateAppearance(nextThemeConfig: ThemeConfig) {
    updateEditor(draftRef.current, nextThemeConfig);
  }

  function toggleSection(sectionId: InvitationSectionId, enabled: boolean) {
    const current = defaultEditorSectionOrder(draftRef.current);
    const next = enabled ? [...current, ...(current.includes(sectionId) ? [] : [sectionId])] : current.filter((id) => id !== sectionId);
    updateEditor({ ...draftRef.current, sectionOrder: normalizeInvitationSectionOrder(next) });
  }

  function moveSection(sectionId: InvitationSectionId, direction: -1 | 1) {
    const current = defaultEditorSectionOrder(draftRef.current);
    const index = current.indexOf(sectionId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;
    const next = [...current];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    updateEditor({ ...draftRef.current, sectionOrder: normalizeInvitationSectionOrder(next) });
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
          <div><p className="ui-overline">Invitation Editor</p><h1>{invitationTitle}</h1><div className="invitation-editor-badges"><Badge tone={commercialState === "TRIAL" || commercialState === "PAID_ACTIVE" ? "info" : "warning"}>{commercialLabel(commercialState)}</Badge><Badge tone={publicationState === "PUBLISHED" ? "success" : "neutral"}>{publicationLabel(publicationState)}</Badge></div></div>
        </div>
        <div className="invitation-editor-header-actions"><span className={`invitation-editor-save-status invitation-editor-save-status-${statusTone}`} aria-live="polite" role="status"><span aria-hidden="true">{saveState === "saved" ? "✓" : saveState === "saving" ? "•" : "!"}</span> {saveStatusLabel(saveState)}</span><TextLink className="ui-button ui-button-secondary" href={`/invitations/${invitationId}/preview`}>Preview</TextLink><TextLink className="ui-button ui-button-primary" href={`/invitations/${invitationId}/publish`}>Publish</TextLink></div>
      </header>

      {!canEdit && <Alert className="invitation-editor-lock" tone="warning" title="Editor hanya-baca">Masa aktif undangan ini tidak mengizinkan perubahan. Data tetap aman dan dapat dilihat melalui preview.</Alert>}
      {saveState === "error" && errorMessage && <Alert className="invitation-editor-save-alert" tone="danger" title="Gagal menyimpan"><p>{errorMessage}</p><Button className="invitation-editor-inline-action" onClick={retrySave} size="sm" variant="secondary">Coba lagi</Button></Alert>}
      {saveState === "conflict" && <Alert className="invitation-editor-save-alert" tone="warning" title="Versi undangan berubah di sesi lain"><p>Perubahan lokal Anda belum ditimpa. Muat versi terbaru hanya setelah Anda siap menghapus perubahan lokal ini.</p><Button className="invitation-editor-inline-action" onClick={reloadLatest} size="sm" variant="secondary">Muat versi terbaru</Button></Alert>}

      <div className="invitation-editor-layout">
        <section aria-label="Kontrol editor" className="invitation-editor-controls">
          <Card><CardHeader><p className="ui-overline">Quick Setup</p><h2 className="ui-card-title">Lengkapi bagian penting</h2><p className="ui-card-description">Perubahan tersimpan otomatis setelah Anda berhenti mengetik.</p></CardHeader><CardContent className="invitation-editor-form">
            <div className="invitation-editor-section-heading"><h3>Couple</h3><Badge tone="success">✓</Badge></div>
            <Field><FieldLabel required>Nama tampilan pasangan 1</FieldLabel><Input aria-label="Nama tampilan pasangan 1" disabled={!canEdit} maxLength={120} onChange={(event) => updateCore("coupleDisplayName1", event.target.value)} value={draft.core.coupleDisplayName1} /></Field>
            <Field><FieldLabel required>Nama tampilan pasangan 2</FieldLabel><Input aria-label="Nama tampilan pasangan 2" disabled={!canEdit} maxLength={120} onChange={(event) => updateCore("coupleDisplayName2", event.target.value)} value={draft.core.coupleDisplayName2} /></Field>
            <OptionalDetailsFields
              canEdit={canEdit}
              content={draft}
              onFullNameChange={updateFullName}
              onParentChange={updateParent}
              onSocialLinkChange={updateSocialLink}
            />
            <div className="invitation-editor-section-heading invitation-editor-section-heading-spaced"><div><h3>Bagian undangan</h3><p className="invitation-editor-control-description">Nyalakan bagian opsional dan atur urutannya.</p></div></div>
            <ol aria-label="Urutan bagian undangan" className="invitation-editor-section-list">{orderedSectionOptions.map((option) => <SectionRow activeCount={activeSectionOrder.length} canEdit={canEdit} enabled={activeSectionSet.has(option.id)} key={option.id} onMove={moveSection} onToggle={toggleSection} option={option} position={activeSectionOrder.indexOf(option.id)} />)}</ol>
            <FieldHint>Couple dan Events selalu tersedia. Bagian yang belum memiliki data akan tampil setelah fiturnya diisi.</FieldHint>
            <div className="invitation-editor-section-heading invitation-editor-section-heading-spaced"><h3>Opening &amp; Closing</h3></div>
            <Field><FieldLabel>Opening</FieldLabel><Textarea aria-label="Opening" disabled={!canEdit} maxLength={5000} onChange={(event) => updateOptional("opening", event.target.value)} placeholder="Tulis pembuka undangan…" value={draft.optional.opening ?? ""} /><FieldHint>Pesan pembuka yang tampil sebelum rangkaian acara.</FieldHint></Field>
            <Field><FieldLabel>Closing</FieldLabel><Textarea aria-label="Closing" disabled={!canEdit} maxLength={5000} onChange={(event) => updateOptional("closing", event.target.value)} placeholder="Tulis penutup undangan…" value={draft.optional.closing ?? ""} /><FieldHint>Pesan penutup untuk tamu.</FieldHint></Field>
            <Field><FieldLabel>Quote, ayat, atau doa <span>(opsional)</span></FieldLabel><Textarea aria-label="Quote, ayat, atau doa" disabled={!canEdit} maxLength={5000} onChange={(event) => updateQuoteOrHashtag("quoteOrPrayer", event.target.value)} placeholder="Tulis quote atau doa pilihan Anda…" value={draft.optional.quoteOrPrayer ?? ""} /></Field>
            <Field><FieldLabel>Hashtag <span>(opsional)</span></FieldLabel><Input aria-label="Hashtag" disabled={!canEdit} maxLength={240} onChange={(event) => updateQuoteOrHashtag("hashtag", event.target.value)} placeholder="#NamaPasangan" value={draft.optional.hashtag ?? ""} /></Field>
            {activeSectionSet.has("love_story") && <LoveStoryFields canEdit={canEdit} content={draft} onChange={updateLoveStory} />}
            <AppearanceControls canEdit={canEdit} onChange={updateAppearance} theme={theme} themeConfig={themeConfig} />
            <div className="invitation-editor-quick-rows" aria-label="Bagian pengaturan lain"><div><span>Events</span><Badge tone="warning">! Lengkapi berikutnya</Badge></div><div><span>Sharing &amp; Privacy</span><TextLink href={`/invitations/${invitationId}/settings`}>Kelola →</TextLink></div></div>
          </CardContent></Card>
        </section>
        <aside aria-label="Live invitation preview" className="invitation-editor-preview-pane"><div className="invitation-editor-preview-heading"><div><p className="ui-overline">Live Preview</p><h2>Undangan Anda</h2></div><Badge tone="warning">Owner preview</Badge></div><div className="invitation-editor-preview-viewport"><ThemeErrorBoundary themeName={theme.definition.name}><InvitationThemeView invitation={livePreview} theme={liveTheme} /></ThemeErrorBoundary></div></aside>
      </div>
      <nav aria-label="Aksi editor" className="invitation-editor-sticky-actions"><TextLink className="ui-button ui-button-secondary" href={`/invitations/${invitationId}/preview`}>Preview</TextLink><TextLink className="ui-button ui-button-primary" href={`/invitations/${invitationId}/publish`}>Publish</TextLink></nav>
    </main>
  );
}
