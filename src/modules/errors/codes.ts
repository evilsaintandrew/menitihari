/**
 * Stable application error codes. These values are part of the internal
 * application contract and must not be replaced with provider-specific codes.
 */
export const ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  CONFLICT: "CONFLICT",
  STALE_VERSION: "STALE_VERSION",
  RATE_LIMITED: "RATE_LIMITED",
  LIFECYCLE_LOCKED: "LIFECYCLE_LOCKED",
  CAPACITY_EXCEEDED: "CAPACITY_EXCEEDED",
  RSVP_CLOSED: "RSVP_CLOSED",
  ALREADY_CHECKED_IN: "ALREADY_CHECKED_IN",
  NOT_INVITED_TO_EVENT: "NOT_INVITED_TO_EVENT",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_NOT_CONFIRMED: "PAYMENT_NOT_CONFIRMED",
  EXTERNAL_SERVICE_UNAVAILABLE: "EXTERNAL_SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const DEFAULT_ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  UNAUTHENTICATED: "You need to sign in to continue.",
  FORBIDDEN: "You do not have permission to do that.",
  NOT_FOUND: "The requested resource could not be found.",
  VALIDATION_FAILED: "Some information needs to be corrected.",
  CONFLICT: "This request conflicts with the current state.",
  STALE_VERSION: "This page is out of date. Refresh and try again.",
  RATE_LIMITED: "Too many requests. Please try again later.",
  LIFECYCLE_LOCKED: "This action is not available in the current lifecycle state.",
  CAPACITY_EXCEEDED: "The invitation capacity has been reached.",
  RSVP_CLOSED: "RSVP is no longer open for this event.",
  ALREADY_CHECKED_IN: "This guest has already been checked in.",
  NOT_INVITED_TO_EVENT: "This guest is not invited to this event.",
  PAYMENT_PENDING: "Payment is still being confirmed.",
  PAYMENT_NOT_CONFIRMED: "Payment could not be confirmed.",
  EXTERNAL_SERVICE_UNAVAILABLE: "A required service is temporarily unavailable.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};
