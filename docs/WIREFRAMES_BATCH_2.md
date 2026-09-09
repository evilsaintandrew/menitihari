# WIREFRAMES_BATCH_2.md — Low-Fidelity Wireframe Batch 2

**Status:** Ready for implementation review  
**Date:** 9 September 2026  
**Scope:** Monetization: trial visibility → expiry lock → checkout → QRIS pending → activation success → receipt  
**Source of truth:** `UX.md`, `PRODUCT.md`, `STATE_MACHINES.md`, `ARCHITECTURE.md`, `SECURITY.md`, `API_CONTRACTS.md`, and `backlog/08-billing-payments.md`

## 1. Purpose

This batch resolves the commercial UX without turning the product into a billing dashboard. It defines how owners understand trial time, activate one invitation, wait for an authoritative QRIS result, recover from expired/failed attempts, and obtain proof of payment.

The product remains invitation-scoped: there is no cart, package comparison, subscription management, renewal, voucher, or global billing center in MVP. Payment state shown to the user must follow server/provider truth; browser return, screenshot, or client polling alone never grants paid access.

Unless explicitly overridden here, `UX.md` remains authoritative.

## 2. Batch-Level Decisions

1. **Activation is invitation-scoped.** Every commercial surface names the invitation being activated. An account with multiple invitations never pays them together.
2. **Trial banner has three prominence levels:** calm (`>24h` remaining), near-expiry (`<=24h`), and expired. The exact server-derived expiry timestamp is the source of truth; the client countdown is display-only.
3. **Activation CTA is available throughout trial** but only becomes visually prominent near expiry. No repeated modal interruption.
4. **Trial expiry is an in-place lifecycle lock, not data loss.** Owner can still privately Preview, Export, and Activate. Editing/publishing controls are disabled and public invitation is offline.
5. **Checkout is a single summary screen.** No multi-step checkout wizard, cart, package selector, promo field, add-ons, or required “I agree” checkbox unless later legally required.
6. **Price is read-only and server-controlled.** UI displays the invitation's locked price. For MVP launch baseline this is `Rp79.000`; client never calculates or overrides payable amount.
7. **One active payable attempt at a time per invitation in the UI.** If an unexpired `PENDING` attempt exists, `Aktifkan` resumes it instead of silently creating another attempt.
8. **QRIS creation occurs only after explicit `Bayar dengan QRIS`.** Checkout itself does not create a provider order.
9. **Pending is a durable destination.** It can be refreshed, revisited, opened on another device, and recovered after browser/app restart.
10. **QRIS presentation:** mobile shows QR plus `Simpan QR` where technically supported and concise instructions for paying from the same device; desktop emphasizes scanning with a phone. We do not assume a universal deep link.
11. **Payment expiry uses provider expiry as authoritative.** Countdown may assist the user but cannot extend an attempt.
12. **Recheck is explicit plus background reconciliation.** `Cek Status Pembayaran` requests/reads current server state. The UI may also poll with conservative backoff while visible. It never fabricates success.
13. **Success only renders after server state is `SUCCEEDED` / invitation is `PAID_ACTIVE`.** A provider redirect can land on Pending with “memeriksa status”.
14. **Success is not confetti-heavy.** It communicates entitlement: paid, exact active-until date, trial branding removed, 30-contact WhatsApp cap removed, and invitation can remain public for the paid period subject to publication/content state.
15. **Receipt is a simple printable/downloadable proof view.** It is not a tax invoice claim unless the business later establishes that document type. Default label: `Bukti Pembayaran` / `Receipt`.
16. **Failed and expired attempts remain in history** but do not dominate the main UX. User can create a new attempt at the same locked price when still eligible.
17. **No screenshot upload as payment proof.** Support can investigate using payment reference; screenshot is not a path to manual activation.
18. **No renewal CTA.** Paid expiry/grace belongs to Batch 4 lifecycle UX and must not be confused with trial-expired activation eligibility.
19. **Accessibility:** payment status never relies on color alone; expiry and success have text/icon labels; countdown changes do not spam screen readers.
20. **Mutation safety:** repeated taps on create/recheck are idempotent or disabled while in flight. Network errors preserve the current payment reference and QR.

