// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommercialState } from "@/generated/prisma/client";
import type { GuestManagementData } from "@/modules/guests";

vi.mock("@/app/invitations/[id]/guests/actions", () => ({
  saveGuestAction: async () => ({ ok: true }),
  archiveGuestAction: async () => ({ ok: true }),
  bulkUpdateGuestsAction: async () => ({ ok: true }),
  getGuestMergePreviewAction: async () => ({ ok: false }),
  mergeGuestAction: async () => ({ ok: true }),
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
    canEdit: true,
    invitedPeopleCapacity: {
      used: 3,
      limit: 500,
      remaining: 497,
      isNearLimit: false,
    },
    groups: [{ id: "group-family", name: "Keluarga" }],
    events: [{ id: "event-1", name: "Resepsi" }],
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
