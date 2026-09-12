// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { updateGuestSharingAction, updateInvitationPasswordAction } = vi.hoisted(() => ({
  updateGuestSharingAction: vi.fn(async (
    _invitationId: string,
    _previousState: { readonly ok: boolean },
    formData: FormData,
  ) => ({
    ok: true,
    guestSharingEnabled: formData.get("enabled") === "true",
    message: "Tersimpan",
  })),
  updateInvitationPasswordAction: vi.fn(async () => ({ ok: false })),
}));

vi.mock("@/app/invitations/[id]/settings/actions", () => ({
  updateGuestSharingAction,
  updateInvitationPasswordAction,
}));

import { InvitationPasswordForm } from "@/app/invitations/[id]/settings/password-form";

afterEach(() => {
  cleanup();
  updateGuestSharingAction.mockClear();
});

describe("InvitationPasswordForm guest sharing control", () => {
  it("autosaves the guest-sharing setting and updates the access summary", async () => {
    render(
      <InvitationPasswordForm
        genericAccessEnabled
        guestSharingEnabled
        invitationId="invitation-1"
        passwordEnabled={false}
      />,
    );

    const control = screen.getByRole("checkbox", { name: /Izinkan Tamu Membagikan Link/ });
    expect(control).toHaveProperty("checked", true);
    fireEvent.click(control);

    await waitFor(() => expect(updateGuestSharingAction).toHaveBeenCalledTimes(1));
    expect(updateGuestSharingAction.mock.calls[0]?.[2].get("enabled")).toBe("false");
    await waitFor(() => expect(screen.getByText("Tamu dapat membagikan link").parentElement?.textContent).toContain("Tidak"));
    expect(screen.getAllByText("Tersimpan").length).toBeGreaterThan(0);
  });
});