## 3. Commercial State → UI Contract

| Server state | Owner label | Primary commercial action | Editor/public consequence |
|---|---|---|---|
| `TRIAL` | `Trial · X tersisa` | `Aktifkan Undangan Ini` | Edit/publish allowed; public page has trial branding; WA manual-flow cap 30 unique contacts |
| `TRIAL_EXPIRED` | `Trial Berakhir` | `Aktifkan Undangan Ini` | Read-only; public offline; Preview/Export remain available |
| `PAID_ACTIVE` | `Aktif sampai <date>` | None | Paid entitlement active; normal edit/publish rules |
| `GRACE` | `Masa Grace · sampai <date>` | None | Read-only; public offline; export/download emphasis; no renewal |

Payment attempt status is separate from invitation commercial state. A `PENDING` payment does **not** change `TRIAL` or `TRIAL_EXPIRED` to paid.

## 4. Shared Monetization Primitives

```text
TRIAL STATUS — CALM
┌──────────────────────────────────────────┐
│ Trial · 2 hari lagi       Aktifkan →     │
└──────────────────────────────────────────┘

TRIAL STATUS — NEAR EXPIRY
┌──────────────────────────────────────────┐
│ ! Trial berakhir dalam 8 jam             │
│ Undangan publik akan offline setelahnya. │
│ [ Aktifkan Undangan Ini ]                │
└──────────────────────────────────────────┘

PAYMENT STATUS
[Menunggu Pembayaran] [Berhasil] [Kedaluwarsa] [Gagal]

PRICE BLOCK
Harga Launch
Rp79.000
Sekali bayar · aktif 1 tahun sejak pembayaran berhasil

SERVER-TRUTH NOTE
Status pembayaran dikonfirmasi otomatis oleh penyedia pembayaran.
```

Commercial copy should say **sekali bayar untuk undangan ini**, not “lifetime”, “subscription”, or “renewal”.

---

# 5. Screen Wireframes

## WF-16 — Trial Status / Banner

**Goal:** Keep remaining trial time and activation discoverable without disrupting creation.  
**Primary CTA:** context-dependent `Aktifkan Undangan Ini`

### A. Workspace header — normal trial (>24h)

```text
┌──────────────────────────────────────────┐
│ Alya & Bima                              │
│ [Trial · 2 hari lagi] [Published]        │
│                          Preview  Aktifkan│
└──────────────────────────────────────────┘
```

On mobile, `Aktifkan` may be a compact text/button action in the header/menu. Do not consume a large part of the editor with an upsell.

### B. Overview — trial detail card

```text
┌──────────────────────────────────────────┐
│ Uji coba gratis                          │
│ 2 hari 04 jam tersisa                    │
│ Berakhir 11 Sep 2026, 18.07 WIB          │
│                                          │
│ Selama trial:                            │
│ • Semua fitur editor & 10 tema           │
│ • QR check-in tersedia                   │
│ • Undangan publik memakai branding       │
│ • Alur WhatsApp maks. 30 kontak unik     │
│                                          │
│ [ Aktifkan Undangan Ini ]                │
│ Rp79.000 · aktif 1 tahun setelah bayar   │
└──────────────────────────────────────────┘
```

### C. Near expiry (<=24h)

```text
┌──────────────────────────────────────────┐
│ ! Trial berakhir dalam 8 jam             │
│ Setelah trial berakhir, undangan publik  │
│ offline dan editor menjadi hanya-baca.   │
│ Data Anda tetap tersimpan.               │
│                                          │
│ [ Aktifkan Undangan Ini ]                │
│ Nanti saja                               │
└──────────────────────────────────────────┘
```

### Behavior / decisions

