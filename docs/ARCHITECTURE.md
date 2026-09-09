# ARCHITECTURE.md --- Platform Undangan Pernikahan Digital

**Status:** Architecture v2 --- implementation baseline\
**Date:** 9 September 2026\
**Scope:** MVP, Indonesia mass market\
**Audience:** engineers and coding agents

## 1. Purpose

This document is the technical source of truth for the MVP. Product
policy belongs in `PRODUCT.md`; detailed entities in `DATA_MODEL.md`;
transitions in `STATE_MACHINES.md`; operational procedures in
`OPERATIONS.md`; executable work in `backlog/`.

When documents appear to conflict, use this precedence:

1.  security and data-integrity invariants in this document;
2.  current product policy in `PRODUCT.md`;
3.  state transitions in `STATE_MACHINES.md`;
4.  data model constraints in `DATA_MODEL.md`;
5.  backlog acceptance criteria.

Do not add infrastructure or abstractions for hypothetical scale.

## 2. Engineering Priority

``` text
Correctness
  ↓
Security
  ↓
Maintainability
  ↓
Shipping speed
  ↓
Performance optimization
  ↓
Infrastructure sophistication
```

The system must remain understandable end-to-end by one engineer or
coding agent.

## 3. Architecture Style

MVP is a **modular monolith**.

-   One TypeScript/Next.js codebase.
-   Domain-oriented modules.
-   PostgreSQL is the transactional source of truth.
-   Separate app, scheduler, general worker, and media worker processes
    may run from the same image/codebase.
-   No microservices.
-   No Redis at launch.
-   No public REST API.
-   External providers are behind internal adapters.
-   Themes contain presentation logic only, never business rules.

Recommended modules:

``` text
modules/
  auth/
  users/
  invitations/
  events/
  guests/
  access/
  rsvp/
  wishes/
  themes/
  media/
  whatsapp/
  checkin/
  billing/
  lifecycle/
  notifications/
  exports/
  audit/
  jobs/
```

Each domain may use `domain/`, `application/`, `infrastructure/`, and
`schemas/` where useful. Do not force ceremonial Clean Architecture.

## 4. Technology Baseline

-   Next.js + React
-   TypeScript strict
-   Tailwind CSS
-   Zod for boundary validation
-   pnpm
-   PostgreSQL
-   Prisma
-   Better Auth, self-hosted
-   Cloudflare R2 Standard through `StorageProvider`
-   DUITKU QRIS through `PaymentProvider`; Midtrans is fallback only
-   Resend through `EmailService`
-   PostHog Cloud for product analytics
-   Sentry for errors, health alerts, and operational failures
-   Caddy reverse proxy
-   Docker Compose on one VPS for launch
-   GHCR for immutable application images

Launch VPS baseline: approximately 2 vCPU / 4 GB RAM. Tune worker
concurrency conservatively.

## 5. Runtime Topology

``` text
Internet
   |
Cloudflare DNS
   |
Caddy
   |
Next.js application
   |
PostgreSQL
   |
+-------------------+------------------+
|                   |                  |
scheduler       worker-general     worker-media
|                   |                  |
+---------------- PostgreSQL -----------+

Application / workers -> R2
Application / workers -> DUITKU / Resend / Sentry / PostHog
```

PostgreSQL runs on the same VPS at launch. Migration to managed
PostgreSQL is an operational scaling decision, not a domain redesign.

## 6. Core Domain Rules

### Account and ownership

-   One account per verified email.
-   A user may own multiple invitations.
-   Each invitation has independent trial, payment, activation, expiry,
    and deletion lifecycle.
-   MVP is single-owner: no collaborator/co-owner UX and no ownership
    transfer.
-   Model membership from the beginning (`invitation_members`) with
    exactly one `OWNER` invariant so future collaboration does not
    require ownership redesign.
-   Authorization is centralized in policy/services; do not scatter
    `user_id === owner_id` checks.

### Invitation

-   New invitation starts `DRAFT`.
-   Trial starts at invitation creation.
-   Publishing is explicit.
-   Owner may edit published invitation while lifecycle allows.
-   Successful saves become live without revision workflow.
-   Owner may unpublish/republish while lifecycle permits.
-   Preview uses the same renderer but an authenticated preview route.
-   Public URL is path-based on the main domain.
-   Slug is globally unique.
-   Historical slugs are retained as aliases and never reused while
    retained.
