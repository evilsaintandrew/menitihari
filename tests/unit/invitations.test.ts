import { describe, expect, it } from "vitest";

import {
  calculateTrialEndsAt,
  createInvitationInputSchema,
  INVITATION_TRIAL_DAYS,
  LAUNCH_PRICE_AMOUNT,
  mainEventDateToInstant,
} from "@/modules/invitations";

describe("invitation creation rules", () => {
  it("keeps the three-day trial clock exact", () => {
    const start = new Date("2026-09-10T08:30:00.000Z");

    expect(INVITATION_TRIAL_DAYS).toBe(3);
    expect(calculateTrialEndsAt(start)).toEqual(new Date("2026-09-13T08:30:00.000Z"));
  });

  it("locks the launch price and converts the date-only event input in WIB", () => {
    expect(LAUNCH_PRICE_AMOUNT).toBe(79_000);
    expect(mainEventDateToInstant("2026-12-20")).toEqual(new Date("2026-12-19T17:00:00.000Z"));
  });

  it("accepts only the three WF-04 fields with a real calendar date", () => {
    expect(createInvitationInputSchema.safeParse({
      coupleDisplayName1: " Alya ",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
    })).toMatchObject({ success: true, data: {
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
    } });

    expect(createInvitationInputSchema.safeParse({
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-02-30",
    }).success).toBe(false);
    expect(createInvitationInputSchema.safeParse({
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      mainEventDate: "2026-12-20",
      venue: "Later",
    }).success).toBe(false);
  });
});
