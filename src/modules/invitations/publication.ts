import {
  CommercialState,
  Prisma,
  PublicationState,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { isCommerciallyEditable } from "@/modules/lifecycle";
import { ownerMembershipWhere } from "./authorization";
import { publicInvitationCacheTag } from "@/modules/invitations/public-cache";

export type PublishRequirement = "coupleNames" | "primaryEvent" | "theme";

export interface PublishReadiness {
  readonly invitationId: string;
  readonly coupleDisplayName1: string;
  readonly coupleDisplayName2: string;
  readonly publicationState: PublicationState;
  readonly commercialState: CommercialState;
  readonly commercialStateAllowsPublication: boolean;
  readonly requirements: Readonly<Record<PublishRequirement, boolean>>;
  readonly missingRequirements: readonly PublishRequirement[];
}

export interface PublicCacheInvalidator {
  invalidateInvitation(invitationId: string): void | Promise<void>;
}

export interface PublicationServiceOptions {
  readonly cache: PublicCacheInvalidator;
}

export interface PublicationTransition {
  readonly invitationId: string;
  readonly previousState: PublicationState;
  readonly publicationState: PublicationState;
  readonly changed: boolean;
}

type PublicationReadDatabase = Pick<PrismaClient, "invitation">;
type PublicationDatabase = Pick<PrismaClient, "$transaction">;

const publicationSelect = {
  id: true,
  coupleDisplayName1: true,
  coupleDisplayName2: true,
  themeId: true,
  themeVersion: true,
  publicationState: true,
  commercialState: true,
  trialEndsAt: true,
  primaryEventId: true,
  primaryEvent: {
    select: {
      startsAt: true,
      cancelledAt: true,
      archivedAt: true,
    },
  },
} satisfies Prisma.InvitationSelect;

type PublicationInvitation = NonNullable<Prisma.Result<
  PrismaClient["invitation"],
  { select: typeof publicationSelect },
  "findFirst"
>>;

function isValidDate(value: Date | null | undefined): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function buildReadiness(invitation: PublicationInvitation, now = new Date()): PublishReadiness {
  const requirements: Record<PublishRequirement, boolean> = {
    coupleNames:
      invitation.coupleDisplayName1.trim().length > 0 &&
      invitation.coupleDisplayName2.trim().length > 0,
    primaryEvent:
      invitation.primaryEventId !== null &&
      invitation.primaryEvent !== null &&
      isValidDate(invitation.primaryEvent.startsAt) &&
      invitation.primaryEvent.cancelledAt === null &&
      invitation.primaryEvent.archivedAt === null,
    theme: invitation.themeId.trim().length > 0 && invitation.themeVersion.trim().length > 0,
  };
  const missingRequirements = (Object.keys(requirements) as PublishRequirement[]).filter(
    (requirement) => !requirements[requirement],
  );

  return {
    invitationId: invitation.id,
    coupleDisplayName1: invitation.coupleDisplayName1,
    coupleDisplayName2: invitation.coupleDisplayName2,
    publicationState: invitation.publicationState,
    commercialState: invitation.commercialState,
    commercialStateAllowsPublication: isCommerciallyEditable(
      invitation.commercialState,
      invitation.trialEndsAt,
      now,
    ),
    requirements,
    missingRequirements,
  };
}

export async function getInvitationPublishReadiness(
  database: PublicationReadDatabase,
  userId: string,
  invitationId: string,
): Promise<PublishReadiness | null> {
  const invitation = await database.invitation.findFirst({
    where: { id: invitationId, ...ownerMembershipWhere(userId) },
    select: publicationSelect,
  });

  return invitation ? buildReadiness(invitation) : null;
}

function validationError(readiness: PublishReadiness): DomainError {
  const details: Record<string, readonly string[]> = {};
  for (const requirement of readiness.missingRequirements) {
    details[requirement] = ["Complete this requirement before publishing."];
  }

  return new DomainError(ERROR_CODES.VALIDATION_FAILED, { details });
}

async function transitionPublication(
  database: PublicationDatabase,
  userId: string,
  invitationId: string,
  targetState: PublicationState,
  options: PublicationServiceOptions,
): Promise<PublicationTransition> {
  const result = await database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({
      where: { id: invitationId, ...ownerMembershipWhere(userId) },
      select: publicationSelect,
    });

    if (!invitation) {
      throw new DomainError(ERROR_CODES.NOT_FOUND);
    }

    if (!isCommerciallyEditable(invitation.commercialState, invitation.trialEndsAt)) {
      throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
    }

    const previousState = invitation.publicationState;
    if (previousState === targetState) {
      return {
        invitationId,
        previousState,
        publicationState: targetState,
        changed: false,
      };
    }

    if (targetState === PublicationState.PUBLISHED) {
      const readiness = buildReadiness(invitation);
      if (readiness.missingRequirements.length > 0) {
        throw validationError(readiness);
      }
      if (previousState !== PublicationState.DRAFT && previousState !== PublicationState.UNPUBLISHED) {
        throw new DomainError(ERROR_CODES.CONFLICT);
      }
    } else if (previousState !== PublicationState.PUBLISHED) {
      throw new DomainError(ERROR_CODES.CONFLICT);
    }

    const updated = await transaction.invitation.updateMany({
      where: {
        id: invitationId,
        ...ownerMembershipWhere(userId),
        publicationState: previousState,
        commercialState: invitation.commercialState,
      },
      data: {
        publicationState: targetState,
        version: { increment: 1 },
      },
    });

    if (updated.count !== 1) {
      throw new DomainError(ERROR_CODES.STALE_VERSION, { retryable: true });
    }

    await writeAuditEvent(transaction, {
      actorId: userId,
      invitationId,
      resourceType: "invitation",
      resourceId: invitationId,
      action:
        targetState === PublicationState.PUBLISHED
          ? "invitation.published"
          : "invitation.unpublished",
      metadata: {
        before_status: previousState,
        after_status: targetState,
      },
    });

    return {
      invitationId,
      previousState,
      publicationState: targetState,
      changed: true,
    };
  });

  if (result.changed) {
    await options.cache.invalidateInvitation(result.invitationId);
  }

  return result;
}

export function publishInvitation(
  database: PublicationDatabase,
  userId: string,
  invitationId: string,
  options: PublicationServiceOptions,
): Promise<PublicationTransition> {
  return transitionPublication(
    database,
    userId,
    invitationId,
    PublicationState.PUBLISHED,
    options,
  );
}

export function unpublishInvitation(
  database: PublicationDatabase,
  userId: string,
  invitationId: string,
  options: PublicationServiceOptions,
): Promise<PublicationTransition> {
  return transitionPublication(
    database,
    userId,
    invitationId,
    PublicationState.UNPUBLISHED,
    options,
  );
}

export { publicInvitationCacheTag };
