// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommercialState } from "@/generated/prisma/client";
import type { GuestManagementData } from "@/modules/guests";

vi.mock("@/app/invitations/[id]/guests/actions", () => ({
  saveGuestAction: async () => ({ ok: true }),
  archiveGuestAction: async () => ({ ok: true }),
  bulkUpdateGuestsAction: async () => ({ ok: true }),
  getGuestMergePreviewAction: async () => ({ ok: false }),
  mergeGuestAction: async () => ({ ok: true }),
  renderWhatsAppMessageAction: async () => ({
    ok: true,
    rendered: {
      invitationId: "invitation-1",
      guestId: "guest-1",
      templateType: "INVITATION",
      guestName: "Keluarga Santoso",
      phone: "0812 3456 7890",
      invitationUrl: "https://menitihari.example/alya-bima/g/token",
      message: "Hai Keluarga Santoso",
      activationVersion: 1,
    },
  }),
  openWhatsAppAction: async () => ({ ok: true }),
  setPublicRsvpApprovalAction: async () => ({ ok: true }),
  setRsvpControlAction: async () => ({ ok: true }),
  overrideRsvpAction: async () => ({ ok: true }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { GuestsManager } from "@/app/invitations/[id]/guests/guests-manager";

afterEach(() => {
  cleanup();
});

function data(overrides: Partial<GuestManagementData> = {}): GuestManagementData {
  return {
    invitationId: "invitation-1",
    invitationVersion: 2,
    commercialState: CommercialState.TRIAL,
    trialEndsAt: "2026-09-13T08:30:00.000Z",
    activeUntil: null,
    whatsappTrialContactUsage: {
      used: 0,
      limit: 30,
      remaining: 30,
    },
    canEdit: true,
    invitedPeopleCapacity: {
      used: 3,
      limit: 500,
      remaining: 497,
      isNearLimit: false,
    },
    groups: [{ id: "group-family", name: "Keluarga" }],
    events: [{ id: "event-1", name: "Resepsi", timezone: "Asia/Jakarta", endsAt: null, rsvpEnabled: true, rsvpClosesAt: null, rsvpClosesAtDate: "", rsvpClosesAtTime: "", eventActive: true, rsvpWindowOpen: true }],
    guests: [{
      id: "guest-1",
      displayName: "Keluarga Santoso",
      displayPhone: "0812 3456 7890",
      normalizedPhone: "+6281234567890",
      notes: null,
      group: { id: "group-family", name: "Keluarga" },
      assignedEvents: [],
      distributionStatus: "NOT_SENT",
      viewedAt: null,
      whatsappFirstOpenedAt: null,
      whatsappLastOpenedAt: null,
      whatsappOpenedCount: 0,
      createdAt: "2026-09-11T08:30:00.000Z",
    }],
    ...overrides,
  };
}

describe("GuestsManager", () => {
  it("shows the add-guest form and clear owner-facing fields", () => {
    render(<GuestsManager data={data({ guests: [] })} />);

    expect(screen.getByRole("heading", { name: "Tamu undangan" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tambah tamu" })).toBeTruthy();
    expect(screen.getByLabelText(/Nama tamu \/ penerima/)).toBeTruthy();
    expect(screen.getByLabelText(/Nomor WhatsApp/)).toBeTruthy();
    expect(screen.getByLabelText("Grup (opsional)")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Resepsi" }));
    expect(screen.getByLabelText("Maksimal orang untuk Resepsi")).toHaveProperty("value", "1");
    expect(screen.getByRole("button", { name: "Simpan tamu" })).toBeTruthy();
  });

  it("filters guest cards by name, phone, or group", () => {
    render(<GuestsManager data={data({ guests: [
      data().guests[0],
      { ...data().guests[0], id: "guest-2", displayName: "Rina", displayPhone: null, group: null },
    ] })} />);

    expect(screen.getByRole("heading", { name: "Keluarga Santoso" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Rina" })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Cari tamu" }), { target: { value: "rina" } });
    expect(screen.queryByRole("heading", { name: "Keluarga Santoso" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Rina" })).toBeTruthy();
  });

  it("filters the guest list to parties with an unanswered RSVP", () => {
    const baseGuest = data().guests[0];
    render(<GuestsManager data={data({ guests: [
      { ...baseGuest, assignedEvents: [{ id: "event-1", assignmentId: "assignment-1", name: "Resepsi", maxPartySize: 2, rsvpStatus: null, attendanceCount: null }] },
      { ...baseGuest, id: "guest-2", displayName: "Rina", assignedEvents: [{ id: "event-1", assignmentId: "assignment-2", name: "Resepsi", maxPartySize: 1, rsvpStatus: "ATTENDING", attendanceCount: 1 }] },
    ] })} />);

    fireEvent.change(screen.getByLabelText("Filter RSVP"), { target: { value: "PENDING" } });
    expect(screen.getByRole("heading", { name: "Keluarga Santoso" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Rina" })).toBeNull();
  });

  it("filters distribution and viewed status independently", () => {
    const baseGuest = data().guests[0];
    render(<GuestsManager data={data({ guests: [
      { ...baseGuest, displayName: "Belum", distributionStatus: "NOT_SENT", viewedAt: null },
      { ...baseGuest, id: "guest-2", displayName: "Terkirim", distributionStatus: "MARKED_SENT", viewedAt: "2026-09-11T09:00:00.000Z" },
      { ...baseGuest, id: "guest-3", displayName: "Dibuka", distributionStatus: "NOT_SENT", whatsappLastOpenedAt: "2026-09-11T09:00:00.000Z", viewedAt: "2026-09-11T09:00:00.000Z" },
    ] })} />);

    fireEvent.change(screen.getByLabelText("Filter distribusi"), { target: { value: "MARKED_SENT" } });
    expect(screen.getByRole("heading", { name: "Terkirim" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Belum" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Dibuka" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Filter dilihat"), { target: { value: "NOT_VIEWED" } });
    expect(screen.queryByRole("heading", { name: "Terkirim" })).toBeNull();
  });

  it("shows public RSVP approval state and owner eligibility actions", () => {
    const baseGuest = data().guests[0];
    render(<GuestsManager data={data({ guests: [{
      ...baseGuest,
      assignedEvents: [{
        id: "event-1",
        assignmentId: "assignment-1",
        name: "Resepsi",
        maxPartySize: 2,
        rsvpStatus: "ATTENDING",
        rsvpSource: "PUBLIC",
        publicRsvpApproval: "PENDING",
        attendanceCount: 1,
      }],
    }] })} />);

    expect(screen.getAllByText("Menunggu persetujuan QR").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Setujui QR" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tolak QR" })).toBeTruthy();
  });

  it("keeps editing and archive actions disabled for read-only lifecycle states", () => {
    render(<GuestsManager data={data({ canEdit: false, commercialState: CommercialState.GRACE })} />);

    expect(screen.getByRole("button", { name: "Edit" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Hapus" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Daftar tamu hanya-baca")).toBeTruthy();
  });

  it("shows the invited-people counter and near-capacity warning", () => {
    render(<GuestsManager data={data({
      invitedPeopleCapacity: { used: 450, limit: 500, remaining: 50, isNearLimit: true },
    })} />);

    expect(screen.getByRole("heading", { name: "450 / 500 orang diundang" })).toBeTruthy();
    expect(screen.getByText("Kapasitas tamu hampir penuh. Sisa 50 orang.")).toBeTruthy();
  });

  it("shows the shared trial WhatsApp contact usage and repeat-contact rule", () => {
    render(<GuestsManager data={data({
      whatsappTrialContactUsage: { used: 12, limit: 30, remaining: 18 },
    })} />);

    expect(screen.getByRole("heading", { name: "12 / 30 kontak WhatsApp digunakan" })).toBeTruthy();
    expect(screen.getByText("Kontak yang sama tidak dihitung lagi.", { exact: false })).toBeTruthy();
  });

  it("shows distribution state and exposes compact bulk actions after selection", () => {
    render(<GuestsManager data={data({ guests: [{
      ...data().guests[0],
      distributionStatus: "MARKED_SENT",
      viewedAt: "2026-09-11T09:00:00.000Z",
    }] })} />);

    expect(screen.getByText("Ditandai Terkirim · Dilihat")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Pilih Keluarga Santoso" }));
    expect(screen.getByRole("heading", { name: "1 tamu dipilih" })).toBeTruthy();
    expect(screen.getByLabelText("Tindakan")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tindakan"), { target: { value: "DISTRIBUTION" } });
    expect(screen.getByLabelText("Status baru")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Terapkan ke tamu terpilih" })).toBeTruthy();
  });

  it("shows WhatsApp opened separately from manual Sent and Viewed", () => {
    const guest = data().guests[0];
    render(<GuestsManager data={data({ guests: [{
      ...guest,
      distributionStatus: "MARKED_SENT",
      viewedAt: "2026-09-11T09:00:00.000Z",
      whatsappFirstOpenedAt: "2026-09-11T08:00:00.000Z",
      whatsappLastOpenedAt: "2026-09-11T08:05:00.000Z",
      whatsappOpenedCount: 2,
    }] })} />);

    expect(screen.getByText("Ditandai Terkirim · WhatsApp Dibuka · Dilihat · Dibuka 2x")).toBeTruthy();
  });

  it("exposes the WF-12 personal message action for assigned guests", async () => {
    const guest = data().guests[0];
    render(<GuestsManager data={data({ guests: [{
      ...guest,
      assignedEvents: [{ id: "event-1", assignmentId: "assignment-1", name: "Resepsi", maxPartySize: 2, rsvpStatus: null, attendanceCount: null }],
    }] })} />);

    expect(screen.getByRole("button", { name: "Bagikan" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bagikan" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Buka WhatsApp" })).toBeTruthy());
    expect(screen.getAllByText("Belum Dikirim · Belum Dilihat")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Tandai Terkirim" })).toBeTruthy();
  });

  it("copies the issued personalized link and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const guest = data().guests[0];
    render(<GuestsManager data={data({ guests: [{
      ...guest,
      assignedEvents: [{ id: "event-1", assignmentId: "assignment-1", name: "Resepsi", maxPartySize: 2, rsvpStatus: null, attendanceCount: null }],
    }] })} />);

    fireEvent.click(screen.getByRole("button", { name: "Bagikan" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salin Link" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Salin Link" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://menitihari.example/alya-bima/g/token"));
    expect(screen.getByText("Link personal berhasil disalin.")).toBeTruthy();
  });

  it("exposes a manual merge review for duplicate warnings", () => {
    const guests = data().guests;
    render(<GuestsManager data={data({ guests: [
      { ...guests[0], duplicateWarnings: [{ guestId: "guest-2", displayName: "Andi", displayPhone: null, matchingSignals: ["NAME"] }] },
      { ...guests[0], id: "guest-2", displayName: "Andi", displayPhone: null },
    ] })} />);

    expect(screen.getByText("Andi", { selector: "strong" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tinjau merge" })).toBeTruthy();
  });
});
