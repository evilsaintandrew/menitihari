import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import {
  DomainError,
  ERROR_CODES,
  ProviderError,
  err,
  mapProviderError,
  mapValidationError,
  ok,
  reportError,
  toPublicError,
  toSentryEvent,
} from "../../src/modules/errors";

describe("Result", () => {
  it("represents a successful value", () => {
    expect(ok({ id: "invitation-1" })).toEqual({
      ok: true,
      value: { id: "invitation-1" },
    });
  });

  it("represents an expected failure without throwing", () => {
    const error = new DomainError(ERROR_CODES.NOT_FOUND);

    expect(err(error)).toEqual({ ok: false, error });
  });
});

describe("error mapping", () => {
  it("maps Zod issues to safe field details without including input values", () => {
    const input = "secret-value-that-must-not-leak";
    const schema = z.object({ email: z.string().min(100) });
    const result = schema.safeParse({ email: input });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    const error = mapValidationError(result.error);
    expect(error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(error.details).toEqual({ email: ["Invalid value"] });
    expect(JSON.stringify(error)).not.toContain(input);
    expect(error.message).not.toContain(input);
  });

  it.each([
    ["PENDING", ERROR_CODES.PAYMENT_PENDING],
    ["NOT_CONFIRMED", ERROR_CODES.PAYMENT_NOT_CONFIRMED],
    ["RATE_LIMITED", ERROR_CODES.RATE_LIMITED],
    ["TIMEOUT", ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE],
    ["UNAVAILABLE", ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE],
    ["UNKNOWN", ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE],
    ["INVALID_REQUEST", ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE],
  ] as const)("maps provider kind %s to %s", (kind, code) => {
    expect(mapProviderError(new ProviderError({ kind, provider: "duitku" })).code).toBe(code);
  });

  it("maps raw provider failures without exposing their message", () => {
    const secret = "api-key=super-secret";
    const error = toPublicError(new Error(secret));

    expect(error).toMatchObject({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Something went wrong. Please try again.",
    });
    expect(JSON.stringify(error)).not.toContain(secret);
  });
});

describe("Sentry-safe reporting", () => {
  it("emits only stable, allowlisted fields", () => {
    const event = toSentryEvent(new Error("Bearer super-secret-token"), {
      requestId: "req/123",
      operation: "payment.webhook",
      provider: "duitku",
    });

    expect(event).toEqual({
      message: "Application error: INTERNAL_ERROR",
      tags: {
        error_code: ERROR_CODES.INTERNAL_ERROR,
        retryable: "false",
        provider: "duitku",
      },
      fingerprint: ["application-error", ERROR_CODES.INTERNAL_ERROR],
      extra: {
        request_id: "req_123",
        operation: "payment.webhook",
      },
    });
    expect(JSON.stringify(event)).not.toContain("super-secret-token");
  });

  it("passes the safe event to an injected reporter", async () => {
    const reporter = vi.fn();

    await reportError(reporter, new DomainError(ERROR_CODES.FORBIDDEN));

    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Application error: FORBIDDEN",
      }),
    );
  });
});
