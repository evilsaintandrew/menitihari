import { describe, expect, it } from "vitest";

import { parseEnv } from "../../src/config/env-schema";

describe("parseEnv", () => {
  it("parses the required application and database URLs and defaults NODE_ENV", () => {
    expect(
      parseEnv({
        NEXT_PUBLIC_APP_URL: "https://menitihari.example",
        DATABASE_URL: "postgresql://localhost/menitihari",
      }),
    ).toEqual({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "https://menitihari.example",
      DATABASE_URL: "postgresql://localhost/menitihari",
      BETTER_AUTH_SECRET: undefined,
      SENTRY_DSN: undefined,
      NEXT_PUBLIC_SENTRY_DSN: undefined,
      SENTRY_ENVIRONMENT: undefined,
    });
  });

  it("parses optional Sentry configuration and accepts empty DSNs", () => {
    expect(
      parseEnv({
        NEXT_PUBLIC_APP_URL: "https://menitihari.example",
        DATABASE_URL: "postgresql://localhost/menitihari",
        SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
        NEXT_PUBLIC_SENTRY_DSN: "",
        SENTRY_ENVIRONMENT: "production",
      }),
    ).toMatchObject({
      SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      NEXT_PUBLIC_SENTRY_DSN: undefined,
      SENTRY_ENVIRONMENT: "production",
    });
  });

  it("rejects a missing application URL", () => {
    expect(() => parseEnv({})).toThrow("NEXT_PUBLIC_APP_URL");
  });

  it("rejects an invalid application URL", () => {
    expect(
      () =>
        parseEnv({
          NEXT_PUBLIC_APP_URL: "not-a-url",
          DATABASE_URL: "postgresql://localhost/menitihari",
        }),
    ).toThrow("Invalid environment configuration");
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(
      () =>
        parseEnv({
          NEXT_PUBLIC_APP_URL: "https://menitihari.example",
          DATABASE_URL: "https://example.com/database",
        }),
    ).toThrow("PostgreSQL connection URL");
  });

  it("rejects a too-short Better Auth secret", () => {
    expect(() => parseEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://menitihari.example",
      DATABASE_URL: "postgresql://localhost/menitihari",
      BETTER_AUTH_SECRET: "too-short",
    })).toThrow("BETTER_AUTH_SECRET");
  });
});
