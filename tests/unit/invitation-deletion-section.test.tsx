// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvitationDeletionSection } from "@/components/invitations/invitation-deletion-section";

const fetchMock = vi.fn();

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("InvitationDeletionSection", () => {
  it("offers export before opening the destructive confirmation", () => {
    render(<InvitationDeletionSection invitationId="inv-1" invitationTitle="Alya & Bima" commercialState="PAID_ACTIVE" purgeAt={null} />);

    expect(screen.getByRole("link", { name: "Export Data Dulu" }).getAttribute("href")).toBe("/invitations/inv-1/export");
    fireEvent.click(screen.getByRole("button", { name: "Hapus Undangan…" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Tidak ada refund otomatis.")).toBeTruthy();
  });

  it("requires HAPUS and shows the scheduled offline state after success", async () => {
    fetchMock.mockResolvedValue(response({
      state: "DELETION_PENDING",
      purgeAt: "2026-09-17T00:00:00.000Z",
    }));
    render(<InvitationDeletionSection invitationId="inv-1" invitationTitle="Alya & Bima" commercialState="TRIAL" purgeAt={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Hapus Undangan…" }));
    fireEvent.click(screen.getByRole("button", { name: "Hapus Undangan", exact: true }));

    expect(screen.getByText("Ketik HAPUS untuk melanjutkan.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Ketik HAPUS/), { target: { value: "HAPUS" } });
    fireEvent.click(screen.getByRole("button", { name: "Hapus Undangan", exact: true }));

    await waitFor(() => expect(screen.getByText(/penghapusan datanya dijadwalkan/)).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/invitations/inv-1/deletion", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ confirmation: "HAPUS" }),
    }));
    expect(screen.getByText(/17 September 2026/)).toBeTruthy();
  });
});
