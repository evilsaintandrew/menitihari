"use client";

import { useActionState } from "react";

import { Alert, Badge, Button, Field, FieldError, FieldLabel, Input } from "@/components/ui";

import {
  initialInvitationPasswordActionState,
  updateInvitationPasswordAction,
} from "./actions";

export function InvitationPasswordForm({
  invitationId,
  genericAccessEnabled,
  passwordEnabled,
  guestSharingEnabled,
}: {
  readonly invitationId: string;
  readonly genericAccessEnabled: boolean;
  readonly passwordEnabled: boolean;
  readonly guestSharingEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateInvitationPasswordAction.bind(null, invitationId),
    initialInvitationPasswordActionState,
  );
  const enabled = state.passwordEnabled ?? passwordEnabled;

  return (
    <section className="invitation-sharing-section" aria-labelledby="sharing-summary-title">
      <div className="invitation-sharing-heading">
        <div>
          <p className="ui-overline">Sharing &amp; Privacy</p>
          <h2 id="sharing-summary-title">Ringkasan akses</h2>
        </div>
      </div>
      <dl className="invitation-sharing-summary">
        <div><dt>Akses umum</dt><dd>{genericAccessEnabled ? "Aktif" : "Tidak aktif"}</dd></div>
        <div><dt>Link personal</dt><dd>Aktif</dd></div>
        <div><dt>Password</dt><dd>{enabled ? "Digunakan" : "Tidak digunakan"}</dd></div>
        <div><dt>Tamu dapat membagikan link</dt><dd>{guestSharingEnabled ? "Ya" : "Tidak"}</dd></div>
      </dl>

      <div className="invitation-sharing-password">
        <div className="invitation-sharing-control-heading">
          <div>
            <h2>Password bersama</h2>
            <p className="ui-card-description">Tamu perlu memasukkan password ini sebelum membuka undangan.</p>
          </div>
          <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "On" : "Off"}</Badge>
        </div>
        {state.formError && <Alert tone="danger" title="Perubahan belum tersimpan">{state.formError}</Alert>}
        {state.ok && state.message && <Alert tone="success" title="Tersimpan">{state.message}</Alert>}

        <form action={formAction} className="invitation-settings-form" noValidate>
          <input name="intent" type="hidden" value={enabled ? "change" : "enable"} />
          <Field htmlFor="shared-password">
            <FieldLabel required>Password baru</FieldLabel>
            <Input
              aria-describedby={state.fieldErrors?.password ? "shared-password-error" : "shared-password-help"}
              aria-invalid={state.fieldErrors?.password ? "true" : undefined}
              autoComplete="new-password"
              id="shared-password"
              maxLength={128}
              minLength={8}
              name="password"
              required
              type="password"
            />
            <span className="ui-field-hint" id="shared-password-help">Minimal 8 karakter.</span>
            {state.fieldErrors?.password && <FieldError id="shared-password-error">{state.fieldErrors.password}</FieldError>}
          </Field>
          <Field htmlFor="shared-password-confirmation">
            <FieldLabel required>Ulangi password</FieldLabel>
            <Input
              aria-describedby={state.fieldErrors?.confirmation ? "shared-password-confirmation-error" : undefined}
              aria-invalid={state.fieldErrors?.confirmation ? "true" : undefined}
              autoComplete="new-password"
              id="shared-password-confirmation"
              maxLength={128}
              minLength={8}
              name="confirmation"
              required
              type="password"
            />
            {state.fieldErrors?.confirmation && <FieldError id="shared-password-confirmation-error">{state.fieldErrors.confirmation}</FieldError>}
          </Field>
          <Button disabled={pending} type="submit" fullWidth>
            {pending ? "Menyimpan..." : enabled ? "Simpan password baru" : "Aktifkan password"}
          </Button>
        </form>

        {enabled && (
          <>
            <p className="ui-field-hint invitation-sharing-password-note">
              Password lama tidak dapat dilihat. Mengganti password akan mengeluarkan sesi tamu yang menggunakan password lama.
            </p>
            <form action={formAction}>
              <input name="intent" type="hidden" value="disable" />
              <Button disabled={pending} type="submit" variant="secondary" fullWidth>
                {pending ? "Menyimpan..." : "Nonaktifkan password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
