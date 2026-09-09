# PRODUCT.md --- MVP Product Source of Truth

**Product:** Digital wedding invitation platform for Indonesia\
**Positioning:** simple, affordable, complete mass-market wedding
invitation\
**Launch offer:** Rp79,000 per invitation

## 1. Product Promise

Users can create, personalize, publish, distribute, and operate a
wedding invitation without needing a wedding organizer or technical
knowledge. Core differentiation for MVP is a strong all-in-one package
at a simple price, including personalized WhatsApp sending workflow and
QR check-in.

The MVP is wedding-only. It is not a general event invitation builder.

## 2. Commercial Model

-   One product, one paid tier.
-   **Harga Launch Rp79.000** per invitation.
-   Do not present a fake crossed-out normal price.
-   Launch price has no fixed public end date.
-   Price is locked when an invitation is created.
-   User pays the locked amount; platform absorbs gateway fee.
-   One-time payment activates that invitation for 1 year.
-   Do not market as lifetime.
-   No add-ons, vouchers, reseller packages, or \>500 custom
    arrangements in MVP.
-   No renewal/reactivation in MVP.

## 3. Trial

-   Every newly created invitation receives its own 3-day trial.
-   Trial begins at creation, not first publish.
-   Same account may own multiple invitations; each has its own trial.
-   Trial editor and preview are full-featured.
-   All 10 themes are available during trial.
-   QR check-in is available during trial.
-   Trial public invitation carries platform branding.
-   Main distribution restriction: manual WhatsApp flow is capped at 30
    unique contacts.
-   Trial expiry is always visible in dashboard and becomes more
    prominent near expiry.
-   Trial uses in-app countdown and a near-expiry email; no daily spam.
-   Paying early immediately starts the 1-year paid period; unused trial
    is not appended.

At trial expiry:

-   public invitation goes offline;
-   editor becomes read-only/locked;
-   saved data remains safe;
-   owner can preview privately, pay, and export.

## 4. Paid Activation

-   User can pay at any point while eligible, including while invitation
    is still draft.
-   Checkout is invitation-scoped: "Aktifkan Undangan Ini".
-   Checkout summarizes invitation, locked price, 1-year duration from
    successful payment, and core benefits.
-   Terms/Privacy/refund notice is visible without unnecessary checkbox
    friction unless legally required.
-   QRIS pending is shown as waiting, never as paid.
-   Expired QRIS attempt can be regenerated for the same eligible
    invitation.
-   Successful activation clearly shows active-until date and removes
    trial branding/30-contact cap.
-   Each invitation uses its own checkout; no cart/bulk checkout.
-   User receives a simple payment receipt.

## 5. Paid Expiry and Grace

Paid period is exactly 1 year from successful payment.

At expiry:

-   public invitation immediately goes offline;
-   public URL shows neutral "Undangan ini sudah tidak tersedia";
-   no renewal flow is offered.

For the following 30 days:

-   dashboard is read-only;
-   private preview remains available;
-   export/download remains available;
-   uploaded media can be downloaded;
-   editing and publication are unavailable.

After grace, deletion/purge proceeds according to architecture.

## 6. Refund Policy

-   No general money-back guarantee; trial is the primary try-before-buy
    mechanism.
-   Voluntary deletion after payment does not automatically refund.
-   Customer reschedule/cancellation does not automatically refund or
    extend.
-   Duplicate payment is refundable after verification.
-   Serious platform-caused outage may receive case-by-case
    refund/compensation.
-   Exceptional cases are handled by support/manual review.
-   No self-service refund flow MVP.

## 7. Account and Onboarding

-   Signup/login is required before creating an invitation.
-   Email verification is required.
-   Post-verification CTA: Create First Invitation.
-   Initial creation asks couple display names + main event date.
-   Theme selection follows basic info, then editor.
-   Onboarding checklist/progress is helpful but non-blocking.
-   One account per email.
-   User may change email after verifying the new address.
-   Account recovery may be assisted by support after adequate
    verification; payment screenshot alone is insufficient.
-   No ownership transfer, even as normal support operation.
-   No collaborator/co-owner MVP.

Landing:

-   primary CTA: "Buat Undangan Gratis" / "Coba Gratis 3 Hari";
-   secondary CTA: public demo;
-   public gallery shows all 10 themes before signup;
-   explain one-time payment per invitation and 1-year active period.

## 8. Invitation Creation and Publishing

-   New invitation is draft.
-   Publish is explicit.
-   Minimum valid core information is required to publish; optional
    sections are never blockers.
-   Published invitation can be edited live while editable.
-   Owner can unpublish/republish.
-   Suggested slug comes from couple names and is editable.
-   Custom slug is available in trial and paid.
-   Slugs are first-come-first-served.
-   Invitation remains online after wedding while still within active
    period unless owner unpublishes/deletes.
-   Owner can mark whole wedding cancelled and optionally keep a
    cancellation notice page.
-   Event date may be changed after payment; paid expiry does not move.

## 9. Couple and Content

Required:

