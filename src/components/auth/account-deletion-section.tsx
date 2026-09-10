"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  Alert,
  BottomSheet,
  Button,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  Input,
} from "@/components/ui";

type DeletionState = "ACTIVE" | "DELETION_COOLING_OFF";

interface DeletionStatusResponse {
  readonly state?: unknown;
  readonly cancellableUntil?: unknown;
}

function isCoolingOffStatus(value: DeletionStatusResponse): value is { state: "DELETION_COOLING_OFF"; cancellableUntil: string } {
  return value.state === "DELETION_COOLING_OFF" && typeof value.cancellableUntil === "string";
}

function formatDeadline(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function AccountDeletionSection() {
  const [state, setState] = useState<DeletionState>("ACTIVE");
  const [cancellableUntil, setCancellableUntil] = useState<string>();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmationError, setConfirmationError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState<"schedule" | "cancel">();

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/account/deletion", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const value = (await response.json()) as DeletionStatusResponse;
        if (cancelled || value.state !== "DELETION_COOLING_OFF") return;
        if (isCoolingOffStatus(value)) {
          setState(value.state);
          setCancellableUntil(value.cancellableUntil);
        }
      })
      .catch(() => {
        // The destructive controls remain available; the server is authoritative.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setPassword("");
    setConfirmation("");
    setConfirmationError(undefined);
  }

  function closeDialog() {
    if (pending) return;
    setOpen(false);
    resetForm();
  }

  async function scheduleDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    if (confirmation !== "HAPUS AKUN") {
      setConfirmationError("Ketik HAPUS AKUN untuk melanjutkan.");
      return;
    }
    setConfirmationError(undefined);
    setPending("schedule");

    try {
      const response = await fetch("/api/account/deletion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const value = (await response.json().catch(() => undefined)) as DeletionStatusResponse | undefined;
      if (!response.ok || !value || !isCoolingOffStatus(value)) {
        setMessage(response.status === 403 ? "Password saat ini tidak benar." : "Penghapusan akun belum dapat dijadwalkan. Coba lagi.");
        return;
      }

      setState(value.state);
      setCancellableUntil(value.cancellableUntil);
      setOpen(false);
      resetForm();
      setMessage(undefined);
    } catch {
      setMessage("Penghapusan akun belum dapat dijadwalkan. Coba lagi.");
    } finally {
      setPending(undefined);
    }
  }

  async function cancelDeletion() {
    if (pending) return;
    setMessage(undefined);
    setPending("cancel");
    try {
      const response = await fetch("/api/account/deletion", { method: "DELETE" });
      const value = (await response.json().catch(() => undefined)) as DeletionStatusResponse | undefined;
      if (!response.ok || !value || value.state !== "ACTIVE") {
        setMessage("Penghapusan akun belum dapat dibatalkan. Coba lagi.");
        return;
      }
      setState("ACTIVE");
      setCancellableUntil(undefined);
      setMessage("Penghapusan akun dibatalkan. Undangan tidak dipublish ulang otomatis.");
    } catch {
      setMessage("Penghapusan akun belum dapat dibatalkan. Coba lagi.");
    } finally {
      setPending(undefined);
    }
  }

  if (state === "DELETION_COOLING_OFF" && cancellableUntil) {
    return (
      <section aria-labelledby="account-deletion-title" className="security-section security-deletion-section">
        <div>
          <h2 id="account-deletion-title">Penghapusan akun dijadwalkan</h2>
          <p>Semua undangan publik sedang offline.</p>
        </div>
        <Alert tone="warning">Dapat dibatalkan sampai: <time dateTime={cancellableUntil}>{formatDeadline(cancellableUntil)} WIB</time>.</Alert>
        {message && <Alert tone="success">{message}</Alert>}
        <Button disabled={pending !== undefined} onClick={cancelDeletion} variant="secondary">
          {pending === "cancel" ? "Membatalkan..." : "Batalkan Penghapusan Akun"}
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="account-deletion-title" className="security-section security-deletion-section">
      <div>
        <h2 id="account-deletion-title">Hapus akun</h2>
        <p>Ini memengaruhi semua undangan milik Anda. Semua undangan publik akan langsung offline.</p>
      </div>
      {message && <Alert tone="success">{message}</Alert>}
      <Button disabled={pending !== undefined} onClick={() => setOpen(true)} variant="danger">
        Jadwalkan Hapus Akun
      </Button>
      <BottomSheet
        description="Penghapusan masuk masa pembatalan. Setelah batas waktu berakhir, data akan diproses sesuai kebijakan retensi. Refund tidak otomatis diberikan."
        onClose={closeDialog}
        open={open}
        title="Konfirmasi Hapus Akun"
      >
        <form className="security-deletion-form" noValidate onSubmit={scheduleDeletion}>
          <Field htmlFor="deletion-password">
            <FieldLabel required>Password saat ini</FieldLabel>
            <Input autoComplete="current-password" id="deletion-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </Field>
          <Field htmlFor="deletion-confirmation">
            <FieldLabel required>Ketik HAPUS AKUN</FieldLabel>
            <Input
              aria-describedby={confirmationError ? "deletion-confirmation-error" : "deletion-confirmation-hint"}
              aria-invalid={confirmationError ? "true" : undefined}
              autoComplete="off"
              id="deletion-confirmation"
              onChange={(event) => setConfirmation(event.target.value)}
              required
              value={confirmation}
            />
            <FieldHint id="deletion-confirmation-hint">Tindakan ini memengaruhi seluruh akun dan tidak memberikan refund otomatis.</FieldHint>
            {confirmationError && <FieldError id="deletion-confirmation-error">{confirmationError}</FieldError>}
          </Field>
          <div className="security-deletion-actions">
            <Button disabled={pending !== undefined} type="submit" variant="danger">
              {pending === "schedule" ? "Menjadwalkan..." : "Jadwalkan Hapus Akun"}
            </Button>
            <Button disabled={pending !== undefined} onClick={closeDialog} type="button" variant="ghost">Batal</Button>
          </div>
        </form>
      </BottomSheet>
    </section>
  );
}
