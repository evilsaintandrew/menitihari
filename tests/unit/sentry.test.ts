import { describe, expect, it } from "vitest";

import {
  createSentryOptions,
  sanitizeSentryEvent,
} from "../../src/modules/errors";

describe("Sentry integration", () => {
  it("keeps only allowlisted application context", () => {
    const event = sanitizeSentryEvent({
      message: "database password=super-secret",
      exception: { values: [{ value: "raw stack and PII" }] },
      request: { url: "https://example.test/g/raw-activation-token" },
      breadcrumbs: [{ message: "guest@example.com" }],
      tags: {
        error_code: "EXTERNAL_SERVICE_UNAVAILABLE",
        retryable: "true",
        provider: "duitku",
        email: "guest@example.com",
      },
      extra: {
        request_id: "req-123",
        operation: "payment.webhook",
        token: "raw-token",
      },
    });

    expect(event).toEqual({
      message: "Application error: EXTERNAL_SERVICE_UNAVAILABLE",
      tags: {
        error_code: "EXTERNAL_SERVICE_UNAVAILABLE",
        retryable: "true",
        provider: "duitku",
      },
      fingerprint: ["application-error", "EXTERNAL_SERVICE_UNAVAILABLE"],
      extra: { request_id: "req-123", operation: "payment.webhook" },
    });
    expect(JSON.stringify(event)).not.toMatch(/super-secret|guest@example.com|raw-token/);
  });

  it("maps untrusted or uncategorized events to the safe internal error", () => {
    expect(sanitizeSentryEvent({ message: "secret" })).toEqual({
      message: "Application error: INTERNAL_ERROR",
      tags: { error_code: "INTERNAL_ERROR", retryable: "false" },
      fingerprint: ["application-error", "INTERNAL_ERROR"],
    });
  });

  it("disables sending when no DSN is configured", () => {
    expect(createSentryOptions(undefined)).toMatchObject({
      dsn: undefined,
      enabled: false,
      sendDefaultPii: false,
    });
  });
});
