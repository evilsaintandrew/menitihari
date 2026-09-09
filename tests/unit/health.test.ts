import { describe, expect, it } from "vitest";

import { healthResponse, readinessResponse } from "../../src/server/health";

describe("health endpoints", () => {
  it("returns a cache-safe liveness response", async () => {
    const response = healthResponse();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns ready only when the database check succeeds", async () => {
    const response = await readinessResponse(async () => undefined);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
  });

  it("returns a generic 503 without exposing the dependency failure", async () => {
    const response = await readinessResponse(async () => {
      throw new Error("postgres password=super-secret");
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "not_ready" });
  });
});