-   Old aliases 301 directly to the latest canonical slug; never build
    redirect chains.
-   Public invitation is `noindex` by default.

### Events

-   Up to 5 events per invitation.
-   Generic `events[]` model, not hard-coded ceremony/reception columns.
-   Each event has timezone; default from invitation, normally
    `Asia/Jakarta`.
-   One event can be selected as primary for countdown.
-   Events can be generic-visible or personalized-only.
-   A personalized-only event is absent from generic output entirely.
-   Location/contact/livestream visibility follows event/guest
    visibility rules.
-   Event with RSVP/check-in history is archived/cancelled, not normally
    hard-deleted.

### Guests and capacity

-   Guest entry may represent one individual or a party/family.
-   Product entitlement is **500 invited people capacity**, not 500
    database rows.
-   Capacity is based on allowed party sizes across active assignments.
-   Guest can have one simple group/category.
-   Guest ↔ event assignment is explicit.
-   `max_party_size` belongs primarily on guest-event assignment with
    optional guest default.
-   Adding a new event after publish does not auto-assign existing
    guests.
-   Duplicate detection warns on normalized phone/email/name signals;
    never auto-merge.
-   Conflicting duplicate histories require owner review.
-   Phone has canonical normalized value plus optional original/display
    form.
-   Guests with history are archived rather than destructively deleted.

### Personalized access

-   Personalized route: `/slug/g/<opaque-token>`.
-   Raw activation token is single-use.
-   Successful activation creates scoped server session.
-   Raw token is never a reusable authenticated credential.
-   Regeneration invalidates prior activation token.
-   Tokens are redacted from logs, analytics, Sentry, and audit
    metadata.
-   Owner "Preview as Guest" does not consume activation token.

### Shared password

-   Optional per invitation.
-   Password is hashed.
-   Successful entry creates short-lived scoped access session.
-   Password attempts are rate-limited by IP + invitation with cooldown.
-   Changing password invalidates previous password access sessions
    through versioning.
-   Personalized-only mode and shared password may be combined.

### RSVP

-   RSVP status: `PENDING`, `ATTENDING`, `NOT_ATTENDING`.
-   RSVP is per guest-party × event.
-   `ATTENDING` requires attendance count \>= 1 and \<= allowed max.
-   Guest may update while RSVP remains open.
-   Optional `rsvp_closes_at`; owner may close/reopen while active.
-   New responses stop after event ends.
-   Owner override is allowed and audited.
-   Capacity is advisory for assigned guests, but public RSVP
    auto-closes at 500 invited capacity.
-   Generic public RSVP is owner-configurable and creates a guest
    record.
-   Public RSVP asks name only or name + phone, chosen by owner; no
    guest email field.
-   Public RSVP may require owner approval before QR/check-in
    eligibility.
-   Personalized RSVP does not re-ask phone/email.

### QR and attendance

-   One QR identity per guest/party; attendance is event-scoped.
-   QR token and guest activation token are separate.
-   QR normally becomes available after eligible `ATTENDING` RSVP.
-   Check-in window is event-scoped and owner-configurable within
    product bounds.
-   Actual attendance may differ from RSVP up to allowed max; flag
    variance.
-   Check-in is an atomic conditional mutation.
-   Concurrent scan: first succeeds; second returns
    `ALREADY_CHECKED_IN`.
-   Mutations accept idempotency/request key.
-   Repeat scan shows checked-in state/time.
-   Correction preserves before/after, actor, timestamp, and reason.
-   Wrong-event valid QR returns `NOT_INVITED_TO_EVENT`; authorized
    override is explicit.
-   Staff may search event-scoped guests and manually check in.
-   No offline synchronization MVP; browser/PWA uses online retry +
    manual fallback.

### Staff access

-   Owner creates event-scoped staff grants.
-   Up to 5 active grants per event.
-   Grants have labels, validity window, revocation, and one/multiple
    event scope.
