// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InvitationPreviewModeForm } from "@/app/invitations/[id]/preview/preview-mode-form";

describe("invitation preview mode form", () => {
  it("offers generic and owner-selected guest modes without exposing activation links", () => {
    render(
      <InvitationPreviewModeForm
        guestOptions={[{ id: "guest-1", displayName: "Keluarga Santoso" }]}
        invitationId="invitation-1"
        selectedGuestId="guest-1"
      />,
    );

    const form = screen.getByRole("button", { name: "Tampilkan" }).closest("form");
    const select = screen.getByRole("combobox", { name: "Tampilkan sebagai" }) as HTMLSelectElement;
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/invitations/invitation-1/preview");
    expect(select.value).toBe("guest-1");
    expect(screen.getByRole("option", { name: "Generic" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Keluarga Santoso" })).toBeTruthy();
    expect(form?.textContent).not.toContain("/g/");
  });
});
