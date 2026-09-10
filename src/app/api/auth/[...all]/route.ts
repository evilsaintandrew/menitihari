import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { LOGIN_GENERIC_ERROR_MESSAGE, SIGNUP_GENERIC_ERROR_MESSAGE } from "@/modules/auth";

const betterAuthHandlers = toNextJsHandler(auth);

async function sanitizeCredentialError(request: Request, response: Response): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const isCredentialEndpoint = /\/api\/auth\/(sign-up|sign-in)\/email$/.test(pathname);

  if (response.ok || !isCredentialEndpoint) return response;

  const message = pathname.endsWith("/sign-up/email")
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
