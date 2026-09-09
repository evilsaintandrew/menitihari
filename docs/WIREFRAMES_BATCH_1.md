# WIREFRAMES_BATCH_1.md — Low-Fidelity Wireframe Batch 1

**Status:** Ready for implementation review  
**Date:** 9 September 2026  
**Scope:** Critical vertical slice: acquisition → creation → publication → guest response  
**Source of truth:** `UX.md`, `PRODUCT.md`, `ARCHITECTURE.md`, `STATE_MACHINES.md`, `SECURITY.md`, and `backlog/`

## 1. Purpose

This document resolves the interaction hierarchy for Wireframe Batch 1. It is deliberately low fidelity: no final brand colors, polished wedding imagery, or theme-specific art direction. The goal is to make navigation, form complexity, CTA placement, responsive behavior, state handling, and lifecycle consequences implementable without another product interview.

Unless this document explicitly says otherwise, `UX.md` remains authoritative. Where UX left a small interaction detail open, this document chooses the simplest behavior consistent with the product and architecture.

## 2. Batch-Level Decisions

1. **Primary breakpoint strategy:** design mobile at 390 px first; desktop reference at 1440 px. Tablet interpolates rather than receiving a separate IA.
2. **Owner app shell:** account-level screens use a simple top bar. Invitation workspace desktop uses a left rail plus workspace header. Mobile uses a compact top bar and a menu drawer; no permanent seven-tab bottom navigation.
3. **Editor:** desktop uses a two-pane layout (controls + live preview). Mobile uses one editing surface with a sticky bottom bar containing Preview and publication action; preview opens full-screen. Autosave status stays visible.
4. **First publish:** no blocking wizard. `Publish` opens a readiness drawer/sheet. If all required items pass, the primary action in that surface is `Publikasikan`.
5. **Invitation slug:** generated automatically from couple names. It is not requested during first creation. It can be edited later in Settings/Sharing & Privacy.
6. **Theme selection:** selecting a theme is immediate but reversible before continuing. All ten themes are equal; no premium badges.
7. **Guest add:** one short form. Event assignment is required; phone and group are optional. Each selected event gets its own maximum-party-size control.
8. **Distribution action:** implemented as a guest-specific action sheet/drawer, not a separate heavyweight page. It exposes Open WhatsApp, Copy Link, and Mark Sent with explicit semantics.
9. **Personalized invitation:** invitation visual presentation is theme-owned, but a compact operational action area makes RSVP obvious without turning the experience into a dashboard.
10. **RSVP:** bottom sheet on mobile, centered dialog on desktop. Responses are per event. The flow does not ask the guest to re-enter identity/contact data.
11. **QR eligibility after RSVP:** confirmation surfaces `Lihat QR` only when the guest is eligible. The QR itself is a later screen in the inventory; Batch 1 proves the eligibility handoff, not scanner operations.
12. **Lifecycle visibility:** inside owner workspace, Trial/Paid status, remaining/active-until date, publication state, Preview, and contextual activation are always discoverable.
13. **Language:** interface copy in this batch defaults to Bahasa Indonesia. Theme invitation content may later follow invitation language settings.
14. **Errors:** validation is inline; mutation failure preserves entered/local state. Destructive or consequential actions explain the consequence before confirmation.
15. **Loading:** use skeletons for page content, spinner/progress only for explicit mutations. Never replace a whole usable page with a spinner during autosave.

## 3. Shared Low-Fidelity Primitives

```text
OWNER TOP BAR / MOBILE
┌──────────────────────────────────────┐
│ ← / Logo     Context          Menu   │
└──────────────────────────────────────┘

INVITATION WORKSPACE HEADER
┌────────────────────────────────────────────────────────────┐
│ Alya & Bima   [Trial · 2 hari lagi] [Draft]   Preview      │
│                                           [Aktifkan]       │
└────────────────────────────────────────────────────────────┘

PRIMARY BUTTON      [ Label utama ]
SECONDARY BUTTON    [ Label ]
TEXT ACTION          Label →
STATUS               [Draft] [Published] [Trial]
INLINE INFO          i  Supporting consequence/help
WARNING              !  Actionable warning
ERROR                ×  What failed + what user can do
```

