# Launch Hardening

Ticket prefix: `LAUNCH`

## LAUNCH-001 --- Build landing page and public theme gallery

**Priority:** P0 **Depends on:** EDIT-002 **Status:** Todo

### Goal

Present launch offer and demo clearly.

### Acceptance Criteria

-   [ ] Primary free-trial CTA.
-   [ ] Public demo.
-   [ ] All 10 themes browsable.
-   [ ] Harga Launch Rp79.000.
-   [ ] Explain 1-year activation, not lifetime.

### UX References

-   `WF-01` — Landing.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LAUNCH-002 --- Build onboarding checklist

**Priority:** P0 **Depends on:** INV-001, EDIT-002 **Status:** Todo

### Goal

Guide first-time owner without blocking.

### Acceptance Criteria

-   [ ] Basic info → theme → content → guest → publish guidance.
-   [ ] Checklist is dismissible/non-blocking.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LAUNCH-003 --- Build help/FAQ/contact support surfaces

**Priority:** P0 **Depends on:** INV-008 **Status:** Todo

### Goal

Support launch users.

### Acceptance Criteria

-   [ ] WhatsApp + email channels.
-   [ ] Realistic business hours.
-   [ ] Safe invitation context.
-   [ ] Key-flow FAQ.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LAUNCH-004 --- Implement abuse report and suspension workflow

**Priority:** P0 **Depends on:** FOUND-007 **Status:** Todo

### Goal

Handle prohibited content minimally.

### Acceptance Criteria

-   [ ] Report channel.
-   [ ] Privileged suspension command.
-   [ ] Suspension takes public offline without immediate deletion.
-   [ ] Action audited.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LAUNCH-005 --- Implement owner operational stats

**Priority:** P0 **Depends on:** EVG-005, RSA-004, CHK-004 **Status:**
Todo

### Goal

Provide useful dashboard summary.

### Acceptance Criteria

-   [ ] Capacity.
-   [ ] RSVP.
-   [ ] Attendance.
-   [ ] Distribution/view.
-   [ ] Guestbook activity.
-   [ ] Simple invitation views.
-   [ ] No guest device/location analytics.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LAUNCH-006 --- Run security release checklist

**Priority:** P0 **Depends on:** AUTH-006, BILL-005, CHK-007 **Status:**
Todo

### Goal

Validate critical controls before public launch.

### Acceptance Criteria

-   [ ] Authz matrix tested.
-   [ ] Rate limits tested.
-   [ ] Token/log redaction verified.
-   [ ] Webhook verification tested.
-   [ ] Cache isolation tested.
-   [ ] Deletion tested.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LAUNCH-007 --- Run lifecycle/payment/check-in load and race tests

**Priority:** P0 **Depends on:** LIFE-005, BILL-005, CHK-004 **Status:**
Todo

### Goal

Find integrity failures under concurrency.

### Acceptance Criteria

-   [ ] Concurrent capacity mutations.
-   [ ] Duplicate webhooks.
-   [ ] Webhook/reconciliation race.
-   [ ] Concurrent QR scans.
-   [ ] Job lease recovery.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LAUNCH-008 --- Run production readiness drill

**Priority:** P0 **Depends on:** OPS-006, OPS-008 **Status:** Todo

### Goal

Prove deploy/restore/incident procedures.

### Acceptance Criteria

-   [ ] Fresh deploy from image.
-   [ ] Migration.
-   [ ] Rollback-compatible app drill.
-   [ ] Backup restore.
-   [ ] Dead-letter requeue.
-   [ ] Payment reconciliation.
-   [ ] Event-day check-in smoke.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LAUNCH-009 --- Launch acceptance review

**Priority:** P0 **Depends on:** LAUNCH-001..008 **Status:** Todo

### Goal

Confirm MVP matches product source of truth.

### Acceptance Criteria

-   [ ] No P0 known defects.
-   [ ] Golden E2E green.
-   [ ] Provider production credentials ready.
-   [ ] Terms/privacy/refund/help content published.
-   [ ] Monitoring and support ownership clear.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
