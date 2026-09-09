# WIREFRAMES_BATCH_4.md — Low-Fidelity Wireframe Batch 4

**Status:** Ready for implementation review  
**Date:** 9 September 2026  
**Scope:** Secondary Product Operations: import, guestbook moderation, media/music, e-angpao, sharing/privacy, export, lifecycle/deletion/account deletion  
**Source of truth:** `UX.md`, `PRODUCT.md`, `STATE_MACHINES.md`, `ARCHITECTURE.md`, `SECURITY.md`, `API_CONTRACTS.md`, `backlog/04-events-guests.md`, `backlog/07-media-guestbook-angpao.md`, and `backlog/10-notifications-exports-deletion.md`

## 1. Purpose

This batch closes the remaining MVP operational surfaces after the critical creation, monetization, RSVP, and event-day flows. It focuses on high-leverage owner tasks that contain irreversible or privacy-sensitive consequences: bulk import, moderation, media management, static gift information, access controls, data export, paid-expiry grace, invitation deletion, and account deletion.

Unless explicitly overridden here, `UX.md` remains authoritative.

## 2. Batch-Level Decisions

1. **These are owner workspace screens.** They reuse the invitation shell from Batch 1; no new global navigation model is introduced.
2. **Bulk/import operations are preview-first.** Invalid rows never surprise-commit. Capacity is rechecked at confirmation/commit time.
3. **Duplicates are warnings, not automatic merge.** User can exclude/import/reconcile explicitly.
4. **Background work is visible as state, not a blocking spinner.** Imports and exports can leave the page and later resume from their job status.
5. **Guestbook moderation uses status tabs/filters, not one giant feed.** Moderation-first mode defaults to pending items.
6. **Hide and delete are distinct.** Hide is reversible publication state; delete is destructive and asks confirmation.
7. **Gallery maximum is 20 photos.** Upload state is per asset; invalid files fail individually without losing already valid items.
8. **Music supports exactly one active track.** Source is either curated library or owner upload. Switching source never activates two tracks.
9. **Autoplay is best-effort.** Preview tells owner that browsers may require guest interaction and guest UI will show a play control when blocked.
10. **E-angpao is static information only.** The platform never presents gift totals, sender tracking, payment success, or transaction history.
11. **Max 3 e-angpao methods.** Bank and uploaded QR image are presentation methods, not platform payment rails.
12. **Sharing & Privacy is a plain-language access summary.** Technical tokens/credential URLs are never exposed as settings.
13. **Password changes invalidate prior scoped password sessions.** Old password can never be revealed.
14. **Generic access and guest-sharing are separate controls.** Disabling generic public access does not disable personalized links.
15. **Export is job-based.** CSV/XLSX export is data-focused; uploaded photos/audio are downloaded separately.
16. **Export artifacts have bounded retention.** UI displays a download-until timestamp supplied by server; user can regenerate while lifecycle allows.
17. **Paid grace has no renewal/reactivation CTA.** The dominant action is export/download before the exact purge deadline.
18. **Voluntary invitation deletion is distinct from wedding cancellation and from lifecycle expiry.** Delete immediately takes public access offline and enters deletion workflow; it does not create a refund entitlement.
19. **Account deletion is the highest-friction destructive flow.** Recent re-authentication, explicit consequences, cooling-off semantics, and cancellation path are required.
20. **Cancelling account deletion does not auto-republish invitations.** They return as owned/inactive and the owner decides publication according to lifecycle rules.
21. **Date/deadline copy uses exact dates/times.** Do not rely only on relative urgency.
22. **Accessibility:** bulk tables remain keyboard usable on desktop; mobile cards expose the same actions; destructive actions never rely on color alone.

---

# 3. Screen Wireframes

## WF-29 — Guest Import

**Goal:** Safely import CSV/XLSX guests with validation, duplicate awareness, and capacity control.  
**Primary flow:** Upload → Validate → Review → Confirm → Background commit → Result

### 29A. Upload

