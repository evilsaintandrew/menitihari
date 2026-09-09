import {
  type Prisma,
  type AuditEvent,
  type PrismaClient,
} from "../../generated/prisma/client";
import { z } from "zod";

import { auditMetadataSchema, type AuditMetadata } from "./metadata";

/**
 * This structural type is implemented by both the application Prisma client
 * and Prisma's interactive transaction client. Passing the latter is what
 * keeps an audit append in the caller's domain transaction.
 */
export type AuditEventDatabase =
  | Pick<PrismaClient, "auditEvent">
  | Prisma.TransactionClient;

export interface WriteAuditEventInput {
  readonly actorId?: string | null;
  readonly invitationId?: string | null;
  readonly resourceType?: string | null;
  readonly resourceId?: string | null;
  readonly action: string;
  readonly metadata?: AuditMetadata;
  readonly createdAt?: Date;
}

const identifierSchema = z.string().trim().min(1).max(128).nullable().optional();
const actionSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z][A-Za-z0-9_.:-]*$/, "action must be an event identifier");

const writeAuditEventInputSchema = z
  .object({
    actorId: identifierSchema,
    invitationId: identifierSchema,
    resourceType: identifierSchema,
    resourceId: identifierSchema,
    action: actionSchema,
    metadata: auditMetadataSchema.optional(),
    createdAt: z.date().optional(),
  })
  .strict();

export async function writeAuditEvent(
  database: AuditEventDatabase,
  input: WriteAuditEventInput,
): Promise<AuditEvent> {
  const parsed = writeAuditEventInputSchema.parse(input);
  const data: Prisma.AuditEventUncheckedCreateInput = {
    userId: parsed.actorId,
    invitationId: parsed.invitationId,
    resourceType: parsed.resourceType,
    resourceId: parsed.resourceId,
    action: parsed.action,
    ...(parsed.metadata === undefined
      ? {}
      : { metadata: parsed.metadata as Prisma.InputJsonValue }),
    ...(parsed.createdAt === undefined ? {} : { createdAt: parsed.createdAt }),
  };

  return database.auditEvent.create({ data });
}

export { auditMetadataSchema, parseAuditMetadata } from "./metadata";
export type { AuditMetadata, AuditMetadataValue } from "./metadata";

/** Convenience default for callers that are not already in a transaction. */
export async function writeAuditEventWithDefaultDatabase(
  input: WriteAuditEventInput,
): Promise<AuditEvent> {
  const { prisma } = await import("../../server/db");
  return writeAuditEvent(prisma, input);
}