Primary actions are full-width on narrow mobile forms where practical. Sticky actions must not obscure form fields or invitation content.

---

# 4. Screen Wireframes

## WF-01 — Landing

**Goal:** Explain product/value quickly and start free creation.  
**Primary CTA:** `Buat Undangan Gratis`  
**Secondary:** `Lihat Demo`, `Lihat Tema`

### Mobile

```text
┌──────────────────────────────────────┐
│ Logo                          Masuk  │
├──────────────────────────────────────┤
│ Undangan digital untuk hari bahagia │
│ Anda                                │
│                                      │
│ Buat, bagikan, kelola RSVP, dan      │
│ check-in tamu dari satu tempat.      │
│                                      │
│ [ Buat Undangan Gratis ]             │
│ Coba gratis 3 hari                   │
│ Lihat Demo     Lihat Tema            │
├──────────────────────────────────────┤
│ Harga Launch                         │
│ Rp79.000 / undangan                  │
│ Aktif 1 tahun setelah pembayaran     │
├──────────────────────────────────────┤
│ ✓ Tautan tamu personal               │
│ ✓ RSVP                               │
│ ✓ QR check-in                        │
│ ✓ 10 tema                            │
├──────────────────────────────────────┤
│ Cara kerja                           │
│ 1 Buat  2 Bagikan  3 Kelola acara   │
├──────────────────────────────────────┤
│ Preview tema / demo placeholders     │
│ [ Lihat semua tema ]                 │
├──────────────────────────────────────┤
│ FAQ ringkas · Terms · Privacy        │
└──────────────────────────────────────┘
```

### Desktop adaptation

Hero becomes two columns: proposition/CTA left, neutral invitation mockup right. Price and trial facts remain in the first viewport or immediately below it. Feature proof uses four compact cards. Do not use a pricing comparison table because there is one paid tier.

### States / notes

- Returning authenticated owner: primary CTA becomes `Buka Dashboard`; `Buat Undangan Gratis` can remain secondary if appropriate.
- Never say WhatsApp is automatically sent/delivered.
- E-angpao is not a payment-processing promise and is not a hero claim.

---

## WF-02 — Sign Up

**Goal:** Create account with minimum friction.  
**Primary CTA:** `Buat Akun`

### Mobile

```text
┌──────────────────────────────────────┐
│ ←                         Logo       │
├──────────────────────────────────────┤
│ Buat akun                            │
│ Mulai dengan uji coba 3 hari saat    │
│ undangan pertama dibuat.             │
│                                      │
│ Email                                │
│ [ nama@email.com                  ]  │
│ Password                             │
│ [ •••••••••••                    ]  │
│ Syarat password ringkas              │
│                                      │
│ [ Buat Akun ]                        │
│                                      │
│ Sudah punya akun? Masuk              │
│ Dengan melanjutkan, Anda menyetujui  │
│ Terms dan Privacy.                   │
└──────────────────────────────────────┘
```

### Error behavior

- Email/account conflict uses generic copy: `Tidak dapat membuat akun dengan data tersebut. Coba masuk atau gunakan email lain.`
- Password requirements update inline.
- Submit disables only while request is in flight; values remain on failure.

---

## WF-03 — Verify Email

**Goal:** Make the next action unmistakable.  
**Primary CTA:** `Buka Email Saya` when a safe platform-neutral mailto action is useful; otherwise the visual primary action is `Kirim Ulang Email` only after cooldown.

### Mobile