- Countdown derives from server `trial_ends_at`; show absolute timestamp alongside countdown in detailed surface.
- `<=24h` is the chosen near-expiry threshold for in-app prominence and near-expiry email alignment. Do not add daily nags.
- If a `PENDING` payment exists, activation CTA becomes `Lanjutkan Pembayaran` and routes to that attempt.
- If trial expires while screen is open, transition UI to WF-17 on the next authoritative lifecycle refresh; preserve unsaved local editor input long enough to explain/save recovery, but server rejects further edits after expiry.
- Trial branding/WA-cap explanation is factual, not framed as feature punishment.

---

## WF-17 — Trial Expired

**Goal:** Explain the lock calmly, preserve trust, and offer eligible next actions.  
**Primary CTA:** `Aktifkan Undangan Ini`  
**Secondary:** `Preview`, `Export Data`

### Mobile — entering locked editor/workspace

```text
┌──────────────────────────────────────────┐
│ ← Alya & Bima                       Menu │
│ [Trial Berakhir] [Offline]               │
├──────────────────────────────────────────┤
│                                          │
│          [ lock icon ]                   │
│ Trial undangan ini sudah berakhir        │
│                                          │
│ Undangan publik sedang offline dan       │
│ editor sekarang hanya-baca. Data yang    │
│ sudah Anda buat tetap tersimpan.         │
│                                          │
│ [ Aktifkan Undangan Ini ]                │
│ Rp79.000 · aktif 1 tahun sejak           │
│ pembayaran berhasil                      │
│                                          │
│ [ Preview ]       Export Data →          │
├──────────────────────────────────────────┤
│ Ringkasan undangan (read-only)            │
│ Tema · acara · tamu · RSVP               │
└──────────────────────────────────────────┘
```

### Desktop adaptation

Keep the normal workspace shell. Replace editable content controls with read-only values and a single lock notice at top. Do **not** replace every editor panel with separate lock cards.

### Consequences

- Publication status is shown as `Offline · trial berakhir`; do not misleadingly show `Published` as if public access remains live.
- Preview remains private and clearly labeled `Preview pribadi`.
- Export is available per product policy.
- A pending payment changes primary CTA to `Lanjutkan Pembayaran`.
- No data-loss countdown is shown here because trial expiry itself does not start the paid-expiry grace purge flow.

### Network/state edge

If the client believes trial expired but server still returns `TRIAL`, server state wins and editable controls remain available. If a mutation races with expiry and is rejected, show: `Trial berakhir sebelum perubahan ini tersimpan. Salin perubahan bila perlu, lalu aktifkan undangan untuk melanjutkan.`

---

## WF-18 — Checkout

**Goal:** Let owner verify exactly what they are activating and intentionally create a QRIS attempt.  
**Primary CTA:** `Bayar dengan QRIS`  
**Secondary:** `Kembali`

### Mobile

```text
┌──────────────────────────────────────────┐
│ ←              Aktivasi Undangan         │
├──────────────────────────────────────────┤
│ Undangan                                 │
│ Alya & Bima                              │
│ 20 Desember 2026                         │
│                                          │
│ Harga Launch                             │
│ Rp79.000                                 │
│ Sekali bayar untuk undangan ini          │
│                                          │
│ Aktif 1 tahun sejak pembayaran berhasil  │
│                                          │
│ Setelah aktif:                           │
│ ✓ Branding trial dihapus                 │
│ ✓ Batas 30 kontak WhatsApp dihapus       │
│ ✓ Undangan dapat tetap aktif selama      │
│   periode berbayar                       │
│                                          │
│ Metode pembayaran                        │
│ [ QRIS ]                                 │
│                                          │
│ Total                                    │
│ Rp79.000                                 │
│ Biaya gateway ditanggung platform        │
│                                          │
│ Terms · Privacy · Kebijakan refund       │
│                                          │
│ [ Bayar dengan QRIS ]                    │
└──────────────────────────────────────────┘
```

### Desktop adaptation

Two columns: invitation/benefit summary left; sticky order summary right. Still one page and one payment method. Avoid e-commerce visual clutter.

