import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  CommercialState,
  PrismaClient,
  WhatsAppTemplateType,
} from "@/generated/prisma/client";
import { createInvitation } from "@/modules/invitations";
import { publishInvitation } from "@/modules/invitations";
import { digestGuestActivationToken } from "@/modules/access";
import { saveGuest } from "@/modules/guests";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  getWhatsAppTemplates,
  renderWhatsAppMessage,
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

  it.skipIf(!testDatabaseUrl)("renders an on-demand personalized message without storing final text", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `whatsapp-render-owner-${Date.now()}@example.com`, emailVerified: true },
    });
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    });

    try {
      await publishInvitation(testPrisma!, owner.id, invitation.id, { cache: { invalidateInvitation: () => undefined } });
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      const guest = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Keluarga Santoso",
        phone: "0812 3456 7890",
        assignments: [{ eventId: event.id, maxPartySize: 3 }],
      });

      const rendered = await renderWhatsAppMessage(
        testPrisma!,
        owner.id,
        invitation.id,
        guest.guestId,
        { type: WhatsAppTemplateType.EVENT_REMINDER, eventId: event.id },
        { baseUrl: "https://menitihari.example", now: () => new Date("2026-09-12T00:00:00.000Z") },
      );

      expect(rendered).toMatchObject({
        invitationId: invitation.id,
        guestId: guest.guestId,
        templateType: WhatsAppTemplateType.EVENT_REMINDER,
        guestName: "Keluarga Santoso",
        phone: "0812 3456 7890",
      });
      expect(rendered.invitationUrl).toMatch(new RegExp(`^https://menitihari\\.example/${invitation.slug}/g/[A-Za-z0-9_-]+$`));
      expect(rendered.message).toContain("Keluarga Santoso");
      expect(rendered.message).toContain("Acara Utama");
      expect(rendered.message).toContain(rendered.invitationUrl);
      expect(rendered.message).not.toMatch(/\{[^}]+\}/);

      const rawToken = new URL(rendered.invitationUrl).pathname.split("/").at(-1);
      expect(rawToken).toBeTruthy();
      await expect(testPrisma!.guestActivationCredential.count({ where: { guestId: guest.guestId } })).resolves.toBe(1);
      await expect(testPrisma!.guestActivationCredential.findFirstOrThrow({ where: { guestId: guest.guestId } })).resolves.toMatchObject({
        digest: digestGuestActivationToken(rawToken!),
      });
      await expect(testPrisma!.whatsAppTemplate.findUniqueOrThrow({ where: { invitationId_type: { invitationId: invitation.id, type: WhatsAppTemplateType.EVENT_REMINDER } } })).resolves.toMatchObject({
        body: DEFAULT_WHATSAPP_TEMPLATES.EVENT_REMINDER,
      });
    } finally {
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
