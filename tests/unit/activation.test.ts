import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  digestGuestActivationToken,
  guestActivationTokenSchema,
  guestSessionCookieName,
} from "@/modules/access";

describe("personalized guest activation", () => {
  it("validates opaque token shape and stores only its digest", () => {
    const token = "A".repeat(43);
    expect(guestActivationTokenSchema.parse(token)).toBe(token);
    expect(digestGuestActivationToken(token)).toBe(
      createHash("sha256").update(token, "utf8").digest("hex"),
    );
    expect(digestGuestActivationToken(token)).not.toBe(token);
    expect(() => guestActivationTokenSchema.parse("too-short")).toThrow();
    expect(() => guestActivationTokenSchema.parse(`${token}.`)).toThrow();
  });

  it("does not put invitation or activation secrets in the session cookie name", () => {
    const invitationId = "invitation-secret-id";
    const cookieName = guestSessionCookieName(invitationId);
    expect(cookieName).toMatch(/^menitihari_guest_[a-f0-9]{16}$/);
    expect(cookieName).not.toContain(invitationId);
  });
});
