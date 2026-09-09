# Editor & Themes

Ticket prefix: `EDIT`

## EDIT-001 --- Build shared invitation content schema

**Priority:** P0 **Depends on:** INV-001 **Status:** Todo

### Goal

Create presentation-neutral invitation data contract.

### Acceptance Criteria

-   [ ] Core/optional sections schema validated.
-   [ ] No theme-specific business rules.
-   [ ] Language ID/EN supported.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EDIT-002 --- Create theme registry with 10 launch themes

**Priority:** P0 **Depends on:** EDIT-001 **Status:** Todo

### Goal

Make themes selectable through one renderer.

### Acceptance Criteria

-   [ ] 10 themes registered.
-   [ ] Theme id/version/config schema.
-   [ ] Trial and paid can use all themes.

### UX References

-   `WF-05` — Theme Picker.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EDIT-003 --- Implement shared renderer and safe fallback

**Priority:** P0 **Depends on:** EDIT-001 **Status:** Todo

### Goal

Render preview/public consistently.

### Acceptance Criteria

-   [ ] Same renderer for preview/public.
-   [ ] Theme error boundary.
-   [ ] Sanitized Sentry reporting.
-   [ ] No theme business logic.

### UX References

-   `WF-07` — Preview.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EDIT-004 --- Implement editor autosave with optimistic concurrency

**Priority:** P0 **Depends on:** EDIT-001 **Status:** Todo

### Goal

Provide reliable live editing.

### Acceptance Criteria

-   [ ] Debounced save.
-   [ ] Visible saving/saved/error state.
-   [ ] Stale write rejected.
-   [ ] Failed save preserves local state.
-   [ ] Cache invalidated only after successful save.

### UX References

-   `WF-06` — Invitation Editor.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EDIT-005 --- Implement section toggles/reordering and curated style controls

**Priority:** P0 **Depends on:** EDIT-002 **Status:** Todo

### Goal

Expose supported customization without arbitrary builder.

### Acceptance Criteria

-   [ ] Optional sections toggle.
-   [ ] Supported sections reorder.
-   [ ] Curated font pairings.
-   [ ] Theme-defined accent options.
-   [ ] Cover selection.

### UX References

-   `WF-06` — Invitation Editor.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EDIT-006 --- Implement Love Story and couple optional fields

**Priority:** P0 **Depends on:** EDIT-001 **Status:** Todo

### Goal

Support wedding content extras.

### Acceptance Criteria

-   [ ] Max 5 timeline milestones.
-   [ ] Full names/parents/social/quote/hashtag optional.
-   [ ] Opening/closing copy editable.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## EDIT-007 --- Implement rich share metadata controls

**Priority:** P0 **Depends on:** EDIT-005 **Status:** Todo

### Goal

Create privacy-aware social previews.

### Acceptance Criteria

-   [ ] Default cover + couple names + primary date.
-   [ ] Owner can select share cover.
-   [ ] Personalized preview excludes guest identity.
-   [ ] Password invitation uses privacy-safe metadata.

### UX References

-   `WF-33` — Sharing & Privacy.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