-   Staff session is scoped and short-lived.
-   Staff sees only operational fields and simple attendance summary.
-   No staff export.
-   Correction permission is authorization-controlled.

### Wishes / guestbook

-   Guestbook is optional.
-   Owner chooses public or personalized-guests-only.
-   Owner chooses auto-publish or moderation-first.
-   Owner can hide/delete submissions.
-   Personalized guest has one active wish that can be updated.
-   No replies/reactions in MVP.
-   Published entry shows sender display name, message, and submission
    date/time.

### Media

-   Browser uploads directly to R2 using presigned authorization.
-   Upload starts in temporary namespace.
-   Backend/worker finalization verifies expected size/type and magic
    bytes.
-   No full malware scanner MVP.
-   Images keep original plus async fixed variants: thumb, medium,
    large.
-   Maximum 20 photos per invitation.
-   One active song per invitation.
-   User-uploaded music requires rights declaration.
-   Audio is transcoded to standardized playback form.
-   Curated royalty-free library is small.
-   Temporary orphan uploads are TTL-cleaned.
-   R2 object deletion is async and idempotent; missing object is
    success.

### Themes and editor

-   Launch with 10 themes.
-   Trial can fully preview/use all themes.
-   Paid removes platform branding.
-   Themes share one invitation data contract and renderer.
-   Theme configuration is schema-validated structured presentation
    data.
-   Switching theme changes theme id/config only; content remains.
-   Theme versions support migration.
-   Renderer has safe fallback/error boundary.
-   Editor uses debounced autosave with visible status.
-   Client validation improves UX; server Zod validation is
    authoritative.
-   Optimistic concurrency rejects stale writes.
-   Failed save preserves local unsaved state.
-   Cache invalidation happens only after successful persistence and may
    be coalesced.

## 7. Commercial Lifecycle

Commercial policy is detailed in `PRODUCT.md`. Architectural facts:

-   Trial: 3 days from creation.
-   Paid activation: successful provider-confirmed payment.
-   Paid expiry: 1 year from successful payment.
-   Paying early immediately enters paid period; unused trial is not
    added.
-   No renewal/reactivation flow in MVP.
-   Expiry makes public invitation immediately unavailable.
-   Grace: 30 days, read-only dashboard/private preview/export/media
    download.
-   After grace, product data is marked for deletion then physically
    purged.
-   Default physical purge window after deletion marking: configurable,
    7 days.
-   `DELETED` is final product state.
-   Financial records are retained separately with minimal/decoupled
    PII.

Publication state and commercial lifecycle are separate concepts. Never
overload one enum to represent both.

## 8. Billing

-   Billing is invitation-scoped.
-   Price is server-controlled and locked when invitation is created.
-   Launch price baseline: Rp79,000.
-   One payment activates one invitation.
-   Draft invitation may be paid.
-   Payment provider webhook is authoritative for success.
-   Client return/success page is never proof of payment.
-   QRIS `PENDING` remains pending until provider confirmation.
-   Expired payment attempt can be replaced while invitation remains
    eligible.
-   Payment state transition, activation, expiry calculation, audit, and
    enqueue of follow-up jobs happen in one DB transaction.
-   External side effects occur after commit.
-   Webhook and reconciliation call the same payment application
    service.
-   Webhook processing is verified and idempotent.
-   Pending payments are reconciled automatically with progressive
    backoff.
-   No manual `PAID` override; support uses reconciliation.
-   Duplicate payment is a support-reviewed refundable case.
-   Store minimal durable financial records separately from invitation
    PII.
-   Provide a simple downloadable/viewable payment receipt.

## 9. Background Jobs

Use PostgreSQL-backed jobs; no Redis at launch.

Required concepts:

-   states include pending/running/succeeded/retry/dead-letter
    semantics;
-   stable optional `dedup_key`;
-   lease + heartbeat;
-   bounded retries;
-   retry policy per job type/class;
-   per-job timeout with global default;
-   DEAD_LETTER after exhaustion;
-   explicit requeue operation;
-   successful jobs have bounded retention;
-   dead-letter records retained longer;
-   payloads use stable IDs plus only necessary immutable snapshots;
-   job table doubles as transactional outbox.

