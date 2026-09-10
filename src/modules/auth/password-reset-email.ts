import { ProviderError } from "@/modules/errors/mapping";
import type { EmailService } from "@/providers";

export interface PasswordResetEmailInput {
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

/** Adapts Better Auth's reset payload to the application EmailService. */
export function createPasswordResetEmailSender(
  emailService: EmailService,
  from: string | undefined,
) {
  return async ({ user, url }: PasswordResetEmailInput): Promise<void> => {
    if (!from) {
      throw new ProviderError({ kind: "UNAVAILABLE", provider: "resend" });
    }

    const escapedUrl = escapeHtml(url);
    await emailService.send({
      from,
      to: [user.email],
      subject: "Reset password Menitihari",
      text: `Gunakan tautan berikut untuk membuat password baru di Menitihari:\n${url}\n\nJika Anda tidak meminta reset password, abaikan email ini.`,
      html: `<p>Gunakan tautan berikut untuk membuat password baru di Menitihari.</p><p><a href="${escapedUrl}">Reset password</a></p><p>Jika Anda tidak meminta reset password, abaikan email ini.</p>`,
    });
  };
}
