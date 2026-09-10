# DATA_MODEL.md

This is the conceptual relational model. Prisma names may differ
slightly, but invariants must remain.

## 1. Identity and Ownership

### User

Key fields: `id`, `name`, `email`, Better Auth's `email_verified` flag,
the application `email_verified_at` timestamp, timestamps, and
account-deletion fields. Better Auth's `account`, `session`, and
`verification` records are persisted separately; provider credentials and
session tokens remain behind the auth adapter.

### InvitationMember

Key fields: `invitation_id`, `user_id`, `role`, timestamps.

MVP role: `OWNER`. Exactly one active owner per invitation.

## 2. Invitation

### Invitation

Key fields:

-   `id`
-   `owner-facing title`
-   `couple_display_name_1`, `couple_display_name_2`
-   optional full names/parent fields
-   `language`
-   `timezone`
-   `theme_id`, `theme_version`, `theme_config`
-   `publication_state`
-   `commercial_state`
-   `trial_started_at`, `trial_ends_at`
-   `paid_at`, `active_until`, `grace_ends_at`
-   `price_locked_amount`, `currency`
-   `primary_event_id`
-   `generic_access_enabled`
-   `shared_password_hash`, `access_version`
-   `guest_sharing_enabled`
-   `rsvp_enabled`, public-RSVP settings
-   `guestbook_enabled`, guestbook mode/moderation
-   timestamps/version for optimistic concurrency

Do not combine publication and commercial state.

### InvitationSlug

-   `invitation_id`
-   `slug`
-   `is_canonical`
-   timestamps

Unique global slug. Historical alias retained and points directly to
current invitation.

### InvitationContent

Structured content for opening/closing, quote/prayer, hashtag, optional
sections, section order, cover/share cover and presentation-neutral
content.

## 3. Events

### Event

-   `id`, `invitation_id`
-   `name`, `starts_at`, `ends_at`, `timezone`
-   `is_primary`
-   visibility mode
-   venue/address/maps/location note
-   livestream/external URL
-   dress code
-   contact fields
-   RSVP settings
-   check-in window
-   cancellation/archive fields

Maximum 5 active/non-deleted events per invitation.

## 4. Guests

### Guest

-   `id`, `invitation_id`
-   `display_name/addressee`
-   normalized phone + display/original phone
-   optional notes
-   `group_id`
-   default max party size
-   distribution/view summary fields
-   archive fields
-   timestamps

### GuestGroup

-   `id`, `invitation_id`, `name`

One group per guest in MVP.

### GuestEvent

Assignment between guest and event:

-   `guest_id`, `event_id`
-   active/removed state
-   `max_party_size`
-   RSVP/check-in eligibility
-   public-RSVP approval state
-   timestamps

This assignment is the source of event-specific capacity and visibility.

## 5. Access

### GuestActivationCredential

Store hash/digest, never raw token:

-   `guest_id`
-   version
-   created/used/revoked/expiry timestamps

### GuestSession

Scoped server session referencing guest/invitation and access version.

### InvitationPasswordSession

Scoped session tied to invitation access version.

### StaffGrant

-   `invitation_id`
-   label
-   validity window
-   revoked timestamp
-   credential digest/version

### StaffGrantEvent

Join table for event scopes.

### StaffSession

Short-lived scoped operational session.

## 6. RSVP

### RSVP

Unique per active `guest_event`.

-   `guest_event_id`
-   `status`: PENDING/ATTENDING/NOT_ATTENDING
-   `attendance_count`
-   optional not-attending message/reason
-   source
-   updated timestamps
-   owner override metadata where applicable

Preserve audit for owner override/history-sensitive changes.

## 7. Guestbook

### Wish

-   `invitation_id`
-   optional `guest_id`
-   sender display name
-   message
-   moderation/publication state
-   submitted/updated timestamps
-   hidden/deleted metadata

For personalized guest, enforce one active wish per guest/invitation.

## 8. Attendance

### Attendance

Unique per `guest_event`.

-   current checked-in state
-   actual attendance count
-   first check-in timestamp
-   last correction timestamp
-   variance flag

### AttendanceAudit

Append-oriented:

-   attendance/guest/event references
-   action
-   before/after minimal state
-   actor type/id
-   reason
-   timestamp
-   idempotency/request key where useful

Do not store raw QR/access tokens.

### QRCredential

Digest/version, guest identity, revoked state. QR identity is separate
from activation credential.

## 9. Media

### MediaAsset

-   `invitation_id`
-   type: image/audio/QRIS/etc.
-   original storage key
-   lifecycle state
-   size/mime/validated metadata
-   upload/finalization timestamps
-   deletion state

### MediaVariant

-   `media_asset_id`
-   kind: thumb/medium/large/playback
-   storage key
-   dimensions/duration/size

### GiftMethod

-   `invitation_id`
-   type
-   bank/e-wallet label
-   account number where applicable
-   account owner name
-   optional QR media asset
-   order
-   active

Max 3 active gift methods.

## 10. Themes

### ThemeDefinition

Code/config registry rather than necessarily DB-managed.

### InvitationThemeConfig

Usually represented inside invitation/config JSON validated by theme
schema. Theme-specific values must not become business truth.

## 11. Billing

### PaymentOrder

-   `id`, `invitation_id`
-   provider
-   provider order/reference id
-   amount/currency copied from locked server price
-   state
-   provider expiry
-   created/updated timestamps

### PaymentAttempt

If provider semantics require multiple attempts, model attempts
separately from invitation activation.

### PaymentEvent

Idempotent normalized provider event: - provider event id/dedup
fingerprint - order - normalized type - received/processed timestamps -
minimal payload/reference

### FinancialRecord

Minimal durable record decoupled from guest/invitation PII where
possible: - transaction reference - amount/currency - payment date -
refund/duplicate-payment accounting fields - minimal customer/invitation
reference required by policy

## 12. Jobs and Notifications

### Job

-   `id`
-   type/class
-   priority
-   state
-   stable `dedup_key` nullable
-   payload
-   attempts/max attempts
-   run-after
-   lease owner/expiry
-   heartbeat
-   timeout
-   last error sanitized
-   created/started/completed timestamps

### EmailDelivery

-   invitation/user scope
-   template/event key
-   provider message id
-   state
-   queued/sent/delivery timestamps
-   suppression outcome

### EmailSuppression

For hard bounce/complaint until address corrected.

## 13. Audit

### AuditEvent

Only sensitive/operational actions:

-   actor
-   invitation/resource
-   action
-   minimal metadata
-   timestamp

Do not use audit as full revision history. Never store raw tokens or
unnecessary old/new PII.

## 14. Export

### ExportJob / ExportArtifact

-   invitation
-   requested by
-   format
-   state
-   storage key
-   expiry/cleanup timestamp

## 15. Capacity Invariant

Capacity is computed from active guest-event invitation entitlement
according to product rules, not raw guest row count.

Any mutation that can increase invited capacity must validate the
500-person entitlement atomically enough to prevent concurrent
over-allocation.

## 16. Referential and Deletion Rules

-   Historical RSVP/check-in should not disappear because a guest is
    "removed"; archive/inactivate instead.
-   Event with history is archived/cancelled.
-   Invitation purge removes operational data in dependency-safe order.
-   Financial retention is separate.
-   Storage deletion is asynchronous and idempotent.
