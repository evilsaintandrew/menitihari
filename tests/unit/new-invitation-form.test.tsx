// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/app/invitations/new/actions", () => ({
  createInvitationAction: vi.fn(),
  initialCreateInvitationActionState: { ok: false },
}));

import { NewInvitationCard } from "@/components/invitations/new-invitation-form";

describe("WF-04 create invitation", () => {
  it("shows only the required creation fields and discloses the trial before submit", () => {
    render(<NewInvitationCard />);

    expect(screen.getByRole("heading", { name: "Mulai dari yang penting" })).toBeTruthy();
    expect(screen.getByLabelText(/Nama tampilan pasangan 1/)).toBeTruthy();
    expect(screen.getByLabelText(/Nama tampilan pasangan 2/)).toBeTruthy();
    expect(screen.getByLabelText(/Tanggal acara utama/).getAttribute("type")).toBe("date");
    expect(screen.getByText("Trial 3 hari dimulai saat undangan dibuat.")).toBeTruthy();
    expect(screen.getByText("Harga Launch Rp79.000 untuk aktivasi 1 tahun setelah pembayaran berhasil.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buat Undangan & Mulai Trial" })).toBeTruthy();
    expect(screen.queryByLabelText(/Venue/i)).toBeNull();
  });
});
