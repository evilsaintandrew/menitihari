# RSVP & Personalized Access

Ticket prefix: `RSA`

## RSA-001 --- Implement shared-password invitation access

**Priority:** P0 **Depends on:** INV-003 **Status:** Todo

### Goal

Protect invitation with owner-defined password.

### Acceptance Criteria

-   [ ] Hash password.
-   [ ] Rate-limit attempts.
-   [ ] Short-lived scoped session.
-   [ ] Changing/disabling password invalidates old sessions.

### UX References

-   `WF-33` — Sharing & Privacy.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## RSA-002 --- Implement single-use personalized activation

**Priority:** P0 **Depends on:** EVG-003 **Status:** Todo

### Goal

Turn opaque guest link into scoped session.

### Acceptance Criteria

-   [ ] Raw token shown only when issued.
-   [ ] Digest stored.
-   [ ] Conditional single-use consume.
-   [ ] Scoped guest session created.
-   [ ] Regeneration invalidates old token.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## RSA-003 --- Implement personalized invitation composition

**Priority:** P0 **Depends on:** RSA-002, EVG-004 **Status:** Todo

### Goal

Show only guest-relevant content.

### Acceptance Criteria

-   [ ] Only assigned events.
-   [ ] Generic/public restrictions respected.
-   [ ] Shared password can layer on top.
-   [ ] No cross-guest data leak.

### UX References

-   `WF-13` — Personalized Invitation.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## RSA-004 --- Implement personalized RSVP

**Priority:** P0 **Depends on:** RSA-002, EVG-004 **Status:** Todo

### Goal

Allow guest response per assigned event.

### Acceptance Criteria

-   [ ] PENDING/ATTENDING/NOT_ATTENDING.
-   [ ] ATTENDING count 1..max.
-   [ ] Editable while open.
-   [ ] Confirmation summary.
-   [ ] No phone/email re-entry.

### UX References

-   `WF-14` — RSVP Interaction.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## RSA-005 --- Implement owner RSVP controls and override

**Priority:** P0 **Depends on:** RSA-004 **Status:** Todo

### Goal

Give owner operational control.

### Acceptance Criteria

-   [ ] Close/reopen while active.
-   [ ] Optional closes_at.
-   [ ] Owner override after close.
-   [ ] Override audited.
-   [ ] Belum RSVP filter.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## RSA-006 --- Implement public RSVP

**Priority:** P0 **Depends on:** EVG-005, RSA-004 **Status:** Todo

### Goal

Allow owner-configurable generic signup.

### Acceptance Criteria

-   [ ] Owner chooses name-only or name+phone.
-   [ ] Owner chooses accepting events/max party size.
-   [ ] Creates guest + assignments.
-   [ ] Returns personalized link.
-   [ ] Duplicate warning.
-   [ ] Auto-closes at 500 capacity.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## RSA-007 --- Implement public-RSVP approval/QR eligibility

**Priority:** P0 **Depends on:** RSA-006 **Status:** Todo

### Goal

Support owner choice between auto eligibility and approval.

### Acceptance Criteria

-   [ ] Setting per invitation.
-   [ ] Pending approval visible.
-   [ ] Approval does not alter guest identity.
-   [ ] Eligibility changes audited.

### UX References

-   `WF-15` — RSVP Confirmation / QR Eligibility.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## RSA-008 --- Implement Preview as Guest

**Priority:** P0 **Depends on:** RSA-003 **Status:** Todo

### Goal

Let owner inspect personalized experience safely.

### Acceptance Criteria

-   [ ] Does not consume activation token.
-   [ ] Uses same personalized renderer.
-   [ ] Clearly marked owner preview context.

### UX References

-   `WF-07` — Preview.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
