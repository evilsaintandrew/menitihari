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
  WHATSAPP_TRIAL_UNIQUE_CONTACT_LIMIT,
  digestWhatsAppContact,
  getWhatsAppTemplates,
  openWhatsApp,
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

  it.skipIf(!testDatabaseUrl)("records WhatsApp opened summary without changing manual Sent status", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `whatsapp-open-owner-${Date.now()}@example.com`, emailVerified: true },
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
      await testPrisma!.guest.update({ where: { id: guest.guestId }, data: { distributionStatus: "MARKED_SENT" } });

      const firstOpenedAt = new Date("2026-09-12T01:00:00.000Z");
      const first = await openWhatsApp(
        testPrisma!,
        owner.id,
        invitation.id,
        guest.guestId,
        { type: WhatsAppTemplateType.INVITATION },
        { baseUrl: "https://menitihari.example", now: () => firstOpenedAt },
      );
      const secondOpenedAt = new Date("2026-09-12T02:00:00.000Z");
      const second = await openWhatsApp(
        testPrisma!,
        owner.id,
        invitation.id,
        guest.guestId,
        { type: WhatsAppTemplateType.INVITATION },
        { baseUrl: "https://menitihari.example", now: () => secondOpenedAt },
      );

      expect(new URL(first.whatsappUrl).hostname).toBe("wa.me");
      expect(new URL(first.whatsappUrl).pathname).toBe("/6281234567890");
      expect(new URL(first.whatsappUrl).searchParams.get("text")).toContain("Keluarga Santoso");
      expect(second.openedCount).toBe(2);
      await expect(testPrisma!.guest.findUniqueOrThrow({ where: { id: guest.guestId } })).resolves.toMatchObject({
        distributionStatus: "MARKED_SENT",
        whatsappFirstOpenedAt: firstOpenedAt,
        whatsappLastOpenedAt: secondOpenedAt,
        whatsappOpenedCount: 2,
      });
    } finally {
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("counts one contact across invitation and reminder opens, then lets paid invitations bypass the cap", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `whatsapp-cap-owner-${Date.now()}@example.com`, emailVerified: true },
    });
    const trialStartedAt = new Date("2026-09-12T00:00:00.000Z");
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    }, { now: () => trialStartedAt });

    try {
      await publishInvitation(testPrisma!, owner.id, invitation.id, { cache: { invalidateInvitation: () => undefined } });
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      const guest = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Keluarga Santoso",
        phone: "0812 3456 7890",
        assignments: [{ eventId: event.id, maxPartySize: 3 }],
      });
      const openNow = new Date("2026-09-12T01:00:00.000Z");

      const first = await openWhatsApp(
        testPrisma!,
        owner.id,
        invitation.id,
        guest.guestId,
        { type: WhatsAppTemplateType.INVITATION },
        { baseUrl: "https://menitihari.example", now: () => openNow },
      );
      const reminder = await openWhatsApp(
        testPrisma!,
        owner.id,
        invitation.id,
        guest.guestId,
        { type: WhatsAppTemplateType.RSVP_REMINDER },
        { baseUrl: "https://menitihari.example", now: () => new Date("2026-09-12T02:00:00.000Z") },
      );

      expect(first.trialUsage).toEqual({ used: 1, limit: WHATSAPP_TRIAL_UNIQUE_CONTACT_LIMIT, remaining: 29 });
      expect(reminder.trialUsage).toEqual({ used: 1, limit: WHATSAPP_TRIAL_UNIQUE_CONTACT_LIMIT, remaining: 29 });
      await expect(testPrisma!.whatsAppTrialContactUsage.count({ where: { invitationId: invitation.id } })).resolves.toBe(1);

      await testPrisma!.whatsAppTrialContactUsage.createMany({
        data: Array.from({ length: WHATSAPP_TRIAL_UNIQUE_CONTACT_LIMIT - 1 }, (_, index) => ({
          invitationId: invitation.id,
          contactDigest: digestWhatsAppContact(`+62812345${String(index + 1000)}`),
        })),
      });
      await expect(testPrisma!.whatsAppTrialContactUsage.count({ where: { invitationId: invitation.id } })).resolves.toBe(WHATSAPP_TRIAL_UNIQUE_CONTACT_LIMIT);

      await testPrisma!.invitation.update({
        where: { id: invitation.id },
        data: {
          commercialState: CommercialState.PAID_ACTIVE,
          activeUntil: new Date("2027-09-12T01:00:00.000Z"),
        },
      });
      const paidGuest = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Keluarga Paid",
        phone: "0812 9999 9999",
        assignments: [{ eventId: event.id, maxPartySize: 1 }],
      });
      const paid = await openWhatsApp(
        testPrisma!,
        owner.id,
        invitation.id,
        paidGuest.guestId,
        { type: WhatsAppTemplateType.EVENT_REMINDER, eventId: event.id },
        { baseUrl: "https://menitihari.example", now: () => openNow },
      );

      expect(paid.trialUsage).toBeNull();
      await expect(testPrisma!.whatsAppTrialContactUsage.count({ where: { invitationId: invitation.id } })).resolves.toBe(WHATSAPP_TRIAL_UNIQUE_CONTACT_LIMIT);
    } finally {
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("rejects a new trial contact at the cap without side effects", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `whatsapp-cap-reject-owner-${Date.now()}@example.com`, emailVerified: true },
    });
    const trialStartedAt = new Date("2026-09-12T00:00:00.000Z");
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    }, { now: () => trialStartedAt });

    try {
      await publishInvitation(testPrisma!, owner.id, invitation.id, { cache: { invalidateInvitation: () => undefined } });
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      await testPrisma!.whatsAppTrialContactUsage.createMany({
        data: Array.from({ length: WHATSAPP_TRIAL_UNIQUE_CONTACT_LIMIT }, (_, index) => ({
          invitationId: invitation.id,
          contactDigest: digestWhatsAppContact(`+62876543${String(index + 1000)}`),
        })),
      });
      const guest = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Tamu Ke-31",
        phone: "0812 0000 0031",
        assignments: [{ eventId: event.id, maxPartySize: 1 }],
      });

      await expect(openWhatsApp(
        testPrisma!,
        owner.id,
        invitation.id,
        guest.guestId,
        { type: WhatsAppTemplateType.INVITATION },
        { baseUrl: "https://menitihari.example", now: () => new Date("2026-09-12T01:00:00.000Z") },
      )).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });

      await expect(testPrisma!.whatsAppTrialContactUsage.count({ where: { invitationId: invitation.id } })).resolves.toBe(WHATSAPP_TRIAL_UNIQUE_CONTACT_LIMIT);
      await expect(testPrisma!.guest.findUniqueOrThrow({ where: { id: guest.guestId } })).resolves.toMatchObject({ whatsappOpenedCount: 0 });
      await expect(testPrisma!.guestActivationCredential.count({ where: { guestId: guest.guestId } })).resolves.toBe(0);
    } finally {
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });

  it.skipIf(!testDatabaseUrl)("serializes concurrent new-contact claims at the 30-contact boundary", async () => {
    const owner = await testPrisma!.user.create({
      data: { email: `whatsapp-cap-concurrency-owner-${Date.now()}@example.com`, emailVerified: true },
    });
    const trialStartedAt = new Date("2026-09-12T00:00:00.000Z");
    const invitation = await createInvitation(testPrisma!, owner.id, {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    }, { now: () => trialStartedAt });

    try {
      await publishInvitation(testPrisma!, owner.id, invitation.id, { cache: { invalidateInvitation: () => undefined } });
      const event = await testPrisma!.event.findFirstOrThrow({ where: { invitationId: invitation.id } });
      await testPrisma!.whatsAppTrialContactUsage.createMany({
        data: Array.from({ length: WHATSAPP_TRIAL_UNIQUE_CONTACT_LIMIT - 1 }, (_, index) => ({
          invitationId: invitation.id,
          contactDigest: digestWhatsAppContact(`+62811111${String(index + 1000)}`),
        })),
      });
      const guestA = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Tamu A",
        phone: "0812 0000 0041",
        assignments: [{ eventId: event.id, maxPartySize: 1 }],
      });
      const guestB = await saveGuest(testPrisma!, owner.id, invitation.id, null, {
        displayName: "Tamu B",
        phone: "0812 0000 0042",
        assignments: [{ eventId: event.id, maxPartySize: 1 }],
      });

      const outcomes = await Promise.allSettled([
        openWhatsApp(testPrisma!, owner.id, invitation.id, guestA.guestId, { type: WhatsAppTemplateType.INVITATION }, { baseUrl: "https://menitihari.example", now: () => new Date("2026-09-12T01:00:00.000Z") }),
        openWhatsApp(testPrisma!, owner.id, invitation.id, guestB.guestId, { type: WhatsAppTemplateType.RSVP_REMINDER }, { baseUrl: "https://menitihari.example", now: () => new Date("2026-09-12T01:00:00.000Z") }),
      ]);

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "rejected")[0]).toMatchObject({ reason: { code: "CAPACITY_EXCEEDED" } });
      await expect(testPrisma!.whatsAppTrialContactUsage.count({ where: { invitationId: invitation.id } })).resolves.toBe(WHATSAPP_TRIAL_UNIQUE_CONTACT_LIMIT);
    } finally {
      await testPrisma!.invitation.delete({ where: { id: invitation.id } });
      await testPrisma!.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
