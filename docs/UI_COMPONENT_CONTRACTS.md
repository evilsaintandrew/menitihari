# Shared UI component contracts

FOUND-008 owns the reusable presentation primitives used by owner, guest, and
staff surfaces. Domain tickets own the data reads, mutations, and lifecycle
rules that feed those primitives.

## Authority boundary

Domain components receive a server-authoritative snapshot and render its
status. They may emit an explicit user intent such as `onRetry`, `onPreview`,
or `onConfirm`, but they must not derive or grant lifecycle, payment, RSVP,
QR, or check-in eligibility in client-only state. Unknown mutation results are
shown as pending/uncertain until the server is queried again.

Technical values such as raw activation tokens, staff grants, QR payloads, and
payment provider secrets are never displayed or logged by shared components.

## Recurring domain surfaces

| Surface | Required server snapshot | Shared presentation responsibilities |
| --- | --- | --- |
| `TrialBanner` | commercial state, server expiry, activation route | show factual state, absolute/relative time, and the allowed next action |
| `PublishReadiness` | checks and authoritative `canPublish` | show satisfied/unsatisfied checks, Preview, and a disabled/explained publish action |
| `GuestRow` | addressee, group, capacity, event, RSVP, distribution, viewed state | preserve privacy, expose row actions without revealing credentials, switch table → card on mobile |
| `RSVPSummary` | per-event status, attendance count, closure state | show text status and validation; never infer eligibility from a local toggle |
| `PaymentStatus` | payment attempt state, server status label, timestamps | distinguish pending/success/failure; never treat browser return as payment success |
| `QRCodeCard` | QR eligibility, event, identity, check-in status | provide textual identity/status beside the QR; never render raw credentials as copy |
| `ScannerViewport` | scoped event, check-in window, camera/network state | show event context, resolving/permission/network states, and manual-search fallback |
| `CheckInConfirmation` | resolved guest, allowed count, current attendance state, idempotency context | confirm actual count before mutation, disable duplicate submit, and show repeat/wrong-event outcomes |

## Responsive contract

- Owner navigation is a desktop rail that becomes a compact top bar and menu
  drawer on small screens. Complex guest management progressively enhances on
  desktop but is not desktop-only.
- Guest invitation and RSVP surfaces are phone-first and can expand for
  desktop presentation.
- Staff scanner and manual search are phone-first, one-handed surfaces with
  large targets and no owner navigation.
- Dialogs become bottom sheets on narrow screens for consequential actions.

## State coverage

Shared patterns cover page loading/skeleton, empty, inline validation,
recoverable error, slow/offline-ish connection, destructive confirmation,
success feedback, and pending/unknown mutation outcomes. Copy must describe
the next safe action and must not claim an operation succeeded before the
authoritative response arrives.