### Behavior / decisions

- Checkout fetches server-owned locked amount and invitation eligibility on entry and again when creating payment.
- If price shown becomes stale before submit, do not silently charge a different amount. Refresh the summary and explain; for existing invitations the locked-price invariant should make this exceptional.
- CTA enters loading state `Membuat QRIS…`; double submission is prevented/idempotent.
- Existing unexpired `PENDING` attempt: checkout does not create a second one; route to WF-19 with `Pembayaran yang masih aktif ditemukan.`
- Ineligible invitation (e.g. already paid): do not create payment; route to current invitation state.
- Terms/Privacy/refund are links, no checkbox by default.
- Refund copy must not imply a general money-back guarantee. Duplicate payment can be reviewed by support; voluntary deletion is not automatically refundable.

### Create-attempt failure

```text
× QRIS belum dapat dibuat.
  Tidak ada pembayaran yang diproses.
  [ Coba Lagi ]
```

If the provider response is uncertain after request submission, query server by idempotency/payment context before offering another create action.

---

## WF-19 — QRIS Pending

**Goal:** Make payment easy while remaining explicit that activation has not happened yet.  
**Primary CTA:** `Cek Status Pembayaran`  
**Secondary:** `Kembali ke Undangan`

### Mobile

```text
┌──────────────────────────────────────────┐
│ ←             Pembayaran QRIS            │
├──────────────────────────────────────────┤
│ [Menunggu Pembayaran]                    │
│ Rp79.000                                 │
│ Alya & Bima                              │
│                                          │
│        ┌────────────────────┐            │
│        │                    │            │
│        │      QR CODE       │            │
│        │                    │            │
│        └────────────────────┘            │
│                                          │
│ [ Simpan QR ]                            │
│                                          │
│ Selesaikan sebelum                       │
│ 9 Sep 2026, 18.37 WIB                    │
│ Sisa 29:42                               │
│                                          │
│ Bayar dari HP ini? Simpan QR lalu buka   │
│ aplikasi pembayaran yang mendukung       │
│ pemindaian QR dari galeri.               │
│                                          │
│ [ Cek Status Pembayaran ]                │
│ Memeriksa otomatis secara berkala        │
│                                          │
│ Ref: INV-AB12-…             Salin        │
│                                          │
│ Kembali ke Undangan                      │
└──────────────────────────────────────────┘
```

### Desktop

```text
┌──────────────────────────────────────────────────────────┐
│ Pembayaran QRIS                                          │
├──────────────────────────┬───────────────────────────────┤
│ [ QR CODE ]              │ [Menunggu Pembayaran]        │
│                          │ Rp79.000                      │
│ Scan dengan aplikasi     │ Alya & Bima                   │
│ pembayaran di ponsel.    │ Kedaluwarsa 18.37 WIB        │
│                          │ Ref: INV-AB12-…               │
│                          │ [ Cek Status Pembayaran ]     │
└──────────────────────────┴───────────────────────────────┘
```

### Status checking

- On load/resume, fetch attempt status from server.
- While page is visible and `PENDING`, conservative polling/reconciliation feedback is allowed; explicit button remains available.
- Button copy while checking: `Memeriksa…` then return to `Cek Status Pembayaran` if still pending.
- Copy: `Belum ada konfirmasi pembayaran. Jika Anda baru membayar, tunggu sebentar lalu cek lagi.`
- Do not say “belum bayar” because provider confirmation may be delayed.
- Background polling pauses/reduces when tab/app is not visible.

### Provider redirect/return

Return lands here, not directly on Success, unless server already has authoritative success. Show transient `Memeriksa konfirmasi pembayaran…` and fetch server state.

### Expired attempt

```text
┌──────────────────────────────────────────┐
│ [Kedaluwarsa]                            │
│ QRIS ini sudah tidak dapat digunakan.    │
│ Tidak ada aktivasi dari percobaan ini.   │
│                                          │
│ Harga undangan tetap Rp79.000             │
│ [ Buat Pembayaran Baru ]                 │
│ Kembali ke Undangan                      │
└──────────────────────────────────────────┘
```

