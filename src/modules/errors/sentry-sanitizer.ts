import { ERROR_CODES, type ErrorCode } from "./codes";
import type { SafeSentryEvent } from "./reporting";

const SAFE_EXTRA_KEYS = new Set(["request_id", "operation"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.values(ERROR_CODES).includes(value as ErrorCode);
}

function safeLabel(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const label = value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80);
  return label || undefined;
}

/**
 * Keeps only the application error contract before an event reaches Sentry.
 * This is intentionally lossy: raw exception messages, URLs, breadcrumbs,
 * request headers, user data, and arbitrary SDK context must not be shipped.
 */
export function sanitizeSentryEvent(event: unknown): SafeSentryEvent {
  const source = isRecord(event) ? event : {};
  const sourceTags = isRecord(source.tags) ? source.tags : {};
  const code = isErrorCode(sourceTags.error_code)
    ? sourceTags.error_code
    : ERROR_CODES.INTERNAL_ERROR;
  const extra: Record<string, string> = {};

  if (isRecord(source.extra)) {
    for (const key of SAFE_EXTRA_KEYS) {
      const value = safeLabel(source.extra[key]);
      if (value) {
        extra[key] = value;
      }
    }
  }

  return {
    message: `Application error: ${code}`,
    tags: {
      error_code: code,
      retryable: sourceTags.retryable === "true" ? "true" : "false",
      ...(safeLabel(sourceTags.provider)
        ? { provider: safeLabel(sourceTags.provider) as string }
        : {}),
    },
    fingerprint: ["application-error", code],
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
  };
}
