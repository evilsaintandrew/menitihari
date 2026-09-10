import { describe, expect, it, vi } from "vitest";

import {
  CommercialState,
  PublicationState,
} from "@/generated/prisma/client";
import {
  getInvitationDashboard,
  getInvitationExpiry,
  sectionInvitationDashboard,
  type InvitationDashboardItem,
} from "@/modules/invitations";

function invitation(
  id: string,
  commercialState: CommercialState,
  overrides: Partial<InvitationDashboardItem> = {},
): InvitationDashboardItem {
  return {
    id,
    ownerFacingTitle: `Invitation ${id}`,
    coupleDisplayName1: "Alya",
    coupleDisplayName2: "Bima",
    publicationState: PublicationState.DRAFT,
    commercialState,
    trialEndsAt: new Date("2026-09-13T08:30:00.000Z"),
    activeUntil: null,
    graceEndsAt: null,
    purgeAt: null,
    createdAt: new Date("2026-09-10T08:30:00.000Z"),
    canonicalSlug: `invitation-${id}`,
    ...overrides,
  };
}

describe("invitation dashboard rules", () => {
  it("reads every owner invitation without applying a product count cap", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { ...invitation("one", CommercialState.TRIAL), slugs: [{ slug: "one" }] },
      { ...invitation("two", CommercialState.PAID_ACTIVE), slugs: [{ slug: "two" }] },
    ]);
    const result = await getInvitationDashboard({ invitation: { findMany } } as never, "user-1");

    expect(result).toHaveLength(2);
    expect(result[0].canonicalSlug).toBe("one");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { members: { some: { userId: "user-1", role: "OWNER" } } },
      orderBy: { createdAt: "desc" },
    }));
    expect(findMany.mock.calls[0][0]).not.toHaveProperty("take");
  });

  it("keeps trial/active cards separate from lifecycle history", () => {
    const sections = sectionInvitationDashboard([
      invitation("trial", CommercialState.TRIAL),
      invitation("paid", CommercialState.PAID_ACTIVE),
      invitation("expired", CommercialState.TRIAL_EXPIRED),
      invitation("grace", CommercialState.GRACE),
      invitation("deleting", CommercialState.DELETION_PENDING),
    ]);

    expect(sections.active.map(({ id }) => id)).toEqual(["trial", "paid"]);
    expect(sections.history.map(({ id }) => id)).toEqual(["expired", "grace", "deleting"]);
  });

  it("uses the lifecycle-specific server date as the visible expiry", () => {
    const activeUntil = new Date("2027-09-10T08:30:00.000Z");
    const graceEndsAt = new Date("2027-10-10T08:30:00.000Z");
    const purgeAt = new Date("2026-09-17T08:30:00.000Z");

    expect(getInvitationExpiry(invitation("trial", CommercialState.TRIAL))).toEqual(
      new Date("2026-09-13T08:30:00.000Z"),
    );
    expect(getInvitationExpiry(invitation("paid", CommercialState.PAID_ACTIVE, { activeUntil }))).toEqual(activeUntil);
    expect(getInvitationExpiry(invitation("grace", CommercialState.GRACE, { activeUntil, graceEndsAt }))).toEqual(graceEndsAt);
    expect(getInvitationExpiry(invitation("deleting", CommercialState.DELETION_PENDING, { purgeAt }))).toEqual(purgeAt);
  });
});