`Buat Pembayaran Baru` creates/re-enters checkout flow for the same invitation and locked price. Prior attempt remains auditable.

### Failed attempt

Use `Pembayaran tidak berhasil` with provider-safe explanation when available. Offer `Buat Pembayaran Baru`. Do not expose raw provider error payloads.

### Network uncertainty

Keep QR, amount, reference, and provider expiry visible from known server data. Banner:

`Koneksi terputus. Status terakhir: Menunggu Pembayaran. Kami belum dapat memeriksa konfirmasi terbaru.`

Never convert this to failed or successful locally.

---

## WF-20 — Payment Success

**Goal:** Confirm authoritative activation and tell owner what changed.  
**Primary CTA:** `Kembali ke Undangan`  
**Secondary:** `Lihat Bukti Pembayaran`

### Mobile

```text
┌──────────────────────────────────────────┐
│              Aktivasi Berhasil           │
├──────────────────────────────────────────┤
│             [ check icon ]               │
│ Pembayaran berhasil                      │
│                                          │
│ Undangan Alya & Bima sudah aktif.        │
│                                          │
│ Aktif sampai                             │
│ 9 September 2027                         │
│                                          │
│ Sekarang:                                │
│ ✓ Branding trial dihapus                 │
│ ✓ Batas 30 kontak WhatsApp dihapus       │
│ ✓ Akses berbayar aktif 1 tahun           │
│                                          │
│ Rp79.000 · QRIS                          │
│ Ref: INV-AB12-…                          │
│                                          │
│ [ Kembali ke Undangan ]                  │
│ Lihat Bukti Pembayaran                   │
└──────────────────────────────────────────┘
```

### Behavior / decisions

- `active_until` is rendered from server entitlement data, not computed from the browser clock.
- If payment succeeds while trial still had time, paid period begins at payment success; unused trial is not added. Do not show “trial converted/remaining added”.
- Returning to invitation preserves publication state. Payment does not auto-publish a draft/unpublished invitation.
- If it was public during trial and remains `PUBLISHED`, paid activation removes trial commercial restrictions without requiring republish.
- Email confirmation is triggered server-side; UI may say `Bukti pembayaran juga dikirim ke email akun Anda` only after the notification job has been accepted/queued according to implementation semantics, not as a guarantee of inbox delivery.

### Delayed entitlement edge

The transactional activation design should make payment success + entitlement atomic. If a rare read lag occurs, keep user on a checking state rather than showing contradictory `Berhasil` plus Trial header.

---

## WF-21 — Receipt / Bukti Pembayaran

**Goal:** Provide durable, understandable payment proof and support reference.  
**Primary CTA:** `Unduh PDF` / browser print-to-PDF equivalent once implemented  
**Secondary:** `Kembali ke Undangan`

### Mobile

```text
┌──────────────────────────────────────────┐
│ ←            Bukti Pembayaran            │
├──────────────────────────────────────────┤
│ Platform / legal business identity       │
│                                          │
│ PEMBAYARAN BERHASIL                      │
│                                          │
│ Undangan        Alya & Bima              │
│ Nominal         Rp79.000                  │
│ Metode          QRIS                     │
│ Status          Berhasil                 │
│ Tanggal bayar   9 Sep 2026, 18.14 WIB    │
│ Referensi       INV-AB12-…               │
│ Aktif sampai    9 Sep 2027               │
│                                          │
│ Harga ini adalah pembayaran satu kali    │
│ untuk aktivasi undangan tersebut.        │
│                                          │
│ [ Unduh PDF ]                            │
│ Kembali ke Undangan                      │
│                                          │
│ Butuh bantuan? Hubungi Support dengan    │
│ menyertakan referensi pembayaran.        │
└──────────────────────────────────────────┘
```

### Receipt rules

