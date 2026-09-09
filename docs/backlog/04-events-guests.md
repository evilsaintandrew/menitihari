# Events & Guests

Ticket prefix: `EVG`

## EVG-001 --- Implement generic event CRUD

**Priority:** P0 **Depends on:** INV-001 **Status:** Todo

### Goal

Support up to 5 wedding events.

### Acceptance Criteria

-   [ ] Max 5 enforced.
-   [ ] Timezone defaults Asia/Jakarta/invitation timezone.
-   [ ] Primary event selection.
-   [ ] Venue/maps/note/livestream/dress code/contact supported.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EVG-002 --- Implement event visibility and cancellation

**Priority:** P0 **Depends on:** EVG-001 **Status:** Todo

### Goal

Control generic vs personalized event content.

### Acceptance Criteria

-   [ ] Generic-visible/personalized-only.
-   [ ] Hidden event absent from generic page.
-   [ ] Cancelled event can show message.
-   [ ] Event with history archives/cancels instead of hard delete.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EVG-003 --- Implement guest/group CRUD

**Priority:** P0 **Depends on:** INV-001 **Status:** Todo

### Goal

Manage individual and party/family guests.

### Acceptance Criteria

-   [ ] Owner-defined addressee.
-   [ ] One group per guest.
-   [ ] Phone normalization.
-   [ ] Archive semantics for guests with history.

### UX References

-   `WF-10` — Guests.
-   `WF-11` — Add Guest.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EVG-004 --- Implement guest-event assignment and party capacity

**Priority:** P0 **Depends on:** EVG-001, EVG-003 **Status:** Todo

### Goal

Model event-specific invitation entitlement.

### Acceptance Criteria

-   [ ] max_party_size per assignment.
-   [ ] New event does not auto-assign guests.
-   [ ] Capacity changes validated.
-   [ ] Removing assignment with history preserves historical RSVP.

### UX References

-   `WF-11` — Add Guest.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EVG-005 --- Enforce 500-person invited capacity

**Priority:** P0 **Depends on:** EVG-004 **Status:** Todo

### Goal

Apply entitlement to people rather than rows.

### Acceptance Criteria

-   [ ] Atomic capacity validation.
-   [ ] Dashboard usage counter.
-   [ ] Near-limit warning.
-   [ ] Over-cap mutation/import cannot commit.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EVG-006 --- Implement duplicate detection and manual merge workflow

**Priority:** P0 **Depends on:** EVG-003 **Status:** Todo

### Goal

Help owner reconcile duplicates safely.

### Acceptance Criteria

-   [ ] Normalized signals produce warning.
-   [ ] No auto-merge.
-   [ ] Conflicting histories require explicit review/choice.
-   [ ] Merge preserves relevant history.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EVG-007 --- Implement CSV/Excel guest import pipeline

**Priority:** P0 **Depends on:** EVG-003, EVG-005 **Status:** Todo

### Goal

Import guests safely at useful scale.

### Acceptance Criteria

-   [ ] Configurable file/row limits.
-   [ ] Background parsing.
-   [ ] Per-row validation preview.
-   [ ] Explicit confirm.
-   [ ] Bounded idempotent commit batches.
-   [ ] Capacity checked before commit.

### UX References

-   `WF-29` — Guest Import.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EVG-008 --- Implement guest bulk actions

**Priority:** P0 **Depends on:** EVG-003, EVG-004 **Status:** Todo

### Goal

Speed common guest management.

### Acceptance Criteria

-   [ ] Assign group.
-   [ ] Assign/unassign event with warnings.
-   [ ] Update distribution status.
-   [ ] No spreadsheet-style editor.

### UX References

-   `WF-10` — Guests.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
