import { describe, expect, it } from "vitest";

import {
  createInvitationPasswordRateLimiter,
  hashSharedPassword,
  verifySharedPassword,
} from "@/modules/access";

describe("shared invitation access", () => {
  it("hashes passwords and verifies without exposing the raw value", async () => {
    const password = "rahasia-aman";
    const encoded = await hashSharedPassword(password);

    expect(encoded).not.toContain(password);
    expect(encoded).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(encoded.split("$")).toHaveLength(6);
    await expect(verifySharedPassword(password, encoded)).resolves.toBe(true);
    await expect(verifySharedPassword("password-salah", encoded)).resolves.toBe(false);
    await expect(verifySharedPassword(password, "not-a-hash")).resolves.toBe(false);
  });

  it("rate-limits by IP and invitation, then resets after the cooldown", () => {
    let now = 0;
    const limiter = createInvitationPasswordRateLimiter({
      now: () => now,
      windowMs: 10_000,
      maxAttempts: 2,
    });

    expect(limiter.consume({ ip: "203.0.113.10", invitationId: "inv-1" })).toMatchObject({ allowed: true });
    expect(limiter.consume({ ip: "203.0.113.10", invitationId: "inv-1" })).toMatchObject({ allowed: true });
    expect(limiter.consume({ ip: "203.0.113.10", invitationId: "inv-1" })).toMatchObject({
      allowed: false,
      retryAfterSeconds: 10,
    });
    expect(limiter.consume({ ip: "203.0.113.10", invitationId: "inv-2" })).toMatchObject({ allowed: true });
    expect(limiter.consume({ ip: "203.0.113.11", invitationId: "inv-1" })).toMatchObject({ allowed: true });

    now = 10_000;
    expect(limiter.consume({ ip: "203.0.113.10", invitationId: "inv-1" })).toMatchObject({ allowed: true });
  });
});
