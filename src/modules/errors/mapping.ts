import { ZodError } from "zod";

import { ERROR_CODES, type ErrorCode } from "./codes";
import { DomainError, type SafeErrorDetails } from "./domain-error";

export type ProviderFailureKind =
  | "INVALID_REQUEST"
  | "NOT_CONFIRMED"
  | "PENDING"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "UNKNOWN";

export interface NormalizedProviderError {
  readonly kind: ProviderFailureKind;
  readonly provider?: string;
}

/**
 * Provider adapters may use this transport-neutral error before FOUND-006
 * introduces the provider interfaces. Its message never includes payloads.
 */
export class ProviderError extends Error {
  readonly name = "ProviderError";
  readonly kind: ProviderFailureKind;
  readonly provider?: string;

  constructor(input: NormalizedProviderError) {
    super("External provider request failed");
    this.kind = input.kind;
    this.provider = input.provider;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const PROVIDER_FAILURE_KINDS = new Set<ProviderFailureKind>([
  "INVALID_REQUEST",
  "NOT_CONFIRMED",
  "PENDING",
  "RATE_LIMITED",
  "TIMEOUT",
  "UNAVAILABLE",
  "UNKNOWN",
]);

function isNormalizedProviderError(value: unknown): value is NormalizedProviderError {
  if (!value || typeof value !== "object") {
    return false;
  }

  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === "string" && PROVIDER_FAILURE_KINDS.has(kind as ProviderFailureKind);
}

function validationDetails(error: ZodError): SafeErrorDetails | undefined {
  const details = new Map<string, string[]>();

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "form";
    const safePath = path.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80) || "form";
    const existing = details.get(safePath) ?? [];

    if (!existing.includes("Invalid value")) {
      existing.push("Invalid value");
    }
    details.set(safePath, existing);
  }

  return details.size > 0 ? Object.fromEntries(details) : undefined;
}

export function mapValidationError(error: ZodError): DomainError {
  return new DomainError(ERROR_CODES.VALIDATION_FAILED, {
    details: validationDetails(error),
  });
}

export function mapProviderError(error: unknown): DomainError {
  const normalized =
    error instanceof ProviderError || isNormalizedProviderError(error) ? error : undefined;

  switch (normalized?.kind) {
    case "PENDING":
      return new DomainError(ERROR_CODES.PAYMENT_PENDING);
    case "NOT_CONFIRMED":
      return new DomainError(ERROR_CODES.PAYMENT_NOT_CONFIRMED);
    case "RATE_LIMITED":
      return new DomainError(ERROR_CODES.RATE_LIMITED, { retryable: true });
    case "TIMEOUT":
    case "UNAVAILABLE":
    case "UNKNOWN":
    case "INVALID_REQUEST":
    default:
      return new DomainError(ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE, {
        retryable: true,
      });
  }
}

export interface PublicError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: SafeErrorDetails;
  readonly retryable: boolean;
}

export function toPublicError(error: unknown): PublicError {
  const domainError = toDomainError(error);

  return {
    code: domainError.code,
    message: domainError.message,
    ...(domainError.details ? { details: domainError.details } : {}),
    retryable: domainError.retryable,
  };
}

export function toDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) {
    return error;
  }

  if (error instanceof ZodError) {
    return mapValidationError(error);
  }

  if (error instanceof ProviderError || isNormalizedProviderError(error)) {
    return mapProviderError(error);
  }

  return new DomainError(ERROR_CODES.INTERNAL_ERROR);
}
