import { describe, expect, it } from "vitest";

import {
  invitationContentSchema,
  MAX_LOVE_STORY_MILESTONES,
  parseInvitationContent,
} from "@/modules/invitations";

const core = {
  coupleDisplayName1: " Alya ",
  coupleDisplayName2: "Bima",
};

describe("invitation content contract", () => {
  it.each(["id", "en"] as const)("supports the %s invitation language", (language) => {
    const result = invitationContentSchema.safeParse({ language, core });

    expect(result).toMatchObject({
      success: true,
      data: {
        language,
        core: {
          coupleDisplayName1: "Alya",
          coupleDisplayName2: "Bima",
        },
        optional: {},
      },
    });
  });

  it("validates optional semantic sections and preserves their meaning", () => {
    const content = parseInvitationContent({
      language: "id",
      core,
      optional: {
        fullNames: { person1: "Alya Putri", person2: "Bima Pratama" },
        parentFields: {
          person1: { father: "Arif", mother: "Sari" },
          person2: { father: "Dedi" },
        },
        opening: "Dengan penuh kebahagiaan, kami mengundang Anda.",
        closing: "Sampai jumpa di hari bahagia kami.",
        quoteOrPrayer: "Semoga menjadi keluarga yang penuh kasih.",
        hashtag: "#AlyaBima",
        socialLinks: { instagram: "https://instagram.com/alyabima" },
        loveStory: {
          milestones: [
            { date: "2019", title: "Bertemu", description: "Awal cerita kami." },
          ],
        },
      },
      sectionOrder: ["couple", "events", "love_story"],
      coverMediaAssetId: "asset-cover",
      shareCoverMediaAssetId: "asset-share-cover",
    });

    expect(content.optional.loveStory?.milestones).toHaveLength(1);
    expect(content.optional.socialLinks?.instagram).toBe("https://instagram.com/alyabima");
    expect(content.sectionOrder).toEqual(["couple", "events", "love_story"]);
  });

  it("enforces required core content and the Love Story milestone limit", () => {
    const tooManyMilestones = Array.from({ length: MAX_LOVE_STORY_MILESTONES + 1 }, (_, index) => ({
      title: `Milestone ${index + 1}`,
    }));

    expect(invitationContentSchema.safeParse({
      language: "id",
      core: { coupleDisplayName1: "Alya", coupleDisplayName2: "" },
    }).success).toBe(false);

    expect(invitationContentSchema.safeParse({
      language: "id",
      core,
      optional: { loveStory: { milestones: tooManyMilestones } },
    }).success).toBe(false);
  });

  it("rejects unsupported languages, duplicate ordering, and theme configuration", () => {
    expect(invitationContentSchema.safeParse({ language: "ID", core }).success).toBe(false);
    expect(invitationContentSchema.safeParse({
      language: "en",
      core,
      sectionOrder: ["couple", "couple"],
    }).success).toBe(false);
    expect(invitationContentSchema.safeParse({
      language: "en",
      core,
      sectionOrder: ["love_story"],
    }).success).toBe(false);
    expect(invitationContentSchema.safeParse({
      language: "id",
      core,
      themeId: "classic",
      themeConfig: {},
    }).success).toBe(false);
    expect(invitationContentSchema.safeParse({
      language: "id",
      core,
      optional: { socialLinks: { instagram: "not-a-url" } },
    }).success).toBe(false);
  });
});
