# Media, Guestbook & E-Angpao

Ticket prefix: `MED`

## MED-001 --- Implement direct temporary R2 upload

**Priority:** P0 **Depends on:** FOUND-006 **Status:** Todo

### Goal

Upload media without proxying through app.

### Acceptance Criteria

-   [ ] Authorization checks invitation ownership.
-   [ ] Presigned upload targets temp namespace.
-   [ ] Size/type constraints included.
-   [ ] Temp asset tracked.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## MED-002 --- Implement media validation/finalization

**Priority:** P0 **Depends on:** MED-001 **Status:** Todo

### Goal

Only validated files become active.

### Acceptance Criteria

-   [ ] Verify existence/size/type/magic bytes.
-   [ ] Reject invalid files.
-   [ ] No raw user filename trust.
-   [ ] Finalize state idempotently.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## MED-003 --- Implement image optimization variants

**Priority:** P0 **Depends on:** MED-002 **Status:** Todo

### Goal

Create fixed image sizes asynchronously.

### Acceptance Criteria

-   [ ] Keep original.
-   [ ] Generate thumb/medium/large.
-   [ ] Worker-media resource limits.
-   [ ] Failure retry/dead-letter.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## MED-004 --- Implement gallery

**Priority:** P0 **Depends on:** MED-003, EDIT-003 **Status:** Todo

### Goal

Support optional max-20-photo gallery.

### Acceptance Criteria

-   [ ] Max 20 enforced.
-   [ ] Lightbox/large view.
-   [ ] Owner add/change/delete while editable.
-   [ ] No guest upload/download feature.

### UX References

-   `WF-31` — Media / Gallery / Music.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## MED-005 --- Implement audio upload/transcode and music library

**Priority:** P0 **Depends on:** MED-002 **Status:** Todo

### Goal

Support one active song.

### Acceptance Criteria

-   [ ] Rights declaration for upload.
-   [ ] Standard playback transcode.
-   [ ] One active song.
-   [ ] Curated library adapter/data.
-   [ ] Autoplay fallback control.

### UX References

-   `WF-31` — Media / Gallery / Music.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## MED-006 --- Implement e-angpao gift methods

**Priority:** P0 **Depends on:** MED-002 **Status:** Todo

### Goal

Support static gift details without processing gifts.

### Acceptance Criteria

-   [ ] Opt-in.
-   [ ] Max 3 methods.
-   [ ] Bank requires owner name/account.
-   [ ] Uploaded QR supported.
-   [ ] No gift amount/sender tracking.

### UX References

-   `WF-32` — E-Angpao.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## MED-007 --- Implement guestbook

**Priority:** P0 **Depends on:** INV-001, RSA-002 **Status:** Todo

### Goal

Support wishes with privacy/moderation modes.

### Acceptance Criteria

-   [ ] Public or personalized-only.
-   [ ] Auto-publish or moderation-first.
-   [ ] One active personalized wish.
-   [ ] Owner hide/delete.
-   [ ] No replies/reactions.

### UX References

-   `WF-30` — Guestbook Moderation.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## MED-008 --- Implement temp/media cleanup

**Priority:** P0 **Depends on:** MED-001 **Status:** Todo

### Goal

Prevent orphan storage growth.

### Acceptance Criteria

-   [ ] TTL cleanup for temp uploads.
-   [ ] Async idempotent deletion.
-   [ ] Missing object treated as success.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
