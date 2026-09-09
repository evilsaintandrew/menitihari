import { ERROR_CODES, type ErrorCode } from "./codes";
import { toDomainError } from "./mapping";

export interface ErrorReportContext {
  /** Opaque correlation id only; do not pass request payloads here. */
  readonly requestId?: string;
  /** A developer-defined operation name, not a user-provided value. */
  readonly operation?: string;
  /** A provider identifier such as `duitku`, never a provider payload. */
  readonly provider?: string;
}

export interface SafeSentryEvent {
  readonly message: string;
  readonly tags: Readonly<Record<string, string>>;
  readonly fingerprint: readonly string[];
  readonly extra?: Readonly<Record<string, string>>;
}

function safeLabel(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const result = value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80);
  return result || undefined;
}

/**
 * Creates a Sentry-compatible event from only sanitized application data.
 * Raw errors, causes, request values, and provider payloads are intentionally
 * not copied into the returned event.
 */
export function toSentryEvent(
  error: unknown,
  context: ErrorReportContext = {},
): SafeSentryEvent {
  const domainError = toDomainError(error);
  const tags: Record<string, string> = {
    error_code: domainError.code,
    retryable: String(domainError.retryable),
  };
  const extra: Record<string, string> = {};

  const requestId = safeLabel(context.requestId);
  const operation = safeLabel(context.operation);
  const provider = safeLabel(context.provider);

  if (requestId) {
    extra.request_id = requestId;
  }
  if (operation) {
    extra.operation = operation;
  }
  if (provider) {
    tags.provider = provider;
  }

  return {
    message: `Application error: ${domainError.code}`,
    tags,
    fingerprint: ["application-error", domainError.code],
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
  };
}

export type ErrorReporter = (event: SafeSentryEvent) => void | Promise<void>;

export async function reportError(
  reporter: ErrorReporter,
  error: unknown,
  context?: ErrorReportContext,
): Promise<void> {
  await reporter(toSentryEvent(error, context));
}

export { ERROR_CODES };
