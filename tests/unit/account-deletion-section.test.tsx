// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDeletionSection } from "@/components/auth/account-deletion-section";

const fetchMock = vi.fn();

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(response({ state: "ACTIVE", cancellableUntil: null }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AccountDeletionSection", () => {
  it("requires the strong confirmation phrase before sending a deletion request", () => {
    render(<AccountDeletionSection />);
    fireEvent.click(screen.getByRole("button", { name: "Jadwalkan Hapus Akun" }));

    fireEvent.change(screen.getByLabelText(/Password saat ini/), { target: { value: "correct-password" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Jadwalkan Hapus Akun" })[1]!);

    expect(screen.getByText("Ketik HAPUS AKUN untuk melanjutkan.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the server deadline after scheduling and sends the reauth password", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ state: "ACTIVE", cancellableUntil: null }))
      .mockResolvedValueOnce(response({ state: "DELETION_COOLING_OFF", cancellableUntil: "2026-09-11T00:00:00.000Z" }));
    render(<AccountDeletionSection />);
    fireEvent.click(screen.getByRole("button", { name: "Jadwalkan Hapus Akun" }));
    fireEvent.change(screen.getByLabelText(/Password saat ini/), { target: { value: "correct-password" } });
    fireEvent.change(screen.getByLabelText(/Ketik HAPUS AKUN/), { target: { value: "HAPUS AKUN" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Jadwalkan Hapus Akun" })[1]!);

    await waitFor(() => expect(screen.getByText(/Penghapusan akun dijadwalkan/)).toBeTruthy());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/account/deletion", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ password: "correct-password", confirmation: "HAPUS AKUN" }),
    }));
    expect(screen.getByText(/11 September 2026/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Batalkan Penghapusan Akun" })).toBeTruthy();
  });

  it("allows cancellation and explains that invitations stay unpublished", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ state: "DELETION_COOLING_OFF", cancellableUntil: "2026-09-11T00:00:00.000Z" }))
      .mockResolvedValueOnce(response({ state: "ACTIVE", cancellableUntil: null }));
    render(<AccountDeletionSection />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Batalkan Penghapusan Akun" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Batalkan Penghapusan Akun" }));

    await waitFor(() => expect(screen.getByText("Penghapusan akun dibatalkan. Undangan tidak dipublish ulang otomatis.")).toBeTruthy());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/account/deletion", { method: "DELETE" });
  });
});
