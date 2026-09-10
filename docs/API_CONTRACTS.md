# API_CONTRACTS.md

This file defines **internal contract conventions**, not a public API.
Exact route/server-action names can evolve.

## 1. Contract Rules

Every mutation declares:

-   authentication/access mode;
-   authorization policy;
-   Zod input schema;
-   server-derived resource ownership;
-   lifecycle preconditions;
-   idempotency behavior when relevant;
-   stable domain error codes;
-   transaction boundary;
-   cache invalidation after commit;
-   audit requirement;
-   background jobs emitted.

Never expose provider SDK objects directly to UI/domain.

## 2. Error Shape

Application services use a typed result convention for expected failures:

``` text
Result<T, DomainError> =
  { ok: true, value: T }
  | { ok: false, error: DomainError }
```

`DomainError` contains a stable `code`, a safe default `message`, optional
safe field-level `details`, and a `retryable` flag. Expected validation,
authorization, lifecycle, payment, RSVP, and check-in failures are returned as
values at application/server-function boundaries. Uncaught programming errors
remain exceptions and are mapped to `INTERNAL_ERROR` at the external boundary.

The canonical error codes are:

``` text
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
VALIDATION_FAILED
CONFLICT
STALE_VERSION
RATE_LIMITED
LIFECYCLE_LOCKED
CAPACITY_EXCEEDED
RSVP_CLOSED
ALREADY_CHECKED_IN
NOT_INVITED_TO_EVENT
PAYMENT_PENDING
PAYMENT_NOT_CONFIRMED
EXTERNAL_SERVICE_UNAVAILABLE
INTERNAL_ERROR
```

UI code receives only the stable code, localized-safe message, safe field
names/details, and retryability. Provider adapters must first normalize SDK
failures into transport-neutral kinds; raw provider errors, payloads, causes,
request values, tokens, and secrets are never returned to UI or copied into
error reports. Sentry integration consumes a sanitized event built from the
error code and an allowlist of non-PII correlation fields; Sentry SDK setup is
owned by `FOUND-005`.

## 3. Important Mutation Contracts

### Save invitation

Auth: owner.\
Input: invitation id, expected version, validated content/config patch.\
Behavior: optimistic concurrency; persist; increment version; invalidate
relevant public cache after commit.

### Publish

Auth: owner.\
Preconditions: editable commercial state + minimum valid core info.\
Behavior: publication state → published; invalidate cache.

### Create/update guest

Auth: owner.\
Behavior: normalize phone, duplicate warning, capacity check where
party/event entitlement changes.

### Import guests

Auth: owner.\
Flow: upload → background parse/validate → preview → explicit confirm →
bounded idempotent commit batches.

### Activate personalized guest

Access: opaque raw activation token.\
Behavior: digest lookup; single-use conditional consume; create scoped
guest session; never return/store raw token again.

### Submit RSVP

Access: scoped guest session or authorized owner override.\
Behavior: verify assignment/window/count; upsert current RSVP; audit
override.

### Public RSVP

Access: public, rate-limited.\
Behavior: verify enabled/event/capacity; create guest + assignments +
RSVP; flag duplicates; return personalized link credential according to
access policy.

### Check in

Access: scoped staff session.\
Input: event context, QR/guest identity, attendance count, idempotency
key.\
Behavior: atomic conditional transition; return `ALREADY_CHECKED_IN` on
repeat/concurrency.

### Correct attendance

Access: authorized staff/owner.\
Behavior: validate bounds; update current state + append audit in
transaction; require reason where configured.

### Create payment

Auth: owner.\
Behavior: read locked price server-side; create provider attempt;
persist provider reference/expiry.

### Payment webhook

Access: provider signature.\
Behavior: verify → normalize → deduplicate → same payment application
service → transactional activation/jobs → 2xx only according to
provider-safe handling.

### Reconcile payment

Access: scheduler/ops.\
Behavior: query provider; normalize; call same payment application
service.

### Request export

Auth: owner.\
Preconditions: export-eligible lifecycle.\
Behavior: enqueue idempotent export job; return job status.

### Delete invitation

Auth: owner membership.\
Input: the exact confirmation phrase `HAPUS`.\
Behavior: transactionally move the invitation to `DELETION_PENDING`, set
publication to `UNPUBLISHED`, set server-owned deletion/purge timestamps,
append a minimal audit event, invalidate the public cache after commit, and
enqueue one deduplicated purge job due at the configured purge deadline. No
payment provider or financial record mutation is performed.\
Response: invitation lifecycle state and the exact server-provided `purgeAt`;
the client never derives the purge window. Repeating an already accepted
request returns the existing state/deadline without moving the deadline or
creating another audit event.

### Delete invitation/account

Auth: owner + recent reauth for account deletion.\
Input for account deletion: current password and the exact confirmation
phrase `HAPUS AKUN`.\
Behavior: transactionally move the account into
`DELETION_COOLING_OFF`, set the server-owned `cancellable_until`, move
owned published invitations to `UNPUBLISHED`, append a minimal audit event,
and enqueue one deduplicated commit job due at that deadline.\
Response: account state and `cancellable_until`; the client never derives
the cooling-off duration.\
Cancellation is an authenticated transaction valid only before that
deadline; it returns the account to `ACTIVE` without republishing invitations.
After the deadline, the commit job marks invitations deleted and enqueues
the physical purge job; financial records are not modified by this flow.

## 4. Read Contracts

Public generic read and personalized read must use separate composition
paths/caching rules so personalized guest/event data can never leak into
shared cache.

Staff reads are event-scoped, paginated, and return minimum operational
fields.

Dashboard reads may aggregate but must not be used as authoritative
mutation preconditions without transactional re-check.
