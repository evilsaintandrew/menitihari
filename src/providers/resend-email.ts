import { ProviderError } from "@/modules/errors/mapping";

import type {
  EmailMessage,
  EmailService,
  EmailSendResult,
  SignedWebhookInput,
} from "./contracts";

export interface ResendEmailServiceOptions {
  readonly apiKey: string | undefined;
  readonly fetchImplementation?: typeof fetch;
  readonly endpoint?: string;
}

function providerFailureKind(status: number): "INVALID_REQUEST" | "RATE_LIMITED" | "UNAVAILABLE" {
  if (status === 429) return "RATE_LIMITED";
  if (status === 408 || status >= 500) return "UNAVAILABLE";
  return "INVALID_REQUEST";
}

function providerMessageId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const id = (payload as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/**
 * Resend's SDK response is normalized at this boundary. The auth domain only
 * receives the provider message id and accepted timestamp.
 */
export function createResendEmailService(options: ResendEmailServiceOptions): EmailService {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const endpoint = options.endpoint ?? "https://api.resend.com/emails";

  return {
    async send(message: EmailMessage): Promise<EmailSendResult> {
      if (!options.apiKey) {
        throw new ProviderError({ kind: "UNAVAILABLE", provider: "resend" });
      }

      let response: Response;
      try {
        response = await fetchImplementation(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: message.from,
            to: [...message.to],
            subject: message.subject,
            ...(message.text ? { text: message.text } : {}),
            ...(message.html ? { html: message.html } : {}),
            ...(message.headers ? { headers: message.headers } : {}),
          }),
        });
      } catch {
        throw new ProviderError({ kind: "UNAVAILABLE", provider: "resend" });
      }

      if (!response.ok) {
        throw new ProviderError({
          kind: providerFailureKind(response.status),
          provider: "resend",
        });
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ProviderError({ kind: "UNAVAILABLE", provider: "resend" });
      }

      const id = providerMessageId(payload);
      if (!id) {
        throw new ProviderError({ kind: "UNAVAILABLE", provider: "resend" });
      }

      return {
        providerMessageId: id,
        status: "ACCEPTED",
        acceptedAt: new Date(),
      };
    },

    async verifyWebhook(_input: SignedWebhookInput) {
      throw new ProviderError({ kind: "INVALID_REQUEST", provider: "resend" });
    },
  };
}
