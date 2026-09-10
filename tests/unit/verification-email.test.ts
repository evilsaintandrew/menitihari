import { describe, expect, it, vi } from "vitest";

import { createVerificationEmailSender } from "@/modules/auth";
import type { EmailService } from "@/providers";

describe("verification email sender", () => {
  it("sends the Better Auth URL through EmailService and escapes HTML", async () => {
    const send = vi.fn<EmailService["send"]>().mockResolvedValue({
      providerMessageId: "msg_123",
      status: "ACCEPTED",
      acceptedAt: new Date("2026-09-10T00:00:00.000Z"),
    });
    const emailService: EmailService = {
      send,
      verifyWebhook: vi.fn(),
    };
    const sender = createVerificationEmailSender(emailService, "Menitihari <noreply@example.test>");

    await sender({
      user: { email: "owner@example.test" },
      url: "https://menitihari.example/verify?token=a&x=\"unsafe\"",
      token: "a",
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      from: "Menitihari <noreply@example.test>",
      to: ["owner@example.test"],
      subject: "Verifikasi email Menitihari",
      text: expect.stringContaining("token=a"),
      html: expect.stringContaining("&quot;unsafe&quot;")
    }));
  });

  it("fails closed when email delivery is not configured", async () => {
    const emailService: EmailService = {
      send: vi.fn(),
      verifyWebhook: vi.fn(),
    };

    await expect(createVerificationEmailSender(emailService, undefined)({
      user: { email: "owner@example.test" },
      url: "https://menitihari.example/verify",
      token: "token",
    })).rejects.toMatchObject({ kind: "UNAVAILABLE" });
    expect(emailService.send).not.toHaveBeenCalled();
  });
});
