/** Authentication and account-session domain boundary. */
export {
  AUTH_GENERIC_ERROR_MESSAGE,
  AUTH_RATE_LIMIT_MESSAGE,
  LOGIN_GENERIC_ERROR_MESSAGE,
  SIGNUP_GENERIC_ERROR_MESSAGE,
} from "./messages";
export {
  authCredentialsSchema,
  displayNameFromEmail,
  validateAuthCredentials,
  type AuthCredentials,
  type AuthFieldErrors,
} from "./validation";
