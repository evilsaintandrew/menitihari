import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  CommercialState,
  PrismaClient,
  WhatsAppTemplateType,
} from "@/generated/prisma/client";
import { createInvitation } from "@/modules/invitations";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  getWhatsAppTemplates,
  updateWhatsAppTemplate,
} from "@/modules/whatsapp";

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

describe("WhatsApp template PostgreSQL integration", () => {
  it.skipIf(!testDatabaseUrl)("creates defaults with an invitation and allows owner edits", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `whatsapp-owner-${Date.now()}@example.com`, emailVerified: true },
    });
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    });

    try {
      const templates = await getWhatsAppTemplates(testPrisma!, owner.id, invitation.id);
      expect(templates).toHaveLength(3);
      expect(templates?.find((template) => template.type === WhatsAppTemplateType.INVITATION)?.body)
        .toBe(DEFAULT_WHATSAPP_TEMPLATES.INVITATION);

      const updated = await updateWhatsAppTemplate(
        testPrisma!,
        owner.id,
        invitation.id,
        WhatsAppTemplateType.INVITATION,
        { body: "Kepada {guest_name}, lihat undangan {invitation_url}." },
      );
      expect(updated).toMatchObject({
        invitationId: invitation.id,
        type: WhatsAppTemplateType.INVITATION,
        body: "Kepada {guest_name}, lihat undangan {invitation_url}.",
        changed: true,
      });
    } finally {
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("keeps template mutations owner-scoped and lifecycle-authoritative", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `whatsapp-owner-2-${Date.now()}@example.com`, emailVerified: true },
    });
    const otherUser = await testPrisma!.user.create({
      data: { email: `whatsapp-other-${Date.now()}@example.com`, emailVerified: true },
    });
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    });

    try {
      await expect(updateWhatsAppTemplate(
        testPrisma!,
        otherUser.id,
        invitation.id,
        WhatsAppTemplateType.RSVP_REMINDER,
        { body: "Tidak boleh." },
      )).rejects.toMatchObject({ code: "NOT_FOUND" });

      await testPrisma!.invitation.update({
        where: { id: invitation.id },
        data: { commercialState: CommercialState.TRIAL_EXPIRED },
      });
      await expect(updateWhatsAppTemplate(
        testPrisma!,
        owner.id,
        invitation.id,
        WhatsAppTemplateType.RSVP_REMINDER,
        { body: "Tidak boleh setelah trial." },
      )).rejects.toMatchObject({ code: "LIFECYCLE_LOCKED" });
    } finally {
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: otherUser.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