```text
┌──────────────────────────────────────────┐
│ ← Import Tamu                            │
├──────────────────────────────────────────┤
│ Upload CSV atau Excel (.xlsx)            │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Tarik file ke sini                  │ │
│ │ atau                                │ │
│ │ [ Pilih File ]                      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Kolom yang didukung: nama/addressee,     │
│ telepon, grup, acara, max orang.          │
│ [ Download Template ]                    │
└──────────────────────────────────────────┘
```

### 29B. Processing

```text
Memeriksa 246 baris…
Anda boleh meninggalkan halaman ini.
[ Kembali ke Tamu ]
```

### 29C. Validation Preview

```text
┌──────────────────────────────────────────┐
│ Import Preview                           │
│ 231 valid · 10 peringatan · 5 invalid   │
├──────────────────────────────────────────┤
│ Filter: [Semua] [Invalid] [Peringatan]   │
│                                          │
│ Row 12  Bpk. Andi & Keluarga             │
│ ! Kemungkinan duplikat: “Andi Keluarga”  │
│ [ Tetap Import ] [ Kecualikan ]          │
│                                          │
│ Row 19  Sinta                            │
│ × Acara “After Party” tidak ditemukan    │
│ [ Edit Mapping ] [ Kecualikan ]          │
└──────────────────────────────────────────┘
```

### 29D. Capacity Summary + Confirm

```text
Kapasitas setelah import
Saat ini              438 / 500
Tambahan valid         +52
--------------------------------
Jika dikonfirmasi      490 / 500

5 baris invalid akan dikecualikan.
10 peringatan tetap akan diimport.

[ Konfirmasi Import 241 Baris ]
Kembali Review
```

If the proposed commit would exceed capacity, primary CTA is disabled with actionable copy. The user must exclude/reduce rows or party limits first.

### 29E. Commit/result

```text
Import sedang diproses
241 baris · job #IMP-…

✓ 238 berhasil
! 3 gagal saat commit

[ Lihat 3 Baris Gagal ]
[ Kembali ke Daftar Tamu ]
```

Commit-time failures can occur because authoritative capacity/data changed after preview. Never silently exceed limits or partially pretend full success.

### Mobile adaptation

Validation rows become stacked cards. Desktop can use a table with sticky issue/status columns. Both expose identical include/exclude semantics.

---

## WF-30 — Guestbook Moderation

**Goal:** Review wishes efficiently while preserving configured publication policy.  
**Primary actions:** `Publikasikan`, `Sembunyikan`, `Hapus`

```text
┌──────────────────────────────────────────┐
│ Guestbook                                │
│ Mode: Moderasi dulu             Settings │
├──────────────────────────────────────────┤
│ [Menunggu 8] [Published 42] [Hidden 3]   │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Rina · 9 Sep 2026 17.42             │ │
│ │ “Selamat menempuh hidup baru…”      │ │
│ │                                      │ │
│ │ [ Publikasikan ]   ⋮                │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Bapak Andi & Keluarga               │ │
│ │ “Semoga lancar sampai hari H…”      │ │
│ │ [ Publikasikan ]   ⋮                │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

Overflow actions: `Sembunyikan` where applicable, `Hapus` destructive. Delete asks confirmation because content is lost; hide does not.

### Settings drawer

```text
Guestbook [On]
Akses: (●) Umum  ( ) Tamu Personal Saja
Publikasi: ( ) Otomatis  (●) Moderasi Dulu
```

Changing from moderation-first to auto-publish does not automatically publish previously pending items unless product logic explicitly defines that later; chosen default is to leave existing pending wishes pending to avoid surprise publication.

### Empty states

- Pending empty: `Tidak ada ucapan yang menunggu moderasi.`
- Entire guestbook empty: show configured mode plus link to preview invitation; do not imply a system problem.

---

## WF-31 — Media / Gallery / Music

**Goal:** Manage invitation media without turning the editor into a DAM.  
**Primary actions:** upload/reorder photos; select one song

### 31A. Gallery

```text
┌──────────────────────────────────────────┐
│ Gallery                         12 / 20   │
├──────────────────────────────────────────┤
│ [ + Tambah Foto ]                        │
│                                          │
│ [img 1] [img 2] [img 3]                 │
│   ⋮       ⋮       ⋮                      │
│ [img 4] [img 5] [img 6]                 │
│                                          │
│ Seret untuk mengatur urutan              │
└──────────────────────────────────────────┘
```

Per photo menu: `Jadikan cover` only where supported by existing invitation media model, `Ganti`, `Hapus`. Meaningful deletion asks confirmation.

### Upload state

```text
Foto 13.jpg      Mengunggah… 64%
Foto 14.png      Memproses…
Foto-virus.exe   Gagal · tipe file tidak didukung
```

Invalid media never becomes active. User can continue working with existing gallery items.

### 31B. Music

```text
Musik Latar [On]

