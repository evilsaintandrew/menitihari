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
});
