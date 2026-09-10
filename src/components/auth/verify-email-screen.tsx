"use client";

import { useEffect, useMemo, useState } from "react";

import { Alert, Button, Card, CardContent, CardHeader, CardTitle, TextLink } from "@/components/ui";
import {
  AUTH_RATE_LIMIT_MESSAGE,
  authEmailSchema,
} from "@/modules/auth";
import {
  authClient,
  PENDING_VERIFICATION_EMAIL_KEY,
  VERIFICATION_CALLBACK_URL,
} from "@/lib/auth-client";

type VerificationState = "waiting" | "verified" | "expired" | "invalid";

const RESEND_COOLDOWN_SECONDS = 60;

export function maskVerificationEmail(email: string | null | undefined): string | undefined {
  const result = authEmailSchema.safeParse(email);
  if (!result.success) return undefined;

  const [localPart, domain] = result.data.split("@");
  return `${localPart.slice(0, 1)}••••@${domain}`;
}

function readVerificationState(): VerificationState {
  if (typeof window === "undefined") return "waiting";

  const params = new URLSearchParams(window.location.search);
  if (params.get("verified") === "1") return "verified";
  if (params.get("error") === "TOKEN_EXPIRED") return "expired";
  if (params.has("error")) return "invalid";
  return "waiting";
}

export function VerifyEmailScreen() {
  const [email, setEmail] = useState<string>();
  const [state, setState] = useState<VerificationState>("waiting");
  const [cooldown, setCooldown] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  const maskedEmail = useMemo(() => maskVerificationEmail(email), [email]);

  useEffect(() => {
    let cancelled = false;
    let refreshInterval: number | undefined;
    const initialize = window.setTimeout(() => {
      const storedEmail = window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
      setEmail(authEmailSchema.safeParse(storedEmail).success ? storedEmail ?? undefined : undefined);
      const initialState = readVerificationState();
      setState(initialState);
      if (new URLSearchParams(window.location.search).get("sent") === "1") {
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }

      if (initialState === "waiting") {
        const refreshVerificationState = async () => {
          try {
            const result = await authClient.getSession();
            if (!cancelled && result.data?.user.emailVerified) {
              setState("verified");
            }
          } catch {
            // A transient session read failure leaves the resend path available.
          }
        };

        void refreshVerificationState();
        refreshInterval = window.setInterval(refreshVerificationState, 3_000);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(initialize);
      if (refreshInterval !== undefined) {
        window.clearInterval(refreshInterval);
      }
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [cooldown]);

  async function resendVerificationEmail() {
    if (!email || cooldown > 0 || pending) return;

    setMessage(undefined);
    setPending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: VERIFICATION_CALLBACK_URL,
      });
      if (result.error) {
        setMessage(result.error.status === 429 ? AUTH_RATE_LIMIT_MESSAGE : "Email verifikasi belum dapat dikirim. Coba lagi nanti.");
        return;
      }

      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage("Email verifikasi dikirim ulang. Periksa kotak masuk Anda.");
    } catch {
      setMessage("Email verifikasi belum dapat dikirim. Coba lagi nanti.");
    } finally {
      setPending(false);
    }
  }

  if (state === "verified") {
    return (
      <VerifyEmailLayout>
        <div className="verify-email-icon verify-email-icon-verified" aria-hidden="true">✓</div>
        <CardHeader>
          <p className="ui-overline">Akun Anda siap digunakan</p>
          <CardTitle className="auth-title">Email terverifikasi</CardTitle>
          <p className="ui-card-description">Terima kasih. Sekarang Anda dapat mulai membuat undangan pertama.</p>
        </CardHeader>
        <CardContent className="verify-email-content">
          <TextLink className="ui-button ui-button-primary ui-button-lg w-full" href="/invitations/new">
            Lanjut buat undangan
          </TextLink>
        </CardContent>
      </VerifyEmailLayout>
    );
  }

  const isExpired = state === "expired";
  return (
    <VerifyEmailLayout>
      <div className="verify-email-icon" aria-hidden="true">✉</div>
      <CardHeader>
        <p className="ui-overline">Satu langkah lagi</p>
        <CardTitle className="auth-title">{isExpired ? "Tautan kedaluwarsa" : "Verifikasi email Anda"}</CardTitle>
        <p className="ui-card-description">
          {isExpired
            ? "Tautan verifikasi ini sudah tidak berlaku. Kirim ulang email untuk mendapatkan tautan baru."
            : state === "invalid"
              ? "Tautan verifikasi tidak valid. Kirim ulang email untuk mendapatkan tautan baru."
              : maskedEmail
                ? <>Kami mengirim tautan verifikasi ke <strong>{maskedEmail}</strong>.</>
                : "Kami mengirim tautan verifikasi ke alamat email Anda."}
        </p>
      </CardHeader>
      <CardContent className="verify-email-content">
        {message && <Alert tone={message.startsWith("Email verifikasi dikirim") ? "success" : "danger"}>{message}</Alert>}
        {maskedEmail && (
          <TextLink className="ui-button ui-button-secondary ui-button-lg w-full" href={`mailto:${encodeURIComponent(email ?? "")}`}>
            Buka Email Saya
          </TextLink>
        )}
        <Button
          disabled={!email || cooldown > 0 || pending}
          fullWidth
          onClick={resendVerificationEmail}
          size="lg"
          type="button"
          variant={maskedEmail ? "ghost" : "primary"}
        >
          {pending
            ? "Mengirim..."
            : cooldown > 0
              ? `Kirim ulang (${String(cooldown).padStart(2, "0")})`
              : "Kirim ulang email"}
        </Button>
        <p className="verify-email-help">Belum menerima? Periksa folder spam atau coba lagi setelah beberapa saat.</p>
        <TextLink href="/signup">Gunakan email lain</TextLink>
      </CardContent>
    </VerifyEmailLayout>
  );
}

function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-container">
        <header className="auth-header">
          <TextLink href="/" aria-label="Kembali ke beranda">←</TextLink>
          <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span> Menitihari</span>
        </header>
        <Card className="auth-card verify-email-card">{children}</Card>
      </div>
    </main>
  );
}