Priority classes:

``` text
CRITICAL
HIGH
NORMAL
LOW
```

Use weighted fairness so low priority cannot starve forever.

Processes:

-   `scheduler`: discovers due work and inserts deduplicated jobs.
-   `worker-general`: lifecycle, email, export, reconciliation, cleanup.
-   `worker-media`: image/audio processing.

Scheduled occurrence uses stable deduplication key. Catch-up after
downtime is bounded; stale occurrences are skipped according to job
policy.

## 10. Notifications

Email is for auth/security, payment, lifecycle, and optional owner RSVP
notifications.

-   Resend webhook is verified, normalized, idempotent.
-   Track lifecycle from queued → provider accepted/sent → delivery
    outcome when available.
-   Hard bounce/complaint suppresses automated mail to that address
    until corrected.
-   Account remains usable.
-   Trial reminders: in-app countdown + near-expiry email; no daily
    spam.
-   Paid expiry reminders: H-30 and H-7.
-   In-app expiry reminder is computed banner/state, not a notification
    center.
-   No platform WhatsApp notification automation.

## 11. Public Caching

Public generic invitation content may be cached.

Invalidate after successful:

-   content save affecting public output;
-   publish/unpublish;
-   slug change;
-   password/access setting change.

Never serve stale cache for:

-   RSVP mutations/state;
-   check-in;
-   payment;
-   dashboard statistics;
-   personalized guest data.

Never put personalized guest data into shared cache.

## 12. Security Invariants

-   HTTPS only.
-   HTTP-only secure cookies.
-   CSRF protection where applicable.
-   Server-side authorization and validation.
-   Output escaping/sanitization.
-   Endpoint-specific rate limiting.
-   Generic auth responses to reduce email enumeration.
-   Login/reset/password attempts use IP + identifier controls.
-   Password reset/change revokes other sessions.
-   Support "logout all devices".
-   Reasonable Better Auth session lifetime, rotation, and revocation.
-   Secrets only through environment/secret management.
-   Webhook signatures verified.
-   Uploads validated before becoming public.
-   Raw access/QR tokens never logged.
-   Phone and other PII masked or omitted from logs.
-   Public mutations rate-limited.
-   Audit only sensitive/operational actions with minimal metadata.

## 13. Privacy and Public Metadata

-   Generic invitation without password is accessible to anyone with
    URL.
-   Owner may disable generic access and use personalized-only mode.
-   Rich link preview defaults to cover + couple names + primary date.
-   Personalized link preview never exposes guest/addressee identity.
-   Owner can select social/share cover from invitation media; default
    main cover.
-   Password-protected invitation uses privacy-safe generic preview.
-   Guest sharing is owner-configurable.
-   Guest list, RSVP, phone, attendance, and owner dashboard stats are
    private.
-   Guest sees only their relevant personalized data.
-   No owner-facing device/browser/location analytics for guests.

## 14. Data Retention and Deletion

-   Voluntary invitation deletion requires strong confirmation and
    offers export first.
-   Account deletion requires recent reauthentication and destructive
    confirmation.
-   Account deletion immediately takes owned public invitations offline.
-   Short cooling-off period allows cancellation.
-   Cancelling account deletion restores account but does not
    auto-republish invitations.
-   After grace, product data is soft-marked deleted then physically
    purged asynchronously.
-   Purge removes guest PII, media, credentials, operational audit, and
    product data according to retention policy.
-   Financial records remain minimal and decoupled.
-   Storage deletion jobs snapshot only minimal object locators.

## 15. Export

Owner can export while invitation is accessible, including trial and
grace.

Export includes:

-   invitation content/configuration;
-   events;
-   guests and groups;
-   guest-event assignments;
-   RSVP;
-   check-in/attendance;
-   guestbook;
-   relevant distribution status.

Formats: CSV and Excel `.xlsx`. Uploaded media can be downloaded
separately before purge.

## 16. Deployment and Environments

Permanent environments:

-   local development;
-   production.

No permanent staging environment for MVP.

CI:

1.  install;
2.  lint;
3.  typecheck;
4.  tests;
5.  build immutable Docker image;
6.  push to GHCR.

Production deployment is manual.

