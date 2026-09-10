import { InvitationRole, Prisma } from "@/generated/prisma/client";

/**
 * Invitation ownership is represented by an active OWNER membership. MVP has
 * no inactive membership state, so a matching membership row is active.
 */
export function ownerMembershipWhere(userId: string): Prisma.InvitationWhereInput {
  return {
    members: { some: { userId, role: InvitationRole.OWNER } },
  };
}
