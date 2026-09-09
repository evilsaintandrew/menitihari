# Lifecycle, Notifications, Export & Deletion

Ticket prefix: `LIFE`

## LIFE-001 --- Implement PostgreSQL job queue

**Priority:** P0 **Depends on:** FOUND-002 **Status:** Todo

### Goal

Provide durable transactional jobs.

### Acceptance Criteria

-   [ ] Priority/state/dedup/retry fields.
-   [ ] Claim/lease mechanism.
-   [ ] Heartbeat.
-   [ ] Job insertion can join domain transaction.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LIFE-002 --- Implement retry, timeout and dead-letter behavior

**Priority:** P0 **Depends on:** LIFE-001 **Status:** Todo

### Goal

Bound failures safely.

### Acceptance Criteria

-   [ ] Per-type retry policy.
-   [ ] Global + per-job timeout.
-   [ ] Exponential/progressive backoff.
-   [ ] DEAD_LETTER after exhaustion.
-   [ ] Explicit requeue.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LIFE-003 --- Implement weighted priority workers

**Priority:** P0 **Depends on:** LIFE-001 **Status:** Todo

### Goal

Process CRITICAL/HIGH/NORMAL/LOW without starvation.

### Acceptance Criteria

-   [ ] worker-general filtering.
-   [ ] Weighted fairness.
-   [ ] Graceful drain.
-   [ ] Lease recovery.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LIFE-004 --- Implement scheduler and occurrence dedup

**Priority:** P0 **Depends on:** LIFE-001 **Status:** Todo

### Goal

Create due lifecycle/reminder work exactly once.

### Acceptance Criteria

-   [ ] Separate scheduler process.
-   [ ] Stable dedup per occurrence.
-   [ ] UTC storage + business timezone evaluation.
-   [ ] Bounded catch-up/stale skip.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LIFE-005 --- Implement lifecycle scheduled jobs

**Priority:** P0 **Depends on:** LIFE-004 **Status:** Todo

### Goal

Drive trial/paid/grace/purge transitions.

### Acceptance Criteria

-   [ ] Trial expiry.
-   [ ] Paid expiry.
-   [ ] Grace transition/purge.
-   [ ] Idempotent on rerun.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LIFE-006 --- Implement email service and delivery tracking

**Priority:** P0 **Depends on:** FOUND-006, LIFE-001 **Status:** Todo

### Goal

Send transactional email through Resend.

### Acceptance Criteria

-   [ ] Queued job model.
-   [ ] Provider message id.
-   [ ] Normalized lifecycle.
-   [ ] Retry policy.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LIFE-007 --- Implement verified Resend webhook and suppression

**Priority:** P0 **Depends on:** LIFE-006 **Status:** Todo

### Goal

Track outcomes and protect reputation.

### Acceptance Criteria

-   [ ] Webhook verification/idempotency.
-   [ ] Hard bounce/complaint suppression.
-   [ ] Corrected email can clear suppression policy.
-   [ ] Account remains usable.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LIFE-008 --- Implement trial and H-30/H-7 reminders

**Priority:** P0 **Depends on:** LIFE-004, LIFE-006 **Status:** Todo

### Goal

Notify without spam.

### Acceptance Criteria

-   [ ] Trial near-expiry email.
-   [ ] Paid expiry H-30/H-7.
-   [ ] Computed dashboard banner.
-   [ ] Bounded catch-up.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LIFE-009 --- Implement export jobs CSV/XLSX

**Priority:** P0 **Depends on:** LIFE-001, EVG-004 **Status:** Todo

### Goal

Export product data during eligible lifecycle.

### Acceptance Criteria

-   [ ] CSV + XLSX.
-   [ ] Includes
    content/events/guests/RSVP/attendance/guestbook/distribution.
-   [ ] Artifact bounded retention.
-   [ ] Trial/paid/grace allowed.

### UX References

-   `WF-34` — Export.
-   `WF-35` — Grace / Invitation Deletion / Account Deletion.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## LIFE-010 --- Implement physical purge and R2 deletion jobs

**Priority:** P0 **Depends on:** LIFE-005, MED-008 **Status:** Todo

### Goal

Delete product data safely after retention.

### Acceptance Criteria

-   [ ] Default purge window configurable 7d.
-   [ ] Operational data removed dependency-safely.
-   [ ] Financial minimal records retained separately.
-   [ ] R2 deletion async/idempotent.

### UX References

-   `WF-35` — Grace / Invitation Deletion / Account Deletion.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
