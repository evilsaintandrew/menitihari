import { describe, expect, it } from "vitest";

import type {
  EmailService,
  PaymentProvider,
  ProviderServices,
  StorageProvider,
} from "@/providers";
import { createResendEmailService } from "@/providers";

const fakePaymentProvider: PaymentProvider = {
  async createPayment(input) {
    return {
      providerReference: input.merchantReference,
      status: "PENDING",
      expiresAt: new Date("2026-09-09T00:10:00.000Z"),
      action: { kind: "QR", value: "test-payment-action" },
    };
  },
  async getPaymentStatus(input) {
    return {
      providerReference: input.providerReference,
      status: "PENDING",
    };
  },
  async verifyWebhook() {
    return {
      eventId: "test-event",
      providerReference: "test-reference",
      status: "SUCCEEDED",
      occurredAt: new Date("2026-09-09T00:00:00.000Z"),
    };
  },
};

const fakeEmailService: EmailService = {
  async send() {
    return {
      providerMessageId: "test-message",
      status: "ACCEPTED",
      acceptedAt: new Date("2026-09-09T00:00:00.000Z"),
    };
  },
  async verifyWebhook() {
    return {
      eventId: "test-email-event",
      providerMessageId: "test-message",
      status: "DELIVERED",
      occurredAt: new Date("2026-09-09T00:00:00.000Z"),
    };
  },
};

const fakeStorageProvider: StorageProvider = {
  async createUploadUrl() {
    return {
      url: "https://storage.example.test/upload",
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
      expiresAt: new Date("2026-09-09T00:10:00.000Z"),
    };
  },
  async createDownloadUrl() {
    return {
      url: "https://storage.example.test/download",
      expiresAt: new Date("2026-09-09T00:10:00.000Z"),
    };
  },
  async deleteObject() {
    // Missing objects are an idempotent success for every implementation.
  },
};

describe("provider adapter contracts", () => {
  it("allows test doubles to replace all external providers", async () => {
    const providers: ProviderServices = {
      payment: fakePaymentProvider,
      email: fakeEmailService,
      storage: fakeStorageProvider,
    };

    const payment = await providers.payment.createPayment({
      merchantReference: "payment-order-test",
      amount: { minorUnits: "79000", currency: "IDR" },
      idempotencyKey: "payment-idempotency-test",
    });
    const email = await providers.email.send({
      from: "no-reply@example.test",
      to: ["owner@example.test"],
      subject: "Test",
      text: "Test message",
    });
    const upload = await providers.storage.createUploadUrl({
      objectKey: "temporary/test.jpg",
      contentType: "image/jpeg",
      maxBytes: 1_000,
      expiresInSeconds: 600,
    });

    expect(payment.status).toBe("PENDING");
    expect(email.status).toBe("ACCEPTED");
    expect(upload.method).toBe("PUT");
  });

  it("exposes normalized webhook facts instead of provider payloads", async () => {
    const paymentEvent = await fakePaymentProvider.verifyWebhook({
      body: "provider-payload-is-contained-here",
      signature: "test-signature",
    });
    const emailEvent = await fakeEmailService.verifyWebhook({
      body: "provider-payload-is-contained-here",
      signature: "test-signature",
    });

    expect(paymentEvent).toEqual({
      eventId: "test-event",
      providerReference: "test-reference",
      status: "SUCCEEDED",
      occurredAt: new Date("2026-09-09T00:00:00.000Z"),
    });
    expect(emailEvent).toEqual({
      eventId: "test-email-event",
      providerMessageId: "test-message",
      status: "DELIVERED",
      occurredAt: new Date("2026-09-09T00:00:00.000Z"),
    });
  });
});

describe("Resend email adapter", () => {
  it("normalizes an accepted provider response without exposing provider payloads", async () => {
    const requests: Request[] = [];
    const service = createResendEmailService({
      apiKey: "re_test_secret",
      endpoint: "https://resend.example.test/emails",
      fetchImplementation: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(JSON.stringify({ id: "msg_123" }), { status: 200 });
      },
    });

    const result = await service.send({
      from: "Menitihari <noreply@example.test>",
      to: ["owner@example.test"],
      subject: "Verify",
      text: "Verify this account",
    });

    expect(result.status).toBe("ACCEPTED");
    expect(result.providerMessageId).toBe("msg_123");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer re_test_secret");
    expect(await requests[0]!.json()).toMatchObject({ to: ["owner@example.test"], subject: "Verify" });
  });

  it("maps provider failures to transport-neutral errors", async () => {
    const service = createResendEmailService({
      apiKey: "re_test_secret",
      fetchImplementation: async () => new Response("provider details", { status: 429 }),
    });

    await expect(service.send({
      from: "noreply@example.test",
      to: ["owner@example.test"],
      subject: "Verify",
    })).rejects.toMatchObject({ kind: "RATE_LIMITED", provider: "resend" });
  });
});
