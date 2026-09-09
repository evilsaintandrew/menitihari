# Invitation Lifecycle

Ticket prefix: `INV`

## INV-001 --- Create invitation and start 3-day trial

**Priority:** P0 **Depends on:** AUTH-002 **Status:** Todo

### Goal

Create invitation with locked commercial terms.

### Acceptance Criteria

-   [ ] Creation records trial start/end.
-   [ ] Launch price locked server-side.
-   [ ] Initial couple display names + main event date captured.
-   [ ] New invitation is DRAFT.

### UX References

-   `WF-04` — Create Invitation.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## INV-002 --- Implement invitation ownership membership

**Priority:** P0 **Depends on:** INV-001 **Status:** Todo

### Goal

Represent exactly one OWNER through membership.

### Acceptance Criteria

-   [ ] invitation_members exists.
-   [ ] Exactly one active owner invariant.
-   [ ] Authorization does not rely on raw owner_id comparison scattered
    in UI.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## INV-003 --- Implement publication state

**Priority:** P0 **Depends on:** INV-001 **Status:** Todo

### Goal

Support draft/publish/unpublish/republish.

### Acceptance Criteria

-   [ ] Minimum publish validation.
-   [ ] Publish/unpublish gated by commercial lifecycle.
-   [ ] Public cache invalidated after commit.

### UX References

-   `WF-08` — Publish Readiness.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## INV-004 --- Implement global slug and canonical aliases

**Priority:** P0 **Depends on:** INV-001 **Status:** Todo

### Goal

Provide stable public paths.

### Acceptance Criteria

-   [ ] Slug globally unique.
-   [ ] Suggested slug editable.
-   [ ] Old slug becomes retained alias.
-   [ ] Alias 301 directly to latest canonical.
-   [ ] Retained alias cannot be reused.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## INV-005 --- Implement trial expiry transition

**Priority:** P0 **Depends on:** INV-001 **Status:** Todo

### Goal

Lock expired trials correctly.

### Acceptance Criteria

-   [ ] Public goes offline.
-   [ ] Editor becomes read-only.
-   [ ] Private preview/pay/export remain.
-   [ ] Transition idempotent.

### UX References

-   `WF-16` — Trial Status / Banner.
-   `WF-17` — Trial Expired.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## INV-006 --- Implement paid expiry and 30-day grace

**Priority:** P0 **Depends on:** INV-001 **Status:** Todo

### Goal

Enforce end-of-life without renewal.

### Acceptance Criteria

-   [ ] Public offline at active_until.
-   [ ] Neutral unavailable page.
-   [ ] Grace read-only export/preview/download.
-   [ ] Deletion scheduled after grace.

### UX References

-   `WF-35` — Grace / Invitation Deletion / Account Deletion.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## INV-007 --- Implement invitation voluntary deletion

**Priority:** P0 **Depends on:** INV-002 **Status:** Todo

### Goal

Allow owner to delete early.

### Acceptance Criteria

-   [ ] Strong confirmation.
-   [ ] Offer export first.
-   [ ] Public immediately offline.
-   [ ] No automatic refund.
-   [ ] Purge workflow idempotent.

### UX References

-   `WF-35` — Grace / Invitation Deletion / Account Deletion.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## INV-008 --- Build invitation dashboard list/history

**Priority:** P0 **Depends on:** INV-001 **Status:** Todo

### Goal

Show all invitations and lifecycle clearly.

### Acceptance Criteria

-   [ ] Trial/active invitations prominent.
-   [ ] Expired/grace/deletion items in history.
-   [ ] Expiry dates visible.
-   [ ] No account invitation-count product cap.

### UX References

-   `WF-09` — Invitation Overview.
-   `WF-16` — Trial Status / Banner.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
