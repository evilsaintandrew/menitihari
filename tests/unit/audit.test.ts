import { describe, expect, it, vi } from "vitest";

import {
  parseAuditMetadata,
  writeAuditEvent,
  type AuditEventDatabase,
} from "../../src/modules/audit";

function fakeDatabase() {
  const event = {
    id: "audit-1",
    userId: "user-1",
    invitationId: "invitation-1",
    resourceType: "invitation",
    resourceId: "invitation-1",
    action: "INVITATION_PUBLISHED",
    metadata: { source: "owner", before_status: "DRAFT" },
    createdAt: new Date("2026-09-09T00:00:00.000Z"),
  };
  const database: AuditEventDatabase = {
    auditEvent: {
      create: vi.fn(async () => event),
    },
  } as unknown as AuditEventDatabase;

  return { database, event };
}

describe("audit metadata", () => {
  it("accepts bounded event facts", () => {
    expect(
      parseAuditMetadata({
        source: "owner",
        participant_count: 3,
        before_status: "DRAFT",
        after_status: "PUBLISHED",
        attendance_count: 2,
        flags: ["manual", "override"],
      }),
    ).toEqual({
      source: "owner",
      participant_count: 3,
      before_status: "DRAFT",
      after_status: "PUBLISHED",
      attendance_count: 2,
      flags: ["manual", "override"],
    });
  });

  it.each([
    ["sensitive field name", { activation_token: "raw-secret" }],
    ["PII field name", { guest_name: "Dina Rahma" }],
    ["email value", { detail: "dina.rahma@example.com" }],
    ["phone value", { detail: "+62 812-3456-7890" }],
    ["JWT value", { detail: "eyJhbGciOiJIUzI1NiJ9.payload.signature" }],
    ["personalized URL", { detail: "/slug/g/raw-activation-token" }],
  ])("rejects %s", (_description, metadata) => {
    expect(() => parseAuditMetadata(metadata)).toThrow();
  });
});

describe("audit event writer", () => {
  it("appends through a transaction-shaped database client", async () => {
    const { database, event } = fakeDatabase();

    await expect(
      writeAuditEvent(database, {
        actorId: "user-1",
        invitationId: "invitation-1",
        resourceType: "invitation",
        resourceId: "invitation-1",
        action: "INVITATION_PUBLISHED",
        metadata: { source: "owner", before_status: "DRAFT" },
        createdAt: event.createdAt,
      }),
    ).resolves.toBe(event);

    expect(database.auditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        invitationId: "invitation-1",
        resourceType: "invitation",
        resourceId: "invitation-1",
        action: "INVITATION_PUBLISHED",
        metadata: { source: "owner", before_status: "DRAFT" },
        createdAt: event.createdAt,
      },
    });
  });

  it("validates metadata before touching the database", async () => {
    const { database } = fakeDatabase();

    await expect(
      writeAuditEvent(database, {
        action: "ACCESS_TOKEN_REGENERATED",
        metadata: { token: "raw-secret" } as never,
      }),
    ).rejects.toThrow();
    expect(database.auditEvent.create).not.toHaveBeenCalled();
  });
});