- Use business/legal identity and fields required by actual implementation/legal setup; do not invent NPWP/tax-invoice semantics.
- Receipt data comes from immutable/auditable payment records and activation result.
- Amount is the actual succeeded amount recorded server-side.
- Do not display full sensitive gateway payloads or secrets.
- Download filename recommendation: `bukti-pembayaran-<invitation-short-ref>.pdf`.
- Printable desktop view removes app navigation and retains essential identity, amount, timestamp, reference, invitation, and active-until date.
- Receipt remains accessible from invitation overview while the record is retained, including after commercial expiry where policy permits account access.

---

# 6. Cross-Screen Flow Stitching

## 6.1 Normal early activation

```text
TRIAL workspace
→ Aktifkan Undangan Ini
→ WF-18 Checkout
→ Bayar dengan QRIS
→ WF-19 Pending
→ provider confirmation / reconciliation
→ WF-20 Success
→ invitation workspace [PAID_ACTIVE]
→ WF-21 Receipt available from overview
```

## 6.2 Resume existing pending attempt

```text
TRIAL / TRIAL_EXPIRED
→ Aktifkan / Lanjutkan Pembayaran
→ server finds unexpired PENDING attempt
→ WF-19 Pending
→ no duplicate QRIS attempt created
```

## 6.3 Attempt expires

```text
WF-19 Pending
→ provider expiry reached / server marks EXPIRED
→ WF-19 Expired state
→ Buat Pembayaran Baru
→ create new attempt using same invitation locked price
→ WF-19 Pending (new reference/expiry)
```

## 6.4 Trial expires during payment

```text
TRIAL + payment PENDING
→ trial_ends_at reached
→ invitation becomes TRIAL_EXPIRED / public offline
→ payment attempt remains independently PENDING until provider outcome/expiry
→ successful authoritative payment
→ PAID_ACTIVE
```

The pending screen should add a small note when commercial state has expired: `Trial sudah berakhir. Undangan akan aktif kembali setelah pembayaran terkonfirmasi.`

## 6.5 Browser/provider return before webhook

```text
Provider/browser return
→ WF-19 "Memeriksa konfirmasi pembayaran…"
→ server still PENDING
→ remain Pending
→ webhook/reconciliation later succeeds
→ WF-20 Success
```

## 6.6 Duplicate success event

No UX duplication. Idempotent backend activation returns the same paid entitlement/receipt; user sees one success state.

---

# 7. Responsive & Interaction Rules

- **390 px mobile baseline:** one-column commercial screens, full-width primary CTA, QR sized to remain scannable without horizontal scroll.
- **Desktop 1440 px:** checkout/pending may use two columns, but all status/action semantics remain identical.
- **Sticky CTA:** checkout may use a bottom sticky CTA on mobile only when it does not hide terms/price; user must still be able to inspect the summary without forced checkbox mechanics.
- **Back navigation:** leaving Pending is allowed. Warn only if navigation would genuinely discard something; a server-side payment attempt is not discarded by leaving the page.
- **Refresh:** safe on all screens. IDs/state live server-side.
- **Deep links:** payment attempt URLs must require authenticated owner authorization and must not expose a usable secret in shareable UI.
- **Timezone:** owner-facing absolute timestamps use the invitation/account presentation timezone; MVP Indonesian default can render WIB where configured. Store canonical timestamps server-side.

# 8. Loading, Empty, Error, and Race States

## Loading

- Trial status: skeleton only for the small status region; workspace remains usable if safe.
- Checkout: skeleton summary until locked price/eligibility arrives; payment CTA unavailable until loaded.
- Pending: QR placeholder until attempt details load; once loaded, keep QR stable during status checks.
- Success: if entered from Pending, use `Mengonfirmasi aktivasi…` until both payment and entitlement read as authoritative.

## Error taxonomy

