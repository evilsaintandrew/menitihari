import {
  MediaAssetState,
  MediaAssetType,
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import { ownerMembershipWhere } from "@/modules/invitations/authorization";

export interface InvitationShareCoverOption {
  readonly id: string;
  readonly mimeType: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

const shareCoverOptionSelect = {
  id: true,
  mimeType: true,
  variants: {
    where: { kind: "LARGE" },
    select: { width: true, height: true },
    take: 1,
  },
} satisfies Prisma.MediaAssetSelect;

type MediaReadDatabase = Pick<PrismaClient, "mediaAsset">;

export async function getInvitationShareCoverOptions(
  database: MediaReadDatabase,
  userId: string,
  invitationId: string,
): Promise<readonly InvitationShareCoverOption[]> {
  const assets = await database.mediaAsset.findMany({
    where: {
      invitationId,
      invitation: ownerMembershipWhere(userId),
      state: MediaAssetState.READY,
      type: MediaAssetType.IMAGE,
    },
    orderBy: { uploadedAt: "asc" },
    select: shareCoverOptionSelect,
  });

  return assets.map((asset) => ({
    id: asset.id,
    mimeType: asset.mimeType,
    width: asset.variants[0]?.width ?? null,
    height: asset.variants[0]?.height ?? null,
  }));
}

export async function assertInvitationShareCover(
  database: Pick<PrismaClient, "mediaAsset">,
  invitationId: string,
  mediaAssetId: string,
): Promise<void> {
  const asset = await database.mediaAsset.findFirst({
    where: {
      id: mediaAssetId,
      invitationId,
      state: MediaAssetState.READY,
      type: MediaAssetType.IMAGE,
    },
    select: { id: true },
  });
  if (!asset) throw new Error("INVALID_SHARE_COVER");
}
