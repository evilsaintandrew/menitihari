/** Authentication and account-session domain boundary. */
export {
  AUTH_GENERIC_ERROR_MESSAGE,
  AUTH_RATE_LIMIT_MESSAGE,
  LOGIN_GENERIC_ERROR_MESSAGE,
  PASSWORD_CHANGE_ERROR_MESSAGE,
  PASSWORD_RESET_GENERIC_MESSAGE,
  SESSION_REVOCATION_ERROR_MESSAGE,
  SIGNUP_GENERIC_ERROR_MESSAGE,
} from "./messages";
export {
  authCredentialsSchema,
  authEmailSchema,
  authPasswordSchema,
  displayNameFromEmail,
  validateAuthCredentials,
  type AuthCredentials,
  type AuthFieldErrors,
} from "./validation";
export {
  createVerificationEmailSender,
  type VerificationEmailInput,
} from "./verification-email";
export {
  createPasswordResetEmailSender,
  type PasswordResetEmailInput,
} from "./password-reset-email";
export { enforcePasswordChangeSessionRevocation } from "./session-revocation";
