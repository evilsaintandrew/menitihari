# UX.md --- MVP UX Blueprint

**Status:** Ready for low-fidelity wireframing\
**Date:** 9 September 2026\
**Source of truth:** `PRODUCT.md`, `ARCHITECTURE.md`,
`STATE_MACHINES.md`, `SECURITY.md`, and `backlog/`

## 1. UX Objective

The product must feel simple enough for a mass-market Indonesian couple
to create and operate a wedding invitation without technical knowledge,
while keeping event-day operations reliable.

Primary UX principles:

1.  **Progressive disclosure.** Show only what is needed for the current
    task.
2.  **Mobile-first.** Owner workflows must remain usable on phones;
    guest and staff experiences are explicitly mobile-first.
3.  **One obvious primary action per screen.**
4.  **Never hide lifecycle/commercial consequences.** Trial remaining,
    active-until date, payment state, RSVP closure, and destructive
    actions must be explicit.
5.  **Operational correctness beats visual cleverness.** Especially
    payment, RSVP, guest capacity, and check-in.
6.  **No fake certainty.** `WHATSAPP_OPENED` is not delivered/read;
    `Viewed` is not proof a guest read the invitation; pending payment
    is not paid.
7.  **Guest privacy by default.** Personalized identity must not leak
    into generic pages, shared metadata, or unrelated guest sessions.
8.  **Avoid configuration walls.** Use sensible defaults and allow
    optional refinement later.

## 2. Actors

### Visitor

Goal: understand the product, price, themes, and try it.

### Owner / Couple

Goal: create, publish, distribute, operate, pay for, and export an
invitation.

### Personalized Guest

Goal: open the invitation, see only relevant events, RSVP, write a wish,
and access QR when eligible.

### Generic Visitor

Goal: view generic invitation content and optionally submit public
RSVP/guestbook when enabled.

### Event Staff

Goal: check guests in quickly with minimal data and minimal training.

### Support / Operator

Goal: perform exceptional operational actions through CLI/scripts, not a
customer-facing admin console.

## 3. Product Surfaces

The UX is intentionally split into three primary products:

``` text
OWNER APP
Dashboard
Invitation setup/editor
Guests & distribution
RSVP / guestbook operations
Billing
Settings/export

GUEST EXPERIENCE
Generic invitation
Personalized invitation
RSVP
Guestbook
QR
Unavailable/cancelled states

EVENT STAFF
Access
Scanner
Guest search
Check-in result
Attendance correction
Summary
```

Do not visually or navigationally force these three surfaces into one
application shell.

## 4. Owner Information Architecture

Recommended desktop navigation:

``` text
Invitations
  └─ [Invitation]
      ├─ Overview
      ├─ Edit Invitation
      ├─ Guests
      ├─ RSVP
      ├─ Guestbook
      ├─ Check-in
      └─ Settings
```

Billing/activation appears contextually in invitation header/overview
rather than as a large global billing product.

Recommended mobile owner navigation:

-   invitation list at account level;
-   invitation workspace uses compact top bar + overflow/menu/drawer;
-   editor may use bottom action bar for Preview / Save status /
    Publish;
-   avoid seven permanent bottom tabs.

## 5. Global Owner Header

When inside an invitation, always make these discoverable:

-   invitation/couple identity;
-   commercial status: Trial / Paid / Trial Expired / Grace;
-   trial remaining or active-until date;
-   publication status;
-   Preview;
-   contextual activation CTA when not paid.

Activation CTA should be available throughout trial but unobtrusive
until expiry approaches.

## 6. Critical User Flow A --- Acquisition and First Publish

``` text
Landing
→ Theme Gallery / Demo (optional)
→ Sign Up
→ Verify Email
→ Create First Invitation
→ Couple Display Names + Main Event Date
→ Choose Theme
→ Editor
→ Preview
→ Publish
→ Published Success
```

### Landing

Primary CTA: **Buat Undangan Gratis** / **Coba Gratis 3 Hari**.

Must communicate above/before major conversion:

-   wedding invitation product;
-   3-day free trial;
-   Harga Launch Rp79.000 per invitation;
-   active 1 year after successful payment;
-   personalized guest/WhatsApp workflow;
-   RSVP;
-   QR check-in;
-   10 themes.

Secondary actions:

-   Lihat Demo
-   Lihat Tema

Do not imply lifetime access, automatic WhatsApp delivery, or active
e-angpao payment processing.

### Sign Up

