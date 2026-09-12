import { createHash } from "node:crypto";

export const RSVP_RATE_LIMIT_WINDOW_SECONDS = 60;
export const RSVP_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const RSVP_RATE_LIMIT_MAX_ENTRIES = 100_000;

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

export interface RsvpRateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number | null;
}

export interface RsvpRateLimiter {
  consume(input: { readonly ip: string; readonly invitationId: string; readonly guestId: string }): RsvpRateLimitResult;
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Process-local launch limiter; keys retain only a digest of scope values. */
export function createRsvpRateLimiter(options: {
  readonly now?: () => number;
  readonly windowMs?: number;
  readonly maxAttempts?: number;
  readonly maxEntries?: number;
} = {}): RsvpRateLimiter {
  const now = options.now ?? Date.now;
  const windowMs = options.windowMs ?? RSVP_RATE_LIMIT_WINDOW_SECONDS * 1_000;
  const maxAttempts = options.maxAttempts ?? RSVP_RATE_LIMIT_MAX_ATTEMPTS;
  const maxEntries = options.maxEntries ?? RSVP_RATE_LIMIT_MAX_ENTRIES;
  const entries = new Map<string, RateLimitEntry>();

  return {
    consume({ ip, invitationId, guestId }) {
      const currentTime = now();
      for (const [key, entry] of entries) {
        if (currentTime - entry.windowStartedAt >= windowMs) entries.delete(key);
      }
      while (entries.size >= maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }

      const key = digest(`${ip}\u0000${invitationId}\u0000${guestId}`);
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

export const rsvpRateLimiter = createRsvpRateLimiter();
