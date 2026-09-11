import { describe, expect, it, vi } from "vitest";

import { getInvitationShareCoverOptions } from "@/modules/media";

describe("share cover media reads", () => {
  it("only asks for ready image assets within the owner's invitation", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "asset-1", mimeType: "image/jpeg", variants: [{ width: 1200, height: 630 }] },
    ]);

    await expect(getInvitationShareCoverOptions({ mediaAsset: { findMany } } as never, "owner-1", "invitation-1"))
      .resolves.toEqual([{ id: "asset-1", mimeType: "image/jpeg", width: 1200, height: 630 }]);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        invitationId: "invitation-1",
        state: "READY",
        type: "IMAGE",
        invitation: { members: { some: { userId: "owner-1", role: "OWNER" } } },
      }),
    }));
  });
});
