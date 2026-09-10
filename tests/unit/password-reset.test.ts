import { describe, expect, it, vi } from "vitest";

import { createPasswordResetEmailSender } from "@/modules/auth/password-reset-email";
import { createPasswordResetRateLimiter } from "@/modules/auth/password-reset-rate-limit";
import type { EmailService } from "@/providers";

describe("password reset email sender", () => {
  it("sends the reset URL through EmailService and escapes HTML", async () => {
    const send = vi.fn<EmailService["send"]>().mockResolvedValue({
      providerMessageId: "msg_reset_123",
      status: "ACCEPTED",
      acceptedAt: new Date("2026-09-10T00:00:00.000Z"),
    });
    const emailService: EmailService = { send, verifyWebhook: vi.fn() };
    const sender = createPasswordResetEmailSender(emailService, "Menitihari <noreply@example.test>");

    await sender({
      user: { email: "owner@example.test" },
      url: "https://menitihari.example/reset-password/token?callbackURL=\"unsafe\"",
      token: "token",
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      from: "Menitihari <noreply@example.test>",
      to: ["owner@example.test"],
      subject: "Reset password Menitihari",
      text: expect.stringContaining("/reset-password/token"),
      html: expect.stringContaining("&quot;unsafe&quot;"),
    }));
  });

  it("fails closed when email delivery is not configured", async () => {
    const emailService: EmailService = { send: vi.fn(), verifyWebhook: vi.fn() };
    const sender = createPasswordResetEmailSender(emailService, undefined);

    await expect(sender({
      user: { email: "owner@example.test" },
      url: "https://menitihari.example/reset-password/token",
      token: "token",
    })).rejects.toMatchObject({ kind: "UNAVAILABLE" });
    expect(emailService.send).not.toHaveBeenCalled();
  });
});

describe("password reset rate limiter", () => {
  it("limits normalized email attempts per IP and identifier", () => {
    let currentTime = 0;
    const limiter = createPasswordResetRateLimiter({ now: () => currentTime });

    expect(limiter.consume({ ip: "203.0.113.10", email: "Owner@Example.com" }).allowed).toBe(true);
    expect(limiter.consume({ ip: "203.0.113.10", email: "owner@example.com" }).allowed).toBe(true);
    expect(limiter.consume({ ip: "203.0.113.10", email: "owner@example.com" }).allowed).toBe(true);
    expect(limiter.consume({ ip: "203.0.113.10", email: "owner@example.com" })).toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
    });

    expect(limiter.consume({ ip: "203.0.113.11", email: "owner@example.com" }).allowed).toBe(true);
    expect(limiter.consume({ ip: "203.0.113.10", email: "other@example.com" }).allowed).toBe(true);

    currentTime = 60_000;
    expect(limiter.consume({ ip: "203.0.113.10", email: "owner@example.com" }).allowed).toBe(true);
  });
});