Keep minimal:

-   email;
-   password;
-   submit.

After signup, verification screen explains the next action. Do not
reveal whether arbitrary email addresses already exist through error
wording.

### Create First Invitation

Step 1 asks only:

-   Couple display name 1
-   Couple display name 2
-   Main event date

Creating the invitation starts the trial. This consequence should be
visible before the final create action, without using a scary modal.

### Theme Selection

Show all 10 themes.

Each card should support:

-   visual thumbnail;
-   theme name;
-   Preview;
-   Select.

No premium labels because all themes are included.

### First Editor

The user should immediately see a usable invitation with defaults, not
an empty configuration form.

Recommended editor grouping:

``` text
Quick Setup
Couple
Events
Opening & Closing
Love Story
Gallery
Music
E-Angpao
RSVP
Guestbook
Appearance
Sharing & Privacy
```

Do not expose every optional setting at once. Collapsible sections or
focused editing panels are preferred.

### Publish

Publish button remains visible but disabled/explained only when core
requirements are invalid.

Before first publish, use a lightweight readiness panel rather than a
long wizard:

-   couple names ✓
-   primary event/date ✓
-   theme ✓
-   public access/privacy summary
-   Preview
-   Publish

Optional sections never block publishing.

## 7. Critical User Flow B --- Guest Distribution and RSVP

``` text
Owner opens Guests
→ Add Guest / Import
→ Assign Event(s)
→ Set Party Size
→ Copy Link or Open WhatsApp
→ Guest opens personalized link
→ Access session activates
→ Invitation
→ RSVP
→ Confirmation
→ QR appears when eligible
```

### Guests Screen

Desktop may use a table. Mobile should use compact cards/list rows.

Primary actions:

-   Tambah Tamu
-   Import
-   bulk actions after selection

Core row information:

-   addressee;
-   group;
-   invited capacity;
-   assigned event summary;
-   RSVP summary;
-   distribution status;
-   viewed status.

Do not show raw technical token/credential information.

After selection, show a compact action bar that preserves the card/list
layout and offers group, event assignment/unassignment, and manual
distribution-status actions. Removing an event assignment that has RSVP or
check-in history requires an explicit warning confirmation; the history is
retained. `Ditandai Terkirim`, `WhatsApp Dibuka`, and `Dilihat` remain distinct
owner-facing states.

Persistent capacity indicator:

**438 / 500 orang diundang**

Near capacity, show warning before mutations fail.

Guest name and phone values are normalized for duplicate detection. A
possible duplicate is a warning only: saving never silently merges rows.
The owner must review and explicitly choose how conflicting RSVP/check-in
histories are handled before using the manual merge workflow.

### Add Guest

Keep initial form short:

-   Addressee / Nama Tamu
-   Phone (optional for owner-created guest)
-   Group (optional)
-   Events
-   Maximum people per selected event

Advanced details should not block save.

### Import

Flow:

``` text
Upload CSV/XLSX
→ Processing
→ Validation Preview
→ Fix/Exclude Invalid Rows
→ Capacity Summary
→ Confirm Import
→ Background Commit
→ Result
```

Never partially surprise-import invalid rows before confirmation.

### Distribution

Per guest actions:

-   Open WhatsApp
-   Copy Link
-   Mark Sent

Show clear semantics:

-   Belum Dikirim
-   Ditandai Terkirim
-   WhatsApp Dibuka
-   Belum Dilihat / Dilihat

Never label WhatsApp action as delivered/read.

Trial users see:

**X / 30 kontak WhatsApp digunakan**

Explain that repeated messages to the same contact do not consume
another unique contact slot.

## 8. Personalized Guest Experience

Personalized invitation should feel like an invitation, not an
account/dashboard.

On first valid personalized open:

-   activation happens silently when possible;
-   shared password is requested if enabled;
-   only assigned events appear.

Primary invitation sections follow theme presentation, but operational
actions should remain obvious:

-   RSVP
-   Open Maps
-   Add to Calendar
-   Guestbook
-   QR when eligible

Do not expose:

-   guest phone;
-   other guests;
-   owner statistics;
-   hidden events;
-   "special guest" labels.

### RSVP Interaction

Prefer inline sheet/card/modal over navigating through a complex form.

Per event:

-   event identity/date;
-   Hadir / Tidak Hadir;
-   number attending when Hadir;
-   optional message/reason when Tidak Hadir.

After submit:

