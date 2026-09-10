import { revalidateTag } from "next/cache";

import { publicInvitationCacheTag } from "@/modules/invitations/public-cache";
import type { PublicCacheInvalidator } from "@/modules/invitations/publication";

/**
 * Invalidation is deliberately kept outside the domain transaction. Next's
 * cache APIs run after the database commit in the publication service.
 */
export const nextPublicCacheInvalidator: PublicCacheInvalidator = {
  invalidateInvitation(invitationId) {
    revalidateTag(publicInvitationCacheTag(invitationId), "max");
  },
};