```text
┌──────────────────────────────────────┐
│ Logo                                 │
├──────────────────────────────────────┤
│            [ envelope ]              │
│ Verifikasi email Anda                │
│                                      │
│ Kami mengirim tautan verifikasi ke   │
│ a••••@example.com                    │
│                                      │
│ Buka email tersebut dan tekan tautan │
│ verifikasi untuk melanjutkan.        │
│                                      │
│ [ Buka Email Saya ]                  │
│ Belum menerima? Kirim ulang (00:42)  │
│                                      │
│ Gunakan email lain                   │
└──────────────────────────────────────┘
```

### States

- **Verified in another tab/device:** page detects/rechecks and shows `Email terverifikasi` → `Lanjut buat undangan`.
- **Expired link:** clear explanation + resend.
- **Resend:** generic success; no account-enumeration wording.

---

## WF-04 — Create Invitation

**Goal:** Capture only data needed to create a useful draft and explicitly disclose trial start.  
**Primary CTA:** `Buat Undangan & Mulai Trial`

### Mobile

```text
┌──────────────────────────────────────┐
│ ←                 Undangan Baru      │
├──────────────────────────────────────┤
│ Mulai dari yang penting              │
│ Detail lain bisa diubah nanti.       │
│                                      │
│ Nama tampilan pasangan 1             │
│ [ Alya                             ] │
│ Nama tampilan pasangan 2             │
│ [ Bima                             ] │
│ Tanggal acara utama                  │
│ [ 20 Desember 2026                 ] │
│                                      │
│ i Trial 3 hari dimulai saat undangan │
│   dibuat. Harga Launch Rp79.000 untuk│
│   aktivasi 1 tahun setelah pembayaran│
│   berhasil.                          │
│                                      │
│ [ Buat Undangan & Mulai Trial ]      │
└──────────────────────────────────────┘
```

### Decisions

- No venue, phone, slug, theme, package, or event-type question here.
- Server creates DRAFT, locks launch price, creates primary event seeded with the selected date and sensible defaults, then routes to Theme Picker.
- Time can be completed later in Events; date is sufficient for creation.

---

## WF-05 — Theme Picker

**Goal:** Pick one of 10 included themes without purchase anxiety.  
**Primary CTA:** `Gunakan Tema Ini` on selected theme / preview.

### Mobile

```text
┌──────────────────────────────────────┐
│ ←                 Pilih Tema         │
│ 1 dari 2 langkah awal                │
├──────────────────────────────────────┤
│ Semua tema termasuk                  │
│                                      │
│ ┌──────────────┐ ┌──────────────┐    │
│ │ thumbnail    │ │ thumbnail    │    │
│ │ Tema A       │ │ Tema B       │    │
│ │ Preview      │ │ Preview      │    │
│ │ ○ Pilih      │ │ ● Dipilih    │    │
│ └──────────────┘ └──────────────┘    │
│ ... 10 total                         │
├──────────────────────────────────────┤
│ Tema B dipilih                       │
│ [ Gunakan Tema Ini ]                 │
└──────────────────────────────────────┘
```

### Desktop adaptation

Five-column or responsive grid where thumbnail legibility permits; otherwise 4/3 columns. Preview opens a large modal with desktop/mobile viewport toggle. Selection is not a premium/upsell moment.

### States

- Thumbnail failure: neutral placeholder + theme name; selection remains possible.
- Theme application failure: keep previous theme and show retryable error.

---

## WF-06 — Invitation Editor

**Goal:** Immediately present a usable invitation with defaults and progressively reveal customization.  
**Primary action:** editing is autosaved; publication is the main consequential action.  
**Persistent utilities:** Preview, save state, Publish.

### Mobile

```text
┌──────────────────────────────────────┐
│ ← Alya & Bima                  ⋮     │
│ [Trial · 2 hari lagi] [Draft]        │
├──────────────────────────────────────┤
│ Quick Setup                          │
│ Lengkapi bagian penting              │
│                                      │
│ Couple                         ✓  >   │
│ Events                         !  >   │
│ Opening & Closing                 >   │
│ Love Story            Off          > │
│ Gallery               Off          > │
│ Music                 Off          > │
│ E-Angpao              Off          > │
│ RSVP                  On           > │
│ Guestbook             Off          > │
│ Appearance                          > │
│ Sharing & Privacy                   > │
│                                      │
│ Tersimpan 18:03                      │
├──────────────────────────────────────┤
│ [ Preview ]           [ Publish ]    │ sticky
└──────────────────────────────────────┘
```

