import { describe, expect, it } from "vitest";

import { parseEnv } from "../../src/config/env-schema";

describe("parseEnv", () => {
  it("parses the required application URL and defaults NODE_ENV", () => {
    expect(parseEnv({ NEXT_PUBLIC_APP_URL: "https://menitihari.example" })).toEqual({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "https://menitihari.example",
    });
  });

  it("rejects a missing application URL", () => {
    expect(() => parseEnv({})).toThrow("NEXT_PUBLIC_APP_URL");
  });

  it("rejects an invalid application URL", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_APP_URL: "not-a-url" })).toThrow(
      "Invalid environment configuration",
    );
  });
});
