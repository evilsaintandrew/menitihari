import { Client } from "pg";
import { describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

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
           AND table_name IN ('invitations', 'guest_events', 'payment_orders', 'jobs')
           ORDER BY table_name`,
        );

        expect(result.rows.map((row) => row.table_name)).toEqual([
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
});