Selecting a row opens a focused full-height subpage/sheet. Example:

```text
┌──────────────────────────────────────┐
│ ← Events                             │
├──────────────────────────────────────┤
│ Acara utama                          │
│ Resepsi                              │
│ 20 Des 2026 · Waktu belum diisi      │
│ [ Edit acara ]                       │
│                                      │
│ + Tambah acara                       │
│ Maks. 5 acara                        │
└──────────────────────────────────────┘
```

### Desktop

```text
┌───────────┬────────────────────────────┬───────────────────────────┐
│ Nav       │ Editor controls            │ Live invitation preview   │
│ Overview  │ Quick Setup                │ ┌───────────────────────┐ │
│ Edit  ●   │ Couple                  ✓  │ │ phone/desktop canvas  │ │
│ Guests    │ Events                  !  │ │ same shared renderer  │ │
│ RSVP      │ Opening & Closing          │ │                       │ │
│ ...       │ Love Story       Off       │ └───────────────────────┘ │
│           │ ...                        │ View: Mobile / Desktop    │
└───────────┴────────────────────────────┴───────────────────────────┘
Top: Alya & Bima · Trial · Draft · Saved · Preview · [Publish]
```

### Autosave states

- `Menyimpan…`
- `Tersimpan`
- `Gagal menyimpan · Coba lagi` while local edits remain intact.
- Concurrency conflict: `Versi undangan berubah di sesi lain.` Provide `Muat versi terbaru` and a safe way not to silently discard local changes.

### First-edit defaults

- Couple display names prefilled.
- Primary event seeded from creation date; missing time/venue visibly incomplete but not represented as fake data.
- Theme selected.
- Sensible opening/closing copy exists.
- RSVP enabled by default for personalized guests; optional sections can start off.

---

## WF-07 — Preview

**Goal:** Inspect the exact shared renderer before publishing.  
**Primary CTA:** `Kembali Edit` while draft; `Publish` remains available in owner chrome.

### Mobile

```text
┌──────────────────────────────────────┐
│ × Preview       Draft     [Publish]  │
├──────────────────────────────────────┤
│ OWNER PREVIEW — tidak terlihat tamu  │
├──────────────────────────────────────┤
│                                      │
│      [ invitation theme renderer ]   │
│      Alya & Bima                     │
│      ...                             │
│                                      │
└──────────────────────────────────────┘
```

### Desktop

Preview uses a centered viewport with `Mobile | Desktop` controls and a `Generic | Preview as Guest` mode entry when guest data exists. Preview-as-Guest does not consume a guest activation token.

### Notes

- No fake share URL is presented as live while unpublished.
- Personalized preview banner must clearly state owner preview context.

---

## WF-08 — Publish Readiness

**Goal:** Make first publication requirements and privacy consequence clear without a wizard.  
**Primary CTA:** `Publikasikan`

### Mobile bottom sheet / desktop side panel

```text
┌──────────────────────────────────────┐
│ Siap dipublikasikan?             ×   │
├──────────────────────────────────────┤
│ ✓ Nama pasangan                      │
│ ✓ Acara utama & tanggal              │
│ ✓ Tema                               │
│                                      │
│ Akses publik                         │
│ Siapa pun yang memiliki link dapat   │
│ membuka konten yang ditandai publik. │
│ Undangan tidak diindeks mesin cari.  │
│                                      │
│ Sharing & Privacy                >    │
│ [ Preview lagi ]                     │
│                                      │
│ [ Publikasikan ]                     │
└──────────────────────────────────────┘
```

### Invalid variant

```text
│ ! Lengkapi waktu acara utama         │
│   [ Lengkapi ]                       │
│ ✓ Nama pasangan                      │
│ ✓ Tema                               │
│ [ Publikasikan ] disabled            │
```

