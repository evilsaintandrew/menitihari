import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { env } from "@/config/env";
import {
  createPasswordResetEmailSender,
  createVerificationEmailSender,
  enforcePasswordChangeSessionRevocation,
} from "@/modules/auth";
import { createResendEmailService, type EmailService } from "@/providers";
import { prisma } from "@/server/db";

export interface AuthDependencies {
  readonly emailService?: EmailService;
}

export function createAuth(dependencies: AuthDependencies = {}) {
  const emailService =
    dependencies.emailService ?? createResendEmailService({ apiKey: env.RESEND_API_KEY });

  return betterAuth({
    appName: "Menitihari",
    baseURL: env.NEXT_PUBLIC_APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: createPasswordResetEmailSender(
        emailService,
        env.RESEND_FROM_EMAIL,
      ),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: createVerificationEmailSender(
        emailService,
        env.RESEND_FROM_EMAIL,
      ),
      afterEmailVerification: async (user) => {
        await prisma.user.updateMany({
          where: { id: user.id, emailVerified: true, emailVerifiedAt: null },
          data: { emailVerifiedAt: new Date() },
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 60,
      max: 5,
      customRules: {
        "/sign-up/email": { window: 60, max: 5 },
        "/sign-in/email": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
    advanced: {
      useSecureCookies:
        env.NODE_ENV === "production" || env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    },
    hooks: {
      before: enforcePasswordChangeSessionRevocation,
    },
    plugins: [nextCookies()],
  });
}

export const auth = createAuth();
