import { z } from "zod";

/**
 * Audit metadata is intentionally smaller than general application JSON.
 * Values are bounded JSON primitives/containers and must describe an event,
 * not copy credentials or product data into the audit trail.
 */
export type AuditMetadataValue =
  | string
  | number
  | boolean
  | readonly AuditMetadataValue[]
  | { readonly [key: string]: AuditMetadataValue };

export type AuditMetadata = Readonly<Record<string, AuditMetadataValue>>;

const MAX_STRING_LENGTH = 256;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 32;
const METADATA_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

const FORBIDDEN_KEY_PARTS = [
  "access",
  "activation",
  "address",
  "api",
  "authorization",
  "bearer",
  "browser",
  "cookie",
  "credential",
  "device",
  "email",
  "ip_address",
  "location",
  "message",
  "mobile",
  "name",
  "password",
  "phone",
  "qr",
  "refresh",
  "secret",
  "session",
  "staff",
  "token",
  "user_agent",
  "whatsapp",
] as const;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:^|\D)(?:\+?62|0)[\s().-]?(?:\d[\s().-]?){7,14}\b/;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const AUTHORIZATION_PATTERN = /\b(?:bearer|basic)\s+[^\s,]+/i;
const PERSONALIZED_PATH_PATTERN = /\/(?:g|qr|staff)\/[^/?\s]+/i;

const metadataKeySchema = z
  .string()
  .regex(METADATA_KEY_PATTERN, "metadata keys must be snake_case identifiers");

function normalizedKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function isForbiddenKey(key: string): boolean {
  const normalized = normalizedKey(key);
  const segments = key.split("_").map(normalizedKey);

  return FORBIDDEN_KEY_PARTS.some((part) => {
    const normalizedPart = normalizedKey(part);
    return (
      normalized === normalizedPart || segments.includes(normalizedPart)
    );
  });
}

function isUnsafeString(value: string): boolean {
  return (
    EMAIL_PATTERN.test(value) ||
    PHONE_PATTERN.test(value) ||
    JWT_PATTERN.test(value) ||
    AUTHORIZATION_PATTERN.test(value) ||
    PERSONALIZED_PATH_PATTERN.test(value)
  );
}

const auditMetadataValueSchema: z.ZodType<AuditMetadataValue> = z.lazy(() =>
  z.union([
    z.string().max(MAX_STRING_LENGTH).refine((value) => !isUnsafeString(value), {
      message: "metadata must not contain tokens or PII",
    }),
    z.number().finite(),
    z.boolean(),
    z.array(auditMetadataValueSchema).max(MAX_ARRAY_ITEMS),
    z
      .record(metadataKeySchema, auditMetadataValueSchema)
      .superRefine((value, context) => {
        if (Object.keys(value).length > MAX_OBJECT_KEYS) {
          context.addIssue({
            code: "custom",
            message: `metadata objects may contain at most ${MAX_OBJECT_KEYS} keys`,
          });
        }

        for (const key of Object.keys(value)) {
          if (isForbiddenKey(key)) {
            context.addIssue({
              code: "custom",
              message: `metadata key '${key}' is not permitted`,
            });
          }
        }
      }),
  ]),
);

export const auditMetadataSchema: z.ZodType<AuditMetadata> = z
  .record(metadataKeySchema, auditMetadataValueSchema)
  .superRefine((value, context) => {
    if (Object.keys(value).length > MAX_OBJECT_KEYS) {
      context.addIssue({
        code: "custom",
        message: `metadata objects may contain at most ${MAX_OBJECT_KEYS} keys`,
      });
    }

    for (const key of Object.keys(value)) {
      if (isForbiddenKey(key)) {
        context.addIssue({
          code: "custom",
          message: `metadata key '${key}' is not permitted`,
        });
      }
    }
  });

export function parseAuditMetadata(value: unknown): AuditMetadata {
  return auditMetadataSchema.parse(value);
}
