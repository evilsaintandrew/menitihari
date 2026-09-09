# Wireframe → Backlog Traceability

**Status:** Reconciled implementation baseline  
**Date:** 9 September 2026

This file reconciles the approved low-fidelity wireframes with the implementation backlog. Wireframes define interaction/layout/state expectations; domain tickets own implementation. `FOUND-008` owns only shared design-system primitives.

A feature is not complete when only its API, database, or visual shell exists. For user-facing tickets, completion means the linked UX, server-authoritative rules, persistence, error/state handling, responsive behavior, accessibility baseline, and risk-appropriate tests work together end-to-end.

| WF | Surface | Primary owner | Supporting tickets |
|---|---|---|---|
| WF-01 | Landing | LAUNCH-001 | FOUND-008 |
| WF-02 | Sign Up | AUTH-001 | FOUND-008 |
| WF-03 | Verify Email | AUTH-002 | FOUND-008 |
| WF-04 | Create Invitation | INV-001 | FOUND-008 |
| WF-05 | Theme Picker | EDIT-002 | FOUND-008 |
| WF-06 | Invitation Editor | EDIT-004 | EDIT-005, EDIT-001, FOUND-008 |
| WF-07 | Preview | EDIT-003 | RSA-008, FOUND-008 |
| WF-08 | Publish Readiness | INV-003 | FOUND-008 |
| WF-09 | Invitation Overview | INV-008 | LAUNCH-005, FOUND-008 |
| WF-10 | Guests | EVG-003 | EVG-008, FOUND-008 |
| WF-11 | Add Guest | EVG-003 | EVG-004, EVG-005, FOUND-008 |
| WF-12 | Distribution Action | WA-003 | WA-005, WA-006, FOUND-008 |
| WF-13 | Personalized Invitation | RSA-003 | FOUND-008 |
| WF-14 | RSVP Interaction | RSA-004 | EVG-004, FOUND-008 |
| WF-15 | RSVP Confirmation / QR Eligibility | RSA-007 | CHK-002, CHK-001, FOUND-008 |
| WF-16 | Trial Status / Banner | INV-005 | INV-008, FOUND-008 |
| WF-17 | Trial Expired | INV-005 | FOUND-008 |
| WF-18 | Checkout | BILL-002 | BILL-001, FOUND-008 |
| WF-19 | QRIS Pending | BILL-002 | BILL-005, BILL-006, FOUND-008 |
| WF-20 | Payment Success | BILL-007 | BILL-004, FOUND-008 |
| WF-21 | Receipt / Bukti Pembayaran | BILL-007 | LIFE-006, FOUND-008 |
| WF-22 | Staff Access | CHK-003 | FOUND-008 |
| WF-23 | Scanner | CHK-008 | CHK-003, FOUND-008 |
| WF-24 | Check-in Confirmation | CHK-004 | CHK-008, FOUND-008 |
| WF-25 | Repeat Scan | CHK-004 | CHK-008, FOUND-008 |
| WF-26 | Wrong Event | CHK-005 | CHK-008, FOUND-008 |
| WF-27 | Manual Search | CHK-006 | CHK-008, FOUND-008 |
| WF-28 | Attendance Correction | CHK-007 | FOUND-007, FOUND-008 |
| WF-29 | Guest Import | EVG-007 | EVG-006, FOUND-008 |
| WF-30 | Guestbook Moderation | MED-007 | FOUND-008 |
| WF-31 | Media / Gallery / Music | MED-004 | MED-001, MED-002, MED-003, MED-005, FOUND-008 |
| WF-32 | E-Angpao | MED-006 | FOUND-008 |
| WF-33 | Sharing & Privacy | RSA-001 | WA-006, EDIT-007, FOUND-008 |
| WF-34 | Export | LIFE-009 | FOUND-008 |
| WF-35 | Grace / Invitation Deletion / Account Deletion | INV-006 | INV-007, AUTH-006, LIFE-009, LIFE-010, FOUND-008 |

## Reconciliation Decisions

1. **No parallel UI feature backlog.** Visual/interaction work belongs to the domain ticket that owns the behavior.
2. **One new foundation ticket:** `FOUND-008` establishes reusable UI primitives and contracts required across all batches.
3. **Wireframes are acceptance references.** Material divergence requires a documentation update in the same change.
4. **Server remains authoritative.** UI components may render lifecycle/payment/RSVP/check-in state but do not invent or grant it client-side.
5. **Batch order is not a waterfall.** Foundation and Batch 1 vertical-slice work can proceed while later domain tickets are refined, as long as dependencies/invariants are respected.
6. **High-fidelity polish is not a prerequisite for implementation.** Approved low-fi plus `FOUND-008` is sufficient to begin; visual refinement can happen on implemented surfaces without changing domain semantics.

## Recommended Engineering Entry Sequence

1. `FOUND-001` + `FOUND-008` — repository and UI primitive baseline.
2. `FOUND-002`–`FOUND-007` as required by the first vertical slice.
3. Batch 1 vertical slice in dependency order: auth → invitation → editor/render → publish → guests → personalized access/RSVP → distribution/QR.
4. Batch 2 monetization.
5. Batch 3 event operations.
6. Batch 4 secondary operations.
7. Launch hardening and production-readiness gates.