-   couple display names.

Optional:

-   full names;
-   parent information;
-   social links for common platforms;
-   editable opening/closing copy;
-   owner-entered quote/verse/prayer;
-   wedding hashtag;
-   Love Story timeline, max 5 milestones.

MVP invitation language/default labels: Indonesian or English, one
selected language per invitation. No dual-language invitation.

## 10. Events

-   Maximum 5 events.
-   Owner selects primary event for countdown.
-   Event may include venue name, address, maps/directions link, short
    location note, livestream/external link, dress code, and optional
    contact person.
-   "Open Maps/Directions" is available when configured.
-   "Add to Calendar" is available for visible events.
-   Each event can be generic-visible or personalized-only.
-   Location/contact/livestream can be further restricted by event
    visibility rules.
-   Personalized guest sees only relevant assigned events.
-   New event does not automatically assign existing guests.
-   Event with history is cancelled/archived rather than destructively
    removed.
-   Event cancellation can include a short message for relevant guests.

## 11. Themes and Editor

-   10 launch themes.
-   Paid unlocks all themes; there are no premium-theme add-ons.
-   Trial can use all themes.
-   Paid invitation has no visible platform branding.
-   Theme controls include supported accent/color options, curated font
    pairings, cover options, optional section toggles, and supported
    section reordering.
-   No arbitrary "design anything" builder.
-   Owner can choose custom cover photo.
-   Editor autosaves and communicates save state.

## 12. Gallery and Music

Gallery:

-   optional;
-   max 20 photos;
-   large/lightbox view;
-   owner can add/change/delete while editable;
-   no guest photo upload;
-   no dedicated guest photo-download button.

Music:

-   one active song;
-   owner can upload with rights/permission declaration;
-   small curated royalty-free library;
-   try autoplay; if browser blocks it, show clear play control.

## 13. E-Angpao

-   Opt-in.
-   Platform is not the gift payment processor.
-   Maximum 3 gift methods/accounts.
-   Support bank account plus uploaded QRIS/e-wallet QR image.
-   Bank method requires bank name/account number/account owner name.
-   No tracking of who gifted or amount.

## 14. Guest Model

-   Guest management is optional; invitation can publish without guests.
-   Guest entry may represent individual or party/family.
-   Owner controls addressee/display name, e.g. "Bapak Andi & Keluarga".
-   Simple owner-created group/category; one group per guest in MVP.
-   Group is for organization/filter/bulk actions, not automatic event
    permissions.
-   Owner can manually add guests or import CSV/Excel.
-   Import provides validation preview/errors.
-   Duplicates are warnings, never automatic merge.
-   Owner can explicitly reconcile/merge duplicates.
-   Conflicting histories require review.
-   Bulk actions: assign group, assign event, distribution status and
    common operations.
-   No spreadsheet-like editor.

## 15. Capacity

Paid entitlement is **500 invited people capacity per invitation**.

Examples:

-   500 individual guests × 1 = 500.
-   100 family entries × max 5 people = 500.

Dashboard shows usage, e.g. `438 / 500`, with near-limit warning.

Imports/public RSVP that would exceed entitlement cannot commit.
Reducing allowed party size returns capacity only when consistent with
existing RSVP/attendance history.

## 16. Personalized Invitation and Privacy

-   Generic and personalized links are supported.
-   Owner can disable generic access and run personalized-only.
-   Generic invitation without password is accessible to anyone with
    URL.
-   Optional shared password works in trial and paid.
-   Personalized guests must also pass shared password when enabled.
-   Owner can change password; old password cannot be viewed.
-   Personalized page exposes only relevant events/data.
-   Do not label guests as "special invitation" merely because content
    differs.

Link previews:

-   general preview: cover + couple names + primary date;
-   personalized preview never contains guest/addressee name;
-   owner may select share cover from invitation media;
-   password-protected invitation uses privacy-safe generic preview.

Guest sharing:

-   owner-configurable;
-   when enabled, use native share/copy-link actions.

## 17. RSVP

RSVP section is optional.

Owner chooses:

-   whether generic public RSVP is allowed;
-   public RSVP asks name only or name + phone;
-   max party size for public RSVP within product bounds;
-   which events accept public RSVP;
-   whether public-RSVP guests automatically become QR/check-in eligible
    or require approval.

Personalized guest:

-   does not re-enter phone/email;
-   cannot normally edit own identity/addressee;
-   responds per assigned event;
-   `ATTENDING` requires at least 1 person;
-   can update response while RSVP remains open;
-   sees confirmation summary and can edit while open.

Public RSVP:

-   creates guest entry;
-   returns personalized link;
-   potential duplicate is flagged;
-   phone is private and not shown back publicly;
-   no guest email field.

Owner:

-   may close/reopen RSVP while invitation active;
-   may override response;
-   can filter `Belum RSVP`;
-   can manually remind guests via WhatsApp.

New responses stop after event ends. Public RSVP automatically closes
when 500-person capacity is reached.

## 18. Guestbook

