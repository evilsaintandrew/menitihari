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

### Manage WhatsApp templates

Auth: owner.\
Read input: invitation id. Mutation input: invitation id, one of the
invitation/RSVP-reminder/event-reminder template types, and a bounded body.\
Behavior: re-check owner membership and commercially editable invitation
lifecycle on the server; return the invitation's default template set or
update exactly one invitation-owned row. Bodies are validated against the
allowlist `{guest_name}`, `{couple_name}`, `{invitation_url}`, `{event_name}`,
`{event_date}`, `{event_time}`, and `{event_venue}`. Unknown or malformed
placeholders fail with `VALIDATION_FAILED`; rendered guest-specific messages
are not persisted by this operation. The unique invitation/type constraint
prevents multiple defaults for one template type. No external side effect or
background job is emitted, and template content changes do not require an
audit event because they are ordinary owner-authored content rather than a
security-sensitive operation.

### Publish

Auth: owner.\
Preconditions: editable commercial state + minimum valid core info.\
Behavior: publication state → published; invalidate cache.

### Create/update guest

Auth: owner.\
Behavior: normalize name and phone, return matching active guests as a
warning, and perform no automatic merge. Run the capacity check where
party/event entitlement changes.

### Bulk guest actions

Auth: owner.\
Input: a bounded, unique list of active guest ids and exactly one operation:
set/clear an invitation-owned group, assign/unassign one active event with a
party-size value for assignment, or set the manual distribution status to
`NOT_SENT`/`MARKED_SENT`.\
Behavior: re-check ownership, invitation lifecycle, guest membership, event
membership, party-history limits, and invited-person capacity inside one
transaction. Event unassignment with RSVP/check-in history first returns a
safe `HISTORICAL_EVENT_UNASSIGN` warning without changing data; a repeat
request must explicitly confirm removal. Confirmed removal changes only the
assignment to `REMOVED`, preserving the historical RSVP/check-in records.
Distribution status is owner-maintained and remains separate from
`WHATSAPP_OPENED` and viewed state. Append minimal audit metadata without
copying guest ids, names, phone numbers, or personalized links.

### Preview/merge duplicate guests

Auth: owner.\
Preview input: invitation id, source guest id, target guest id.\
Merge input: the same pair plus one explicit `SOURCE` or `TARGET`
resolution for every overlapping event assignment where either guest has
RSVP/check-in history.\
Behavior: re-check ownership and invitation lifecycle in one transaction;
move source assignments that do not conflict; retain conflicting source
assignments and their history; archive and link the source to the chosen
target; revoke source access credentials; and append a minimal audit event.
The operation never auto-merges from a duplicate warning. Missing or extra
conflict resolutions fail with `CONFLICT`.

### Update/cancel event

Auth: owner membership.\
Input: event id, validated event fields/visibility, and an optional bounded
cancellation message.\
Behavior: enforce invitation lifecycle and ownership inside one transaction;
mark an active event cancelled with its optional message; audit the status
change with minimal metadata that does not copy the message; and invalidate
the public invitation cache only after commit. An event with cancellation or
RSVP/check-in history is archived rather than hard-deleted.

### Import guests

Auth: owner.\
Flow: upload → background parse/validate → preview → explicit confirm →
bounded idempotent commit batches.

Upload enforces server-configured file and row limits before queueing a parse
job. Preview rows expose only safe row fields, validation issues, and duplicate
warnings. Invalid rows are excluded by default; warnings never auto-merge a
guest. Confirmation re-checks lifecycle, ownership, and invited-person
capacity in a transaction. Commit batches re-check capacity again and record
each committed row atomically with its created guest; rows that no longer fit
are marked failed without exceeding the 500-person entitlement.

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
RSVP; flag duplicates; apply the invitation's auto-eligibility or pending
approval policy to QR/check-in eligibility; return personalized link
credential according to access policy.

### Approve public RSVP eligibility

Auth: owner membership.\
Input: guest-event assignment and `APPROVE` or `REJECT` decision.\
Behavior: verify the assignment belongs to a public-RSVP guest, update only
approval/check-in eligibility fields in one transaction, and append a minimal
audit event. Guest identity and contact fields are never changed.

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
