"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  Input,
  TextLink,
} from "@/components/ui";
import {
  AUTH_GENERIC_ERROR_MESSAGE,
  AUTH_RATE_LIMIT_MESSAGE,
  PASSWORD_RESET_GENERIC_MESSAGE,
  authEmailSchema,
  authPasswordSchema,
} from "@/modules/auth";
import { authClient, PASSWORD_RESET_CALLBACK_URL } from "@/lib/auth-client";

type ResetView = "loading" | "form" | "invalid" | "success";

export function PasswordResetRequestScreen() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setSuccess(false);

    const validation = authEmailSchema.safeParse(email);
    if (!validation.success) {
      setEmailError(validation.error.issues[0]?.message ?? "Masukkan email yang valid.");
      return;
    }

    setEmailError(undefined);
    setPending(true);
    try {
      const response = await authClient.requestPasswordReset({
        email: validation.data,
        redirectTo: PASSWORD_RESET_CALLBACK_URL,
      });
      if (response.error) {
        setMessage(response.error.status === 429 ? AUTH_RATE_LIMIT_MESSAGE : AUTH_GENERIC_ERROR_MESSAGE);
        return;
      }
      setSuccess(true);
    } catch {
      setMessage(AUTH_GENERIC_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <CardHeader>
        <p className="ui-overline">Akses akun</p>
        <CardTitle className="auth-title">Lupa password?</CardTitle>
        <p className="ui-card-description">Masukkan email akun Anda dan kami akan mengirim tautan untuk membuat password baru.</p>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="verify-email-content">
            <Alert tone="success" title="Periksa email Anda">{PASSWORD_RESET_GENERIC_MESSAGE}</Alert>
            <p className="verify-email-help">Jika email tidak masuk, periksa folder spam atau coba lagi setelah beberapa saat.</p>
            <TextLink className="ui-button ui-button-secondary ui-button-lg w-full" href="/login">Kembali ke masuk</TextLink>
          </div>
        ) : (
          <form className="auth-form" noValidate onSubmit={submit}>
            {message && <Alert tone="danger" title="Permintaan belum berhasil">{message}</Alert>}
            <Field htmlFor="reset-request-email">
              <FieldLabel required>Email</FieldLabel>
              <Input
                aria-describedby={emailError ? "reset-request-email-error" : undefined}
                aria-invalid={emailError ? "true" : undefined}
                autoComplete="email"
                id="reset-request-email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@email.com"
                required
                type="email"
                value={email}
              />
              {emailError && <FieldError id="reset-request-email-error">{emailError}</FieldError>}
            </Field>
            <FieldHint>Respons selalu sama demi menjaga keamanan akun.</FieldHint>
            <Button disabled={pending} fullWidth size="lg" type="submit">
              {pending ? "Mengirim..." : "Kirim tautan reset"}
            </Button>
            <TextLink className="ui-button ui-button-ghost ui-button-lg w-full" href="/login">Kembali ke masuk</TextLink>
          </form>
        )}
      </CardContent>
    </AuthLayout>
  );
}

export function PasswordResetScreen() {
  const [view, setView] = useState<ResetView>("loading");
  const [token, setToken] = useState<string>();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string>();
  const [confirmationError, setConfirmationError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const receivedToken = params.get("token");
      setToken(receivedToken ?? undefined);
      setView(receivedToken && !params.has("error") ? "form" : "invalid");
    }, 0);

    return () => window.clearTimeout(initialize);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setPasswordError(undefined);
    setConfirmationError(undefined);

    const validation = authPasswordSchema.safeParse(password);
    let invalid = false;
    if (!validation.success) {
      setPasswordError(validation.error.issues[0]?.message ?? "Masukkan password.");
      invalid = true;
    }
    if (password !== confirmation) {
      setConfirmationError("Password belum sama.");
      invalid = true;
    }
    if (invalid || !token) return;

    setPending(true);
    try {
      const response = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (response.error) {
        setMessage(response.error.status === 429 ? AUTH_RATE_LIMIT_MESSAGE : "Tautan reset sudah tidak valid atau kedaluwarsa.");
        return;
      }
      setView("success");
    } catch {
      setMessage(AUTH_GENERIC_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  if (view === "loading") {
    return <AuthLayout><CardContent><p role="status">Memeriksa tautan reset...</p></CardContent></AuthLayout>;
  }

  if (view === "success") {
    return (
      <AuthLayout>
        <CardHeader>
          <p className="ui-overline">Password diperbarui</p>
          <CardTitle className="auth-title">Berhasil reset password</CardTitle>
          <p className="ui-card-description">Password baru Anda sudah aktif. Sesi di perangkat lain telah dikeluarkan demi keamanan.</p>
        </CardHeader>
        <CardContent className="verify-email-content">
          <TextLink className="ui-button ui-button-primary ui-button-lg w-full" href="/login">Masuk dengan password baru</TextLink>
        </CardContent>
      </AuthLayout>
    );
  }

  if (view === "invalid") {
    return (
      <AuthLayout>
        <CardHeader>
          <p className="ui-overline">Tautan reset</p>
          <CardTitle className="auth-title">Tautan kedaluwarsa</CardTitle>
          <p className="ui-card-description">Tautan reset password tidak valid atau sudah tidak berlaku. Minta tautan baru untuk melanjutkan.</p>
        </CardHeader>
        <CardContent className="verify-email-content">
          <TextLink className="ui-button ui-button-primary ui-button-lg w-full" href="/forgot-password">Minta tautan baru</TextLink>
          <TextLink href="/login">Kembali ke masuk</TextLink>
        </CardContent>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <CardHeader>
        <p className="ui-overline">Akses akun</p>
        <CardTitle className="auth-title">Buat password baru</CardTitle>
        <p className="ui-card-description">Gunakan minimal 8 karakter. Password lama tidak dapat digunakan setelah reset.</p>
      </CardHeader>
      <CardContent>
        <form className="auth-form" noValidate onSubmit={submit}>
          {message && <Alert tone="danger" title="Password belum diperbarui">{message}</Alert>}
          <Field htmlFor="reset-password">
            <FieldLabel required>Password baru</FieldLabel>
            <Input
              aria-describedby={passwordError ? "reset-password-error" : "reset-password-hint"}
              aria-invalid={passwordError ? "true" : undefined}
              autoComplete="new-password"
              id="reset-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <FieldHint id="reset-password-hint">Minimal 8 karakter, maksimal 128 karakter.</FieldHint>
            {passwordError && <FieldError id="reset-password-error">{passwordError}</FieldError>}
          </Field>
          <Field htmlFor="reset-password-confirmation">
            <FieldLabel required>Ulangi password baru</FieldLabel>
            <Input
              aria-describedby={confirmationError ? "reset-password-confirmation-error" : undefined}
              aria-invalid={confirmationError ? "true" : undefined}
              autoComplete="new-password"
              id="reset-password-confirmation"
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type="password"
              value={confirmation}
            />
            {confirmationError && <FieldError id="reset-password-confirmation-error">{confirmationError}</FieldError>}
          </Field>
          <Button disabled={pending} fullWidth size="lg" type="submit">
            {pending ? "Menyimpan..." : "Simpan password baru"}
          </Button>
        </form>
      </CardContent>
    </AuthLayout>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-container">
        <header className="auth-header">
          <TextLink href="/" aria-label="Kembali ke beranda">←</TextLink>
          <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span> Menitihari</span>
        </header>
        <Card className="auth-card">{children}</Card>
      </div>
    </main>
  );
}