Sumber
(●) Library
( ) Upload sendiri

[ Search library… ]
○ Senja Akustik          ▶ Preview
● Hari Bahagia           ▶ Preview
○ Piano Ceremonial       ▶ Preview

Lagu aktif: Hari Bahagia

Catatan: autoplay dapat diblokir browser.
Tamu tetap akan melihat kontrol Play.
```

Owner-upload source adds file picker plus rights declaration. Only one active song is possible. Switching source asks confirmation only when it would discard an unsaved upload choice; it does not delete the stored asset merely because it becomes inactive.

---

## WF-32 — E-Angpao

**Goal:** Configure optional static gift methods clearly without implying platform payment processing.  
**Primary CTA:** `Tambah Metode`

```text
┌──────────────────────────────────────────┐
│ E-Angpao                         [On]     │
│ 2 / 3 metode                             │
├──────────────────────────────────────────┤
│ Bank BCA                                 │
│ 1234567890                               │
│ a.n. Alya Putri                          │
│ [ Edit ] [ Hapus ]                       │
│                                          │
│ QRIS / E-wallet QR                       │
│ [thumbnail QR]                           │
│ Dana Keluarga                            │
│ [ Ganti ] [ Hapus ]                      │
│                                          │
│ [ + Tambah Metode ]                      │
│                                          │
│ Platform hanya menampilkan informasi     │
│ hadiah. Pembayaran hadiah tidak diproses │
│ atau dilacak oleh platform.              │
└──────────────────────────────────────────┘
```

### Add bank method

Fields: bank name, account number, account owner name; all required for bank type.

### Add QR method

Fields: display label + uploaded image. Validate as media through the normal upload/finalization path.

Never show `saldo`, `gift received`, `payment success`, transaction status, or donor identities.

---

## WF-33 — Sharing & Privacy

**Goal:** Give the owner one understandable place to control invitation access and sharing.  
**Primary action:** autosaved settings

```text
┌──────────────────────────────────────────┐
│ Sharing & Privacy                        │
├──────────────────────────────────────────┤
│ Ringkasan akses                          │
│ Akses umum: Aktif                       │
│ Link personal: Aktif                     │
│ Password: Tidak digunakan                │
│ Tamu dapat membagikan link: Tidak        │
│                                          │
│ Akses umum                     [ On ]     │
│ Izinkan URL umum dibuka tanpa link tamu  │
│                                          │
│ Password bersama               [ Off ]    │
│ [ Aktifkan Password ]                     │
│                                          │
│ Izinkan Tamu Membagikan Link    [ Off ]   │
│                                          │
│ Event visibility →                       │
│ Location/contact visibility →            │
└──────────────────────────────────────────┘
```

### Enable/change password

```text
Gunakan password bersama
[ password baru                 ]
[ ulangi password               ]
[ Simpan Password ]
```

Change copy:

`Password lama tidak dapat dilihat. Mengganti password akan mengeluarkan sesi tamu yang menggunakan password lama.`

Do not expose hashes, token versions, guest activation credentials, or technical session IDs.

### Generic access off

Confirmation is informational, not destructive:

`Link umum akan berhenti membuka undangan. Link personal tamu tetap dapat digunakan sesuai aturan akses.`

If publication/lifecycle makes public access unavailable anyway, show the lifecycle reason so the setting does not misleadingly appear to restore access.

---

## WF-34 — Export

**Goal:** Let owner obtain portable product data during trial, paid, or grace.  
**Primary CTA:** `Buat Export`

### Ready state

```text
┌──────────────────────────────────────────┐
│ Export Data                              │
├──────────────────────────────────────────┤
│ Termasuk:                                │
│ ✓ Konten & konfigurasi undangan          │
│ ✓ Event, tamu, grup                      │
│ ✓ RSVP & attendance                      │
│ ✓ Guestbook                              │
│ ✓ Status distribusi yang relevan         │
│                                          │
│ Format                                   │
│ (●) Excel .xlsx                          │
│ ( ) CSV                                  │
│                                          │
│ [ Buat Export ]                          │
│                                          │
│ Foto/audio diunduh terpisah.             │
│ Download Media →                         │
└──────────────────────────────────────────┘
```

### Job pending

```text
Menyiapkan export…
Anda boleh meninggalkan halaman ini.

