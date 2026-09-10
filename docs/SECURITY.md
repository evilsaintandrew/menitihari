# SECURITY.md

## Security Baseline

1.  HTTPS everywhere.
2.  Secure HTTP-only cookies.
3.  CSRF protection for cookie-authenticated mutations where relevant.
4.  Zod/server validation at every trust boundary.
5.  Centralized server-side authorization.
6.  Rate limiting for public mutations and authentication/security
    endpoints.
7.  Generic auth responses to reduce account enumeration.
8.  Output escaping/sanitization.
9.  Verified provider webhooks.
10. No secrets/raw access tokens in logs, analytics, Sentry, or audit.

## Authentication

-   Better Auth self-hosted.
-   Email/password, verification, password reset.
-   Reasonable session lifetime and rotation.
-   Password reset/change revokes other sessions.
-   Support "logout all devices".
-   Login/reset attempts use IP + identifier endpoint-specific limits.
-   Account deletion requires re-entering the current credential password
    and an exact destructive confirmation phrase.
-   Account deletion uses a server-owned cooling-off deadline; the client
    cannot choose or extend it.

## Authorization

Use invitation policy/service boundaries. Check:

-   owner membership;
-   invitation lifecycle;
-   event scope;
-   guest session scope;
-   staff grant scope;
-   operation-specific permission.

Never trust client-provided owner/invitation/event identity without
verifying relationships.

## Public Access

-   Generic public invitation is intentionally public when enabled.
-   Personalized access uses opaque single-use activation credential
    then scoped session.
-   Shared password uses hash + scoped short-lived access session.
-   Password changes invalidate old sessions.
-   Personalized and shared-password access may be layered.

## Tokens

Never persist raw activation/QR/staff secrets when a digest suffices.

Separate credentials:

-   guest activation;
-   guest session;
-   QR;
-   shared-password access session;
-   staff grant/session.

Do not reuse one token across purposes.

## PII

Sensitive product data includes:

-   guest names/addressee;
-   phone numbers;
-   RSVP;
-   attendance;
-   user email;
-   uploaded media.

Rules:

-   minimize collection;
-   mask phone in logs;
-   no raw PII in Sentry context unless strictly required and scrubbed;
-   no guest identity in personalized link preview;
-   no device/browser/location analytics exposed to owner;
-   no personalized data in shared cache.

## Upload Security

-   authorize upload before presigning;
-   temporary namespace;
-   size/type constraints;
-   server/worker verification including magic bytes;
-   reject invalid asset before public finalization;
-   sanitize metadata/file naming;
-   no executable serving;
-   user rights declaration for music/media.

## Payment Security

-   server determines price;
-   verify webhook authenticity;
-   deduplicate provider events;
-   transactional state transition;
-   no client success override;
-   reconciliation shares same domain path;
-   retain only required financial data.

## Abuse and Moderation

-   rate-limit RSVP, guestbook, password, activation and other public
    mutations;
-   provide report-abuse channel;
-   platform can suspend public content;
-   suspension does not immediately destroy evidence/data.

## Audit

Audit security-sensitive actions only, including:

-   owner overrides;
-   attendance corrections;
-   access reset/token regeneration;
-   archive/restore;
-   eligibility changes;
-   account/invitation deletion;
-   privileged ops.

Audit metadata must be minimal and append-oriented.

## Security Release Gate

Before launch, verify:

-   auth enumeration resistance;
-   authorization matrix;
-   session revocation;
-   CSRF;
-   rate limits;
-   webhook verification;
-   token redaction;
-   upload validation;
-   cache isolation;
-   concurrent check-in;
-   payment idempotency;
-   account deletion;
-   backup access controls.

Account deletion must take owned public invitations offline in the same
transaction as the account state transition. Cancellation must not
republish them. Deletion jobs contain stable user identifiers and deadlines
only; passwords, invitation content, financial payloads, and session tokens
must not be copied into job or audit metadata.

Invitation deletion requires owner membership and the exact confirmation
phrase. It takes the public invitation offline in the same transaction as
the `DELETION_PENDING` state change. Purge jobs contain only the invitation
identifier; retained financial records are not refunded or deleted as part
of this flow, and storage object deletion is safe to retry.
