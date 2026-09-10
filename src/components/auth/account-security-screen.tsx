"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
  FieldHint,
  FieldLabel,
  Input,
  TextLink,
} from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { AccountDeletionSection } from "./account-deletion-section";
import {
  PASSWORD_CHANGE_ERROR_MESSAGE,
  SESSION_REVOCATION_ERROR_MESSAGE,
  authPasswordSchema,
} from "@/modules/auth";

const PASSWORD_CONFIRMATION_ERROR = "Konfirmasi password harus sama.";

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";
type FieldErrors = Partial<Record<PasswordField, string>>;

export function AccountSecurityScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pendingAction, setPendingAction] = useState<"password" | "current" | "all">();

  function clearFeedback() {
    setMessage(undefined);
    setSuccess(undefined);
  }

  function validatePasswordFields(): FieldErrors {
    const errors: FieldErrors = {};
    const currentResult = authPasswordSchema.safeParse(currentPassword);
    const newResult = authPasswordSchema.safeParse(newPassword);

    if (!currentResult.success) errors.currentPassword = currentResult.error.issues[0]?.message;
    if (!newResult.success) errors.newPassword = newResult.error.issues[0]?.message;
    if (newPassword !== confirmPassword) errors.confirmPassword = PASSWORD_CONFIRMATION_ERROR;

    return errors;
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const errors = validatePasswordFields();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPendingAction("password");
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (result.error) {
        setMessage(PASSWORD_CHANGE_ERROR_MESSAGE);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password berhasil diubah. Perangkat lain sudah dikeluarkan.");
    } catch {
      setMessage(PASSWORD_CHANGE_ERROR_MESSAGE);
    } finally {
      setPendingAction(undefined);
    }
  }

  async function logoutCurrentDevice() {
    clearFeedback();
    setPendingAction("current");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setMessage(SESSION_REVOCATION_ERROR_MESSAGE);
        return;
      }
      router.replace("/login?logged-out=1");
    } catch {
      setMessage(SESSION_REVOCATION_ERROR_MESSAGE);
    } finally {
      setPendingAction(undefined);
    }
  }

  async function logoutAllDevices() {
    clearFeedback();
    setPendingAction("all");
    try {
      const result = await authClient.revokeSessions();
      if (result.error) {
        setMessage(SESSION_REVOCATION_ERROR_MESSAGE);
        return;
      }

      // revokeSessions invalidates the server session but intentionally does
      // not clear the current browser cookie. signOut clears that cookie too.
      try {
        await authClient.signOut();
      } catch {
        // The server session is already revoked. The login redirect remains
        // the safe recovery path if cookie cleanup has a transient failure.
      }
      router.replace("/login?logged-out=all");
    } catch {
      setMessage(SESSION_REVOCATION_ERROR_MESSAGE);
    } finally {
      setPendingAction(undefined);
    }
  }

  const busy = pendingAction !== undefined;

  return (
    <main className="auth-page">
      <div className="auth-container security-container">
        <header className="auth-header">
          <TextLink href="/" aria-label="Kembali ke beranda">←</TextLink>
          <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span> Menitihari</span>
        </header>

        <Card>
          <CardHeader>
            <p className="ui-overline">Akun</p>
            <h1 className="ui-card-title auth-title">Keamanan akun</h1>
            <CardDescription>Kelola password dan perangkat yang masih memiliki akses ke akun Anda.</CardDescription>
          </CardHeader>
          <CardContent className="security-content">
            {message && <Alert tone="danger" title="Permintaan belum berhasil">{message}</Alert>}
            {success && <Alert tone="success" title="Perubahan tersimpan">{success}</Alert>}

            <section className="security-section" aria-labelledby="session-security-title">
              <div>
                <h2 id="session-security-title">Sesi perangkat</h2>
                <p>Cabut akses perangkat ini, atau keluarkan semua perangkat sekaligus.</p>
              </div>
              <div className="security-actions">
                <Button disabled={busy} onClick={logoutCurrentDevice} variant="secondary">
                  {pendingAction === "current" ? "Mengeluarkan..." : "Keluar dari perangkat ini"}
                </Button>
                <Button disabled={busy} onClick={logoutAllDevices} variant="danger">
                  {pendingAction === "all" ? "Mengeluarkan semua..." : "Keluar dari semua perangkat"}
                </Button>
              </div>
            </section>

            <form className="security-section security-password-form" noValidate onSubmit={changePassword}>
              <div>
                <h2 id="password-change-title">Ubah password</h2>
                <p>Setelah disimpan, sesi pada perangkat lain akan dicabut.</p>
              </div>
              <Field htmlFor="current-password">
                <FieldLabel required>Password saat ini</FieldLabel>
                <Input
                  aria-describedby={fieldErrors.currentPassword ? "current-password-error" : undefined}
                  aria-invalid={fieldErrors.currentPassword ? "true" : undefined}
                  autoComplete="current-password"
                  id="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
                {fieldErrors.currentPassword && <FieldError id="current-password-error">{fieldErrors.currentPassword}</FieldError>}
              </Field>
              <Field htmlFor="new-password">
                <FieldLabel required>Password baru</FieldLabel>
                <Input
                  aria-describedby={fieldErrors.newPassword ? "new-password-error" : "new-password-hint"}
                  aria-invalid={fieldErrors.newPassword ? "true" : undefined}
                  autoComplete="new-password"
                  id="new-password"
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  type="password"
                  value={newPassword}
                />
                <FieldHint id="new-password-hint">Minimal 8 karakter, maksimal 128 karakter.</FieldHint>
                {fieldErrors.newPassword && <FieldError id="new-password-error">{fieldErrors.newPassword}</FieldError>}
              </Field>
              <Field htmlFor="confirm-password">
                <FieldLabel required>Konfirmasi password baru</FieldLabel>
                <Input
                  aria-describedby={fieldErrors.confirmPassword ? "confirm-password-error" : undefined}
                  aria-invalid={fieldErrors.confirmPassword ? "true" : undefined}
                  autoComplete="new-password"
                  id="confirm-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
                {fieldErrors.confirmPassword && <FieldError id="confirm-password-error">{fieldErrors.confirmPassword}</FieldError>}
              </Field>
              <CardFooter className="security-form-actions">
                <Button disabled={busy} type="submit">
                  {pendingAction === "password" ? "Menyimpan..." : "Ubah password"}
                </Button>
              </CardFooter>
            </form>
            <AccountDeletionSection />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
