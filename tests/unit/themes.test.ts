import { afterEach, describe, expect, it, vi } from "vitest";

import { CommercialState } from "@/generated/prisma/client";
import {
  canUseTheme,
  getInvitationThemePicker,
  getThemeDefinition,
  LAUNCH_THEMES,
  selectInvitationTheme,
  THEME_REGISTRY,
  themeConfigSchema,
  type ThemeSelectionCacheInvalidator,
} from "@/modules/themes";
import type { PrismaClient } from "@/generated/prisma/client";

const invitationId = "invitation-1";
const userId = "user-1";
const now = new Date("2026-09-10T08:30:00.000Z");
const defaultThemeConfig = getThemeDefinition("classic")!.defaultConfig;

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: invitationId,
    coupleDisplayName1: "Alya",
    coupleDisplayName2: "Bima",
    themeId: "classic",
    themeVersion: "1",
    themeConfig: defaultThemeConfig,
    commercialState: CommercialState.TRIAL,
    trialEndsAt: new Date("2026-09-13T08:30:00.000Z"),
    activeUntil: null,
    version: 1,
    ...overrides,
  };
}

function databaseFor(transaction: Record<string, unknown>): Pick<PrismaClient, "$transaction"> {
  return {
    $transaction: vi.fn(async (callback: (value: Record<string, unknown>) => unknown) => callback(transaction)),
  } as unknown as Pick<PrismaClient, "$transaction">;
}

function transactionFor(current = invitation()) {
  return {
    invitation: {
      findFirst: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

function cacheFor() {
  return { invalidateInvitation: vi.fn() } satisfies ThemeSelectionCacheInvalidator;
}

afterEach(() => vi.restoreAllMocks());

describe("theme registry", () => {
  it("registers ten unique versioned launch themes with valid presentation defaults", () => {
    expect(THEME_REGISTRY).toHaveLength(10);
    expect(LAUNCH_THEMES).toBe(THEME_REGISTRY);
    expect(new Set(THEME_REGISTRY.map(({ id }) => id)).size).toBe(10);
    expect(THEME_REGISTRY.every(({ version }) => version === "1")).toBe(true);

    for (const theme of THEME_REGISTRY) {
      expect(themeConfigSchema.safeParse(theme.defaultConfig).success).toBe(true);
      expect(theme.preview.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(getThemeDefinition(theme.id, theme.version)).toEqual(theme);
    }
  });

  it("rejects configuration outside the curated presentation schema", () => {
    expect(themeConfigSchema.safeParse({
      ...defaultThemeConfig,
      businessRule: "paid-only",
    }).success).toBe(false);
    expect(themeConfigSchema.safeParse({
      ...defaultThemeConfig,
      accent: "not-registered",
    }).success).toBe(false);
  });

  it.each([
    [CommercialState.TRIAL, new Date("2026-09-13T08:29:59.999Z"), null, true],
    [CommercialState.PAID_ACTIVE, null, new Date("2027-09-10T08:30:00.001Z"), true],
    [CommercialState.TRIAL, new Date("2026-09-09T08:30:00.000Z"), null, false],
    [CommercialState.PAID_ACTIVE, null, new Date("2026-09-09T08:30:00.000Z"), false],
    [CommercialState.TRIAL_EXPIRED, null, null, false],
    [CommercialState.GRACE, null, null, false],
  ])("allows every theme only while the invitation is editable (%s)", (commercialState, trialEndsAt, activeUntil, expected) => {
    expect(canUseTheme(commercialState, trialEndsAt, activeUntil, now)).toBe(expected);
  });
});

describe("theme selection", () => {
  it("returns the owner-scoped picker snapshot", async () => {
    const findFirst = vi.fn().mockResolvedValue(invitation());
    const database = { invitation: { findFirst } } as unknown as Pick<PrismaClient, "invitation">;

    await expect(getInvitationThemePicker(database, userId, invitationId, { now })).resolves.toMatchObject({
      invitationId,
      coupleDisplayName1: "Alya",
      coupleDisplayName2: "Bima",
      selectedThemeId: "classic",
      selectedThemeVersion: "1",
      commercialState: CommercialState.TRIAL,
      canEdit: true,
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: invitationId, members: expect.anything() }),
    }));
  });

  it("changes the theme atomically, audits it, and invalidates cache after commit", async () => {
    const transaction = transactionFor();
    const cache = cacheFor();
    let committed = false;
    transaction.invitation.updateMany.mockImplementation(async () => {
      committed = true;
      return { count: 1 };
    });
    cache.invalidateInvitation.mockImplementation(() => {
      expect(committed).toBe(true);
    });

    await expect(selectInvitationTheme(
      databaseFor(transaction),
      userId,
      invitationId,
      { themeId: "botanical" },
      { cache, now: () => now },
    )).resolves.toMatchObject({
      invitationId,
      previousThemeId: "classic",
      themeId: "botanical",
      themeVersion: "1",
      changed: true,
    });
    expect(transaction.invitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        themeId: "botanical",
        themeVersion: "1",
        themeConfig: getThemeDefinition("botanical")!.defaultConfig,
        version: { increment: 1 },
      }),
    }));
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "invitation.theme_changed",
        metadata: {
          before_theme: "classic",
          after_theme: "botanical",
          before_version: "1",
          after_version: "1",
        },
      }),
    }));
    expect(cache.invalidateInvitation).toHaveBeenCalledWith(invitationId);
  });

  it("does not write or invalidate when the selected theme is unchanged", async () => {
    const transaction = transactionFor();
    const cache = cacheFor();

    await expect(selectInvitationTheme(
      databaseFor(transaction),
      userId,
      invitationId,
      { themeId: "classic" },
      { cache, now: () => now },
    )).resolves.toMatchObject({ changed: false, themeId: "classic" });
    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });

  it.each([
    CommercialState.TRIAL_EXPIRED,
    CommercialState.GRACE,
    CommercialState.DELETION_PENDING,
    CommercialState.DELETED,
  ])("rejects selection for lifecycle state %s", async (commercialState) => {
    const transaction = transactionFor(invitation({ commercialState }));
    const cache = cacheFor();

    await expect(selectInvitationTheme(
      databaseFor(transaction),
      userId,
      invitationId,
      { themeId: "modern" },
      { cache, now: () => now },
    )).rejects.toMatchObject({ code: "LIFECYCLE_LOCKED" });
    expect(transaction.invitation.updateMany).not.toHaveBeenCalled();
    expect(cache.invalidateInvitation).not.toHaveBeenCalled();
  });

  it("fails closed when the owner membership is missing", async () => {
    const transaction = transactionFor(null as never);
    const cache = cacheFor();

    await expect(selectInvitationTheme(
      databaseFor(transaction),
      userId,
      invitationId,
      { themeId: "modern" },
      { cache, now: () => now },
    )).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
