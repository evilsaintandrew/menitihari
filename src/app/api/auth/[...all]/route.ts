import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import {
  AUTH_GENERIC_ERROR_MESSAGE,
  AUTH_RATE_LIMIT_MESSAGE,
  LOGIN_GENERIC_ERROR_MESSAGE,
  PASSWORD_RESET_GENERIC_MESSAGE,
  SIGNUP_GENERIC_ERROR_MESSAGE,
  authEmailSchema,
} from "@/modules/auth";
import { createPasswordResetRateLimiter } from "@/modules/auth/password-reset-rate-limit";

const betterAuthHandlers = toNextJsHandler(auth);
const passwordResetRateLimiter = createPasswordResetRateLimiter();

function isPasswordResetRequest(pathname: string): boolean {
  return pathname.endsWith("/request-password-reset");
}

function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.trim();
  if (forwarded && !forwarded.includes(",")) return forwarded;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "127.0.0.1";
}

async function resetEmailFromRequest(request: Request): Promise<string | undefined> {
  try {
    const body: unknown = await request.clone().json();
    if (!body || typeof body !== "object" || !("email" in body)) return undefined;

    const email = (body as { email?: unknown }).email;
    const result = authEmailSchema.safeParse(email);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

async function sanitizeCredentialError(request: Request, response: Response): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const isCredentialEndpoint = /\/api\/auth\/(sign-up|sign-in)\/email$/.test(pathname);
  const isResetRequest = isPasswordResetRequest(pathname);

  if (isResetRequest && response.ok) {
    const headers = new Headers(response.headers);
    headers.set("content-type", "application/json");
    return new Response(
      JSON.stringify({ status: true, message: PASSWORD_RESET_GENERIC_MESSAGE }),
      { status: response.status, headers },
    );
  }

  if (response.ok || (!isCredentialEndpoint && !isResetRequest)) return response;
  if (response.status === 429) return response;

  const message = isResetRequest
    ? AUTH_GENERIC_ERROR_MESSAGE
    : pathname.endsWith("/sign-up/email")
      ? SIGNUP_GENERIC_ERROR_MESSAGE
      : LOGIN_GENERIC_ERROR_MESSAGE;
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json");

  return new Response(
    JSON.stringify({
      error: {
        code: "AUTHENTICATION_FAILED",
        message,
        status: response.status,
        statusText: "Authentication failed",
      },
    }),
    { status: response.status, headers },
  );
}

export async function GET(request: Request) {
  return betterAuthHandlers.GET(request);
}

export async function POST(request: Request) {
  if (isPasswordResetRequest(new URL(request.url).pathname)) {
    const email = await resetEmailFromRequest(request);
    if (email) {
      const decision = passwordResetRateLimiter.consume({ ip: requestIp(request), email });
      if (!decision.allowed) {
        return new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: AUTH_RATE_LIMIT_MESSAGE,
              status: 429,
              statusText: "Too Many Requests",
            },
          }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": String(decision.retryAfterSeconds),
              "x-retry-after": String(decision.retryAfterSeconds),
            },
          },
        );
      }
    }
  }

  return sanitizeCredentialError(request, await betterAuthHandlers.POST(request));
}

export async function PATCH(request: Request) {
  return betterAuthHandlers.PATCH(request);
}

export async function PUT(request: Request) {
  return betterAuthHandlers.PUT(request);
}

export async function DELETE(request: Request) {
  return betterAuthHandlers.DELETE(request);
}
