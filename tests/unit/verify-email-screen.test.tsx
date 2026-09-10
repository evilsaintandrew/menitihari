// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    getSession: vi.fn().mockResolvedValue({ data: null }),
    sendVerificationEmail: vi.fn(),
  }),
}));

import { VerifyEmailScreen, maskVerificationEmail } from "@/components/auth/verify-email-screen";

afterEach(() => cleanup());

describe("VerifyEmailScreen", () => {
  it("masks the email and exposes the WF-03 recovery actions", () => {
    expect(maskVerificationEmail("Alya.Example@Email.COM")).toBe("a••••@email.com");
    render(<VerifyEmailScreen />);

    expect(screen.getByText("Verifikasi email Anda")).toBeTruthy();
    expect(screen.getByText("Gunakan email lain")).toBeTruthy();
  });

  it("renders the verified continuation state", () => {
    window.history.pushState({}, "", "/verify-email?verified=1");
    render(<VerifyEmailScreen />);

    return vi.waitFor(() => {
      expect(screen.getByText("Email terverifikasi")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Lanjut buat undangan" }).getAttribute("href")).toBe("/invitations/new");
    });
  });
});
