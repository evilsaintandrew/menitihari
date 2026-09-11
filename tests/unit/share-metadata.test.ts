import { describe, expect, it } from "vitest";

import {
  buildInvitationShareMetadata,
  formatPrimaryEventDate,
} from "@/modules/invitations";

const namedInput = {
  slug: "alya-bima",
  coupleDisplayName1: "Alya",
  coupleDisplayName2: "Bima",
  language: "id" as const,
  timezone: "Asia/Jakarta",
  primaryEventTimezone: "Asia/Jakarta",
  primaryEventStartsAt: new Date("2026-12-20T03:00:00.000Z"),
  passwordProtected: false,
  available: true,
};

describe("invitation share metadata", () => {
  it("uses couple names, the primary date, and the default cover", () => {
    const metadata = buildInvitationShareMetadata(namedInput);

    expect(metadata).toMatchObject({
      title: "Alya & Bima",
      description: "Undangan pernikahan Alya & Bima pada 20 Desember 2026.",
      imagePath: "/alya-bima/opengraph-image",
      privacyMode: "named",
      coverSource: "default",
    });
  });

  it("keeps personalized metadata addressee-free and records the selected share cover", () => {
    const metadata = buildInvitationShareMetadata({
      ...namedInput,
      shareCoverMediaAssetId: "asset-share-cover",
    });

    expect(metadata).toMatchObject({
      title: "Alya & Bima",
      coverSource: "selected",
    });
    expect(JSON.stringify(metadata)).not.toContain("guest");
    expect(JSON.stringify(metadata)).not.toContain("Siti");
  });

  it("uses generic privacy-safe metadata for password-protected or unavailable invitations", () => {
    expect(buildInvitationShareMetadata({
      ...namedInput,
      passwordProtected: true,
      shareCoverMediaAssetId: "private-asset",
    })).toMatchObject({
      title: "Undangan pernikahan",
      description: "Buka undangan untuk melihat detail acara.",
      privacyMode: "generic",
      coverSource: "default",
    });

    expect(buildInvitationShareMetadata({
      ...namedInput,
      available: false,
    })).toMatchObject({
      title: "Undangan pernikahan",
      privacyMode: "generic",
    });
  });

  it("formats the primary date in the invitation timezone and fails safely for invalid zones", () => {
    expect(formatPrimaryEventDate(namedInput.primaryEventStartsAt, "Asia/Jakarta")).toBe("20 Desember 2026");
    expect(formatPrimaryEventDate(namedInput.primaryEventStartsAt, "not-a-timezone")).toBeNull();
  });
});
