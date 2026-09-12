// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvitationRenderer } from "@/components/invitations/invitation-renderer";
import { RsvpStatus } from "@/generated/prisma/client";
import type { InvitationRenderData } from "@/modules/invitations";

vi.mock("@/modules/errors", () => ({ captureSanitizedError: vi.fn() }));
vi.mock("@/app/[slug]/rsvp-actions", () => ({
  initialSubmitRsvpActionState: { ok: false },
  submitPersonalizedRsvpAction: vi.fn(),
}));

const event = {
  id: "event-1",
  name: "Resepsi",
  startsAt: "2026-12-20T04:00:00.000Z",
  endsAt: null,
  timezone: "Asia/Jakarta",
  maxPartySize: 4,
  status: RsvpStatus.PENDING,
  attendanceCount: null,
  notAttendingReason: null,
  canRespond: true,
};

const invitation: InvitationRenderData = {
  invitationId: "invitation-1",
  mode: "personalized",
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
  events: [{
    id: "event-1",
    name: "Resepsi",
    startsAt: event.startsAt,
    endsAt: null,
    timezone: event.timezone,
    venue: null,
    address: null,
    mapsUrl: null,
    locationNote: null,
    livestreamUrl: null,
    dressCode: null,
    contact: null,
    cancelledAt: null,
    cancellationMessage: null,
  }],
  guest: { displayName: "Keluarga Santoso" },
  rsvp: { enabled: true, events: [event] },
};

afterEach(() => cleanup());

describe("personalized RSVP interaction", () => {
  it("shows the guest-only RSVP action and opens the per-event dialog without contact fields", () => {
    render(<InvitationRenderer invitation={invitation} />);

    expect(screen.getByRole("heading", { name: "Konfirmasi kehadiran Anda" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Konfirmasi Kehadiran" })).toBeTruthy();
    expect(screen.queryByText("Keluarga Lain")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Kehadiran" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Konfirmasi Kehadiran" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Hadir" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Tidak hadir" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Jumlah hadir untuk Resepsi" })).toHaveProperty("value", "1");
    expect(screen.queryByLabelText(/telepon|email|WhatsApp/i)).toBeNull();
  });

  it("bounds the attending count to the assigned maximum and shows closed saved responses", () => {
    const closedInvitation: InvitationRenderData = {
      ...invitation,
      rsvp: {
        enabled: true,
        events: [{ ...event, status: RsvpStatus.ATTENDING, attendanceCount: 4, canRespond: false }],
      },
    };
    render(<InvitationRenderer invitation={closedInvitation} />);

    expect(screen.getByText("Hadir · 4 orang")).toBeTruthy();
    expect(screen.getByText("RSVP sudah ditutup")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simpan RSVP" })).toBeNull();
  });
});
