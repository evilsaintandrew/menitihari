import { createAuthMiddleware } from "better-auth/api";

/** Enforces the account security policy at the Better Auth trust boundary. */
export const enforcePasswordChangeSessionRevocation = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/change-password" || !ctx.body || typeof ctx.body !== "object") return;

  (ctx.body as { revokeOtherSessions?: boolean }).revokeOtherSessions = true;
});
