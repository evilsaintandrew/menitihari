# Ops, Security & Observability

Ticket prefix: `OPS`

## OPS-001 --- Create Docker Compose production topology

**Priority:** P0 **Depends on:** FOUND-002 **Status:** Todo

### Goal

Run app, DB, scheduler and workers predictably.

### Acceptance Criteria

-   [ ] Separate service definitions.
-   [ ] Resource limits for media worker.
-   [ ] Persistent PostgreSQL volume.
-   [ ] Private internal networking where applicable.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## OPS-002 --- Create immutable GHCR build pipeline

**Priority:** P0 **Depends on:** FOUND-001 **Status:** Todo

### Goal

Produce deployable image only after quality gate.

### Acceptance Criteria

-   [ ] Lint/typecheck/test/build required.
-   [ ] Immutable tag/digest.
-   [ ] No automatic production deployment.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## OPS-003 --- Implement one-shot migration deployment step

**Priority:** P0 **Depends on:** OPS-002 **Status:** Todo

### Goal

Make migrations explicit before traffic switch.

### Acceptance Criteria

-   [ ] Migration container exits clearly success/failure.
-   [ ] Deploy aborts on failure.
-   [ ] No app auto-migrate race.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## OPS-004 --- Configure Caddy health-based traffic switch

**Priority:** P0 **Depends on:** OPS-001 **Status:** Todo

### Goal

Provide best-effort near-zero downtime.

### Acceptance Criteria

-   [ ] Candidate health checked.
-   [ ] Traffic switches only after healthy.
-   [ ] HTTPS configured.
-   [ ] Old process can drain.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## OPS-005 --- Implement daily PostgreSQL backup to R2

**Priority:** P0 **Depends on:** OPS-001 **Status:** Todo

### Goal

Protect source-of-truth data.

### Acceptance Criteria

-   [ ] Daily schedule.
-   [ ] 14-day default retention.
-   [ ] Status/size recorded.
-   [ ] Failure alerts.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## OPS-006 --- Document and test restore runbook

**Priority:** P0 **Depends on:** OPS-005 **Status:** Todo

### Goal

Prove backups are usable.

### Acceptance Criteria

-   [ ] Restore command/procedure documented.
-   [ ] Periodic isolated restore test.
-   [ ] Version compatibility checked.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## OPS-007 --- Implement `pnpm ops:*` operational commands

**Priority:** P0 **Depends on:** LIFE-001, BILL-005 **Status:** Todo

### Goal

Operate without admin UI.

### Acceptance Criteria

-   [ ] Queue health.
-   [ ] Dead-letter inspect/requeue.
-   [ ] Payment reconciliation.
-   [ ] Backup status.
-   [ ] Purge status.
-   [ ] Commands audited where privileged.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## OPS-008 --- Implement proactive queue/scheduler alerts

**Priority:** P0 **Depends on:** OPS-007 **Status:** Todo

### Goal

Surface operational failure early.

### Acceptance Criteria

-   [ ] Stuck lease/backlog alert.
-   [ ] Dead-letter growth alert.
-   [ ] Scheduler heartbeat alert.
-   [ ] Sanitized Sentry events.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.

## OPS-009 --- Configure PostHog privacy-safe analytics

**Priority:** P0 **Depends on:** FOUND-001 **Status:** Todo

### Goal

Measure product usage without leaking secrets.

### Acceptance Criteria

-   [ ] No raw activation/QR tokens.
-   [ ] No guest PII by default.
-   [ ] Invitation view metric.
-   [ ] Owner-facing analytics remains aggregate/simple.

### Tests

-   [ ] Add unit/integration/E2E coverage appropriate to the risk.
