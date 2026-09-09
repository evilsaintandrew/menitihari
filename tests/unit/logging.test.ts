import { describe, expect, it } from "vitest";

import {
  createJobLogger,
  createLogger,
  createRequestLogger,
  redactLogString,
  redactLogValue,
} from "../../src/modules/logging";

function captureLog() {
  const lines: string[] = [];
  const logger = createLogger({
    sink: (line) => lines.push(line),
    clock: () => new Date("2026-09-09T00:00:00.000Z"),
  });

  return { lines, logger };
}

describe("structured logging", () => {
  it("emits JSON with request and job correlation fields", () => {
    const { lines, logger } = captureLog();

    logger
      .child({ requestId: "req-123" })
      .child({ jobId: "job-456" })
      .info("job.completed", { attempt: 2 });

    expect(JSON.parse(lines[0])).toEqual({
      timestamp: "2026-09-09T00:00:00.000Z",
      level: "info",
      event: "job.completed",
      attempt: 2,
      request_id: "req-123",
      job_id: "job-456",
    });
  });

  it("supports request and job logger factories", () => {
    const request = captureLog();
    createRequestLogger("req-1", {
      sink: (line) => request.lines.push(line),
      clock: () => new Date("2026-09-09T00:00:00.000Z"),
    }).info("request.started");

    const job = captureLog();
    createJobLogger("job-1", {
      sink: (line) => job.lines.push(line),
      clock: () => new Date("2026-09-09T00:00:00.000Z"),
    }).info("job.started");

    expect(JSON.parse(request.lines[0]).request_id).toBe("req-1");
    expect(JSON.parse(job.lines[0]).job_id).toBe("job-1");
  });
});

describe("log redaction", () => {
  it("redacts activation, QR, and staff credentials at any object depth", () => {
    const value = redactLogValue({
      activation_token: "activation-secret",
      nested: {
        qrToken: "qr-secret",
        staff: [{ staff_token: "staff-secret" }],
      },
    });

    expect(value).toEqual({
      activation_token: "[REDACTED]",
      nested: {
        qrToken: "[REDACTED]",
        staff: [{ staff_token: "[REDACTED]" }],
      },
    });
    expect(JSON.stringify(value)).not.toMatch(/activation-secret|qr-secret|staff-secret/);
  });

  it("masks email and phone fields without retaining the raw values", () => {
    const email = "dina.rahma@example.com";
    const phone = "+62 812-3456-7890";
    const value = redactLogValue({ email, phone, nested: { mobile_number: phone } });

    expect(value).toEqual({
      email: "d***@example.com",
      phone: "***90",
      nested: { mobile_number: "***90" },
    });
    expect(JSON.stringify(value)).not.toContain(email);
    expect(JSON.stringify(value)).not.toContain(phone);
  });

  it("redacts credentials and PII accidentally interpolated into strings", () => {
    const value = redactLogString(
      "GET /slug/g/activation-secret Authorization: Bearer bearer-secret " +
        "email=dina.rahma@example.com phone=081234567890",
    );

    expect(value).toContain("/g/[REDACTED]");
    expect(value).toContain("Bearer [REDACTED]");
    expect(value).toContain("[EMAIL_REDACTED]");
    expect(value).toContain("[PHONE_REDACTED]");
    expect(value).not.toMatch(/activation-secret|bearer-secret|dina\.rahma@example\.com|081234567890/);
  });

  it("keeps the logger safe for circular and error values", () => {
    const { lines, logger } = captureLog();
    const circular: Record<string, unknown> = { error: new Error("token=secret") };
    circular.self = circular;

    logger.error("request.failed", circular);

    const output = JSON.parse(lines[0]);
    expect(output.error).toEqual({ name: "Error", message: "token=[REDACTED]" });
    expect(output.self).toBe("[CIRCULAR]");
    expect(lines[0]).not.toContain("secret");
  });
});
