"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Alert, Button, Card, CardContent, TextLink } from "@/components/ui";
import { selectThemeAction } from "@/app/invitations/[id]/themes/actions";
import { initialThemeSelectionActionState } from "@/app/invitations/[id]/themes/action-state";
import type { ThemeDefinition } from "@/modules/themes";

interface ThemePickerProps {
  readonly invitationId: string;
  readonly coupleName: string;
  readonly selectedThemeId: string;
  readonly selectedThemeVersion: string;
  readonly themes: readonly ThemeDefinition[];
  readonly canEdit: boolean;
}

export function ThemePicker({
  invitationId,
  coupleName,
  selectedThemeId,
  selectedThemeVersion,
  themes,
  canEdit,
}: ThemePickerProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    selectThemeAction.bind(null, invitationId),
    initialThemeSelectionActionState,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok, state.selectedThemeId]);

  const displayedThemeId = state.selectedThemeId ?? selectedThemeId;

  return (
    <Card className="invitation-theme-card">
      <CardContent className="invitation-theme-picker">
        {!canEdit && (
          <Alert tone="warning" title="Tema tidak dapat diubah">
            {`Masa aktif undangan ${coupleName} sudah berakhir. Data tetap tersimpan dan tema dapat dilihat kembali setelah undangan diaktifkan.`}
          </Alert>
        )}

        {state.formError && (
          <Alert tone="danger" title="Tema belum tersimpan">
            {state.formError}
          </Alert>
        )}

        {state.ok && state.message && <Alert tone="success">{state.message}</Alert>}

        <form action={action} className="invitation-theme-form">
          <ul className="invitation-theme-grid" aria-label="Daftar tema">
            {themes.map((theme) => {
              const selected = displayedThemeId === theme.id;
              return (
                <li
                  className={`invitation-theme-option${selected ? " invitation-theme-option-selected" : ""}`}
                  data-selected={selected ? "true" : "false"}
                  key={theme.id}
                >
                  <div
                    aria-label={`Pratinjau ${theme.name}`}
                    className="invitation-theme-thumbnail"
                    role="img"
                    style={{
                      backgroundColor: theme.preview.backgroundColor,
                      color: theme.preview.foregroundColor,
                      borderColor: theme.preview.accentColor,
                    }}
                  >
                    <span className="invitation-theme-thumbnail-mark" style={{ backgroundColor: theme.preview.accentColor }} aria-hidden="true" />
                    <span className="invitation-theme-thumbnail-line invitation-theme-thumbnail-line-long" aria-hidden="true" />
                    <span className="invitation-theme-thumbnail-line" aria-hidden="true" />
                    <span className="invitation-theme-thumbnail-caption">Preview</span>
                  </div>
                  <div className="invitation-theme-option-copy">
                    <div className="invitation-theme-option-heading">
                      <h2>{theme.name}</h2>
                      {selected && <span className="ui-badge ui-badge-accent">Dipilih</span>}
                    </div>
                    <p>{theme.description}</p>
                    <Button
                      aria-pressed={selected}
                      disabled={!canEdit || pending}
                      name="themeId"
                      size="sm"
                      type="submit"
                      value={theme.id}
                      variant={selected ? "primary" : "secondary"}
                    >
                      {pending && selected ? "Menyimpan..." : selected ? "Tema digunakan" : "Pilih tema"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </form>

        <div className="invitation-theme-footer">
          <span>{`Tema aktif: ${displayedThemeId} · versi ${selectedThemeVersion}`}</span>
          <TextLink className="ui-button ui-button-primary invitation-theme-continue" href={`/invitations/${invitationId}/publish`}>Lanjut ke kesiapan publikasi</TextLink>
        </div>
      </CardContent>
    </Card>
  );
}