``` text
RSVP berhasil diperbarui

Resepsi
Hadir · 3 orang

[Ubah RSVP]
```

If QR is eligible, surface it after confirmation and in an easy-to-find
invitation action.

### RSVP Closed

Do not simply disable controls.

Show:

-   current saved response;
-   "RSVP sudah ditutup";
-   no misleading submit CTA.

### QR

QR view contains:

-   addressee/name;
-   event context where useful;
-   QR;
-   status.

After check-in:

**Sudah Check-in · 18:42**

## 9. Generic Public Invitation

Generic visitor can see only generic-visible content.

If generic RSVP enabled, CTA is visible but subordinate to invitation
content.

Public RSVP flow:

``` text
RSVP
→ Name
→ Phone if owner requires
→ Party count
→ Eligible event(s)
→ Submit
→ Personalized link created
→ Confirmation + Open Personalized Invitation
```

Include short privacy notice around data collection.

When capacity reaches 500 or RSVP closes, explain that RSVP is closed
rather than failing after form completion.

## 10. Critical User Flow C --- Payment

``` text
Trial
→ Activate Invitation
→ Checkout Summary
→ Create QRIS
→ Pending
→ Provider Confirms
→ Success
```

### Activation Entry Points

Available from:

-   invitation header/status;
-   overview;
-   near-expiry banner;
-   trial-expired lock screen.

CTA: **Aktifkan Undangan Ini**

### Checkout

Show:

-   invitation/couple identity;
-   **Harga Launch Rp79.000**;
-   "Aktif 1 tahun sejak pembayaran berhasil";
-   benefits: branding removed, WhatsApp 30-contact cap removed, public
    invitation remains active for paid period;
-   Terms / Privacy / refund policy links.

No fake discount anchor.

### QRIS Pending

Pending screen must be resumable and honest.

Show:

-   amount;
-   payment reference where useful;
-   expiry;
-   QR/payment instructions;
-   status: Menunggu Pembayaran;
-   refresh/recheck behavior.

Do not display success because browser returned from provider.

### Payment Success

Show:

-   payment successful;
-   invitation activated;
-   exact active-until date;
-   receipt;
-   CTA back to invitation.

If payment attempt expires, offer **Buat Pembayaran Baru** using the
same locked price.

## 11. Critical User Flow D --- Event-Day Check-in

``` text
Staff Access
→ Select/Confirm Event
→ Scanner
→ Scan QR
→ Guest Result
→ Select Actual Attendance Count
→ Check In
→ Success
```

### Staff Entry

A staff grant should open directly into operational context.

Show:

-   staff label;
-   event;
-   check-in window;
-   simple attendance count.

Do not show owner dashboard navigation.

### Scanner

Scanner screen prioritizes:

1.  camera area;
2.  scan status;
3.  manual search fallback;
4.  simple event summary.

Large touch targets. High contrast. Minimal text.

### Successful Scan

Show guest/addressee and allowed max before final check-in if attendance
count selection is needed.

Success state should be unmistakable:

**Check-in berhasil**

`Bapak Andi & Keluarga · 3 orang`

Then return quickly to scanner.

### Repeat Scan

Show:

**Sudah Check-in**

with original check-in time and current count. Do not create a second
attendance event.

### Wrong Event

Show:

**Tamu tidak terdaftar untuk acara ini**

Then provide authorized override only to roles/grants allowed to do so.
Never silently switch event.

### Manual Search

Server-side search scoped to current event.

Result shows minimum fields:

-   addressee;
-   group where operationally useful;
-   RSVP;
-   checked-in status.

### Correction

Correction is deliberately more frictionful than normal scan:

-   current state;
-   corrected count/state;
-   reason;
-   confirm.

## 12. Invitation Overview

The owner overview should answer "what needs my attention?" rather than
duplicate the editor.

Recommended hierarchy:

### Status

-   publication state;
-   trial/paid state;
-   expiry;
-   activation CTA.

### Setup Progress

Only unfinished meaningful items.

### Operational Summary

-   invited capacity;
-   RSVP;
-   attendance;
-   distribution/view;
-   guestbook activity.

### Quick Actions

-   Preview
-   Edit
-   Add Guest
-   Open WhatsApp distribution
-   Check-in
-   Export

## 13. Editor UX Rules

-   Autosave is the default.
-   Save status is always understandable: `Menyimpan…`, `Tersimpan`,
    `Gagal menyimpan`.
