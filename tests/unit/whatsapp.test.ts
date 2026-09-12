import { describe, expect, it } from "vitest";

import { WhatsAppTemplateType } from "@/generated/prisma/client";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  WHATSAPP_TEMPLATE_MAX_BODY_LENGTH,
  WHATSAPP_TEMPLATE_PLACEHOLDERS,
  defaultWhatsAppTemplateRows,
  buildPersonalizedInvitationUrl,
  buildWhatsAppUrl,
  extractWhatsAppTemplatePlaceholders,
  renderWhatsAppTemplateBody,
  updateWhatsAppTemplateInputSchema,
  whatsappTemplateBodySchema,
} from "@/modules/whatsapp";

describe("WhatsApp templates", () => {
  it("defines one default template for each supported type", () => {
    const rows = defaultWhatsAppTemplateRows("invitation-1");

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.type)).toEqual([
      WhatsAppTemplateType.INVITATION,
      WhatsAppTemplateType.RSVP_REMINDER,
      WhatsAppTemplateType.EVENT_REMINDER,
    ]);
    expect(new Set(rows.map((row) => row.body)).size).toBe(3);
    expect(rows.every((row) => row.invitationId === "invitation-1")).toBe(true);
    expect(Object.keys(DEFAULT_WHATSAPP_TEMPLATES)).toHaveLength(3);
  });

  it("accepts only allowlisted placeholders and returns unique names in order", () => {
    const body = "Hai {guest_name}, {guest_name}. {event_name} — {invitation_url}";

    expect(whatsappTemplateBodySchema.safeParse(body).success).toBe(true);
    expect(extractWhatsAppTemplatePlaceholders(body)).toEqual([
      "guest_name",
      "event_name",
      "invitation_url",
    ]);
    expect(WHATSAPP_TEMPLATE_PLACEHOLDERS).toContain("guest_name");
  });

  it("rejects unknown, malformed, empty, and oversized template bodies", () => {
    expect(whatsappTemplateBodySchema.safeParse("Hai {unknown}").success).toBe(false);
    expect(whatsappTemplateBodySchema.safeParse("Hai {guest-name}").success).toBe(false);
    expect(whatsappTemplateBodySchema.safeParse("Hai {guest_name").success).toBe(false);
    expect(whatsappTemplateBodySchema.safeParse("   ").success).toBe(false);
    expect(updateWhatsAppTemplateInputSchema.safeParse({ body: "x".repeat(WHATSAPP_TEMPLATE_MAX_BODY_LENGTH + 1) }).success).toBe(false);
  });

  it("renders allowlisted values and always includes the personalized URL", () => {
    const invitationUrl = buildPersonalizedInvitationUrl("https://menitihari.example/", "alya-bima", "raw-token");

    expect(renderWhatsAppTemplateBody("Hai {guest_name}, {event_name}.", {
      guest_name: "Keluarga Santoso",
      couple_name: "Alya & Bima",
      invitation_url: invitationUrl,
      event_name: "Resepsi",
      event_date: "20 Desember 2026",
      event_time: "13.00",
      event_venue: "Gedung A",
    })).toBe(`Hai Keluarga Santoso, Resepsi.\n\nLihat undangan: ${invitationUrl}`);
  });

  it("builds a wa.me link from the canonical phone and encoded message", () => {
    expect(buildWhatsAppUrl("+6281234567890", "Hai Keluarga Santoso!"))
      .toBe("https://wa.me/6281234567890?text=Hai%20Keluarga%20Santoso!");
  });

  it("rejects unknown placeholders again at render time", () => {
    expect(() => renderWhatsAppTemplateBody("Hai {unknown}", {
      guest_name: "Keluarga Santoso",
      couple_name: "Alya & Bima",
      invitation_url: "https://menitihari.example/alya-bima/g/token",
      event_name: "Resepsi",
      event_date: "20 Desember 2026",
      event_time: "13.00",
      event_venue: "Gedung A",
    })).toThrow();
  });
});
