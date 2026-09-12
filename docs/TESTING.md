# TESTING.md

## 1. Strategy

Use the smallest test layer that proves the behavior:

-   unit tests for pure rules;
-   integration tests for DB transactions, repositories, authz, jobs and
    provider normalization;
-   E2E for critical user journeys;
-   manual production smoke checks for deployment/provider integration.

## 2. Mandatory Domain Tests

### Auth

-   signup/verify/login/reset;
-   generic anti-enumeration responses;
-   password change/reset revokes other sessions;
-   logout all devices;
-   rate limits.

### Invitation lifecycle

-   trial begins at creation;
-   trial expires at exactly configured boundary;
-   payment during trial starts paid clock immediately;
-   paid expiry after 1 year;
-   grace lasts 30 days;
-   no publish/edit during grace;
-   purge scheduling;
-   no renewal path.

### Publication/slug

-   draft/publish/unpublish/republish;
-   publish validation;
-   globally unique slug;
-   slug change creates alias;
-   alias 301 to latest canonical;
-   alias never chains;
-   historical slug not reused.

### Access/privacy

-   generic enabled/disabled;
-   shared password;
-   password session invalidated on change;
-   activation token single-use;
-   regenerated token invalidates old token;
-   personalized guest cannot access other guest/event data;
-   no personalized data in cache/metadata.

### Guests/capacity

-   party capacity counts people;
-   500 entitlement;
-   concurrent capacity-increasing mutations cannot exceed cap;
-   normalized name/phone duplicate warning without auto-merge;
-   manual merge requires explicit choices for conflicting histories;
-   merge archives/links the source and preserves relevant history;
-   archive with history;
-   restore creates new credentials;
-   CSV import validation/preview/idempotency.

### RSVP

-   per-event assignment;
-   ATTENDING min 1;
-   max party size;
-   close/reopen;
-   event-end auto close;
-   owner override audit;
-   public RSVP creates guest;
-   public RSVP closes at capacity;
-   public RSVP approval/QR eligibility.

### WhatsApp

-   allowlisted placeholders;
-   personalized URL;
-   unique-contact trial cap atomic;
-   repeat contact does not consume another slot;
-   paid removes cap;
-   `WHATSAPP_OPENED` is not delivery.

### Guestbook

-   public vs personalized-only;
-   moderation-first;
-   one active personalized wish;
-   owner hide/delete.

### Check-in

-   QR eligibility;
-   check-in window;
-   wrong event;
-   concurrent scan exactly once;
-   idempotency key;
-   actual count limits;
-   repeat scan;
-   correction audit;
-   manual search/check-in;
-   staff event scope and expiry/revocation.

### Billing

-   server price lock;
-   draft can pay;
-   verified webhook only;
-   webhook duplicate;
-   webhook/reconciliation race;
-   pending/expired/new attempt;
-   transaction activates invitation once;
-   receipt.

### Jobs

-   dedup key;
-   lease/heartbeat;
-   retry/backoff;
-   timeout;
-   DEAD_LETTER;
-   explicit requeue;
-   scheduler duplicate occurrence;
-   bounded catch-up.

### Media

-   presign authorization;
-   invalid size/type/magic bytes;
-   temp orphan cleanup;
-   image variants;
-   audio transcode;
-   missing R2 object deletion is success.

### Deletion/export

-   export in trial/paid/grace;
-   account deletion requires recent reauthentication and strong confirmation;
-   account deletion takes public offline;
-   cooling-off cancel does not republish;
-   cooling-off deadline is server-configured and exposed exactly;
-   deletion commit is idempotent and schedules purge;
-   operational data purge;
-   financial record retention separation.

## 3. Local Verification Environment

Run local verification serially, one check at a time, to keep memory use predictable. Never run builds, tests, database setup, or browser checks concurrently.

Before a build or memory-intensive test, inspect available RAM. If available RAM is 2 GiB or less, cap Node's heap at 1 GiB:

```sh
NODE_OPTIONS=--max-old-space-size=1024 pnpm build
```

If available RAM is greater than 2 GiB, cap Node's heap at 2 GiB instead:

```sh
NODE_OPTIONS=--max-old-space-size=2048 pnpm build
```

Integration tests that require PostgreSQL should run against a temporary disposable Docker container when Docker is available. Apply all checked-in migrations to the container before testing and remove the container afterward. If Docker is unavailable, use an installed local PostgreSQL server as a fallback: create a uniquely named temporary database and user, apply all checked-in migrations, point the test URL at it, and drop both after testing. Do not leave test data in a persistent development database.

When a ticket requires browser verification, use `agent-browser` for dev-server navigation, screenshots, accessibility/interaction inspection, and console/error checks, preferring Lightpanda when it is available and compatible. Close the browser session after verification. If the repository has no automated E2E suite for the journey, report the manual browser coverage and the missing automation separately.

If a verification step is blocked by permissions, sandboxing, daemon access, or another environment restriction, request elevated permission before declaring it blocked. If escalation is unavailable or denied, record the exact command, reason, and remaining coverage.

## 4. Golden E2E

1.  User signs up and verifies email.
2.  Creates invitation; trial clock visible.
3.  Chooses theme and edits content.
4.  Adds two events.
5.  Publishes.
6.  Imports/adds guest party.
7.  Opens personalized link and activates guest session.
8.  Guest RSVPs attending with count.
9.  Owner opens WhatsApp distribution.
10. Payment succeeds through provider-confirmed path.
11. Guest sees eligible QR.
12. Staff grant scans/checks in.
13. Repeat scan shows already checked in.
14. Owner sees summary.
15. Owner exports data.

## 5. Release Gate

P0 release requires:

-   lint/typecheck/build green;
-   unit/integration suite green;
-   golden E2E green;
-   migration tested;
-   backup and restore procedure tested;
-   provider sandbox/production smoke where available;
-   no known P0 security/integrity bug.
