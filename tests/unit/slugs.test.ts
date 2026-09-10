import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  invitationSlugInputSchema,
  normalizeInvitationSlug,
  resolveInvitationSlug,
  suggestInvitationSlug,
  updateInvitationSlug,
} from "@/modules/invitations";

const invitationId = "invitation-1";
const userId = "user-1";

function databaseFor(transaction: Record<string, unknown>) {
  return {
    $transaction: vi.fn(async (callback: (value: Record<string, unknown>) => unknown) => callback(transaction)),
  } as unknown as Pick<PrismaClient, "$transaction">;
}

function updateTransaction(currentSlug = "alya-bima") {
  return {
    invitation: {
      findFirst: vi.fn().mockResolvedValue({
        id: invitationId,
        commercialState: "TRIAL",
        slugs: [{ id: "slug-1", slug: currentSlug }],
      }),
    },
    invitationSlug: {
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

describe("invitation slug rules", () => {
  it("normalizes names into a readable suggested slug", () => {
    expect(normalizeInvitationSlug("  Alya & Bima / 2026  ")).toBe("alya-bima-2026");
    expect(suggestInvitationSlug("Dína", "Rahma & Fajar")).toBe("dina-rahma-fajar");
  });

  it("normalizes editable input and rejects reserved paths", () => {
    expect(invitationSlugInputSchema.parse(" Alya_Bima ")).toBe("alya-bima");
    expect(invitationSlugInputSchema.safeParse("api").success).toBe(false);
    expect(invitationSlugInputSchema.safeParse("not a valid slug").success).toBe(true);
  });

  it("changes the canonical slug, retains the old slug, audits, and invalidates after commit", async () => {
    const transaction = updateTransaction();
    const database = databaseFor(transaction);
    const cache = { invalidateInvitation: vi.fn() };

    await expect(
      updateInvitationSlug(database, userId, invitationId, "alya-wedding", { cache }),
    ).resolves.toEqual({
      invitationId,
      previousSlug: "alya-bima",
      canonicalSlug: "alya-wedding",
      changed: true,
    });
    expect(transaction.invitationSlug.update).toHaveBeenCalledWith({
      where: { id: "slug-1" },
      data: { isCanonical: false },
    });
    expect(transaction.invitationSlug.create).toHaveBeenCalledWith({
      data: { invitationId, slug: "alya-wedding", isCanonical: true },
    });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "invitation.slug_changed" }),
    }));
    expect(cache.invalidateInvitation).toHaveBeenCalledWith(invitationId);
  });

  it("is idempotent for the current canonical slug", async () => {
    const transaction = updateTransaction();
    const cache = { invalidateInvitation: vi.fn() };

    await expect(
      updateInvitationSlug(databaseFor(transaction), userId, invitationId, "ALYA-BIMA", { cache }),
    ).resolves.toMatchObject({ changed: false, canonicalSlug: "alya-bima" });
    expect(transaction.invitationSlug.update).not.toHaveBeenCalled();
    expect(transaction.invitationSlug.create).not.toHaveBeenCalled();
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });

  it("maps a unique slug collision to a safe conflict", async () => {
    const transaction = updateTransaction();
    transaction.invitationSlug.create = vi.fn().mockRejectedValue({ code: "P2002" });
    const cache = { invalidateInvitation: vi.fn() };

    await expect(
      updateInvitationSlug(databaseFor(transaction), userId, invitationId, "already-used", { cache }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
  });

  it("fails closed for locked lifecycle state and non-owner lookup", async () => {
    const transaction = updateTransaction();
    transaction.invitation.findFirst = vi.fn().mockResolvedValue({
      id: invitationId,
      commercialState: "GRACE",
      slugs: [{ id: "slug-1", slug: "alya-bima" }],
    });

    await expect(
      updateInvitationSlug(databaseFor(transaction), userId, invitationId, "alya-wedding", {
        cache: { invalidateInvitation: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: "LIFECYCLE_LOCKED" });

    transaction.invitation.findFirst = vi.fn().mockResolvedValue(null);
    await expect(
      updateInvitationSlug(databaseFor(transaction), "not-owner", invitationId, "alya-wedding", {
        cache: { invalidateInvitation: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("resolves an old alias directly to the latest canonical slug", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      invitationId,
      slug: "alya-bima",
      isCanonical: false,
      invitation: { slugs: [{ slug: "alya-wedding-latest" }] },
    });
    const database = { invitationSlug: { findUnique } } as unknown as Pick<PrismaClient, "invitationSlug">;

    await expect(resolveInvitationSlug(database, "alya-bima")).resolves.toEqual({
      invitationId,
      requestedSlug: "alya-bima",
      canonicalSlug: "alya-wedding-latest",
      isCanonical: false,
    });
  });

  it("does not expose a malformed public path as a valid slug", () => {
    expect(() => invitationSlugInputSchema.parse("!!!")).toThrow();
  });
});