-   Never discard local edits after a failed autosave.
-   Stale-write conflict explains that data changed elsewhere and
    provides safe recovery/reload.
-   Preview is one tap away.
-   Theme switch previews before/while applying but does not reset
    content.
-   Optional sections have sensible off/on defaults.
-   Destructive section/media deletion asks confirmation only when
    consequence is meaningful.
-   On mobile, avoid a permanent side-by-side preview/editor layout; use
    edit → preview transitions.

## 14. Privacy & Sharing UX

Provide one understandable **Sharing & Privacy** area.

It should summarize current access in plain Indonesian, e.g.:

``` text
Akses umum: Aktif
Link personal: Aktif
Password: Tidak digunakan
Tamu dapat membagikan link: Tidak
```

Controls:

-   Generic public access on/off
-   Shared password on/off/change
-   Allow Guest Sharing
-   Event visibility
-   Location/contact visibility where supported

Changing password should say old password cannot be viewed and existing
password sessions will be invalidated.

## 15. Trial-Expired UX

When trial expires while owner is in editor:

-   preserve current data;
-   switch to read-only;
-   show non-alarming lock state;
-   explain public invitation is offline;
-   primary CTA: **Aktifkan Undangan Ini**;
-   secondary: Preview / Export.

Do not repeatedly show blocking payment modals.

## 16. Paid Expiry / Grace UX

At paid expiry:

-   public page uses neutral unavailable message;
-   dashboard explains 30-day grace and exact deletion/export deadline;
-   editing/publishing controls are disabled;
-   prominent actions: Export Data, Download Media;
-   no renewal CTA.

As deletion approaches, increase prominence of the deadline without
using deceptive urgency.

## 17. Cancellation UX

### Event cancellation

Relevant guests see event as cancelled with optional owner message.

### Entire wedding cancellation

Owner chooses:

-   take invitation offline; or
-   keep public cancellation notice.

This is separate from deleting the invitation.

## 18. Empty States

Every operational screen needs a useful empty state.

Examples:

### No guests

"Belum ada tamu." Actions: Tambah Tamu / Import Daftar Tamu.

### No RSVP

Explain RSVP activity appears after distribution; do not show
meaningless zero-heavy analytics.

### No guestbook entries

Show moderation/status explanation and link to guestbook settings.

### No check-ins

Before event: explain check-in starts in configured window. During
event: show scanner CTA.

### No media

Show recommended photo/audio constraints before upload.

## 19. Loading, Error, and Offline-ish States

### Loading

Use skeletons for page-level reads; disable duplicate mutation actions
while submitting.

### Recoverable errors

Keep user input. Explain next action.

### Slow venue connection

Scanner/check-in should:

-   show pending state;
-   prevent repeated accidental submit;
-   safely retry idempotent request;
-   provide manual search fallback.

Do not claim offline mode.

### Payment/network uncertainty

Show pending/unknown and recheck server/provider state. Never infer
payment success locally.

## 20. Accessibility Baseline

-   keyboard-accessible owner desktop UI;
-   semantic headings/labels;
-   visible focus;
-   sufficient contrast;
-   form errors tied to fields;
-   do not encode status only by color;
-   touch targets suitable for mobile/event staff;
-   reduced-motion friendly invitation controls where feasible;
-   QR screen still provides textual identity/status.

## 21. Responsive Priorities

### Guest invitation

Design mobile-first; desktop is expanded presentation.

### Staff check-in

Phone-first, one-handed operational use.

### Owner app

Must work on mobile, but complex guest management/import may
progressively enhance on desktop.

Avoid desktop-only critical operations.

## 22. Screen Inventory

### Public / Acquisition

-   Landing
-   Theme Gallery
-   Theme Preview
-   Demo Invitation
-   Sign Up
-   Login
-   Verify Email
-   Forgot/Reset Password
-   Terms
-   Privacy
-   Refund Policy
-   Help/FAQ
-   Abuse Report

### Account

-   Invitation List
-   Create Invitation
-   Account Settings
-   Security/Sessions
-   Delete Account

### Invitation Owner

-   Invitation Overview
-   Editor
-   Theme Picker
-   Preview
-   Publish Readiness
-   Guests
-   Add/Edit Guest
-   Import Upload
-   Import Validation
-   Import Result
-   Guest Detail
-   Distribution
-   RSVP Dashboard
-   Guestbook Dashboard
-   Check-in Setup
-   Staff Grants
-   Sharing & Privacy
-   Billing/Activation
-   Payment Pending
-   Payment Success
-   Receipt
-   Export
-   Invitation Delete
-   Trial Expired
-   Grace/Deletion Warning

