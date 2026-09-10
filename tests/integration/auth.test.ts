import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testPrisma = testDatabaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: testDatabaseUrl,
        max: 2,
        connectionTimeoutMillis: 5_000,
      }),
    })
  : undefined;

const testAuth = testPrisma
  ? betterAuth({
      baseURL: "https://menitihari.example",
      secret: "test-secret-for-auth-integration-32-chars",
      database: prismaAdapter(testPrisma, { provider: "postgresql" }),
      emailAndPassword: { enabled: true },
      rateLimit: { enabled: false },
      advanced: { useSecureCookies: true },
    })
  : undefined;

describe("Better Auth email/password integration", () => {
  it.skipIf(!testDatabaseUrl)("creates one account and a secure session", async () => {
    const email = `auth-${Date.now()}@example.com`;
    const password = "correct-password";

    const signup = await testAuth!.api.signUpEmail({
      body: { email, name: "Auth integration", password },
      asResponse: true,
    });

    expect(signup.status).toBe(200);
    expect(signup.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(signup.headers.get("set-cookie")).toMatch(/Secure/i);
    expect(signup.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
    expect(await testPrisma!.user.count({ where: { email } })).toBe(1);

    const duplicate = await testAuth!.api.signUpEmail({
      body: { email, name: "Auth integration", password },
      asResponse: true,
    });
    expect(duplicate.status).toBe(400);

    const wrongPassword = await testAuth!.api.signInEmail({
      body: { email, password: "wrong-password" },
      asResponse: true,
    });
    expect(wrongPassword.status).toBe(401);
    expect((await wrongPassword.json()).message).not.toContain(email);

    await testPrisma!.user.delete({ where: { email } });
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
