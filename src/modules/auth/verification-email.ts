import { ProviderError } from "@/modules/errors/mapping";
import type { EmailService } from "@/providers";

export interface VerificationEmailInput {
  readonly user: { readonly email: string };
  readonly url: string;
  readonly token: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Adapts Better Auth's verification payload to the application EmailService. */
export function createVerificationEmailSender(
  emailService: EmailService,
  from: string | undefined,
) {
  return async ({ user, url }: VerificationEmailInput): Promise<void> => {
    if (!from) {
      throw new ProviderError({ kind: "UNAVAILABLE", provider: "resend" });
    }

    const escapedUrl = escapeHtml(url);
    await emailService.send({
      from,
      to: [user.email],
      subject: "Verifikasi email Menitihari",
      text: `Verifikasi email Anda untuk melanjutkan menggunakan Menitihari:\n${url}\n\nJika Anda tidak membuat akun, abaikan email ini.`,
      html: `<p>Verifikasi email Anda untuk melanjutkan menggunakan Menitihari.</p><p><a href="${escapedUrl}">Verifikasi email</a></p><p>Jika Anda tidak membuat akun, abaikan email ini.</p>`,
    });
  };
}