-   Optional.
-   Owner chooses public or personalized-guests-only.
-   Owner chooses auto-publish or moderation-first.
-   Owner can hide/delete wishes.
-   Published wish shows sender display name, message, date/time.
-   Personalized guest has one active wish and may update it.
-   No owner replies.
-   No reactions/likes.
-   Guestbook is included in export.
-   No email per wish; dashboard surfaces new/pending activity.

## 19. WhatsApp Distribution

MVP does not send WhatsApp messages automatically.

-   Per-guest personalized `wa.me` flow.
-   Copy personalized link is also available.
-   Editable per-invitation templates.
-   Allowlisted placeholders only.
-   Templates: invitation, RSVP reminder, event reminder.
-   "Open WhatsApp" records `WHATSAPP_OPENED`; it is not delivery/read
    proof.
-   Track first/last opened and optional count, not permanent click
    history.
-   Owner may manually mark `Sent`, separate from `WHATSAPP_OPENED`.
-   Simple distribution filters/status.
-   Trial cap is 30 unique contacts across the WhatsApp sending/reminder
    flow; repeated sends to same contact do not consume another unique
    slot.
-   Paid removes this cap.
-   No automated bulk blast.

## 20. QR Check-in

-   Full QR check-in is available in trial and paid.
-   QR is event-operational and usable only in configured check-in
    window.
-   Owner can configure window within product bounds.
-   Max 5 active staff access grants per event.
-   Staff sees minimum guest fields and simple attendance summary.
-   Guest QR appears after eligible `ATTENDING` RSVP.
-   Owner can download/share an individual guest QR manually.
-   No bulk QR-file export.
-   QR screen shows addressee/name and QR, not party member details.
-   Party check-in records total actual people.
-   No adult/child split.
-   Actual count can differ from RSVP within allowed max.
-   Guest changing to `NOT_ATTENDING` becomes normally ineligible for
    check-in; authorized override remains possible.
-   Venue staff can search and manually check in a guest without a QR.
-   After check-in, guest sees checked-in state/time.
-   Repeat staff scan clearly reports already checked in.

## 21. Dashboard and Analytics

Main dashboard lists all invitations with lifecycle/status/expiry.

No product limit on number of invitations per account.

Invitation-level operational stats:

-   invited capacity;
-   RSVP status/count;
-   actual attendance;
-   distribution/view status;
-   guestbook activity;
-   simple invitation view count;
-   post-event invited vs attending RSVP vs actual attendance.

Personalized guest status may show `Viewed / Belum Dilihat`. "Viewed"
means invitation successfully opened, not proof the person read it.

Do not expose guest device/browser/location analytics to owner.

Expired/grace invitations appear in history/archive until purged.

No Duplicate Invitation feature MVP.

## 22. Export and Deletion

Owner can export during trial, paid, and grace.

Formats:

-   CSV;
-   Excel `.xlsx`.

Export includes relevant invitation content/config,
guest/RSVP/check-in/guestbook/distribution data.

Owner can download uploaded photos/audio before purge.

Before voluntary deletion, offer Download/Export Data but do not make it
mandatory.

Voluntary delete:

-   strong confirmation;
-   no automatic refund.

## 23. Support

Launch channels:

-   WhatsApp;
-   email.

State realistic business hours; do not claim 24/7.

Prioritize event-now/very-near issues.

Dashboard provides Help/Contact Support and may attach safe invitation
context.

Provide simple FAQ/help pages for key flows, not a large knowledge base.

## 24. Safety, Terms, and Privacy

-   User is responsible for rights to uploaded media.
-   Platform may suspend/remove illegal, prohibited, or abusive content.
-   Provide simple abuse-report channel.
-   Valid takedown/removal process.
-   Suspension takes public invitation offline but does not immediately
    delete data; support resolution may be possible.
-   Short privacy notice appears around RSVP/guest interactions.
-   Guest list, phone, RSVP, attendance are private to owner/authorized
    staff.
-   Published guestbook exposes only sender display name + message +
    timestamp.
-   Invitation is noindex by default.

## 25. Explicitly Not MVP

-   custom domain;

-   renewal;

-   collaborator/co-owner;

-   ownership transfer;

-   promo/voucher;

-   add-ons;

-   reseller/WO package;

-   500 capacity custom deal;

-   WhatsApp Business API;

-   automated bulk WhatsApp;

-   seating/table assignment;

-   custom RSVP question builder;

-   bilingual simultaneous invitation;

-   guest photo contribution;

-   guest photo download feature;

-   bulk QR image archive;

-   sophisticated analytics;

-   keepsake report;

-   self-service refund;

-   complex moderation console.

## 26. Product Success Baseline

Initial product spec targets:

-   500 paid active invitations sold in first 3 months after public
    launch;
-   operational storage/CDN cost below 15% of selling price per package;
-   core invitation, RSVP, personalized distribution, and check-in flows
    are reliable enough for real wedding-day use.

Product decisions not explicitly listed here should default to the
simplest behavior consistent with this document and `ARCHITECTURE.md`.
