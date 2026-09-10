"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  Field,
  FieldError,
  FieldLabel,
  Input,
  TextLink,
} from "@/components/ui";
import {
  createInvitationAction,
  initialCreateInvitationActionState,
} from "@/app/invitations/new/actions";

export function NewInvitationForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createInvitationAction,
    initialCreateInvitationActionState,
  );

  useEffect(() => {
    if (state.ok && state.invitationId) {
      router.replace(`/invitations/${state.invitationId}/themes`);
    }
  }, [router, state.invitationId, state.ok]);

  return (
    <form action={action} className="invitation-create-form" noValidate>
      {state.formError && (
        <Alert tone="danger" title="Undangan belum dibuat">
          {state.formError}
        </Alert>
      )}

      <Field htmlFor="couple-display-name-1">
        <FieldLabel required>Nama tampilan pasangan 1</FieldLabel>
        <Input
          aria-describedby={state.fieldErrors?.coupleDisplayName1 ? "couple-display-name-1-error" : undefined}
          aria-invalid={state.fieldErrors?.coupleDisplayName1 ? "true" : undefined}
          autoComplete="name"
          id="couple-display-name-1"
          name="coupleDisplayName1"
          placeholder="Alya"
          required
        />
        {state.fieldErrors?.coupleDisplayName1 && (
          <FieldError id="couple-display-name-1-error">{state.fieldErrors.coupleDisplayName1}</FieldError>
        )}
      </Field>

      <Field htmlFor="couple-display-name-2">
        <FieldLabel required>Nama tampilan pasangan 2</FieldLabel>
        <Input
          aria-describedby={state.fieldErrors?.coupleDisplayName2 ? "couple-display-name-2-error" : undefined}
          aria-invalid={state.fieldErrors?.coupleDisplayName2 ? "true" : undefined}
          autoComplete="name"
          id="couple-display-name-2"
          name="coupleDisplayName2"
          placeholder="Bima"
          required
        />
        {state.fieldErrors?.coupleDisplayName2 && (
          <FieldError id="couple-display-name-2-error">{state.fieldErrors.coupleDisplayName2}</FieldError>
        )}
      </Field>

      <Field htmlFor="main-event-date">
        <FieldLabel required>Tanggal acara utama</FieldLabel>
        <Input
          aria-describedby={state.fieldErrors?.mainEventDate ? "main-event-date-error" : undefined}
          aria-invalid={state.fieldErrors?.mainEventDate ? "true" : undefined}
          id="main-event-date"
          name="mainEventDate"
          required
          type="date"
        />
        {state.fieldErrors?.mainEventDate && (
          <FieldError id="main-event-date-error">{state.fieldErrors.mainEventDate}</FieldError>
        )}
      </Field>

      <div className="ui-alert ui-alert-info" role="note">
        <span aria-hidden="true" className="ui-alert-mark">i</span>
        <div>
          <p className="ui-alert-title">Trial 3 hari dimulai saat undangan dibuat.</p>
          <p className="ui-alert-content">Harga Launch Rp79.000 untuk aktivasi 1 tahun setelah pembayaran berhasil.</p>
        </div>
      </div>

      <CardFooter className="invitation-create-actions">
        <Button disabled={pending} fullWidth size="lg" type="submit">
          {pending ? "Membuat undangan..." : "Buat Undangan & Mulai Trial"}
        </Button>
        <TextLink href="/">Kembali</TextLink>
      </CardFooter>
    </form>
  );
}

export function NewInvitationCard() {
  return (
    <Card className="invitation-create-card">
      <CardHeader>
        <p className="ui-overline">Undangan baru</p>
        <h1 className="auth-title">Mulai dari yang penting</h1>
        <CardDescription>Detail lain bisa diubah nanti.</CardDescription>
      </CardHeader>
      <CardContent>
        <NewInvitationForm />
      </CardContent>
    </Card>
  );
}
