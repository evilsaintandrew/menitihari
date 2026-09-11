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

  it("uses the persisted section order and selected theme accent", () => {
    render(<InvitationRenderer invitation={{
      ...invitation,
      themeConfig: { accent: "blush", fontPairing: "serif-sans", coverStyle: "centered", sectionStyle: "soft" },
      content: {
        ...invitation.content,
        optional: {
          opening: "Opening copy",
          loveStory: { milestones: [{ title: "Bertemu" }] },
        },
        sectionOrder: ["couple", "love_story", "events", "opening_closing"],
      },
      events: [{
        id: "event-1",
        name: "Resepsi",
        startsAt: "2026-12-20T03:00:00.000Z",
        endsAt: null,
        timezone: "Asia/Jakarta",
        venue: null,
        address: null,
        mapsUrl: null,
        locationNote: null,
        livestreamUrl: null,
        dressCode: null,
      }],
    }} />);

    const article = screen.getByRole("article");
    const sections = Array.from(article.querySelectorAll(".invitation-renderer-section"));
    expect(article.getAttribute("data-accent")).toBe("blush");
    expect(article.style.getPropertyValue("--invitation-accent")).toBe("#df86a8");
    expect(sections.map((section) => section.textContent)).toEqual([
      expect.stringContaining("Kisah Kami"),
      expect.stringContaining("Rangkaian Acara"),
      expect.stringContaining("Opening copy"),
    ]);
  });

  it("renders optional couple details, social links, quote, hashtag, and Love Story content", () => {
    render(<InvitationRenderer invitation={{
      ...invitation,
      content: {
        ...invitation.content,
        optional: {
          fullNames: { person1: "Alya Putri", person2: "Bima Pratama" },
          parentFields: { person1: { father: "Arif", mother: "Sari" } },
          opening: "Selamat datang",
          closing: "Sampai jumpa",
          quoteOrPrayer: "Semoga penuh kasih.",
          hashtag: "#AlyaBima",
          socialLinks: { instagram: "https://instagram.com/alyabima" },
          loveStory: { milestones: [{ date: "2019", title: "Pertama bertemu", description: "Awal cerita kami." }] },
        },
        sectionOrder: ["couple", "events", "opening_closing", "love_story"],
      },
    }} />);

    expect(screen.getByText("Alya Putri")).toBeTruthy();
    expect(screen.getByText("Arif & Sari")).toBeTruthy();
    expect((screen.getByRole("link", { name: "Instagram" }) as HTMLAnchorElement).href).toBe("https://instagram.com/alyabima");
    expect(screen.getByText("Semoga penuh kasih.")).toBeTruthy();
    expect(screen.getByText("#AlyaBima")).toBeTruthy();
    expect(screen.getByText("Pertama bertemu")).toBeTruthy();
  });
});
