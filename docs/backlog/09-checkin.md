# QR Check-in

Ticket prefix: `CHK`

## CHK-001 --- Implement QR credential issuance/rotation

**Priority:** P0 **Depends on:** RSA-004 **Status:** Todo

### Goal

Create QR identity separate from activation link.

### Acceptance Criteria

-   [ ] QR eligible only according to RSVP/approval rules.
-   [ ] Digest/version stored.
-   [ ] Owner can regenerate/share individual QR.
-   [ ] Raw token not logged.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## CHK-002 --- Implement guest QR screen

**Priority:** P0 **Depends on:** CHK-001, RSA-003 **Status:** Todo

### Goal

Show QR and operational state to guest.

### Acceptance Criteria

-   [ ] Shows addressee/name.
-   [ ] No family-member details.
-   [ ] Checked-in state/time after attendance.
-   [ ] NOT_ATTENDING normally disables eligibility.

### UX References

-   `WF-15` — RSVP Confirmation / QR Eligibility.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## CHK-003 --- Implement staff grants and sessions

**Priority:** P0 **Depends on:** EVG-001 **Status:** Todo

### Goal

Create scoped event-day operator access.

### Acceptance Criteria

-   [ ] Max 5 active grants/event.
-   [ ] Label + validity + revocation.
-   [ ] One/multiple event scope.
-   [ ] Short-lived scoped session.

### UX References

-   `WF-22` — Staff Access.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## CHK-004 --- Implement QR scan/check-in mutation

**Priority:** P0 **Depends on:** CHK-001, CHK-003 **Status:** Todo

### Goal

Record attendance safely.

### Acceptance Criteria

-   [ ] Event context required.
-   [ ] Window enforced.
-   [ ] Attendance count \<= max.
-   [ ] Atomic conditional transition.
-   [ ] Idempotency key.
-   [ ] Concurrent second scan returns ALREADY_CHECKED_IN.

### UX References

-   `WF-24` — Check-in Confirmation.
-   `WF-25` — Repeat Scan.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## CHK-005 --- Implement wrong-event and override flow

**Priority:** P0 **Depends on:** CHK-004 **Status:** Todo

### Goal

Handle valid QR in wrong event explicitly.

### Acceptance Criteria

-   [ ] Returns NOT_INVITED_TO_EVENT.
-   [ ] No silent check-in.
-   [ ] Authorized override explicit and audited.

### UX References

-   `WF-26` — Wrong Event.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## CHK-006 --- Implement manual guest search/check-in

**Priority:** P0 **Depends on:** CHK-003, CHK-004 **Status:** Todo

### Goal

Provide venue fallback without QR.

### Acceptance Criteria

-   [ ] Server-side event-scoped pagination/search.
-   [ ] Minimum fields only.
-   [ ] Manual check-in uses same attendance service.

### UX References

-   `WF-27` — Manual Search.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## CHK-007 --- Implement attendance correction

**Priority:** P0 **Depends on:** CHK-004 **Status:** Todo

### Goal

Correct mistakes without destroying history.

### Acceptance Criteria

-   [ ] Before/after recorded.
-   [ ] Actor/time/reason recorded.
-   [ ] Bounds validated.
-   [ ] Current state and audit update transactionally.

### UX References

-   `WF-28` — Attendance Correction.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## CHK-008 --- Build check-in PWA/slow-network UX

**Priority:** P0 **Depends on:** CHK-004, CHK-006 **Status:** Todo

### Goal

Operate reliably on venue mobile browser.

### Acceptance Criteria

-   [ ] Clear loading/retry.
-   [ ] No full offline sync.
-   [ ] Repeat scan clearly reports prior check-in.
-   [ ] Simple attendance summary.
-   [ ] No staff export.

### UX References

-   `WF-23` — Scanner.
-   `WF-24` — Check-in Confirmation.
-   `WF-25` — Repeat Scan.
-   `WF-26` — Wrong Event.
-   `WF-27` — Manual Search.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
