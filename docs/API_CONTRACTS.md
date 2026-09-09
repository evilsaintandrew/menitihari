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

Prefer stable internal errors such as:

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
```

UI may localize friendly copy.

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

### Delete invitation/account

Auth: owner + recent reauth for account deletion.\
Behavior: strong confirmation; immediate public-offline semantics;
schedule deletion workflow.

## 4. Read Contracts

Public generic read and personalized read must use separate composition
paths/caching rules so personalized guest/event data can never leak into
shared cache.

Staff reads are event-scoped, paginated, and return minimum operational
fields.

Dashboard reads may aggregate but must not be used as authoritative
mutation preconditions without transactional re-check.
