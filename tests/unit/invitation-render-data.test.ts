import { describe, expect, it } from "vitest";

import { EventVisibility } from "@/generated/prisma/client";
import {
  buildInvitationRenderData,
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
      cancelledAt: null,
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
      cancelledAt: null,
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
  });

  it("removes cancelled and archived events before the renderer sees them", () => {
    const data = buildInvitationRenderData({
      ...baseRecord,
      events: [
        ...baseRecord.events,
        { ...baseRecord.events[0], id: "cancelled", cancelledAt: new Date() },
        { ...baseRecord.events[0], id: "archived", archivedAt: new Date() },
      ],
    }, "public");

    expect(data.events.map(({ id }) => id)).toEqual(["event-generic"]);
  });

  it("serializes dates at the server boundary and preserves safe text content", () => {
    const data = buildInvitationRenderData(baseRecord, "public");

    expect(data.events[0]).toMatchObject({
      startsAt: "2026-12-20T03:00:00.000Z",
      venue: "Gedung A",
    });
    expect(data.content.optional.hashtag).toBe("#AlyaBima");
  });
});
