/**
 * Shared display contracts for recurring domain surfaces.
 *
 * These values are snapshots from server-authoritative reads. A component may
 * render them and emit an intent callback, but it must not calculate or grant
 * lifecycle, payment, RSVP, QR, or check-in eligibility in client state.
 */
export interface TrialBannerContract {
  state: "TRIAL" | "TRIAL_EXPIRED" | "PAID_ACTIVE" | "GRACE";
  endsAt: string;
  remainingLabel?: string;
  activationHref?: string;
}

export interface PublishReadinessContract {
  canPublish: boolean;
  checks: ReadonlyArray<{ id: string; label: string; satisfied: boolean; detail?: string }>;
  previewHref: string;
}

export interface GuestRowContract {
  id: string;
  addressee: string;
  groupLabel?: string;
  capacityLabel: string;
  eventSummary: string;
  rsvpSummary: string;
  distributionLabel: string;
  viewedLabel: string;
}

export interface RSVPSummaryContract {
  status: "PENDING" | "ATTENDING" | "NOT_ATTENDING";
  attendanceLabel?: string;
  eventLabel: string;
  closesLabel?: string;
}

export interface PaymentStatusContract {
  state: "CREATED" | "PENDING" | "SUCCEEDED" | "EXPIRED" | "FAILED";
  statusLabel: string;
  checkedAt?: string;
  receiptHref?: string;
}

export interface QRCodeCardContract {
  status: "ELIGIBLE" | "NOT_ELIGIBLE" | "ALREADY_CHECKED_IN";
  identityLabel: string;
  eventLabel: string;
  statusLabel: string;
  qrValue?: string;
}

export interface ScannerViewportContract {
  eventLabel: string;
  windowLabel: string;
  state: "READY" | "RESOLVING" | "PERMISSION_DENIED" | "NETWORK_UNCERTAIN" | "CLOSED";
  manualSearchHref: string;
}

export interface CheckInConfirmationContract {
  guestLabel: string;
  eventLabel: string;
  allowedCountLabel: string;
  currentState: "READY" | "PENDING" | "CHECKED_IN" | "ALREADY_CHECKED_IN" | "WRONG_EVENT";
  idempotencyKey: string;
}
