// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  revokeSessions: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: authMocks.replace }),
}));

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    changePassword: authMocks.changePassword,
    revokeSessions: authMocks.revokeSessions,
    signOut: authMocks.signOut,
  }),
}));

import { AccountSecurityScreen } from "@/components/auth/account-security-screen";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AccountSecurityScreen", () => {
  it("changes the password while asking the server to revoke other sessions", async () => {
    authMocks.changePassword.mockResolvedValue({ data: { status: true }, error: null });
    render(<AccountSecurityScreen />);

    fireEvent.change(screen.getByLabelText(/Password saat ini/), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText(/^Password baru/), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText(/^Konfirmasi password baru/), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Ubah password" }));

    await waitFor(() => expect(authMocks.changePassword).toHaveBeenCalledWith({
      currentPassword: "old-password",
      newPassword: "new-password",
      revokeOtherSessions: true,
    }));
    expect(await screen.findByText("Password berhasil diubah. Perangkat lain sudah dikeluarkan.")).toBeTruthy();
  });

  it("rejects mismatched passwords before calling the server", () => {
    render(<AccountSecurityScreen />);

    fireEvent.change(screen.getByLabelText(/Password saat ini/), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText(/^Password baru/), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText(/^Konfirmasi password baru/), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Ubah password" }));

    expect(screen.getByText("Konfirmasi password harus sama.")).toBeTruthy();
    expect(authMocks.changePassword).not.toHaveBeenCalled();
  });

  it("revokes all sessions, clears this browser session, and returns to login", async () => {
    authMocks.revokeSessions.mockResolvedValue({ data: { status: true }, error: null });
    authMocks.signOut.mockResolvedValue({ data: { success: true }, error: null });
    render(<AccountSecurityScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Keluar dari semua perangkat" }));

    await waitFor(() => expect(authMocks.revokeSessions).toHaveBeenCalledOnce());
    expect(authMocks.signOut).toHaveBeenCalledOnce();
    expect(authMocks.replace).toHaveBeenCalledWith("/login?logged-out=all");
  });

  it("logs out only the current device when requested", async () => {
    authMocks.signOut.mockResolvedValue({ data: { success: true }, error: null });
    render(<AccountSecurityScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Keluar dari perangkat ini" }));

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledOnce());
    expect(authMocks.revokeSessions).not.toHaveBeenCalled();
    expect(authMocks.replace).toHaveBeenCalledWith("/login?logged-out=1");
  });
});
