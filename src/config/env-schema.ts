import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().trim().url(),
  DATABASE_URL: z.string().trim().url().refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "must be a PostgreSQL connection URL",
  ),
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
