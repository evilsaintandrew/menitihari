# WhatsApp Distribution

Ticket prefix: `WA`

## WA-001 --- Implement WhatsApp template model

**Priority:** P0 **Depends on:** EVG-003 **Status:** Todo

### Goal

Provide editable invitation/reminder templates.

### Acceptance Criteria

-   [ ] Invitation, RSVP reminder, event reminder templates.
-   [ ] Allowlisted placeholders.
-   [ ] Default template per invitation.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## WA-002 --- Implement personalized message rendering

**Priority:** P0 **Depends on:** WA-001, RSA-002 **Status:** Todo

### Goal

Render safe per-guest messages on demand.

### Acceptance Criteria

-   [ ] Personalized URL included.
-   [ ] No rendered final message stored by default.
-   [ ] Unknown placeholders rejected.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## WA-003 --- Implement `wa.me` open action

**Priority:** P0 **Depends on:** WA-002 **Status:** Todo

### Goal

Open WhatsApp without claiming delivery.

### Acceptance Criteria

-   [ ] Record WHATSAPP_OPENED immediately before navigation.
-   [ ] Track first/last and optional count.
-   [ ] Never label as delivered/read.

### UX References

-   `WF-12` — Distribution Action.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## WA-004 --- Implement trial 30-unique-contact cap

**Priority:** P0 **Depends on:** WA-003, INV-001 **Status:** Todo

### Goal

Enforce trial distribution entitlement.

### Acceptance Criteria

-   [ ] Unique contact counted atomically.
-   [ ] Repeat sends same contact do not consume another slot.
-   [ ] Reminders share same unique-contact cap.
-   [ ] Paid bypasses cap.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## WA-005 --- Implement manual Sent status and distribution filters

**Priority:** P0 **Depends on:** WA-003 **Status:** Todo

### Goal

Let owner track manual distribution.

### Acceptance Criteria

-   [ ] Sent is owner action, separate from WHATSAPP_OPENED.
-   [ ] Viewed/Belum Dilihat supported.
-   [ ] Common filters available.

### UX References

-   `WF-12` — Distribution Action.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## WA-006 --- Implement copy personalized link and guest-share setting

**Priority:** P0 **Depends on:** RSA-002 **Status:** Todo

### Goal

Support non-WhatsApp sharing.

### Acceptance Criteria

-   [ ] Owner can copy per-guest link.
-   [ ] Guest share/copy action obeys Allow Guest Sharing.
-   [ ] Personalized preview metadata remains privacy-safe.

### UX References

-   `WF-12` — Distribution Action.
-   `WF-33` — Sharing & Privacy.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
