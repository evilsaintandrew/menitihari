"use client";

import { useActionState } from "react";

import { Alert, Button, Field, FieldError, FieldLabel, Input } from "@/components/ui";

import {
  initialInvitationSlugActionState,
  updateInvitationSlugAction,
} from "./actions";

export function InvitationSlugForm({
  invitationId,
  canonicalSlug,
}: {
  readonly invitationId: string;
  readonly canonicalSlug: string;
}) {
  const [state, action, pending] = useActionState(
    updateInvitationSlugAction.bind(null, invitationId),
    initialInvitationSlugActionState,
  );
  const currentSlug = state.canonicalSlug ?? canonicalSlug;

  return (
    <form action={action} className="invitation-settings-form" noValidate>
      {state.formError && <Alert tone="danger" title="Alamat link belum tersimpan">{state.formError}</Alert>}
      {state.ok && state.message && <Alert tone="success" title="Tersimpan">{state.message}</Alert>}
      <Field htmlFor="invitation-slug">
        <FieldLabel required>Alamat link publik</FieldLabel>
        <Input
          aria-describedby={state.fieldErrors?.slug ? "invitation-slug-error" : "invitation-slug-help"}
          aria-invalid={state.fieldErrors?.slug ? "true" : undefined}
          defaultValue={currentSlug}
          id="invitation-slug"
          name="slug"
          required
          spellCheck={false}
        />
        <p className="ui-field-help" id="invitation-slug-help">
          Link publik: /{currentSlug}. Link lama tetap mengarah ke alamat terbaru.
        </p>
        {state.fieldErrors?.slug && <FieldError id="invitation-slug-error">{state.fieldErrors.slug}</FieldError>}
      </Field>
      <Button disabled={pending} type="submit" fullWidth>
        {pending ? "Menyimpan..." : "Simpan alamat link"}
      </Button>
    </form>
  );
}
