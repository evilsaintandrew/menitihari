import {
  CommercialState,
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";

import { ownerMembershipWhere } from "./authorization";

const dashboardInvitationSelect = {
  id: true,
  ownerFacingTitle: true,
  coupleDisplayName1: true,
  coupleDisplayName2: true,
  publicationState: true,
  commercialState: true,
  trialEndsAt: true,
  activeUntil: true,
  graceEndsAt: true,
  purgeAt: true,
  createdAt: true,
  slugs: {
    where: { isCanonical: true },
    select: { slug: true },
    take: 1,
  },
} satisfies Prisma.InvitationSelect;

type DashboardInvitationRecord = NonNullable<
  Prisma.Result<
    PrismaClient["invitation"],
    { select: typeof dashboardInvitationSelect },
    "findMany"
  >[number]
>;

export type InvitationDashboardItem = Omit<DashboardInvitationRecord, "slugs"> & {
  readonly canonicalSlug: string | null;
};

export interface InvitationDashboardSections {
  readonly active: readonly InvitationDashboardItem[];
  readonly history: readonly InvitationDashboardItem[];
}

type InvitationDashboardReadDatabase = Pick<PrismaClient, "invitation">;

/**
 * Reads every invitation owned by the account. There is intentionally no
 * account-level invitation count or pagination cap in this query.
 */
export async function getInvitationDashboard(
  database: InvitationDashboardReadDatabase,
  userId: string,
): Promise<readonly InvitationDashboardItem[]> {
  const invitations = await database.invitation.findMany({
    where: ownerMembershipWhere(userId),
    orderBy: { createdAt: "desc" },
    select: dashboardInvitationSelect,
  });

  return invitations.map(({ slugs, ...invitation }) => ({
    ...invitation,
    canonicalSlug: slugs[0]?.slug ?? null,
  }));
}

export function sectionInvitationDashboard(
  invitations: readonly InvitationDashboardItem[],
): InvitationDashboardSections {
  return {
    active: invitations.filter(({ commercialState }) =>
      commercialState === CommercialState.TRIAL ||
      commercialState === CommercialState.PAID_ACTIVE,
    ),
    history: invitations.filter(({ commercialState }) =>
      commercialState !== CommercialState.TRIAL &&
      commercialState !== CommercialState.PAID_ACTIVE,
    ),
  };
}

export function getInvitationExpiry(
  invitation: Pick<
    InvitationDashboardItem,
    "commercialState" | "trialEndsAt" | "activeUntil" | "graceEndsAt" | "purgeAt"
  >,
): Date | null {
  switch (invitation.commercialState) {
    case CommercialState.TRIAL:
    case CommercialState.TRIAL_EXPIRED:
      return invitation.trialEndsAt;
    case CommercialState.PAID_ACTIVE:
      return invitation.activeUntil;
    case CommercialState.GRACE:
      return invitation.graceEndsAt;
    case CommercialState.DELETION_PENDING:
      return invitation.purgeAt;
    case CommercialState.DELETED:
      return null;
  }
}
