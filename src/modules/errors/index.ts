export { ERROR_CODES, DEFAULT_ERROR_MESSAGES, type ErrorCode } from "./codes";
export {
  DomainError,
  type DomainErrorOptions,
  type SafeErrorDetails,
} from "./domain-error";
export { err, ok, type Result } from "./result";
export {
  mapProviderError,
  mapValidationError,
  ProviderError,
  toDomainError,
  toPublicError,
  type NormalizedProviderError,
  type ProviderFailureKind,
  type PublicError,
} from "./mapping";
export {
  reportError,
  toSentryEvent,
  type ErrorReporter,
  type ErrorReportContext,
  type SafeSentryEvent,
} from "./reporting";
