import { PrismaPg } from "@prisma/adapter-pg";
import { createEmailVerificationToken } from "better-auth/api";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testAuthSecret = "test-secret-for-auth-integration-32-chars";
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
      secret: testAuthSecret,
      database: prismaAdapter(testPrisma, { provider: "postgresql" }),
      emailAndPassword: { enabled: true },
      rateLimit: { enabled: false },
      advanced: { useSecureCookies: true },
    })
  : undefined;

const verificationMessages: Array<{ url: string; token: string }> = [];
const verificationAuth = testPrisma
  ? betterAuth({
      baseURL: "https://menitihari.example",
      secret: testAuthSecret,
      database: prismaAdapter(testPrisma, { provider: "postgresql" }),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
      },
      emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ url, token }) => {
          verificationMessages.push({ url, token });
        },
        afterEmailVerification: async (user) => {
          await testPrisma!.user.updateMany({
            where: { id: user.id, emailVerified: true, emailVerifiedAt: null },
            data: { emailVerifiedAt: new Date() },
          });
        },
      },
      rateLimit: { enabled: false },
      advanced: { useSecureCookies: true },
    })
  : undefined;

const resetMessages: Array<{ url: string; token: string }> = [];
const resetAuth = testPrisma
  ? betterAuth({
      baseURL: "https://menitihari.example",
      secret: testAuthSecret,
      database: prismaAdapter(testPrisma, { provider: "postgresql" }),
      emailAndPassword: {
        enabled: true,
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ url, token }) => {
          resetMessages.push({ url, token });
        },
      },
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
    expect(duplicate.status).toBe(422);

    const wrongPassword = await testAuth!.api.signInEmail({
      body: { email, password: "wrong-password" },
      asResponse: true,
    });
    expect(wrongPassword.status).toBe(401);
    expect((await wrongPassword.json()).message).not.toContain(email);

    await testPrisma!.user.delete({ where: { email } });
  });

  it.skipIf(!testDatabaseUrl)("sends verification, persists state, and safely handles expiry/replay", async () => {
    const email = `verify-${Date.now()}@example.com`;
    verificationMessages.length = 0;

    const signup = await verificationAuth!.api.signUpEmail({
      body: { email, name: "Verification integration", password: "correct-password" },
      asResponse: true,
    });

    expect(signup.status).toBe(200);
    expect(signup.headers.get("set-cookie")).toBeNull();
    expect(verificationMessages).toHaveLength(1);
    expect(verificationMessages[0]!.url).toContain("/verify-email?token=");
    expect(verificationMessages[0]!.url).not.toContain(email);
    expect(await testPrisma!.user.findUnique({ where: { email } })).toMatchObject({
      emailVerified: false,
      emailVerifiedAt: null,
    });

    const verified = await verificationAuth!.api.verifyEmail({
      query: { token: verificationMessages[0]!.token },
      asResponse: true,
    });
    expect(verified.status).toBe(200);
    expect(await testPrisma!.user.findUnique({ where: { email } })).toMatchObject({
      emailVerified: true,
      emailVerifiedAt: expect.any(Date),
    });

    const replay = await verificationAuth!.api.verifyEmail({
      query: { token: verificationMessages[0]!.token },
      asResponse: true,
    });
    expect(replay.status).toBe(200);

    const expiredToken = await createEmailVerificationToken(testAuthSecret, email, undefined, -1);
    const expired = await verificationAuth!.api.verifyEmail({
      query: { token: expiredToken },
      asResponse: true,
    });
    expect(expired.status).toBe(401);

    await testPrisma!.user.delete({ where: { email } });
  });

  it.skipIf(!testDatabaseUrl)("resets password generically, revokes sessions, and consumes reset tokens", async () => {
    const email = `reset-${Date.now()}@example.com`;
    resetMessages.length = 0;

    const signup = await resetAuth!.api.signUpEmail({
      body: { email, name: "Reset integration", password: "old-password" },
      asResponse: true,
    });
    expect(signup.status).toBe(200);
    const user = await testPrisma!.user.findUniqueOrThrow({ where: { email } });

    const secondLogin = await resetAuth!.api.signInEmail({
      body: { email, password: "old-password" },
      asResponse: true,
    });
    expect(secondLogin.status).toBe(200);
    expect(await testPrisma!.session.count({ where: { userId: user.id } })).toBeGreaterThanOrEqual(2);

    const unknown = await resetAuth!.api.requestPasswordReset({
      body: { email: "missing@example.com", redirectTo: "/reset-password" },
      asResponse: true,
    });
    const known = await resetAuth!.api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
      asResponse: true,
    });
    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());
    expect(resetMessages).toHaveLength(1);
    expect(resetMessages[0]!.url).toContain("/reset-password/");
    expect(resetMessages[0]!.url).not.toContain(email);

    const reset = await resetAuth!.api.resetPassword({
      body: { token: resetMessages[0]!.token, newPassword: "new-password" },
      asResponse: true,
    });
    expect(reset.status).toBe(200);
    expect(await testPrisma!.session.count({ where: { userId: user.id } })).toBe(0);

    const oldLogin = await resetAuth!.api.signInEmail({
      body: { email, password: "old-password" },
      asResponse: true,
    });
    expect(oldLogin.status).toBe(401);
    const newLogin = await resetAuth!.api.signInEmail({
      body: { email, password: "new-password" },
      asResponse: true,
    });
    expect(newLogin.status).toBe(200);

    const replay = await resetAuth!.api.resetPassword({
      body: { token: resetMessages[0]!.token, newPassword: "another-password" },
      asResponse: true,
    });
    expect(replay.status).toBe(400);

    await testPrisma!.verification.create({
      data: {
        identifier: "reset-password:expired-token",
        value: user.id,
        expiresAt: new Date(Date.now() - 1_000),
      },
    });
    const expired = await resetAuth!.api.resetPassword({
      body: { token: "expired-token", newPassword: "another-password" },
      asResponse: true,
    });
    expect(expired.status).toBe(400);

    await testPrisma!.user.delete({ where: { email } });
  });
});

afterAll(async () => {
  await testPrisma?.$disconnect();
});