Status: Dalam antrean / Diproses
[ Muat Ulang Status ]
```

### Artifact ready

```text
✓ Export siap
wedding-alya-bima-2026-09-09.xlsx
Dibuat 9 Sep 2026 · 18.12 WIB
Tersedia sampai 10 Sep 2026 · 18.12 WIB

[ Download Export ]
Buat Ulang
```

The exact retention duration is server-configured; UI only displays authoritative availability deadline.

### Failure

`Export belum berhasil dibuat. Data asli tidak berubah.` Offer retry while lifecycle allows.

---

## WF-35 — Grace / Invitation Deletion / Account Deletion

WF-35 is one inventory item in `UX.md`, but it contains three materially different destructive/lifecycle surfaces. They are specified separately here to avoid implementation ambiguity.

### 35A. Paid Expiry → Grace

**Goal:** Communicate read-only recovery window and exact deadline without suggesting renewal.  
**Primary CTA:** `Export Data`

```text
┌──────────────────────────────────────────┐
│ Alya & Bima                              │
│ [Masa Grace] [Offline]                   │
├──────────────────────────────────────────┤
│ Masa aktif undangan berakhir             │
│ 8 September 2027.                        │
│                                          │
│ Undangan publik sekarang offline.        │
│ Data tersedia sampai:                    │
│ 8 Oktober 2027, 18.07 WIB                │
│                                          │
│ Selama masa ini Anda masih dapat:        │
│ • Preview pribadi                        │
│ • Export CSV/Excel                       │
│ • Download foto/audio                    │
│                                          │
│ Editor dan publish tidak tersedia.       │
│ Tidak ada renewal untuk MVP.             │
│                                          │
│ [ Export Data ]                          │
│ [ Download Media ]                       │
│ Preview Pribadi →                        │
└──────────────────────────────────────────┘
```

As the deadline approaches, increase banner prominence, but always display the exact server deadline. After grace ends and deletion is pending, remove export claims unless backend explicitly still permits them.

### 35B. Voluntary Invitation Deletion

**Goal:** Let owner intentionally delete one invitation with strong confirmation and export offer.  
**Primary destructive CTA:** `Hapus Undangan`

```text
Danger Zone
Hapus Undangan
Menghapus undangan akan membuat link publik
langsung offline dan memulai proses penghapusan data.
Pembayaran tidak otomatis direfund.

[ Export Data Dulu ]
[ Hapus Undangan… ]
```

Confirmation:

```text
Hapus “Alya & Bima”?

Tindakan ini akan:
• membuat undangan offline;
• menjadwalkan penghapusan data/media;
• tidak memberikan refund otomatis.

Ketik HAPUS untuk mengonfirmasi
[ HAPUS                         ]

