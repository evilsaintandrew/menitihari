import { describe, expect, it, vi } from "vitest";

import { InvitationRole, type PrismaClient } from "@/generated/prisma/client";
import { getInvitationForOwner, ownerMembershipWhere } from "@/modules/invitations";

describe("invitation owner authorization", () => {
  it("builds authorization filters from OWNER membership", () => {
    expect(ownerMembershipWhere("user-1")).toEqual({
      members: { some: { userId: "user-1", role: InvitationRole.OWNER } },
    });
  });

  it("returns an invitation only for its owner membership", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
    });

    const database = { invitation: { findFirst } } as unknown as Pick<PrismaClient, "invitation">;

    await expect(getInvitationForOwner(
      database,
      "user-1",
      "invitation-1",
    )).resolves.toEqual({ coupleDisplayName1: "Alya", coupleDisplayName2: "Bima" });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "invitation-1",
        members: { some: { userId: "user-1", role: InvitationRole.OWNER } },
      },
      select: { coupleDisplayName1: true, coupleDisplayName2: true },
    });
  });
});
