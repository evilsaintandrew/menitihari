import { DEFAULT_ERROR_MESSAGES, type ErrorCode } from "./codes";

export type SafeErrorDetails = Readonly<Record<string, readonly string[]>>;

export interface DomainErrorOptions {
  readonly details?: SafeErrorDetails;
  readonly retryable?: boolean;
}

/**
 * An expected application failure with a stable code and safe public message.
 *
 * The constructor deliberately does not accept arbitrary messages or causes.
 * Provider payloads and request values must stay at the boundary that maps
 * them into this error.
 */
export class DomainError extends Error {
  readonly name = "DomainError";
  readonly code: ErrorCode;
  readonly details?: SafeErrorDetails;
  readonly retryable: boolean;

  constructor(code: ErrorCode, options: DomainErrorOptions = {}) {
    super(DEFAULT_ERROR_MESSAGES[code]);
    this.code = code;
    this.details = options.details;
    this.retryable = options.retryable ?? false;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
