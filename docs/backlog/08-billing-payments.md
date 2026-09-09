# Billing & Payments

Ticket prefix: `BILL`

## BILL-001 --- Implement locked invitation price

**Priority:** P0 **Depends on:** INV-001 **Status:** Todo

### Goal

Keep commercial price server-controlled.

### Acceptance Criteria

-   [ ] Rp79,000 launch baseline.
-   [ ] Locked at invitation creation.
-   [ ] Client cannot override amount.
-   [ ] Future price changes do not alter existing invitation lock.

### UX References

-   `WF-18` — Checkout.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## BILL-002 --- Implement DUITKU payment adapter

**Priority:** P0 **Depends on:** FOUND-006, BILL-001 **Status:** Todo

### Goal

Create invitation-scoped QRIS attempt.

### Acceptance Criteria

-   [ ] Provider order/reference stored.
-   [ ] Provider expiry stored.
-   [ ] Pending state displayed.
-   [ ] Draft invitation can pay.

### UX References

-   `WF-18` — Checkout.
-   `WF-19` — QRIS Pending.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## BILL-003 --- Implement verified idempotent payment webhook

**Priority:** P0 **Depends on:** BILL-002 **Status:** Todo

### Goal

Make provider confirmation authoritative.

### Acceptance Criteria

-   [ ] Signature verified.
-   [ ] Event deduplicated.
-   [ ] Normalized event passed to payment service.
-   [ ] Duplicate webhook cannot double-activate.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## BILL-004 --- Implement transactional paid activation

**Priority:** P0 **Depends on:** BILL-003 **Status:** Todo

### Goal

Activate exactly once.

### Acceptance Criteria

-   [ ] Payment transition + paid_at + active_until + audit + jobs in
    one DB transaction.
-   [ ] active_until = success + 1 year.
-   [ ] Unused trial not appended.
-   [ ] External side effects after commit.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## BILL-005 --- Implement payment reconciliation

**Priority:** P0 **Depends on:** BILL-003 **Status:** Todo

### Goal

Recover missing/delayed webhook outcomes.

### Acceptance Criteria

-   [ ] Pending attempts checked with progressive backoff.
-   [ ] Same payment service as webhook.
-   [ ] Provider expiry authoritative.
-   [ ] No manual PAID override.

### UX References

-   `WF-19` — QRIS Pending.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## BILL-006 --- Implement expired/retry payment UX

**Priority:** P0 **Depends on:** BILL-002 **Status:** Todo

### Goal

Allow a new attempt for same invitation.

### Acceptance Criteria

-   [ ] Expired attempt clearly shown.
-   [ ] New attempt uses locked price.
-   [ ] Prior attempt history retained.

### UX References

-   `WF-19` — QRIS Pending.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## BILL-007 --- Implement payment success/receipt UX

**Priority:** P0 **Depends on:** BILL-004 **Status:** Todo

### Goal

Give owner clear proof and entitlement.

### Acceptance Criteria

-   [ ] Active-until date shown.
-   [ ] Trial branding/WA cap removed.
-   [ ] Simple receipt view/download.
-   [ ] Email confirmation.

### UX References

-   `WF-20` — Payment Success.
-   `WF-21` — Receipt / Bukti Pembayaran.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## BILL-008 --- Implement support refund/duplicate-payment records

**Priority:** P0 **Depends on:** BILL-004 **Status:** Todo

### Goal

Support exceptional manual cases without self-service refund.

### Acceptance Criteria

-   [ ] Duplicate-payment case can be recorded.
-   [ ] Refund status auditable.
-   [ ] No automatic voluntary-delete refund.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
