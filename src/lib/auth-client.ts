import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const VERIFICATION_CALLBACK_URL = "/verify-email?verified=1";
export const PENDING_VERIFICATION_EMAIL_KEY = "menitihari.pending-verification-email";
export const PASSWORD_RESET_CALLBACK_URL = "/reset-password";
