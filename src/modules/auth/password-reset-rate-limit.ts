import { createHash } from "node:crypto";

import { authEmailSchema } from "./validation";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_ENTRIES = 100_000;

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

export interface PasswordResetRateLimitOptions {
  readonly now?: () => number;
  readonly windowMs?: number;
  readonly maxAttempts?: number;
}

export interface PasswordResetRateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number | null;
}

export interface PasswordResetRateLimiter {
  consume(input: { readonly ip: string; readonly email: string }): PasswordResetRateLimitResult;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Limits reset requests by the reverse-proxy-resolved IP and normalized email.
 * Only a digest is retained in process memory, so identifiers are not kept in
 * rate-limit keys or accidentally exposed by diagnostics.
 */
export function createPasswordResetRateLimiter(
  options: PasswordResetRateLimitOptions = {},
): PasswordResetRateLimiter {
  const now = options.now ?? Date.now;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const entries = new Map<string, RateLimitEntry>();

  return {
    consume({ ip, email }) {
      const normalizedEmail = authEmailSchema.parse(email);
      const key = digest(`${ip}\u0000${normalizedEmail}`);
      const currentTime = now();

      for (const [entryKey, entryValue] of entries) {
        if (currentTime - entryValue.windowStartedAt >= windowMs) entries.delete(entryKey);
      }
      while (entries.size >= MAX_ENTRIES) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }

      const entry = entries.get(key);

      if (!entry || currentTime - entry.windowStartedAt >= windowMs) {
        entries.set(key, { count: 1, windowStartedAt: currentTime });
        return { allowed: true, retryAfterSeconds: null };
      }

      if (entry.count >= maxAttempts) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((entry.windowStartedAt + windowMs - currentTime) / 1_000),
          ),
        };
      }

      entry.count += 1;
      return { allowed: true, retryAfterSeconds: null };
    },
  };
}
