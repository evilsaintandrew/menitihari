"use client";

import { useState, type FormEvent } from "react";

import {
  Alert,
  Button,
  CardContent,
  CardFooter,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  Input,
  TextLink,
} from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import {
  AUTH_RATE_LIMIT_MESSAGE,
  displayNameFromEmail,
  LOGIN_GENERIC_ERROR_MESSAGE,
  SIGNUP_GENERIC_ERROR_MESSAGE,
  validateAuthCredentials,
  type AuthFieldErrors,
} from "@/modules/auth";

type AuthMode = "login" | "signup";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setSuccess(false);

    const validation = validateAuthCredentials({ email, password });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setPending(true);

    try {
      const result = isSignup
        ? await authClient.signUp.email({
            email: validation.data.email,
            name: displayNameFromEmail(validation.data.email),
            password: validation.data.password,
          })
        : await authClient.signIn.email({
            email: validation.data.email,
            password: validation.data.password,
            rememberMe: true,
          });

      if (result.error) {
        setMessage(
          result.error.status === 429
            ? AUTH_RATE_LIMIT_MESSAGE
            : isSignup
              ? SIGNUP_GENERIC_ERROR_MESSAGE
              : LOGIN_GENERIC_ERROR_MESSAGE,
        );
        return;
      }

      setSuccess(true);
    } catch {
      setMessage(isSignup ? SIGNUP_GENERIC_ERROR_MESSAGE : LOGIN_GENERIC_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      {message && <Alert tone="danger" title="Permintaan belum berhasil">{message}</Alert>}
      {success && (
        <Alert tone="success" title={isSignup ? "Akun berhasil dibuat" : "Berhasil masuk"}>
          Sesi aman Anda sudah aktif di perangkat ini.
        </Alert>
      )}

      <Field htmlFor="auth-email">
        <FieldLabel required>Email</FieldLabel>
        <Input
          aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
          aria-invalid={fieldErrors.email ? "true" : undefined}
          autoComplete="email"
          id="auth-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nama@email.com"
          required
          type="email"
          value={email}
        />
        {fieldErrors.email && <FieldError id="auth-email-error">{fieldErrors.email}</FieldError>}
      </Field>

      <Field htmlFor="auth-password">
        <FieldLabel required>Password</FieldLabel>
        <Input
          aria-describedby={fieldErrors.password ? "auth-password-error" : "auth-password-hint"}
          aria-invalid={fieldErrors.password ? "true" : undefined}
          autoComplete={isSignup ? "new-password" : "current-password"}
          id="auth-password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <FieldHint id="auth-password-hint">Minimal 8 karakter, maksimal 128 karakter.</FieldHint>
        {fieldErrors.password && <FieldError id="auth-password-error">{fieldErrors.password}</FieldError>}
      </Field>

      <CardFooter className="auth-form-actions">
        <Button disabled={pending} fullWidth type="submit">
          {pending ? "Memproses..." : isSignup ? "Buat Akun" : "Masuk"}
        </Button>
      </CardFooter>
    </form>
  );
}

export function AuthFooter({ mode }: { mode: AuthMode }) {
  return (
    <CardContent className="auth-form-footer">
      {mode === "signup" ? (
        <p>Sudah punya akun? <TextLink href="/login">Masuk</TextLink></p>
      ) : (
        <p>Belum punya akun? <TextLink href="/signup">Buat akun</TextLink></p>
      )}
      {mode === "signup" && <p>Dengan melanjutkan, Anda menyetujui Terms dan Privacy.</p>}
    </CardContent>
  );
}