**Decision:** minimum publish validation requires a usable primary event including date/time; venue may remain optional if product permits remote/undisclosed venue. Optional content never blocks publication.

### Success transition

After commit and cache invalidation: toast/compact success state `Undangan dipublikasikan` with `Buka Undangan` and route to Overview. Do not create a separate celebratory wizard.

---

## WF-09 — Invitation Overview

**Goal:** Tell owner current state and next operational action.  
**Primary CTA is contextual:** for a newly published invitation with no guests, `Tambah Tamu`.

### Mobile

```text
┌──────────────────────────────────────┐
│ ← Alya & Bima                  ⋮     │
│ [Trial · 2 hari lagi] [Published]    │
│ Preview                 Aktifkan →   │
├──────────────────────────────────────┤
│ Undangan aktif                       │
│ /alya-bima                           │
│ [ Buka Undangan ]  [ Salin Link ]    │
├──────────────────────────────────────┤
│ Tamu                                 │
│ 0 / 500 orang diundang               │
│ [ Tambah Tamu ]                      │
├──────────────────────────────────────┤
│ RSVP                                 │
│ Hadir 0 · Tidak 0 · Belum RSVP 0     │
│ Lihat RSVP →                         │
├──────────────────────────────────────┤
│ Distribusi                           │
│ 0 / 30 kontak WhatsApp digunakan    │
│ Trial menghitung kontak unik.        │
│ Kelola tamu →                        │
├──────────────────────────────────────┤
│ Aktivitas                            │
│ Belum ada aktivitas tamu             │
└──────────────────────────────────────┘
```

### Desktop

Overview uses a 2–3 column operational card grid, not analytics-heavy charts. Workspace navigation appears in left rail. Invitation lifecycle/status remains in header.

### Empty-state priority

For zero guests, the first obvious action is `Tambah Tamu`; analytics cards remain compact and non-distracting.

---

## WF-10 — Guests

**Goal:** Manage invitees, assignments, capacity, and distribution status.  
**Primary CTA:** `Tambah Tamu`

### Mobile

```text
┌──────────────────────────────────────┐
│ ← Guests                      ⋮      │
│ 438 / 500 orang diundang             │
│ ! Mendekati kapasitas                │
├──────────────────────────────────────┤
│ [ Cari tamu...                    ]  │
│ Filter ▾                 [Tambah]    │
│ Import                                │
├──────────────────────────────────────┤
│ □ Keluarga Santoso                   │
│   Keluarga · maks 4 orang            │
│   Resepsi + Akad                     │
│   RSVP: Hadir 3                      │
│   [Ditandai Terkirim] [Dilihat]      │
│   ⋮                                  │
├──────────────────────────────────────┤
│ □ Rina                               │
│   Teman · maks 1 orang               │
│   Resepsi                            │
│   RSVP: Belum                        │
│   [Belum Dikirim] [Belum Dilihat]   │
│   ⋮                                  │
└──────────────────────────────────────┘
```

### Desktop

Table columns: selection, addressee, group, invited capacity, events, RSVP, distribution, viewed, actions. Capacity indicator stays above table. Bulk action bar appears only after selection.

### Empty state

`Belum ada tamu` + short explanation + `Tambah Tamu` primary + `Import file` secondary.

### Capacity behavior

- Warn before an add/edit would exceed 500.
- Never allow UI to imply that guest rows equal people capacity.
- Server remains authoritative; atomic capacity failure returns actionable copy.

---

## WF-11 — Add Guest

**Goal:** Add one guest/party quickly with explicit event capacity.  
**Primary CTA:** `Simpan Tamu`

### Mobile

