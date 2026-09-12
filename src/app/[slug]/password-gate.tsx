"use client";

import { useActionState } from "react";

import { Alert, Button, Card, CardContent, CardHeader, Field, FieldError, FieldLabel, Input } from "@/components/ui";

import {
  initialInvitationPasswordGateState,
  submitInvitationPasswordAction,
} from "./password-actions";
import type { InvitationPasswordAccessMode } from "@/modules/access";

export function InvitationPasswordGate({
  invitationId,
  mode = "generic",
}: {
  readonly invitationId: string;
  readonly mode?: InvitationPasswordAccessMode;
}) {
  const [state, formAction, pending] = useActionState(
    submitInvitationPasswordAction.bind(null, invitationId, mode),
    initialInvitationPasswordGateState,
  );

  return (
    <Card className="invitation-password-gate">
      <CardHeader>
        <p className="ui-overline">Menitihari</p>
        <h1 className="auth-title">Undangan terlindungi</h1>
        <p className="ui-card-description">Masukkan password bersama untuk membuka undangan ini.</p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="invitation-settings-form" noValidate>
          {state.formError && <Alert tone="danger" title="Belum dapat dibuka">{state.formError}</Alert>}
          <Field htmlFor="invitation-password">
            <FieldLabel required>Password</FieldLabel>
            <Input
              aria-describedby={state.fieldError ? "invitation-password-error" : undefined}
              aria-invalid={state.fieldError ? "true" : undefined}
              autoComplete="current-password"
              autoFocus
              id="invitation-password"
              name="password"
              required
              type="password"
            />
            {state.fieldError && <FieldError id="invitation-password-error">{state.fieldError}</FieldError>}
          </Field>
          <Button disabled={pending} type="submit" fullWidth>
            {pending ? "Membuka..." : "Buka undangan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