1. **Recoverable network error:** preserve state, retry.
2. **Provider create error:** no claim of payment; retry after server checks whether an attempt was actually created.
3. **Provider status delay:** remain Pending.
4. **Expired attempt:** create new attempt.
5. **Failed attempt:** create new attempt when eligible.
6. **Already paid race:** route to Success/paid overview; do not charge again.
7. **Unauthorized invitation/payment:** generic not-found/permission surface; do not leak another owner's payment details.

# 9. Copy Guardrails

Use:

- `Harga Launch Rp79.000`
- `Sekali bayar untuk undangan ini`
- `Aktif 1 tahun sejak pembayaran berhasil`
- `Menunggu Pembayaran`
- `Pembayaran berhasil`
- `Trial berakhir`
- `Data Anda tetap tersimpan`

Avoid:

- `Harga normal Rp...` / fake strikethrough discount
- `Lifetime`
- `Langganan` / subscription
- `Perpanjang` / renewal
- `Pembayaran pasti berhasil` before provider confirmation
- `Sudah dibayar` based only on browser redirect/screenshot
- countdown copy designed to manufacture scarcity around the launch price

# 10. Analytics / Product Events

Event names are recommendations, not API contracts. Do not include payment secrets or unnecessary PII.

```text
trial_banner_viewed {invitation_id, prominence}
activation_clicked {invitation_id, entry_point, commercial_state}
checkout_viewed {invitation_id}
payment_attempt_create_requested {invitation_id}
payment_attempt_created {invitation_id, attempt_id}
payment_pending_viewed {invitation_id, attempt_id}
payment_status_recheck_clicked {attempt_id}
payment_attempt_expired_viewed {attempt_id}
payment_retry_clicked {invitation_id, prior_attempt_id}
payment_success_viewed {invitation_id, attempt_id}
receipt_viewed {invitation_id, payment_id}
receipt_downloaded {invitation_id, payment_id}
```

Server-side payment/activation audit remains authoritative; analytics is never used to infer entitlement.

# 11. Accessibility Acceptance Notes

- Status icon + text, not color alone.
- QR has adjacent textual payment instructions; QR itself does not need a verbose image description containing encoded payment data.
- Focus moves to the status heading after Pending → Success transition.
- Expiry countdown is not an `aria-live` every-second announcement. Announce only meaningful state transitions.
- Buttons have explicit labels (`Cek Status Pembayaran`, not just `Refresh`).
- Receipt is semantically structured and printable; essential information remains text, not an image.

# 12. Implementation Traceability

Primary backlog mapping:

| Wireframe | Backlog |
|---|---|
| WF-16 Trial status/banner | `BILL-001`, invitation lifecycle/status surfaces |
| WF-17 Trial Expired | `BILL-006`, invitation lifecycle gating |
| WF-18 Checkout | `BILL-001`, `BILL-002` |
| WF-19 QRIS Pending | `BILL-002`, `BILL-003`, `BILL-005`, `BILL-006` |
| WF-20 Payment Success | `BILL-003`, `BILL-004`, `BILL-007` |
| WF-21 Receipt | `BILL-007` |

`BILL-008` support refund/duplicate-payment records does not need an owner self-service wireframe in this batch; it is an exceptional support operation and must not create a general refund UI.

# 13. Batch 2 Acceptance Gate

Batch 2 is implementation-ready when engineering can answer all of the following from the docs without a new product decision:

- Where and how trial status changes prominence.
- What becomes unavailable at trial expiry and what remains available.
- What the owner sees before creating a payment attempt.
- Which amount is charged and who controls it.
- What happens when an active Pending attempt already exists.
- How Pending differs from Success.
- What browser/provider return means before authoritative confirmation.
- How expired/failed attempts are retried.
- What happens if trial expiry occurs during a pending payment.
- Exactly when the one-year period starts.
- What activation changes and what it does **not** change (e.g. it does not auto-publish).
- What the receipt contains and what it must not claim.

With these decisions fixed, Batch 2 should move directly into implementation alongside the Batch 1 vertical slice. Visual design may later refine typography, spacing, iconography, and brand treatment without changing these lifecycle or payment semantics.
