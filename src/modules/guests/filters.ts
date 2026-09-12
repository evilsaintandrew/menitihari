import type { GuestManagementItem } from "./index";

export type GuestRsvpFilter = "ALL" | "PENDING";
export type GuestDistributionFilter = "ALL" | "NOT_SENT" | "MARKED_SENT" | "WHATSAPP_OPENED";
export type GuestViewedFilter = "ALL" | "VIEWED" | "NOT_VIEWED";

function hasManualSentStatus(guest: GuestManagementItem): boolean {
  return guest.distributionStatus === "MARKED_SENT";
}

function hasWhatsAppOpened(guest: GuestManagementItem): boolean {
  return guest.whatsappLastOpenedAt !== null || guest.distributionStatus === "WHATSAPP_OPENED";
}

export function filterGuestsByRsvp(
  guests: readonly GuestManagementItem[],
  filter: GuestRsvpFilter,
): readonly GuestManagementItem[] {
  if (filter === "ALL") return guests;
  return guests.filter((guest) => guest.assignedEvents.some((event) => event.rsvpStatus === null || event.rsvpStatus === "PENDING"));
}

export function filterGuestsByDistribution(
  guests: readonly GuestManagementItem[],
  filter: GuestDistributionFilter,
): readonly GuestManagementItem[] {
  if (filter === "ALL") return guests;
  if (filter === "MARKED_SENT") return guests.filter(hasManualSentStatus);
  if (filter === "WHATSAPP_OPENED") return guests.filter(hasWhatsAppOpened);
  return guests.filter((guest) => !hasManualSentStatus(guest));
}

export function filterGuestsByViewed(
  guests: readonly GuestManagementItem[],
  filter: GuestViewedFilter,
): readonly GuestManagementItem[] {
  if (filter === "ALL") return guests;
  if (filter === "VIEWED") return guests.filter((guest) => guest.viewedAt !== null);
  return guests.filter((guest) => guest.viewedAt === null);
}

export interface GuestManagementFilters {
  readonly rsvp: GuestRsvpFilter;
  readonly distribution: GuestDistributionFilter;
  readonly viewed: GuestViewedFilter;
}

export function filterGuestManagementItems(
  guests: readonly GuestManagementItem[],
  filters: GuestManagementFilters,
): readonly GuestManagementItem[] {
  return filterGuestsByViewed(
    filterGuestsByDistribution(filterGuestsByRsvp(guests, filters.rsvp), filters.distribution),
    filters.viewed,
  );
}
