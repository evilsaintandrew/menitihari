import { describe, expect, it } from "vitest";

import { EventVisibility } from "@/generated/prisma/client";
import {
  buildInvitationRenderData,
  getPersonalizedInvitationPageData,
  type InvitationRenderRecord,
} from "@/modules/invitations";

const baseRecord = {
  id: "invitation-1",
  coupleDisplayName1: "Alya",
  coupleDisplayName2: "Bima",
  fullNames: null,
  parentFields: null,
  language: "id",
  timezone: "Asia/Jakarta",
  themeId: "classic",
  themeVersion: "1",
  themeConfig: { accent: "rose", fontPairing: "serif-sans", coverStyle: "centered", sectionStyle: "soft" },
  publicationState: "PUBLISHED",
  commercialState: "TRIAL",
  trialEndsAt: new Date("2026-12-20T00:00:00.000Z"),
  activeUntil: null,
  genericAccessEnabled: true,
  content: {
    opening: "Selamat datang",
    closing: null,
    quoteOrPrayer: null,
    hashtag: "#AlyaBima",
    sections: null,
    sectionOrder: null,
    coverMediaAssetId: null,
    shareCoverMediaAssetId: null,
  },
  events: [
    {
      id: "event-generic",
      name: "Akad Nikah",
      startsAt: new Date("2026-12-20T03:00:00.000Z"),
      endsAt: null,
      timezone: "Asia/Jakarta",
      visibility: EventVisibility.GENERIC,
      venue: "Gedung A",
      address: null,
      mapsUrl: null,
      locationNote: null,
      livestreamUrl: null,
      dressCode: null,
      contactFields: null,
      cancelledAt: null,
      cancellationMessage: null,
      archivedAt: null,
    },
    {
      id: "event-private",
      name: "Jamuan keluarga",
      startsAt: new Date("2026-12-20T06:00:00.000Z"),
      endsAt: null,
      timezone: "Asia/Jakarta",
      visibility: EventVisibility.PERSONALIZED_ONLY,
      venue: null,
      address: null,
      mapsUrl: null,
      locationNote: null,
      livestreamUrl: null,
      dressCode: null,
      contactFields: null,
      cancelledAt: null,
      cancellationMessage: null,
      archivedAt: null,
    },
  ],
} satisfies InvitationRenderRecord;

describe("invitation render data", () => {
  it("keeps preview and public inputs identical for generic visibility", () => {
    const preview = buildInvitationRenderData(baseRecord, "preview");
    const publicData = buildInvitationRenderData(baseRecord, "public");

    expect(preview.content.core).toEqual(publicData.content.core);
    expect(preview.content.optional.opening).toBe("Selamat datang");
    expect(preview.events.map(({ id }) => id)).toEqual(["event-generic"]);
    expect(publicData.events.map(({ id }) => id)).toEqual(["event-generic"]);
    expect(publicData.guest).toBeNull();
  });

  it("composes a scoped guest identity and only the assigned events", async () => {
    const invitation = {
      ...baseRecord,
      genericAccessEnabled: false,
      rsvpEnabled: true,
      events: [baseRecord.events[0]],
    };
    const result = await getPersonalizedInvitationPageData({
      guest: {
        findFirst: async () => ({
          displayName: "Keluarga Santoso",
          eventAssignments: [{
            id: "guest-event-1",
            eventId: "event-generic",
            maxPartySize: 3,
            rsvpEligible: true,
            rsvp: null,
            event: {
              id: "event-generic",
              name: "Akad Nikah",
              startsAt: new Date("2026-12-20T03:00:00.000Z"),
              endsAt: null,
              timezone: "Asia/Jakarta",
              rsvpEnabled: true,
              rsvpClosesAt: null,
              cancelledAt: null,
            },
          }],
        }),
      },
      invitation: {
        findFirst: async ({ where }: { readonly where: { readonly events?: unknown } }) => {
          expect(where.events).toMatchObject({ some: { id: { in: ["event-generic"] } } });
          return invitation;
        },
      },
    } as never, "invitation-1", "guest-1", new Date("2026-09-13T00:00:00.000Z"));

    expect(result).toMatchObject({
      mode: "personalized",
      guest: { displayName: "Keluarga Santoso" },
      events: [{ id: "event-generic" }],
      rsvp: { enabled: true, events: [{ id: "event-generic", canRespond: true, status: "PENDING", maxPartySize: 3 }] },
    });
  });

  it("keeps a cancelled generic event with its message but removes archived events", () => {
    const data = buildInvitationRenderData({
      ...baseRecord,
      events: [
        ...baseRecord.events,
        { ...baseRecord.events[0], id: "cancelled", cancelledAt: new Date(), cancellationMessage: "Dipindahkan ke minggu depan." },
        { ...baseRecord.events[0], id: "archived", archivedAt: new Date() },
      ],
    }, "public");

    expect(data.events.map(({ id }) => id)).toEqual(["event-generic", "cancelled"]);
    expect(data.events[1]).toMatchObject({ cancellationMessage: "Dipindahkan ke minggu depan." });
  });

  it("serializes dates at the server boundary and preserves safe text content", () => {
    const data = buildInvitationRenderData(baseRecord, "public");

    expect(data.events[0]).toMatchObject({
      startsAt: "2026-12-20T03:00:00.000Z",
      venue: "Gedung A",
    });
    expect(data.content.optional.hashtag).toBe("#AlyaBima");
  });

  it("preserves structured optional sections stored in JSON columns", () => {
    const data = buildInvitationRenderData({
      ...baseRecord,
      content: {
        ...baseRecord.content,
        sections: {
          socialLinks: { instagram: "https://instagram.com/alyabima" },
          loveStory: { milestones: [{ date: "2019", title: "Pertama bertemu" }] },
        },
        sectionOrder: ["couple", "events", "love_story"],
      },
    }, "public");

    expect(data.content.optional.socialLinks).toEqual({ instagram: "https://instagram.com/alyabima" });
    expect(data.content.optional.loveStory).toEqual({ milestones: [{ date: "2019", title: "Pertama bertemu" }] });
  });
});
