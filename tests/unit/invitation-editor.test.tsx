// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommercialState, PublicationState } from "@/generated/prisma/client";
import type { InvitationContent, InvitationRenderData } from "@/modules/invitations";
import type { ResolvedThemePresentation } from "@/modules/themes";

const { saveInvitationContentAction } = vi.hoisted(() => ({
  saveInvitationContentAction: vi.fn(),
}));

vi.mock("@/app/invitations/[id]/edit/actions", () => ({
  saveInvitationContentAction,
}));

vi.mock("@/components/invitations/invitation-theme-view", () => ({
  InvitationThemeView: () => <div data-testid="live-preview" />,
}));

vi.mock("@/components/invitations/theme-error-boundary", () => ({
  ThemeErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

import { InvitationEditor } from "@/app/invitations/[id]/edit/invitation-editor";

const content: InvitationContent = {
  language: "id",
  core: { coupleDisplayName1: "Alya", coupleDisplayName2: "Bima" },
  optional: { opening: "Selamat datang" },
};

const preview: InvitationRenderData = {
  invitationId: "editor-ui-1",
  mode: "preview",
  language: "id",
  timezone: "Asia/Jakarta",
  themeId: "classic",
  themeVersion: "1",
  themeConfig: { accent: "rose", fontPairing: "serif-sans", coverStyle: "centered", sectionStyle: "soft" },
  content,
  events: [],
};

const theme: ResolvedThemePresentation = {
  definition: {
    id: "classic",
    version: "1",
    name: "Klasik Mutiara",
    description: "Tema klasik",
    defaultConfig: { accent: "rose", fontPairing: "serif-sans", coverStyle: "centered", sectionStyle: "soft" },
    preview: { backgroundColor: "#fff8f5", foregroundColor: "#402b35", accentColor: "#bd7185" },
  },
  config: { accent: "rose", fontPairing: "serif-sans", coverStyle: "centered", sectionStyle: "soft" },
  usedFallback: false,
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function renderEditor() {
  return render(
    <InvitationEditor
      invitationId="editor-ui-1"
      invitationTitle="Alya & Bima"
      initialContent={content}
      initialVersion={1}
      preview={preview}
      theme={theme}
      publicationState={PublicationState.DRAFT}
      commercialState={CommercialState.TRIAL}
      canEdit
    />,
  );
}

describe("WF-06 invitation editor", () => {
  it("debounces edits and exposes saving then saved state", async () => {
    vi.useFakeTimers();
    saveInvitationContentAction.mockResolvedValue({ ok: true, version: 2, message: "Perubahan tersimpan." });
    renderEditor();

    fireEvent.change(screen.getByLabelText("Opening"), { target: { value: "Pembuka baru" } });
    expect(screen.getByRole("status").textContent).toContain("Menyimpan…");
    expect(saveInvitationContentAction).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(699);
    });
    expect(saveInvitationContentAction).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(saveInvitationContentAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain("Tersimpan");
  });

  it("keeps local edits and offers retry after a failed save", async () => {
    vi.useFakeTimers();
    saveInvitationContentAction.mockRejectedValueOnce(new Error("network"));
    renderEditor();

    fireEvent.change(screen.getByLabelText("Closing"), { target: { value: "Penutup lokal" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(screen.getByText("Coba lagi")).toBeTruthy();
    expect((screen.getByLabelText("Closing") as HTMLTextAreaElement).value).toBe("Penutup lokal");
  });

  it("shows an explicit conflict recovery action without replacing local content", async () => {
    vi.useFakeTimers();
    saveInvitationContentAction.mockResolvedValue({
      ok: false,
      conflict: true,
      errorCode: "STALE_VERSION",
      message: "This page is out of date. Refresh and try again.",
    });
    renderEditor();

    fireEvent.change(screen.getByLabelText("Opening"), { target: { value: "Draf lokal" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(screen.getByText("Muat versi terbaru")).toBeTruthy();
    expect((screen.getByLabelText("Opening") as HTMLTextAreaElement).value).toBe("Draf lokal");
  });
});
