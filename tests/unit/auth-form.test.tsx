// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: authMocks.replace }),
}));

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    signIn: { email: authMocks.signIn },
    signUp: { email: authMocks.signUp },
  }),
}));

import { AuthForm } from "@/components/auth/auth-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthForm", () => {
  it("shows inline validation without sending invalid credentials", () => {
    render(<AuthForm mode="signup" />);

    fireEvent.click(screen.getByRole("button", { name: "Buat Akun" }));

    expect(screen.getByText("Masukkan email yang valid.")).toBeTruthy();
    expect(screen.getByText("Password minimal 8 karakter.")).toBeTruthy();
    expect(authMocks.signUp).not.toHaveBeenCalled();
  });

  it("uses generic conflict copy and preserves entered values", async () => {
    authMocks.signUp.mockResolvedValue({
      data: null,
      error: { message: "User already exists", status: 400 },
    });
    render(<AuthForm mode="signup" />);

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Buat Akun" }));

    await waitFor(() => expect(screen.getByText("Tidak dapat membuat akun dengan data tersebut. Coba masuk atau gunakan email lain.")).toBeTruthy());
    expect((screen.getByLabelText(/Email/) as HTMLInputElement).value).toBe("owner@example.com");
    expect((screen.getByLabelText(/Password/) as HTMLInputElement).value).toBe("correct-password");
    expect(screen.queryByText("User already exists")).toBeNull();
  });

  it("routes a new account to the verification screen after signup", async () => {
    authMocks.signUp.mockResolvedValue({
      data: { user: { emailVerified: false } },
      error: null,
    });
    render(<AuthForm mode="signup" />);

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Buat Akun" }));

    await waitFor(() => expect(authMocks.replace).toHaveBeenCalledWith("/verify-email?sent=1"));
    expect(screen.queryByText("User already exists")).toBeNull();
  });

  it("routes an unverified login to resend verification", async () => {
    authMocks.signIn.mockResolvedValue({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", status: 403 },
    });
    render(<AuthForm mode="login" />);

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    await waitFor(() => expect(authMocks.replace).toHaveBeenCalledWith("/verify-email"));
  });

  it("shows a successful login without exposing provider response details", async () => {
    authMocks.signIn.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    render(<AuthForm mode="login" />);

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    await waitFor(() => expect(screen.getByText("Sesi aman Anda sudah aktif di perangkat ini.")).toBeTruthy());
  });
});
