// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvitationRenderer } from "@/components/invitations/invitation-renderer";
import { ThemeErrorBoundary } from "@/components/invitations/theme-error-boundary";
import type { InvitationRenderData } from "@/modules/invitations";

const captureSanitizedError = vi.hoisted(() => vi.fn());
vi.mock("@/modules/errors", () => ({ captureSanitizedError }));

const invitation: InvitationRenderData = {
  invitationId: "invitation-1",
  mode: "preview",
  language: "id",
  timezone: "Asia/Jakarta",
  themeId: "classic",
  themeVersion: "1",
  themeConfig: { accent: "rose", fontPairing: "serif-sans", coverStyle: "centered", sectionStyle: "soft" },
  content: {
    language: "id",
    core: { coupleDisplayName1: "Alya", coupleDisplayName2: "Bima" },
    optional: {},
  },
  events: [],
};

afterEach(() => {
  cleanup();
  captureSanitizedError.mockClear();
});

describe("shared invitation renderer", () => {
  it("renders the same presentation entry point with a validated theme", () => {
    render(<InvitationRenderer invitation={invitation} />);

    expect(screen.getByRole("article").getAttribute("data-theme")).toBe("classic");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Alya");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Bima");
  });

  it("falls back when persisted theme metadata is unknown or malformed", () => {
    render(<InvitationRenderer invitation={{
      ...invitation,
      themeId: "deleted-theme",
      themeVersion: "99",
      themeConfig: { businessRule: "paid-only" },
    }} />);

    expect(screen.getByRole("article").getAttribute("data-theme")).toBe("classic");
    expect(screen.getByRole("article").getAttribute("data-theme-fallback")).toBe("true");
  });

  it("shows a retryable neutral fallback and reports only through the sanitizer", async () => {
    const error = new Error("raw guest email and token");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function BrokenTheme() {
      throw error;
    }

    render(
      <ThemeErrorBoundary themeName="Klasik Mutiara">
        <BrokenTheme />
      </ThemeErrorBoundary>,
    );

    expect(screen.getByRole("alert").textContent).toContain("Data undangan tetap aman");
    await waitFor(() => expect(captureSanitizedError).toHaveBeenCalledWith(
      error,
      { operation: "invitation.theme_render" },
    ));
    expect(screen.queryByText(/raw guest email|token/)).toBeNull();
    consoleError.mockRestore();
  });
});
