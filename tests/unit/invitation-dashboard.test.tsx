// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CommercialState, PublicationState } from "@/generated/prisma/client";
import { InvitationDashboard } from "@/components/invitations/invitation-dashboard";
import type { InvitationDashboardItem } from "@/modules/invitations";

afterEach(() => {
  cleanup();
});

function invitation(id: string, commercialState: CommercialState): InvitationDashboardItem {
  return {
    id,
    ownerFacingTitle: `Invitation ${id}`,
    coupleDisplayName1: "Alya",
    coupleDisplayName2: "Bima",
    publicationState: PublicationState.PUBLISHED,
    commercialState,
    trialEndsAt: new Date("2026-09-13T08:30:00.000Z"),
    activeUntil: commercialState === CommercialState.PAID_ACTIVE ? new Date("2027-09-10T08:30:00.000Z") : null,
    graceEndsAt: commercialState === CommercialState.GRACE ? new Date("2027-10-10T08:30:00.000Z") : null,
    purgeAt: commercialState === CommercialState.DELETION_PENDING ? new Date("2026-09-17T08:30:00.000Z") : null,
    createdAt: new Date("2026-09-10T08:30:00.000Z"),
    canonicalSlug: `invitation-${id}`,
  };
}

describe("InvitationDashboard", () => {
  it("promotes active invitations and keeps expired lifecycle items in history", () => {
    render(
      <InvitationDashboard
        invitations={[
          invitation("trial", CommercialState.TRIAL),
          invitation("expired", CommercialState.TRIAL_EXPIRED),
          invitation("grace", CommercialState.GRACE),
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Trial & undangan aktif" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Expired, grace & penghapusan" })).toBeTruthy();
    expect(screen.getByText("Trial", { selector: ".ui-badge" })).toBeTruthy();
    expect(screen.getByText("Trial berakhir", { selector: ".ui-badge" })).toBeTruthy();
    expect(screen.getByText("Grace", { selector: ".ui-badge" })).toBeTruthy();
    expect(screen.getAllByText(/13 September 2026/).length).toBeGreaterThan(0);
    expect(screen.getByText(/10 Oktober 2027/)).toBeTruthy();
  });

  it("offers a clear empty-state path to create an invitation", () => {
    render(<InvitationDashboard invitations={[]} />);

    expect(screen.getByRole("heading", { name: "Belum ada undangan" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mulai Buat Undangan" }).getAttribute("href")).toBe("/invitations/new");
  });
});
