import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createInvitation } from "@/modules/invitations";
import { confirmGuestImportForOwner, getGuestImportForOwner, runGuestImportWorker, saveGuest, startGuestImport } from "@/modules/guests";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 2, connectionTimeoutMillis: 5_000 }) })
  : undefined;

describe("guest import PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("parses, previews, confirms, and idempotently commits a CSV import", async () => {
    const owner = await testPrisma!.user.create({ data: { email: `guest-import-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, { coupleDisplayName1: "Alya", coupleDisplayName2: "Bima", mainEventDate: "2026-12-20" });
    try {
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      const started = await startGuestImport(testPrisma!, owner.id, invitation.id, {
        filename: "tamu.csv",
        mimeType: "text/csv",
        bytes: new TextEncoder().encode(`nama,telepon,acara,max orang\nAndi,081234567890,${event.name},2\nSinta,,${event.name},1\n`),
      });
      expect(started.state).toBe("UPLOADED");
      await runGuestImportWorker(testPrisma!, undefined, { maxJobs: 1 });
      await expect(getGuestImportForOwner(testPrisma!, owner.id, invitation.id, started.importId)).resolves.toMatchObject({ state: "PREVIEW", validRows: 2, includedRows: 2, capacityAdditional: 3 });

      await confirmGuestImportForOwner(testPrisma!, owner.id, started.importId);
      await runGuestImportWorker(testPrisma!, undefined, { maxJobs: 10 });
      await runGuestImportWorker(testPrisma!, undefined, { maxJobs: 10 });

      await expect(getGuestImportForOwner(testPrisma!, owner.id, invitation.id, started.importId)).resolves.toMatchObject({ state: "COMPLETED", committedRows: 2, failedRows: 0 });
      await expect(testPrisma!.guest.count({ where: { invitationId: invitation.id, archivedAt: null } })).resolves.toBe(2);
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("re-checks capacity at confirmation before queueing commit", async () => {
    const owner = await testPrisma!.user.create({ data: { email: `guest-import-capacity-${Date.now()}@example.com`, emailVerified: true } });
    const invitation = await createInvitation(testPrisma!, owner.id, { coupleDisplayName1: "Alya", coupleDisplayName2: "Bima", mainEventDate: "2026-12-20" });
    try {
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      await saveGuest(testPrisma!, owner.id, invitation.id, null, { displayName: "Keluarga Besar", assignments: [{ eventId: event.id, maxPartySize: 499 }] });
      const started = await startGuestImport(testPrisma!, owner.id, invitation.id, { filename: "tamu.csv", mimeType: "text/csv", bytes: new TextEncoder().encode(`nama,acara,max orang\nTamu Baru,${event.name},2\n`) });
      await runGuestImportWorker(testPrisma!, undefined, { maxJobs: 1 });
      await expect(confirmGuestImportForOwner(testPrisma!, owner.id, started.importId)).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });
      await expect(getGuestImportForOwner(testPrisma!, owner.id, invitation.id, started.importId)).resolves.toMatchObject({ state: "PREVIEW", committedRows: 0 });
      await expect(testPrisma!.guest.count({ where: { invitationId: invitation.id, archivedAt: null } })).resolves.toBe(1);
    } finally {
      await testPrisma!.auditEvent.deleteMany({ where: { invitationId: invitation.id } });
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
