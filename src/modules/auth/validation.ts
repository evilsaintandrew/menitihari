import { z } from "zod";

export const authEmailSchema = z
  .string({ error: "Masukkan email yang valid." })
  .trim()
  .toLowerCase()
  .email({ error: "Masukkan email yang valid." });

export const authPasswordSchema = z
  .string({ error: "Masukkan password." })
  .min(8, { error: "Password minimal 8 karakter." })
  .max(128, { error: "Password maksimal 128 karakter." });

export const authCredentialsSchema = z.object({
  email: authEmailSchema,
  password: authPasswordSchema,
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type AuthFieldErrors = Partial<Record<keyof AuthCredentials, string>>;

export function validateAuthCredentials(input: unknown):
  | { success: true; data: AuthCredentials }
  | { success: false; errors: AuthFieldErrors } {
  const result = authCredentialsSchema.safeParse(input);

  if (result.success) return result;

  const fieldErrors = result.error.flatten().fieldErrors;
  return {
    success: false,
    errors: {
      email: fieldErrors.email?.[0],
      password: fieldErrors.password?.[0],
    },
  };
}

/** Better Auth requires a display name; AUTH-001 intentionally keeps WF-02 to two fields. */
export function displayNameFromEmail(email: string): string {
  const localPart = email.slice(0, email.indexOf("@"));
  return localPart.replace(/[._-]+/g, " ").trim() || "Menitihari user";
}
