// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const issueGuestShareLinkAction = vi.hoisted(() => vi.fn(async (
  _invitationId: string,
  _previousState: { readonly ok: boolean },
  formData: FormData,
) => ({
  ok: true,
  intent: formData.get("intent") === "share" ? "share" as const : "copy" as const,
  url: "https://menitihari.example/alya-bima/g/issued-token",
})));

vi.mock("@/app/[slug]/share-actions", () => ({ issueGuestShareLinkAction }));

import { PersonalizedShareActions } from "@/components/invitations/personalized-share-actions";

afterEach(() => {
  cleanup();
  issueGuestShareLinkAction.mockClear();
});

describe("personalized guest share actions", () => {
  it("requests a fresh scoped URL before copying it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<PersonalizedShareActions invitationId="invitation-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Salin Link" }));

    await waitFor(() => expect(issueGuestShareLinkAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://menitihari.example/alya-bima/g/issued-token"));
    expect(screen.getByText("Link undangan berhasil disalin.")).toBeTruthy();
  });
});
