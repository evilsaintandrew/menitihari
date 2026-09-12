// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvitationRenderer } from "@/components/invitations/invitation-renderer";
import type { InvitationRenderData } from "@/modules/invitations";

vi.mock("@/modules/errors", () => ({ captureSanitizedError: vi.fn() }));

const submitPublicRsvpAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/[slug]/rsvp-actions", () => ({
  initialSubmitRsvpActionState: { ok: false },
  submitPersonalizedRsvpAction: vi.fn(),
  initialSubmitPublicRsvpActionState: { ok: false },
  submitPublicRsvpAction,
}));
vi.mock("@/app/[slug]/share-actions", () => ({
  issueGuestShareLinkAction: vi.fn(async () => ({ ok: false })),
}));

const invitation: InvitationRenderData = {
  invitationId: "invitation-1",
  mode: "public",
  guestSharingEnabled: false,
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
  guest: null,
  rsvp: null,
  publicRsvp: {
    enabled: true,
    approvalRequired: false,
    requirePhone: false,
    maxPartySize: 4,
    events: [{ id: "event-1", name: "Resepsi", startsAt: "2026-12-20T04:00:00.000Z" }],
    capacity: { used: 0, limit: 500, remaining: 500, isNearLimit: false },
    closed: false,
  },
};

afterEach(() => {
  cleanup();
  submitPublicRsvpAction.mockReset();
});

describe("public RSVP interaction", () => {
  it("asks for the owner-selected fields and displays accepting events without guest contact re-entry", () => {
    render(<InvitationRenderer invitation={invitation} />);

    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Kehadiran" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Nama")).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Jumlah hadir" }).getAttribute("max")).toBe("4");
    expect(screen.getByText("Resepsi")).toBeTruthy();
    expect(screen.queryByLabelText(/telepon|email|WhatsApp/i)).toBeNull();
  });

  it("shows phone when the owner requires it and explains the full-capacity state", () => {
    const { rerender } = render(<InvitationRenderer invitation={{
      ...invitation,
      publicRsvp: { ...invitation.publicRsvp!, requirePhone: true },
    }} />);
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Kehadiran" }));
    expect(screen.getByLabelText("Nomor telepon")).toBeTruthy();

    rerender(<InvitationRenderer invitation={{
      ...invitation,
      publicRsvp: { ...invitation.publicRsvp!, closed: true, capacity: { used: 500, limit: 500, remaining: 0, isNearLimit: true } },
    }} />);
    expect(screen.getByText("RSVP sudah ditutup")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Konfirmasi Kehadiran" })).toBeNull();
  });

  it("shows pending approval after a public RSVP when QR eligibility is owner-controlled", async () => {
    submitPublicRsvpAction.mockResolvedValue({
      ok: true,
      result: {
        invitationId: "invitation-1",
        guestId: "guest-1",
        personalizedPath: "/alya-bima/g/token",
        duplicateWarning: false,
        approvalPending: true,
        events: [{ id: "event-1", name: "Resepsi", startsAt: "2026-12-20T04:00:00.000Z" }],
      },
    });
    render(<InvitationRenderer invitation={invitation} />);
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Kehadiran" }));
    fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Rina" } });
    fireEvent.submit(screen.getByRole("button", { name: "Kirim RSVP" }).closest("form")!);

    await waitFor(() => expect(screen.getByText("Menunggu persetujuan untuk QR check-in.")).toBeTruthy());
  });
});