[ Hapus Undangan ]
Batal
```

Chosen confirmation phrase is a static destructive word rather than the invitation name, because names may contain punctuation/Unicode and be cumbersome on mobile. Backend still requires authenticated ownership and confirmation token/state.

### 35C. Account Deletion

**Goal:** Delete the entire owner account with recent re-authentication, clear consequences, and cooling-off semantics.  
**Primary destructive CTA:** `Jadwalkan Hapus Akun`

```text
┌──────────────────────────────────────────┐
│ Hapus Akun                               │
├──────────────────────────────────────────┤
│ Ini memengaruhi semua undangan milikmu.  │
│                                          │
│ Sebelum lanjut:                          │
│ [ Export data undangan ]                 │
│                                          │
│ Setelah dikonfirmasi:                    │
│ • semua undangan publik langsung offline │
│ • akun masuk masa pembatalan singkat     │
│ • setelah masa itu, data dipurge sesuai  │
│   kebijakan retensi                      │
│ • refund tidak otomatis diberikan        │
│                                          │
│ [ Lanjutkan ]                            │
└──────────────────────────────────────────┘
```

Then require **recent reauthentication** using the account's supported auth method. After reauth:

```text
Konfirmasi Hapus Akun
Ketik HAPUS AKUN
[                              ]

[ Jadwalkan Hapus Akun ]
Batal
```

### Account deletion pending

```text
Penghapusan akun dijadwalkan
Semua undangan publik sedang offline.

Dapat dibatalkan sampai:
<exact server timestamp>

[ Batalkan Penghapusan Akun ]
```

The exact cooling-off duration remains server/configuration policy because current source documents specify a short cooling-off period but do not lock a duration. This is intentionally **not invented in wireframes**; API must provide `cancellable_until`.

### Cancel deletion

On cancellation:

```text
✓ Penghapusan akun dibatalkan
Akun dapat digunakan kembali.
Undangan tidak dipublish ulang otomatis.
[ Buka Daftar Undangan ]
```

Each invitation then follows its own commercial/publication lifecycle and requires explicit owner action where publication is allowed.

---

# 4. Cross-Screen States and Safety Rules

### Read-only lifecycle

In `TRIAL_EXPIRED` or `GRACE`, secondary settings that mutate invitation data are disabled. Export/preview remain available according to policy. Do not leave controls visually active only to fail after submit.

### Concurrent changes

Import confirmation, privacy changes, guestbook moderation, and destructive actions must re-check authoritative state. Stale writes should explain what changed and preserve safe local input when possible.

### Upload uncertainty

If upload completed but finalization status is unknown, query media state before asking for another upload. Never create duplicate active assets due to retry.

### Deletion and jobs

Deletion UI distinguishes:

- request accepted / scheduled;
- cancellation window where applicable;
- deletion pending;
- final deleted/unavailable.

Do not claim physical purge occurred merely because the item disappeared from normal workspace UI.

## 5. Responsive Notes

- Import preview and guestbook moderation use cards on mobile and tables/lists on desktop.
- Gallery uses a 2–3-column mobile grid and larger desktop grid; operations remain available without hover.
- Sharing/privacy and export forms use a single-column mobile baseline.
- Destructive confirmation dialogs become full-height sheets on small screens to avoid accidental dismissal/taps.

## 6. Implementation Acceptance Gate

Batch 4 is ready for engineering when:

- import validates before commit, shows duplicates as warnings, and enforces capacity authoritatively;
- guestbook moderation implements pending/published/hidden/deleted semantics without accidental publication;
- gallery/media states distinguish upload, validation, ready, failure, and deletion;
- only one music track can be active and autoplay fallback is represented accurately;
- e-angpao never behaves like a platform payment ledger;
- Sharing & Privacy accurately distinguishes generic, personalized, shared password, and guest-sharing controls;
- export is job-based, lifecycle-gated, and produces explicit ready/expiry states;
- grace shows exact deletion/export deadline and no renewal CTA;
- invitation deletion and account deletion are separate flows with correct refund/public-offline semantics;
- account deletion requires recent re-auth and supports the architecture-defined cooling-off cancellation behavior;
- canceling account deletion does not auto-republish invitations.