```text
┌──────────────────────────────────────┐
│ × Tambah Tamu                        │
├──────────────────────────────────────┤
│ Nama tamu / penerima                 │
│ [ Keluarga Santoso                ]  │
│                                      │
│ Nomor WhatsApp (opsional)            │
│ [ +62 ...                         ]  │
│                                      │
│ Grup (opsional)                      │
│ [ Keluarga ▾                      ]  │
│                                      │
│ Acara yang diundang                  │
│ ☑ Akad                               │
│   Maks. orang [ 4  − + ]             │
│ ☑ Resepsi                            │
│   Maks. orang [ 4  − + ]             │
│ ☐ After Party                        │
│                                      │
│ Kapasitas setelah disimpan:          │
│ 442 / 500 orang                      │
├──────────────────────────────────────┤
│ [ Simpan Tamu ]                      │
└──────────────────────────────────────┘
```

### Decisions / validation

- At least one event assignment is required for an actionable personalized invitation.
- Party size defaults to 1 when an event is selected.
- If multiple events are selected, each assignment has an independent maximum; the invitation-level capacity calculation follows the authoritative product/data-model rule rather than summing UI rows naively.
- Duplicate signals produce a warning, never automatic merge: `Tamu serupa ditemukan` → `Lihat` / `Tetap simpan` where safe.
- After save: return to Guests, highlight new row, offer distribution action.

---

## WF-12 — Distribution Action

**Goal:** Share one personalized invitation while accurately representing what the platform knows.  
**Primary CTA:** `Buka WhatsApp` when a phone exists; otherwise `Salin Link`.

### Mobile action sheet

```text
┌──────────────────────────────────────┐
│ Bagikan ke Keluarga Santoso      ×   │
├──────────────────────────────────────┤
│ Tautan personal siap digunakan.      │
│ Identitas tamu tidak muncul di       │
│ preview link yang dibagikan.         │
│                                      │
│ Pesan                                 │
│ [ Kepada {guest_name}, ...        ]  │
│ Edit template →                      │
│                                      │
│ [ Buka WhatsApp ]                    │
│ [ Salin Link ]                       │
│                                      │
│ Status                               │
│ Belum Dikirim                        │
│ [ Tandai Terkirim ]                  │
│                                      │
│ Trial: 12 / 30 kontak WhatsApp       │
│ Kontak yang sama tidak dihitung lagi │
└──────────────────────────────────────┘
```

### Semantics

- Immediately before navigating to `wa.me`, record `WHATSAPP_OPENED`.
- After return, UI says `WhatsApp Dibuka`, never delivered/read.
- `Tandai Terkirim` is a separate owner action.
- `Dilihat` appears only after successful invitation open; it does not mean read.
- Trial-cap failure explains the 30 unique-contact rule and activation option without blocking Copy Link.

---

## WF-13 — Personalized Invitation

**Goal:** Let a guest experience the invitation naturally while making relevant operational actions obvious.  
**Primary operational CTA before response:** `Konfirmasi Kehadiran`

### Mobile

```text
┌──────────────────────────────────────┐
│        [ theme invitation ]          │
│                                      │
│ Untuk                                │
│ Keluarga Santoso                     │
│                                      │
│ Alya & Bima                          │
│ 20 Desember 2026                     │
│                                      │
│ [ theme content / opening ]          │
│                                      │
│ ACARA UNTUK ANDA                     │
│ Akad · 09:00                         │
│ [ Buka Maps ] [ Tambah Kalender ]    │
│                                      │
│ Resepsi · 11:00                      │
│ [ Buka Maps ] [ Tambah Kalender ]    │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Konfirmasi kehadiran Anda       │ │
│ │ [ Konfirmasi Kehadiran ]        │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [ remaining theme sections ]         │
└──────────────────────────────────────┘
```

### Behavior

- Only assigned events render.
- Personalized activation happens silently when possible; shared-password gate can precede content if configured.
- No guest phone, owner stats, other guests, hidden events, or special labels.
- If already RSVP'd, operational card summarizes current response and action becomes `Ubah RSVP`.
- If QR eligible, a `Lihat QR` action joins the operational card.
- If guest sharing is disabled, do not expose personalized copy/share action.

