import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { writeAuditEvent } from "../../src/modules/audit";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: testDatabaseUrl,
        max: 2,
        connectionTimeoutMillis: 5_000,
      }),
    })
  : undefined;

describe("Prisma PostgreSQL migration", () => {
  it.skipIf(!testDatabaseUrl)(
    "creates the baseline tables in the isolated integration database",
    async () => {
      const client = new Client({
        connectionString: testDatabaseUrl,
        connectionTimeoutMillis: 5_000,
      });

      await client.connect();
      try {
        const result = await client.query<{ table_name: string }>(
          `SELECT table_name
           FROM information_schema.tables
           WHERE table_schema = 'public'
           AND table_name IN ('invitations', 'guest_events', 'payment_orders', 'jobs', 'audit_events')
           ORDER BY table_name`,
        );

        expect(result.rows.map((row) => row.table_name)).toEqual([
          "audit_events",
          "guest_events",
          "invitations",
          "jobs",
          "payment_orders",
        ]);
      } finally {
        await client.end();
      }
    },
  );

  it.skipIf(!testDatabaseUrl)(
    "rolls back an audit append with its interactive transaction",
    async () => {
      const marker = `found_007_rollback_${Date.now()}`;

      await expect(
        testPrisma!.$transaction(async (transaction) => {
          await writeAuditEvent(transaction, {
            action: "FOUND_007_ROLLBACK_TEST",
            resourceType: "integration_test",
            resourceId: marker,
            metadata: { source: "integration_test", outcome: "rolled_back" },
          });
          throw new Error("rollback audit transaction");
        }),
      ).rejects.toThrow("rollback audit transaction");

      await expect(
        testPrisma!.auditEvent.count({ where: { resourceId: marker } }),
      ).resolves.toBe(0);
    },
  );
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