Deployment:

1.  pull target immutable image;
2.  take pre-deploy backup only for risky/destructive/large migration;
3.  run explicit one-shot migration container;
4.  start new application process/container;
5.  health check;
6.  switch Caddy traffic;
7.  drain old workers/app where relevant.

Target is best-effort near-zero downtime, not elaborate orchestration.

Rollback:

-   application image may roll back;
-   database schema is roll-forward only;
-   migrations use expand-migrate-contract for risky changes;
-   never manually mutate production schema.

## 17. Database and Backup

-   Prisma direct PostgreSQL connections at launch.
-   Conservative connection limits.
-   No PgBouncer initially.
-   Daily PostgreSQL backup to R2.
-   Default retention: 14 days.
-   Backup failure alerts.
-   Restore procedure documented.
-   Periodic manual restore tests.
-   Never rely only on a backup stored on the same VPS.

## 18. Observability and Operations

Use:

-   structured application logs;
-   Sentry errors/alerts;
-   PostHog product analytics;
-   health endpoints;
-   CLI/`pnpm ops:*` commands for privileged operations.

No Prometheus/Grafana requirement at MVP.

Proactively alert on:

-   failed backup;
-   unhealthy app;
-   queue backlog/stuck leases;
-   repeated scheduler failure;
-   payment webhook/reconciliation failures;
-   DEAD_LETTER growth;
-   media processing failures above threshold.

No platform-admin UI in MVP. Privileged operations use audited
CLI/scripts.

## 19. Testing Baseline

Mandatory coverage includes:

-   auth/session revocation;
-   centralized authorization;
-   trial and paid lifecycle;
-   price lock and payment webhook idempotency;
-   payment reconciliation;
-   slug alias/canonical behavior;
-   password access invalidation;
-   personalized activation single-use;
-   RSVP limits and close rules;
-   public RSVP capacity;
-   QR eligibility;
-   concurrent check-in;
-   correction audit;
-   scheduled job deduplication/retry;
-   media finalization;
-   expiry/grace/purge;
-   export;
-   account deletion;
-   cache isolation.

Golden-path E2E:

``` text
signup
→ verify
→ create invitation
→ choose theme
→ edit
→ publish
→ add/import guest
→ open personalized invitation
→ RSVP
→ pay/activate when needed
→ show QR
→ staff check-in
→ owner views summary
→ export
```

## 20. Architectural Invariants

1.  Provider-confirmed webhook/reconciliation determines payment
    success.
2.  Payment processing is idempotent.
3.  Client never sets transaction price.
4.  Commercial lifecycle is enforced server-side.
5.  Authorization is server-side and centralized.
6.  Provider SDKs do not leak into domain logic.
7.  Themes do not contain business logic.
8.  Jobs are idempotent and bounded.
9.  Personalized activation token is single-use.
10. Guest session, QR token, and shared-password access are separate
    credentials.
11. Personalized data never enters shared public cache.
12. Check-in concurrency cannot double-count.
13. Historical attendance/payment facts are not silently rewritten.
14. `wa.me` action means `WHATSAPP_OPENED`, never message delivery.
15. Deletion and storage cleanup are idempotent.
16. Technical complexity requires demonstrated need.

## 21. Explicit MVP Non-Goals

-   microservices;
-   Redis/managed queue;
-   permanent staging;
-   full offline check-in sync;
-   WhatsApp Business API/blast;
-   renewal/reactivation;
-   collaborator/co-owner;
-   ownership transfer;
-   custom domains;
-   public developer API;
-   seating/table assignment;
-   RSVP form builder;
-   guest photo contribution;
-   bulk QR file generation;
-   advanced analytics;
-   reseller/WO package;
-   promo/voucher engine;
-   add-ons;
-   automated refund;
-   large admin/moderation console.

## 22. Provider Decisions Still Operational

These may be selected during implementation without changing domain
architecture:

-   VPS OS/base image and hardening details;
-   managed PostgreSQL migration threshold;
-   DUITKU production merchant credentials/approval;
-   exact R2 bucket names/lifecycle settings;
-   exact curated royalty-free music source.

Document consequential changes in `DECISIONS.md`.
