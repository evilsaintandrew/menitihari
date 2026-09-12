import { createHash } from "node:crypto";

export const INVITATION_PASSWORD_RATE_LIMIT_WINDOW_SECONDS = 60;
export const INVITATION_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const INVITATION_PASSWORD_RATE_LIMIT_MAX_ENTRIES = 100_000;

export interface InvitationPasswordRateLimitOptions {
  readonly now?: () => number;
  readonly windowMs?: number;
  readonly maxAttempts?: number;
  readonly maxEntries?: number;
}

export interface InvitationPasswordRateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number | null;
}

export interface InvitationPasswordRateLimiter {
  consume(input: { readonly ip: string; readonly invitationId: string }): InvitationPasswordRateLimitResult;
}

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Process-local limiter for the launch single-app runtime. Keys are digested
 * so addresses and invitation identifiers are not retained in diagnostics.
 */
export function createInvitationPasswordRateLimiter(
  options: InvitationPasswordRateLimitOptions = {},
): InvitationPasswordRateLimiter {
  const now = options.now ?? Date.now;
  const windowMs = options.windowMs ?? INVITATION_PASSWORD_RATE_LIMIT_WINDOW_SECONDS * 1_000;
  const maxAttempts = options.maxAttempts ?? INVITATION_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS;
  const maxEntries = options.maxEntries ?? INVITATION_PASSWORD_RATE_LIMIT_MAX_ENTRIES;
  if (!Number.isInteger(windowMs) || windowMs <= 0) throw new Error("Password rate-limit window is invalid");
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) throw new Error("Password rate-limit max is invalid");
  if (!Number.isInteger(maxEntries) || maxEntries <= 0) throw new Error("Password rate-limit capacity is invalid");

  const entries = new Map<string, RateLimitEntry>();
  return {
    consume({ ip, invitationId }) {
      const currentTime = now();
      for (const [entryKey, entryValue] of entries) {
        if (currentTime - entryValue.windowStartedAt >= windowMs) entries.delete(entryKey);
      }
      while (entries.size >= maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }

      const key = digest(`${ip}\u0000${invitationId}`);
      const entry = entries.get(key);
      if (!entry || currentTime - entry.windowStartedAt >= windowMs) {
        entries.set(key, { count: 1, windowStartedAt: currentTime });
        return { allowed: true, retryAfterSeconds: null };
      }
      if (entry.count >= maxAttempts) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((entry.windowStartedAt + windowMs - currentTime) / 1_000)),
        };
      }
      entry.count += 1;
      return { allowed: true, retryAfterSeconds: null };
    },
  };
}

export const invitationPasswordRateLimiter = createInvitationPasswordRateLimiter();
