import { describe, expect, it } from "vitest";

import {
  displayNameFromEmail,
  validateAuthCredentials,
} from "@/modules/auth";

describe("auth credential validation", () => {
  it("normalizes email and accepts the Better Auth password bounds", () => {
    expect(validateAuthCredentials({
      email: "  Alya.Example@Email.COM ",
      password: "correct horse battery staple",
    })).toEqual({
      success: true,
      data: {
        email: "alya.example@email.com",
        password: "correct horse battery staple",
      },
    });
  });

  it("returns field-safe validation messages", () => {
    const result = validateAuthCredentials({ email: "not-an-email", password: "short" });

    expect(result).toEqual({
      success: false,
      errors: {
        email: "Masukkan email yang valid.",
        password: "Password minimal 8 karakter.",
      },
    });
  });

  it("derives the required Better Auth display name without collecting another field", () => {
    expect(displayNameFromEmail("alya.example@email.com")).toBe("alya example");
  });
});
