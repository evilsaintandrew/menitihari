const REDACTED = "[REDACTED]";
const MASKED_EMAIL = "[EMAIL_REDACTED]";
const MASKED_PHONE = "[PHONE_REDACTED]";
const CIRCULAR_VALUE = "[CIRCULAR]";

const SENSITIVE_FIELD_NAMES = new Set([
  "accessToken",
  "activationSecret",
  "activationToken",
  "apiKey",
  "authorization",
  "bearerToken",
  "cookie",
  "credential",
  "credentials",
  "password",
  "passwordHash",
  "qrSecret",
  "qrToken",
  "refreshToken",
  "secret",
  "sessionToken",
  "setCookie",
  "staffSecret",
  "staffToken",
  "token",
  "tokenValue",
]);

const PII_EMAIL_FIELD_NAMES = new Set([
  "email",
  "emailAddress",
  "recipientEmail",
]);

const PII_PHONE_FIELD_NAMES = new Set([
  "contactNumber",
  "mobile",
  "mobileNumber",
  "phone",
  "phoneNumber",
  "whatsapp",
]);

function normalizeFieldName(fieldName: string): string {
  return fieldName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

const sensitiveFieldNames = new Set(
  [...SENSITIVE_FIELD_NAMES].map(normalizeFieldName),
);
const emailFieldNames = new Set([...PII_EMAIL_FIELD_NAMES].map(normalizeFieldName));
const phoneFieldNames = new Set([...PII_PHONE_FIELD_NAMES].map(normalizeFieldName));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function maskEmail(value: unknown): string {
  if (typeof value !== "string") {
    return MASKED_EMAIL;
  }

  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === value.length - 1) {
    return MASKED_EMAIL;
  }

  return `${value.slice(0, 1)}***${value.slice(atIndex)}`;
}

function maskPhone(value: unknown): string {
  if (typeof value !== "string") {
    return MASKED_PHONE;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 2) {
    return MASKED_PHONE;
  }

  return `***${digits.slice(-2)}`;
}

/**
 * Removes credentials and common PII-bearing values from free-form log text.
 * Field-aware redaction below is the primary protection; these patterns cover
 * accidental interpolation into messages and URL/header fields.
 */
export function redactLogString(value: string): string {
  return value
    .replace(/\b(Bearer|Basic)\s+[^\s,]+/gi, `$1 ${REDACTED}`)
    .replace(
      /((?:activation|access|refresh|qr|staff)?[_-]?token|api[_-]?key)\s*(?:=|:)\s*[^\s,&}\]]+/gi,
      `$1=${REDACTED}`,
    )
    .replace(/\/((?:g|qr|staff))\/[^/?\s]+/gi, `/$1/${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, MASKED_EMAIL)
    .replace(
      /((?:phone|mobile|whatsapp)(?:[_-]?number)?\s*(?:=|:)\s*)(?:\+?\d[\d\s-]{7,}\d)/gi,
      `$1${MASKED_PHONE}`,
    );
}

function redactValue(
  value: unknown,
  fieldName: string | undefined,
  seen: WeakSet<object>,
): unknown {
  const normalizedFieldName = fieldName ? normalizeFieldName(fieldName) : undefined;

  if (normalizedFieldName && sensitiveFieldNames.has(normalizedFieldName)) {
    return REDACTED;
  }
  if (normalizedFieldName && emailFieldNames.has(normalizedFieldName)) {
    return maskEmail(value);
  }
  if (normalizedFieldName && phoneFieldNames.has(normalizedFieldName)) {
    return maskPhone(value);
  }

  if (typeof value === "string") {
    return redactLogString(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return CIRCULAR_VALUE;
  }

  seen.add(value);
  try {
    if (value instanceof Error) {
      return {
        name: redactLogString(value.name),
        message: redactLogString(value.message),
      };
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((item) => redactValue(item, undefined, seen));
    }
    if (isRecord(value)) {
      const result: Record<string, unknown> = {};
      for (const [key, childValue] of Object.entries(value)) {
        result[key] = redactValue(childValue, key, seen);
      }
      return result;
    }

    return redactLogString(String(value));
  } finally {
    seen.delete(value);
  }
}

export function redactLogValue(value: unknown): unknown {
  return redactValue(value, undefined, new WeakSet<object>());
}

export function redactLogFields(
  fields: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return redactLogValue(fields) as Readonly<Record<string, unknown>>;
}

export { REDACTED };
