# WIREFRAMES_INDEX.md — MVP Low-Fidelity Wireframe Set

**Status:** Complete for MVP implementation baseline  
**Date:** 9 September 2026

This index joins the four wireframe batches defined by `UX.md`. `UX.md` remains the UX source of truth for product intent; the batch files make those decisions implementation-specific. If a batch-level decision conflicts with an older ambiguous UX statement, the newer explicit wireframe decision should be reviewed against `PRODUCT.md`/architecture invariants before implementation.

## Batch 1 — Critical Vertical Slice

`WIREFRAMES_BATCH_1.md`

WF-01–WF-15: acquisition, signup/verification, invitation creation, theme/editor/preview, publish readiness, overview, guests, distribution, personalized invitation, RSVP, QR eligibility.

## Batch 2 — Monetization

`WIREFRAMES_BATCH_2.md`

WF-16–WF-21: trial status, trial-expired lock, checkout, QRIS pending/recovery, payment success, receipt.

## Batch 3 — Event Operations

`WIREFRAMES_BATCH_3.md`

WF-22–WF-28: staff access, scanner, check-in confirmation, repeat scan, wrong event, manual search, audited correction.

## Batch 4 — Secondary Product Operations

`WIREFRAMES_BATCH_4.md`

WF-29–WF-35: import, guestbook moderation, media/gallery/music, e-angpao, sharing/privacy, export, grace/invitation deletion/account deletion.

## Cross-Batch Non-Negotiables

1. Server state is authoritative for lifecycle, payment, RSVP capacity, staff access/window, and check-in.
2. Generic public, personalized guest, owner, and staff surfaces have separate privacy boundaries.
3. No UI labels WhatsApp-open as delivered/read.
4. Payment pending never implies paid; client return never grants entitlement.
5. Trial-expired and grace are read-only/offline lifecycle states with export behavior defined by product policy.
6. Event-day check-in writes are atomic/idempotent; repeat/concurrent scans do not duplicate attendance.
7. Destructive deletion and corrections preserve required audit/retention semantics.
8. Mobile is a critical platform for guest and staff experiences; owner critical operations are never desktop-only.

## Recommended Next Design/Engineering Gate

With Batch 1–4 complete, stop expanding low-fidelity scope. The next artifacts should be:

1. execute `FOUND-008` for the shared UI/design-system primitive baseline;
2. follow `backlog/WIREFRAME_TRACEABILITY.md` for screen-to-ticket ownership;
3. implement Foundation/Sprint 0 and the Batch 1 vertical slice end-to-end;
4. apply high-fidelity visual polish only to surfaces being implemented, without creating a parallel feature backlog;
5. field-test the event-day scanner before launch hardening.
