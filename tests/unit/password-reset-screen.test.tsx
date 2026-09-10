// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    requestPasswordReset: authMocks.requestPasswordReset,
    resetPassword: authMocks.resetPassword,
  }),
}));

import { PasswordResetRequestScreen, PasswordResetScreen } from "@/components/auth/password-reset-screen";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("PasswordResetRequestScreen", () => {
  it("validates email before sending and shows generic success copy", async () => {
    authMocks.requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
    render(<PasswordResetRequestScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Kirim tautan reset" }));
    expect(screen.getByText("Masukkan email yang valid.")).toBeTruthy();
    expect(authMocks.requestPasswordReset).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "Owner@Example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Kirim tautan reset" }));

    await waitFor(() => expect(screen.getByText("Jika email terdaftar, kami mengirim tautan reset password.")).toBeTruthy());
    expect(authMocks.requestPasswordReset).toHaveBeenCalledWith({
      email: "owner@example.com",
      redirectTo: "/reset-password",
    });
  });
});

describe("PasswordResetScreen", () => {
  it("submits matching passwords with the token and confirms the reset", async () => {
    window.history.replaceState({}, "", "/reset-password?token=opaque-reset-token");
    authMocks.resetPassword.mockResolvedValue({ data: { status: true }, error: null });
    render(<PasswordResetScreen />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Buat password baru" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Password baru/), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText(/Ulangi password baru/), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan password baru" }));

    await waitFor(() => expect(screen.getByText("Berhasil reset password")).toBeTruthy());
    expect(authMocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "new-password",
      token: "opaque-reset-token",
    });
  });

  it("does not submit mismatched passwords", async () => {
    window.history.replaceState({}, "", "/reset-password?token=opaque-reset-token");
    render(<PasswordResetScreen />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Buat password baru" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Password baru/), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText(/Ulangi password baru/), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan password baru" }));

    expect(await screen.findByText("Password belum sama.")).toBeTruthy();
    expect(authMocks.resetPassword).not.toHaveBeenCalled();
  });
});
