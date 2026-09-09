# Backlog --- Master Index

This folder is the implementation backlog derived from `../ARCHITECTURE.md`,
`../PRODUCT.md`, `../UX.md`, and the approved MVP low-fidelity wireframes WF-01–WF-35.

## How to Use

1.  Follow `../../AGENTS.md` and `../IMPLEMENTATION_WORKFLOW.md`.
2.  Read `../ARCHITECTURE.md` invariants, `../TESTING.md`, and the relevant domain documents.
3.  Pick a ticket whose dependencies are complete and create/use the matching GitHub Issue as the live execution record.
4.  Implement only the ticket scope plus necessary supporting changes.
5.  For user-facing work, implement the linked `UX References` from the approved wireframes.
6.  Add and run tests required by the ticket and `../TESTING.md`.
7.  Use the PR template as the review/completion gate; move the live tracker to Done only after required review/CI/merge.

`Status: Todo` in these seed files is specification metadata, not the day-to-day progress tracker. GitHub Issues/Projects are the intended live status system while ticket IDs remain stable. Do not edit source-of-truth backlog files merely to record Todo/In Progress/Done transitions.

## Priority

-   **P0:** required for launch or correctness/security of a launch
    feature.
-   **P1:** useful but can slip if it does not block a P0 flow.
-   **Post-MVP:** do not implement unless explicitly promoted.

## Epic Order

  ---------------------------------------------------------------------------------------------------------
                         Order File                                     Purpose
  ---------------------------- ---------------------------------------- -----------------------------------
                             0 `00-foundation.md`                       repo, UI primitives, DB, adapters, logging

                             1 `01-auth-account.md`                     authentication/account

                             2 `02-invitation-lifecycle.md`             invitation/commercial/publication
                                                                        lifecycle

                             3 `03-editor-themes.md`                    editor/renderer/themes

                             4 `04-events-guests.md`                    events, guests, capacity/import

                             5 `05-rsvp-personalized-access.md`         access and RSVP

                             6 `06-whatsapp-distribution.md`            manual personalized distribution

                             7 `07-media-guestbook-angpao.md`           uploads/media/wishes/gifts

                             8 `08-billing-payments.md`                 QRIS/payment activation

                             9 `09-checkin.md`                          QR/staff/attendance

                            10 `10-notifications-exports-deletion.md`   jobs, lifecycle, email,
                                                                        export/purge

                            11 `11-ops-security-observability.md`       production operations

                            12 `12-launch-hardening.md`                 landing/support/release gates
  ---------------------------------------------------------------------------------------------------------

This is a dependency order, not a strict waterfall. Once foundations
exist, multiple epics can proceed in parallel.

## Suggested Milestones

### M0 --- Skeleton

Foundation + UI primitives + auth + database + CI.

### M1 --- Invitation Alpha

Create/edit/theme/preview/publish/events.

### M2 --- Guest & RSVP Beta

Guests/import/personalized access/RSVP/WhatsApp.

### M3 --- Monetization

Trial expiry + DUITKU + paid activation + lifecycle.

### M4 --- Wedding-Day Operations

QR/staff/check-in + slow-network UX.

### M5 --- Complete Content

Media/music/gallery/e-angpao/guestbook/export.

### M6 --- Production Ready

Jobs/reminders/purge/backups/restore/security/load
tests/support/landing.

## Global Definition of Done

A ticket is not done unless:

-   acceptance criteria are met;
-   authorization/lifecycle rules are enforced server-side;
-   inputs are validated;
-   relevant transactions/idempotency are correct;
-   PII/tokens are not leaked to logs/analytics;
-   tests appropriate to risk are added;
-   cache invalidation is correct;
-   migrations are backward-compatible where required;
-   user-facing UI matches the ticket's approved wireframe references where applicable;
-   responsive behavior is implemented for the surfaces defined in `../UX.md`;
-   loading, empty, validation, success and error states relevant to the flow are handled;
-   accessibility-critical behavior (semantics, labels, keyboard/focus, contrast) is covered;
-   feature-level UI and server/domain behavior are integrated end-to-end rather than marked done independently;
-   documentation is updated when behavior changes an invariant or approved UX contract.

## Wireframe Traceability

`WIREFRAME_TRACEABILITY.md` maps every approved MVP wireframe (WF-01–WF-35) to its owning implementation ticket(s). The mapping is intentionally domain-owned: there is no duplicate frontend-only feature backlog. Shared UI primitives are owned by `FOUND-008`.

For a user-facing ticket, its linked wireframe is part of acceptance. If implementation requires a material UX departure, update the wireframe/source documentation in the same change rather than silently drifting.

## Scope Rule

Do not opportunistically add:

-   Redis;
-   microservices;
-   custom domains;
-   WhatsApp API;
-   offline sync;
-   renewal;
-   collaborators;
-   seating;
-   form builder;
-   reseller system;
-   add-ons;
-   advanced analytics.

Promote post-MVP scope only through an explicit product/architecture
decision.


## Coding-Agent Workflow

For implementation, use `../../AGENTS.md` as the permanent agent contract and `../IMPLEMENTATION_WORKFLOW.md` as the lifecycle SOP. The normal unit of work is one backlog ticket → one GitHub Issue → one PR. The issue/project tracks live status; the PR records implementation and verification; source-of-truth docs change only when the approved contract changes.