---

## WF-14 — RSVP Interaction

**Goal:** Capture per-event attendance with minimal input.  
**Primary CTA:** `Simpan RSVP`

### Mobile bottom sheet

```text
┌──────────────────────────────────────┐
│ Konfirmasi Kehadiran             ×   │
├──────────────────────────────────────┤
│ Akad · 20 Des · 09:00                │
│ ( Hadir )   ( Tidak Hadir )          │
│ Jumlah hadir                         │
│ [ − ]  3 orang  [ + ]   Maks. 4      │
│                                      │
│ Resepsi · 20 Des · 11:00             │
│ ( Hadir )   ( Tidak Hadir )          │
│ Jumlah hadir                         │
│ [ − ]  3 orang  [ + ]   Maks. 4      │
│                                      │
│ Pesan/alasan (opsional)              │
│ [                                  ] │
├──────────────────────────────────────┤
│ [ Simpan RSVP ]                      │
└──────────────────────────────────────┘
```

### Interaction rules

- Each assigned event has its own status and attending count.
- Selecting `Hadir` reveals count, default 1, bounded by assignment max.
- Selecting `Tidak Hadir` hides count; optional message/reason may be entered.
- Existing response preloads when editing.
- Closed RSVP variant shows saved response and `RSVP sudah ditutup`; no misleading submit CTA.
- Mutation failure preserves selections and offers retry.

---

## WF-15 — RSVP Confirmation / QR Eligibility

**Goal:** Confirm exactly what was saved and expose next action.  
**Primary CTA when eligible:** `Lihat QR`; otherwise `Kembali ke Undangan`.

### Mobile — eligible

```text
┌──────────────────────────────────────┐
│             ✓                        │
│ RSVP berhasil diperbarui             │
│                                      │
│ Akad                                 │
│ Hadir · 3 orang                      │
│                                      │
│ Resepsi                              │
│ Hadir · 3 orang                      │
│                                      │
│ QR check-in Anda sudah tersedia.     │
│ Simpan akses ini untuk hari acara.   │
│                                      │
│ [ Lihat QR ]                         │
│ [ Kembali ke Undangan ]              │
│ Ubah RSVP                            │
└──────────────────────────────────────┘
```

### Mobile — not eligible / not attending

```text
│ RSVP berhasil diperbarui             │
│ Resepsi                              │
│ Tidak Hadir                          │
│                                      │
│ [ Kembali ke Undangan ]              │
│ Ubah RSVP                            │
```

### Notes

- QR eligibility must come from server state, not inferred solely from the just-submitted UI choice.
- Public-RSVP approval policy may mean an attending response is pending QR eligibility; copy becomes `Menunggu persetujuan untuk QR check-in` rather than falsely showing a QR.

---

# 5. Critical Flow Stitching

```text
Visitor
Landing
  → Sign Up
  → Verify Email
  → Create Invitation  [trial starts]
  → Theme Picker
  → Editor
  → Preview
  → Publish Readiness
  → Overview [Published]
  → Guests
  → Add Guest
  → Distribution Action

Guest
Personalized Link
  → personalized activation/session
  → Personalized Invitation
  → RSVP Interaction
  → RSVP Confirmation
  → QR eligibility handoff
```

The owner should be able to complete the happy path without entering any optional profile, billing, gallery, guestbook, e-angpao, or advanced privacy configuration.

# 6. Responsive Rules

| Pattern | Mobile | Desktop |
|---|---|---|
| Account navigation | top bar | top bar / simple account nav |
| Invitation workspace | compact header + drawer | left rail + workspace header |
| Editor | focused section pages + sticky actions | controls + live preview |
| Guests | cards/list rows | table |
| Publish readiness | bottom sheet/full-height sheet | right-side panel/dialog |
| Distribution | bottom sheet | side panel/dialog |
| RSVP | bottom sheet | centered dialog |
| Preview | full-screen | viewport canvas with device toggle |

