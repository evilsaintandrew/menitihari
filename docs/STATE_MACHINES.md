# STATE_MACHINES.md

## 1. Invitation Commercial Lifecycle

``` text
TRIAL
  | payment confirmed
  v
PAID_ACTIVE
  | active_until reached
  v
GRACE
  | grace_ends_at reached
  v
DELETION_PENDING
  | purge completed
  v
DELETED

TRIAL
  | trial_ends_at reached without payment
  v
TRIAL_EXPIRED
  | payment confirmed while still eligible
  v
PAID_ACTIVE
```

Voluntary/account deletion may take an invitation offline earlier and
enter deletion workflow according to policy.

For voluntary invitation deletion, any non-final invitation lifecycle state
may transition to `DELETION_PENDING` immediately. The invitation is
unpublished in the same transaction; after the server-owned purge deadline,
the physical purge moves it to the final deleted/inaccessible state.

Rules:

-   `TRIAL` starts at creation.
-   `PAID_ACTIVE.active_until = payment_success_at + 1 year`.
-   Trial remainder is not added.
-   No renewal transition.
-   `GRACE` is 30 days.
-   `DELETED` is final product state.

## 2. Publication State

``` text
DRAFT -> PUBLISHED <-> UNPUBLISHED
```

Commercial lifecycle gates which transitions/actions are allowed.

-   Trial/paid active: editing/publish subject to validation.
-   Trial expired: read-only, no public.
-   Grace: read-only, no public.
-   Deleted: inaccessible.

Cancellation is content/event status, not a replacement for commercial
lifecycle.

## 3. Payment

``` text
CREATED
  -> PENDING
  -> SUCCEEDED

CREATED/PENDING -> EXPIRED
CREATED/PENDING -> FAILED
SUCCEEDED -> REFUND_REVIEW -> REFUNDED (support case only)
```

Rules:

-   Only verified provider event/reconciliation may enter `SUCCEEDED`.
-   Client redirect cannot.
-   `SUCCEEDED` is idempotent.
-   Expired attempt may be replaced by a new attempt for same
    invitation.
-   No manual PAID override.

## 4. RSVP

``` text
PENDING -> ATTENDING
PENDING -> NOT_ATTENDING
ATTENDING <-> NOT_ATTENDING
ATTENDING -> ATTENDING (count update)
```

Transitions are allowed only while RSVP window is open for guest, except
audited owner override.

`ATTENDING` requires `1 <= attendance_count <= max_party_size`.

## 5. Attendance

``` text
NOT_CHECKED_IN
  -> CHECKED_IN
  -> CORRECTED_CHECKED_IN
```

Corrections may adjust count or reverse/correct state only through
authorized audited flow. Historical audit is append-oriented.

Concurrent initial check-in must allow exactly one successful state
transition.

## 6. Guest Access Credential

``` text
ISSUED -> USED
ISSUED -> REVOKED
ISSUED -> EXPIRED
```

`USED`, `REVOKED`, and `EXPIRED` are terminal for that credential.
Regeneration creates a new credential version.

## 7. Shared Password Access

Password itself has versions. Sessions are valid only against current
invitation access version.

``` text
NO_PASSWORD
  -> PASSWORD_ENABLED(v1)
  -> PASSWORD_CHANGED(v2)
  -> PASSWORD_DISABLED
```

Changing/disabling increments access version and invalidates old scoped
sessions.

## 8. Staff Grant

``` text
ACTIVE -> REVOKED
ACTIVE -> EXPIRED
```

Validity window can also make a grant not-yet-valid.

## 9. Media

``` text
TEMP_UPLOADED
 -> VALIDATING
 -> READY
 -> DELETE_PENDING
 -> DELETED

VALIDATING -> REJECTED
TEMP_UPLOADED -> EXPIRED_ORPHAN -> DELETED
```

Image/audio processing may create variants while original remains
durable until product deletion.

## 10. Job

``` text
PENDING
 -> RUNNING
 -> SUCCEEDED

RUNNING -> RETRY_WAIT -> PENDING
RUNNING -> DEAD_LETTER
RUNNING --lease lost--> recoverable PENDING/RETRY_WAIT
DEAD_LETTER -> PENDING (explicit requeue)
```

Retries are bounded and idempotent.

## 11. Email Delivery

``` text
QUEUED -> PROVIDER_ACCEPTED/SENT -> DELIVERED
                               -> BOUNCED
                               -> COMPLAINED
                               -> FAILED
```

Provider capabilities determine exact terminal evidence. Do not infer
delivery from enqueue/sent.

## 12. Wish Moderation

Auto-publish mode:

``` text
SUBMITTED -> PUBLISHED -> HIDDEN/DELETED
```

Moderation-first:

``` text
SUBMITTED -> PENDING_REVIEW -> PUBLISHED
                            -> HIDDEN/DELETED
```

## 13. Account Deletion

``` text
ACTIVE
 -> DELETION_COOLING_OFF
 -> DELETION_COMMITTED
 -> PURGED

DELETION_COOLING_OFF -> ACTIVE (cancel)
```

Entering cooling-off immediately takes public invitations offline.
Cancelling restores account but does not automatically republish
invitations.