### Guest

-   Generic Invitation
-   Shared Password Gate
-   Personalized Invitation
-   RSVP
-   RSVP Confirmation
-   Public RSVP
-   Public RSVP Confirmation/Personalized Link
-   Guestbook Submit/Edit
-   QR
-   Already Checked In
-   Invitation Unavailable
-   Wedding/Event Cancelled

### Staff

-   Staff Access
-   Event Scanner
-   Scan Result
-   Wrong Event
-   Manual Search
-   Manual Check-in
-   Attendance Correction
-   Simple Event Summary
-   Grant Expired/Revoked

## 23. Wireframe Priority

Do **not** wireframe every screen before development.

### Wireframe Batch 1 --- Critical Vertical Slice

Must be designed first:

1.  Landing
2.  Sign Up
3.  Verify Email
4.  Create Invitation
5.  Theme Picker
6.  Invitation Editor
7.  Preview
8.  Publish Readiness
9.  Invitation Overview
10. Guests
11. Add Guest
12. Distribution action
13. Personalized Invitation
14. RSVP interaction
15. RSVP Confirmation / QR eligibility

This batch proves acquisition → creation → publication → guest response.

### Wireframe Batch 2 --- Monetization

16. Trial status/banner
17. Trial Expired
18. Checkout
19. QRIS Pending
20. Payment Success
21. Receipt

### Wireframe Batch 3 --- Event Operations

22. Staff access
23. Scanner
24. Check-in confirmation
25. Repeat scan
26. Wrong event
27. Manual search
28. Correction

### Wireframe Batch 4 --- Secondary Product Operations

29. Import
30. Guestbook moderation
31. Media/gallery/music
32. E-angpao
33. Sharing & Privacy
34. Export
35. Grace/deletion/account deletion

## 24. Design-System Scope

Before high-fidelity design, define only the platform primitives needed
for Batch 1--3:

-   typography;
-   neutral/brand/semantic colors;
-   spacing;
-   buttons;
-   inputs/selects;
-   cards;
-   dialogs/drawers;
-   tabs;
-   list/table;
-   status badge;
-   banners/alerts;
-   toast;
-   empty state;
-   skeleton;
-   progress;
-   mobile navigation patterns.

Invitation themes use a separate theme-level visual system and should
not dictate owner-dashboard components.

## 25. UX-to-Backlog Mapping

  ----------------------------------------------------------------------------
  UX Area                             Primary Backlog
  ----------------------------------- ----------------------------------------
  Acquisition/onboarding              `backlog/12-launch-hardening.md`,
                                      `backlog/01-auth-account.md`,
                                      `backlog/02-invitation-lifecycle.md`

  Editor/themes                       `backlog/03-editor-themes.md`

  Events/guests/import                `backlog/04-events-guests.md`

  Personalized access/RSVP            `backlog/05-rsvp-personalized-access.md`

  WhatsApp distribution               `backlog/06-whatsapp-distribution.md`

  Gallery/music/e-angpao/guestbook    `backlog/07-media-guestbook-angpao.md`

  Checkout/payment                    `backlog/08-billing-payments.md`

  Event-day check-in                  `backlog/09-checkin.md`

  Lifecycle/export/deletion           `backlog/10-notifications-exports-deletion.md`

  Production/security                 `backlog/11-ops-security-observability.md`
  ----------------------------------------------------------------------------

## 26. Wireframe Review Checklist

Before approving a flow, answer:

-   Can a first-time user identify the next action in under a few
    seconds?
-   Is the commercial/lifecycle state understandable?
-   Is anything technically true but misleading to a non-technical user?
-   Is a destructive action reversible or clearly explained?
-   Does mobile remain usable?
-   Are optional settings hidden until relevant?
-   Are privacy consequences understandable?
-   Are loading/error/empty states represented?
-   Does the screen require information the product does not actually
    have?
-   Can the same flow be implemented without violating
    architecture/backlog rules?

## 27. Next Deliverable

The next artifact after this document is **low-fidelity Wireframe Batch
1**.

Do not start with polished wedding imagery or final brand colors.
Validate hierarchy, navigation, form complexity, CTA placement, and
mobile behavior first. Once Batch 1 is accepted, foundation development
can begin while Batches 2--4 are designed in parallel.