No critical operation depends on hover. Touch targets should be comfortably tappable. Tables collapse into semantic cards rather than horizontal spreadsheet scrolling for core guest actions.

# 7. Required Empty, Loading, and Error States

Batch 1 implementation is incomplete without these states:

- Landing/auth network failure.
- Verification resend cooldown, success, expired token.
- Invitation creation validation and server failure.
- Theme thumbnails loading/failure and theme apply failure.
- Editor initial skeleton; autosave saving/saved/error/conflict.
- Preview renderer failure with safe fallback.
- Publish invalid, publishing, success, failure.
- Overview zero-guest state.
- Guests loading, empty, no search results, near-capacity, capacity failure.
- Add Guest duplicate warning and invalid phone/event/party size.
- Distribution no-phone variant, WhatsApp cap reached, copy success/failure.
- Personalized link invalid/expired/already-consumed-unrecoverable state routes to neutral safe recovery/unavailable behavior without leaking identity.
- RSVP loading, closed, invalid count, save failure.
- Confirmation eligible, pending approval, not eligible.

# 8. Analytics / Event Naming Needed for UX Validation

Keep product analytics coarse and privacy-safe. Suggested events:

```text
landing_cta_clicked
signup_completed
email_verified
invitation_created
trial_started
theme_selected
editor_preview_opened
publish_readiness_opened
invitation_published
guest_created
distribution_whatsapp_opened
distribution_link_copied
distribution_marked_sent
personalized_invitation_viewed
rsvp_submitted
qr_eligibility_shown
```

Do not log raw personalized credentials, guest phone numbers, RSVP free-text, or sensitive URL query/path material in analytics.

# 9. Implementation Mapping

| Wireframe | Primary tickets |
|---|---|
| WF-01 Landing | launch hardening / acquisition |
| WF-02 Sign Up | AUTH-001 |
| WF-03 Verify Email | AUTH-002 |
| WF-04 Create Invitation | INV-001 |
| WF-05 Theme Picker | EDIT-002, EDIT-003 |
| WF-06 Editor | EDIT-001, EDIT-004, EDIT-005, EDIT-006 |
| WF-07 Preview | EDIT-003, RSA-008 |
| WF-08 Publish Readiness | INV-003 |
| WF-09 Overview | INV-003, INV-008, EVG-005 |
| WF-10 Guests | EVG-003, EVG-004, EVG-005, WA-005 |
| WF-11 Add Guest | EVG-003, EVG-004, EVG-005, EVG-006 |
| WF-12 Distribution | WA-001..006, RSA-002 |
| WF-13 Personalized Invitation | RSA-002, RSA-003 |
| WF-14 RSVP | RSA-004, RSA-005 |
| WF-15 RSVP Confirmation | RSA-004, RSA-007; check-in eligibility contract |

# 10. Batch 1 Acceptance Gate

Batch 1 is ready to hand to implementation when the team can answer **yes** to all of these:

- A first-time owner can identify the next action on every happy-path screen.
- Trial start is disclosed before invitation creation.
- Price/lifecycle copy never implies lifetime access or browser-confirmed payment.
- The editor never requires optional content to publish.
- Owner can distinguish `WhatsApp Dibuka`, `Ditandai Terkirim`, and `Dilihat`.
- Capacity is consistently expressed in people, not guest rows.
- Personalized guest sees only assigned events and no unrelated private data.
- RSVP supports per-event status and event-specific party limits.
- QR eligibility is server-authoritative and not promised prematurely.
- Mobile owner, guest, and distribution flows do not depend on desktop-only interaction.
- Loading/error/empty states above are represented in implementation tickets/tests.

## 11. Deliberately Deferred to Later Batches

Not resolved here beyond necessary entry points: trial-expired lock screen, checkout/QRIS, receipt, scanner/staff grants, import workflow, guestbook moderation, media upload detail, e-angpao detail, export/deletion, grace lifecycle, and full QR presentation/check-in states. Their behavior remains governed by `UX.md` and later wireframe batches.
