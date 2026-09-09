# Auth & Account

Ticket prefix: `AUTH`

## AUTH-001 --- Implement email/password authentication

**Priority:** P0 **Depends on:** FOUND-002 **Status:** Todo

### Goal

Provide Better Auth signup/login baseline.

### Acceptance Criteria

-   [ ] Signup/login works.
-   [ ] One account per email.
-   [ ] Secure HTTP-only sessions.
-   [ ] Generic failure copy prevents enumeration.

### UX References

-   `WF-02` — Sign Up.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## AUTH-002 --- Implement email verification

**Priority:** P0 **Depends on:** AUTH-001 **Status:** Todo

### Goal

Require verified email for normal product onboarding.

### Acceptance Criteria

-   [ ] Verification email through EmailService.
-   [ ] Token expiry/reuse handled safely.
-   [ ] Verified state persists.

### UX References

-   `WF-03` — Verify Email.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## AUTH-003 --- Implement password reset

**Priority:** P0 **Depends on:** AUTH-001 **Status:** Todo

### Goal

Allow secure password recovery.

### Acceptance Criteria

-   [ ] Generic reset request response.
-   [ ] Successful reset revokes other sessions.
-   [ ] Rate limits apply by IP + identifier.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## AUTH-004 --- Implement logout-all-devices and session revocation

**Priority:** P0 **Depends on:** AUTH-001 **Status:** Todo

### Goal

Give users session security controls.

### Acceptance Criteria

-   [ ] Current/all-session revocation works.
-   [ ] Password change revokes other sessions.
-   [ ] Revoked session cannot mutate.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## AUTH-005 --- Implement account email change

**Priority:** P0 **Depends on:** AUTH-002 **Status:** Todo

### Goal

Allow verified email migration.

### Acceptance Criteria

-   [ ] New email must be verified.
-   [ ] Uniqueness enforced.
-   [ ] Security notification sent where appropriate.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## AUTH-006 --- Implement account deletion cooling-off flow

**Priority:** P0 **Depends on:** AUTH-004 **Status:** Todo

### Goal

Support safe account deletion.

### Acceptance Criteria

-   [ ] Recent reauth required.
-   [ ] Strong confirmation.
-   [ ] Owned public invitations immediately offline.
-   [ ] Cancellation during cooling-off restores account but not
    publication.
-   [ ] Commit schedules purge while preserving minimal financial
    records.

### UX References

-   `WF-35` — Grace / Invitation Deletion / Account Deletion.


### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
