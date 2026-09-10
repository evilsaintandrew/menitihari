import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { env } from "@/config/env";
import { prisma } from "@/server/db";

export const auth = betterAuth({
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
    },
  },
  advanced: {
    useSecureCookies:
      env.NODE_ENV === "production" || env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
  },
  plugins: [nextCookies()],
});
