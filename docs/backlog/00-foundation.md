# Foundation

Ticket prefix: `FOUND`

## FOUND-001 --- Initialize production-grade repository

**Priority:** P0 **Depends on:** --- **Status:** Todo

### Goal

Create the Next.js/TypeScript baseline and enforce project conventions.

### Acceptance Criteria

-   [ ] TypeScript strict enabled.
-   [ ] pnpm is package manager.
-   [ ] Lint, typecheck, test and build commands exist.
-   [ ] Domain-oriented module skeleton exists.
-   [ ] Environment validation fails fast.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## FOUND-002 --- Set up Prisma/PostgreSQL baseline

**Priority:** P0 **Depends on:** FOUND-001 **Status:** Todo

### Goal

Create database integration and migration workflow.

### Acceptance Criteria

-   [ ] Prisma configured for PostgreSQL.
-   [ ] Initial migration can run from clean DB.
-   [ ] Connection limits are conservative.
-   [ ] No production schema mutation outside migrations.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## FOUND-003 --- Create domain error and result conventions

**Priority:** P0 **Depends on:** FOUND-001 **Status:** Todo

### Goal

Standardize application-layer failures.

### Acceptance Criteria

-   [ ] Stable error codes documented.
-   [ ] UI/provider errors are mapped without leaking secrets.
-   [ ] Errors can be safely reported to Sentry.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## FOUND-004 --- Implement structured logging and redaction

**Priority:** P0 **Depends on:** FOUND-001 **Status:** Todo

### Goal

Make logs useful without leaking PII/tokens.

### Acceptance Criteria

-   [ ] Structured logs include request/job correlation.
-   [ ] Activation/QR/staff tokens are redacted.
-   [ ] Phone/email sensitive fields are masked/omitted.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## FOUND-005 --- Configure Sentry and health endpoints

**Priority:** P0 **Depends on:** FOUND-001 **Status:** Todo

### Goal

Provide launch observability.

### Acceptance Criteria

-   [ ] App health/readiness endpoint exists.
-   [ ] Sentry captures sanitized errors.
-   [ ] Health endpoint does not expose secrets.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## FOUND-006 --- Create provider adapter boundaries

**Priority:** P0 **Depends on:** FOUND-001 **Status:** Todo

### Goal

Prevent provider SDK coupling.

### Acceptance Criteria

-   [ ] Interfaces exist for payment, email, storage.
-   [ ] Domain/application code does not import provider SDKs directly.
-   [ ] Test doubles can replace providers.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## FOUND-007 --- Implement audit-event foundation

**Priority:** P0 **Depends on:** FOUND-002 **Status:** Todo

### Goal

Provide minimal append-oriented audit trail.

### Acceptance Criteria

-   [ ] Audit schema exists.
-   [ ] Raw tokens/PII are rejected from metadata conventions.
-   [ ] Audit write can participate in domain transactions.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.


## FOUND-008 --- Establish application UI design system foundation

**Priority:** P0 **Depends on:** FOUND-001 **Status:** Todo

### Goal

Provide the shared implementation primitives needed to turn the approved low-fidelity wireframes into consistent, accessible, responsive product UI without creating a separate frontend-only backlog.

### Acceptance Criteria

-   [ ] Semantic design tokens exist for typography, spacing, color roles, radius, elevation and motion.
-   [ ] Core primitives exist for buttons, links, inputs, selects, text areas, checkboxes/radios, cards, badges, alerts, dialogs, bottom sheets, toasts and navigation.
-   [ ] Shared patterns exist for loading/skeleton, empty, validation, error, offline/unavailable and destructive-confirmation states.
-   [ ] Responsive conventions cover owner desktop/mobile surfaces and phone-first guest/staff surfaces.
-   [ ] Accessibility baseline covers keyboard operation, focus visibility, labels, semantic structure, reduced motion and contrast.
-   [ ] Domain component contracts are documented for recurring UI such as TrialBanner, PublishReadiness, GuestRow, RSVPSummary, PaymentStatus, QRCodeCard, ScannerViewport and CheckInConfirmation.
-   [ ] Components do not encode server-authoritative lifecycle, payment, RSVP or check-in decisions in client-only state.
-   [ ] `../WIREFRAMES_INDEX.md` and `WIREFRAME_TRACEABILITY.md` are the implementation references; no parallel UI backlog is introduced.

### UX References

-   All MVP wireframes: WF-01–WF-35.
-   This ticket owns shared primitives only; feature-specific UI remains owned by its domain ticket.

### Tests

-   [ ] Component tests cover interaction states and accessibility-critical behavior.
-   [ ] Representative responsive smoke tests cover owner, guest and staff shells.
