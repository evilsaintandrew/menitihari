import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().url().optional(),
);

const optionalPositiveInteger = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().trim().url(),
  DATABASE_URL: z.string().trim().url().refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "must be a PostgreSQL connection URL",
  ),
  BETTER_AUTH_SECRET: z.string().trim().min(32).optional(),
  RESEND_API_KEY: z.string().trim().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().trim().min(1).optional(),
  SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  SENTRY_ENVIRONMENT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  ACCOUNT_DELETION_COOLING_OFF_SECONDS: optionalPositiveInteger,
  INVITATION_PURGE_WINDOW_SECONDS: optionalPositiveInteger,
});

export type AppEnv = z.infer<typeof envSchema>;
export type RawEnv = Record<string, string | undefined>;

export function parseEnv(input: RawEnv): AppEnv {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration. ${details}`);
  }

  return result.data;
}
