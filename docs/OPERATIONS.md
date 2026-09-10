# OPERATIONS.md

## 1. Production Components

-   Caddy
-   Next.js app
-   PostgreSQL
-   scheduler
-   worker-general
-   worker-media

All application processes use the same immutable image where practical.

## 2. CI

Required quality gate:

``` text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker build
push immutable image to GHCR
```

Production deploy remains manual.

## 3. Deploy Runbook

1.  Confirm CI green.
2.  Identify immutable image digest/tag.
3.  Review migration risk.
4.  If migration is risky/destructive/large, take verified pre-deploy
    backup.
5.  Pull image.
6.  Run one-shot migration container.
7.  Start candidate app.
8.  Check health/readiness.
9.  Switch Caddy traffic.
10. Start/update scheduler/workers.
11. Gracefully drain old workers.
12. Smoke-test signup/public invitation/payment callback
    endpoints/check-in.
13. Watch Sentry and queue health.

Database rollback is roll-forward only. App image rollback is allowed
only when schema remains compatible.

## 4. Migration Rules

-   Prisma migrations only.
-   Never manually mutate production schema.
-   Prefer expand → migrate/backfill → contract.
-   Separate destructive cleanup from initial compatible deploy.
-   Migration must be safe against old/new app overlap during traffic
    switch.

## 5. Worker Shutdown

On SIGTERM:

-   stop claiming new jobs;
-   continue current work up to configured drain timeout;
-   heartbeat/lease remains valid while working;
-   release/allow lease recovery on forced termination;
-   side effects remain idempotent.

## 6. Queue Operations

Provide `pnpm ops:*` commands for:

-   queue summary;
-   list dead-letter jobs;
-   inspect sanitized job;
-   requeue job;
-   payment reconciliation;
-   scheduler health;
-   backup status;
-   purge status.

No admin UI required.

## 7. Scheduler

-   Separate process/container.
-   Scheduled occurrence has stable dedup key.
-   Daily lifecycle/reminder sweep is acceptable.
-   Store timestamps UTC.
-   Event/business dates use event/invitation timezone.
-   Default timezone Asia/Jakarta.
-   After outage, catch up only within bounded usefulness window.
-   Skip stale reminders/actions that no longer make product sense.

## 8. Payment Reconciliation

-   Automatically revisit pending payments.
-   Progressive backoff.
-   Provider expiry remains authoritative with internal hard upper
    bound.
-   Manual support action triggers reconciliation, not PAID override.
-   Alert on repeated provider/reconciliation failure.

## 9. Backups

-   PostgreSQL backup daily.
-   Destination: private R2.
-   Default retention: 14 days.
-   Record success/failure and artifact size.
-   Alert on failure.
-   Do not keep the only copy on production VPS.
-   Periodically restore into isolated environment and document result.

## 10. R2 Cleanup

-   Temporary uploads use TTL cleanup.
-   Product purge enqueues object deletion.
-   Missing object counts as successful deletion.
-   Deletion job contains only minimal storage locator.
-   Voluntary invitation purge uses the server-configured retention window
    (default 7 days), deletes invitation operational data transactionally,
    and leaves minimal financial records retained independently.
-   Export artifacts have bounded retention.
-   Account deletion commit jobs run only after their server-owned
    `cancellable_until`; cancellation removes the pending commit job.

## 11. Monitoring

Health signals:

-   app readiness;
-   DB connectivity;
-   scheduler recent heartbeat;
-   queue age/depth;
-   stuck/expired leases;
-   DEAD_LETTER count;
-   backup recency;
-   payment webhook errors;
-   media failures.

The application exposes `GET /api/health` as a liveness check and
`GET /api/ready` as a database-readiness check. Both responses are
`no-store` and contain only a status value; readiness returns HTTP 503
without exposing dependency or configuration details when PostgreSQL is
unavailable.

Use structured logs + Sentry. No Prometheus/Grafana requirement for MVP.

## 12. Incident Priorities

P0 examples:

-   public invitations broadly unavailable;
-   check-in unavailable near/at events;
-   confirmed payments not activating;
-   data corruption/security incident.

P1 examples:

-   media processing backlog;
-   email reminder failure;
-   partial dashboard degradation.

For event-day incidents, preserve attendance correctness before cosmetic
functionality.

## 13. Managed Database Exit Criteria

Do not migrate merely for fashion. Reassess managed PostgreSQL when one
or more become material:

-   VPS resource contention threatens app/database reliability;
-   backup/restore operational burden is too high;
-   maintenance windows are unacceptable;
-   connection/IO demands exceed safe single-host operation;
-   team requires managed HA/point-in-time recovery.

Record the decision when threshold is reached.
