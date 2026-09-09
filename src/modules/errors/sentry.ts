import * as Sentry from "@sentry/nextjs";

import { sanitizeSentryEvent } from "./sentry-sanitizer";
import {
  toSentryEvent,
  type ErrorReportContext,
  type SafeSentryEvent,
} from "./reporting";

export function createSentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
  };
}

/** Capture only the sanitized application event produced by FOUND-003. */
export async function captureSanitizedError(
  error: unknown,
  context?: ErrorReportContext,
): Promise<void> {
  captureSentryEvent(toSentryEvent(error, context));
  await Sentry.flush(2_000);
}

export function captureSentryEvent(event: SafeSentryEvent): void {
  Sentry.captureEvent({
    message: event.message,
    tags: { ...event.tags },
    fingerprint: [...event.fingerprint],
    ...(event.extra ? { extra: { ...event.extra } } : {}),
  });
}

export { sanitizeSentryEvent } from "./sentry-sanitizer";
