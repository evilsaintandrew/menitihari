# WIREFRAMES_BATCH_3.md — Low-Fidelity Wireframe Batch 3

**Status:** Ready for implementation review  
**Date:** 9 September 2026  
**Scope:** Event Operations: staff access → scanner → confirmation → repeat/wrong-event handling → manual fallback → audited correction  
**Source of truth:** `UX.md`, `PRODUCT.md`, `STATE_MACHINES.md`, `ARCHITECTURE.md`, `SECURITY.md`, `API_CONTRACTS.md`, and `backlog/09-checkin.md`

## 1. Purpose

This batch defines the event-day operating surface. It is intentionally narrower and more task-focused than the owner workspace: staff should be able to arrive at a venue, enter an event-scoped session, scan or find a guest, record the actual attendance count safely, understand exceptional states immediately, and recover from slow network without creating duplicate attendance records.

Unless explicitly overridden here, `UX.md` remains authoritative.

## 2. Batch-Level Decisions

1. **Phone-first operational shell.** Scanner and manual check-in are designed around a 390px mobile viewport and one-handed use. Desktop/tablet can expand spacing but do not gain critical-only functionality.
2. **Staff has no owner navigation.** A staff grant opens directly into the scoped event context. No invitation editor, guest export, payment, privacy settings, or cross-account navigation is exposed.
3. **Event context is always visible.** Event name plus a compact state (`Check-in Dibuka`, `Belum Dibuka`, `Ditutup`) stays at the top. Staff never silently changes event after scanning a QR for another event.
4. **Camera scan and manual search use the same attendance service.** Manual mode is a fallback input method, not a second check-in implementation.
5. **Scan is not check-in when count still needs confirmation.** A valid QR first resolves the guest. If party size can vary, staff confirms actual attendance before the mutation.
6. **Fast path for single-person parties.** When `max_party_size = 1` and the guest is eligible, show the confirmation card with `1 orang` preselected and make the commit one prominent tap. Do not auto-write attendance purely from QR decode.
7. **Actual attendance may differ from RSVP within allowed max.** RSVP count is context, not a hard equality constraint.
8. **Every write has a single in-flight state.** Disable repeat submit while pending; retries reuse idempotency context.
9. **No offline claim.** Slow/no connection shows a clear connection state, preserves the resolved guest where safe, and offers retry/manual search. It never says a check-in is saved until server confirms.
10. **Repeat scan is informational.** Existing check-in returns original time/current count and never creates a second attendance event.
11. **Wrong event is explicit.** Valid QR for an unassigned event yields `Tamu tidak terdaftar untuk acara ini`. Authorized override, if present, is secondary and audited.
12. **Correction is intentionally slower.** It requires current state, new state/count, reason, and confirmation. Correction does not overwrite history silently.
13. **Staff session status is visible but unobtrusive.** Grant label, event, and session validity live under a compact menu; expiry/revocation becomes blocking.
14. **Attendance summary is simple.** Show `checked-in people / expected invited capacity` or a similarly server-supported aggregate. Do not expose owner analytics.
15. **Privacy minimum.** Search/results show addressee, optional group, RSVP, max party size, and checked-in state only. Phone is not needed for event operations unless a later requirement explicitly adds it.
16. **Camera permissions degrade gracefully.** Denied/unavailable camera immediately surfaces manual search; no dead-end permission loop.
17. **Accessibility:** high contrast, text labels in addition to status color, large targets, vibration/audio cues only as optional enhancement, and visible focus for external keyboard/scanner use.
18. **Event window is server-authoritative.** Local device time is display-only.
19. **Concurrent scans are expected.** UI handles `ALREADY_CHECKED_IN` as a normal race outcome, not a generic error.
20. **Audit-sensitive actions require actor context.** Override/correction always records staff/owner actor, timestamp, before/after, and reason according to backend contracts.

## 3. Operational State → UI Contract

| Condition | Staff UI | Allowed action |
|---|---|---|
| Grant not yet valid | `Akses belum aktif` + validity time | No check-in |
| Grant active, window closed-before | `Check-in belum dibuka` | Search may be view-only if backend allows; no mutation |
| Grant active, window open | `Check-in Dibuka` | Scan/search/check-in |
| Grant active, window passed | `Check-in ditutup` | No normal check-in; authorized owner/support policy only |
| Grant expired/revoked | Blocking `Akses staff berakhir` | Re-auth/new grant required |
| Network uncertain | `Koneksi bermasalah` | Retry; do not claim saved |
| Guest already checked in | `Sudah Check-in` | View details; correction if authorized |

## 4. Shared Staff Shell

```text
┌──────────────────────────────────────────┐
│ Resepsi · Grand Ballroom          ⋮      │
│ ● Check-in Dibuka · 18.00–21.00          │
│ 126 orang sudah masuk                    │
├──────────────────────────────────────────┤
│                                          │
│              screen content              │
│                                          │
├──────────────────────────────────────────┤
│ [ Scan QR ]                 [ Cari Tamu ]│
└──────────────────────────────────────────┘
```

The bottom actions may collapse to one active mode plus a secondary text action when screen height is limited.

---

# 5. Screen Wireframes

## WF-22 — Staff Access

**Goal:** Enter a tightly scoped event-day session with minimal setup.  
**Primary CTA:** `Buka Scanner`

### Valid grant landing

```text
┌──────────────────────────────────────────┐
│             Akses Check-in               │
├──────────────────────────────────────────┤
│ [staff icon] Petugas: Meja Depan 1       │
│                                          │
│ Resepsi                                  │
│ Grand Ballroom                           │
│ 20 Des 2026 · 18.00–21.00 WIB            │
│                                          │
│ Akses aktif sampai 21.30 WIB             │
│                                          │
│ 0 / 500 orang check-in                   │
│                                          │
│ [ Buka Scanner ]                         │
│ Cari tamu manual →                       │
│                                          │
│ Hanya data operasional acara ini         │
│ yang dapat diakses.                      │
└──────────────────────────────────────────┘
```

### Multi-event grant

If one grant legitimately covers multiple events, first entry shows a compact event picker. Once chosen, the active event remains pinned until staff explicitly changes it from menu. Never infer/switch from scanned QR.

### Grant not active / expired / revoked

```text
Akses belum aktif
Akses ini berlaku mulai 17.30 WIB.
[ Muat Ulang ]

—or—

Akses staff berakhir
Minta pemilik undangan membuat atau memperbarui akses staff.
```

### Behavior

- Access link exchanges into a short-lived scoped session; raw grant credential should not remain broadly exposed in UI/logs.
- If camera permission has not been granted, do not ask on this landing. Ask when scanner is opened so the intent is clear.
- Max active grant rules are owner-side configuration, not a staff-facing concern.

---

## WF-23 — Scanner

**Goal:** Continuously resolve guest QR codes with minimal cognitive load.  
**Primary action:** camera scan

### Mobile

```text
┌──────────────────────────────────────────┐
│ Resepsi · Grand Ballroom          ⋮      │
│ ● Check-in Dibuka · 126 orang            │
├──────────────────────────────────────────┤
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │                                      │ │
│ │           CAMERA PREVIEW             │ │
│ │        ┌──────────────────┐           │ │
│ │        │   arahkan QR ke  │           │ │
│ │        │      sini        │           │ │
│ │        └──────────────────┘           │ │
│ │                                      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Arahkan QR tamu ke kamera                │
│                                          │
│ Tidak bisa scan? Cari tamu manual →      │
└──────────────────────────────────────────┘
```

### Resolving

```text
QR terbaca
Memeriksa tamu…
[spinner]
```

Pause QR intake while resolving/check-in confirmation is on screen so the camera does not trigger multiple guests behind the modal/card.

### Permission denied

```text
Kamera tidak dapat digunakan
Izinkan akses kamera dari pengaturan browser,
atau lanjutkan dengan pencarian manual.

[ Cari Tamu ]
Coba Kamera Lagi
```

### Slow network

```text
Koneksi lambat
QR sudah terbaca, sedang memeriksa ke server…
[ Coba Lagi ]
Cari Tamu Manual
```

No “tersimpan offline” copy.

---

## WF-24 — Check-in Confirmation

**Goal:** Verify identity and actual attendance before the first attendance mutation.  
**Primary CTA:** `Check In`

```text
┌──────────────────────────────────────────┐
│               Tamu Ditemukan             │
├──────────────────────────────────────────┤
│ Bapak Andi & Keluarga                    │
│ Keluarga Mempelai Pria                   │
│                                          │
│ RSVP: Hadir · 3 orang                    │
│ Maksimal: 4 orang                        │
│                                          │
│ Berapa orang yang datang?                │
│                                          │
│ [ − ]          3 orang          [ + ]    │
│                                          │
│ [ Check In · 3 orang ]                   │
│ Batal                                    │
└──────────────────────────────────────────┘
```

### Count rules

- Bounds: `1..max_party_size` for normal check-in.
- Initialize from RSVP attending count when valid; otherwise initialize to 1.
- If RSVP is `NOT_ATTENDING`, show warning and normal CTA is not available unless the current grant is authorized for override.
- If business rules permit authorized override, CTA becomes `Check In dengan Override` and opens a reason confirmation before mutation.

### Pending → success

```text
Menyimpan check-in…
(do not allow double tap)

✓ Check-in berhasil
Bapak Andi & Keluarga · 3 orang
18.42 WIB

[ Scan Berikutnya ]
```

Auto-return to scanner after a short non-blocking interval may be provided, but `Scan Berikutnya` is always available immediately. Avoid long celebrations/animations.

---

## WF-25 — Repeat Scan

**Goal:** Make an already-recorded attendance state unmistakable and safe under concurrency.  
**Primary CTA:** `Scan Berikutnya`

```text
┌──────────────────────────────────────────┐
│ [already icon] Sudah Check-in            │
├──────────────────────────────────────────┤
│ Bapak Andi & Keluarga                    │
│                                          │
│ Check-in pertama                         │
│ 18.42 WIB · 3 orang                      │
│                                          │
│ Tidak ada check-in baru yang dibuat.     │
│                                          │
│ [ Scan Berikutnya ]                      │
│ Perlu koreksi? →                         │
└──────────────────────────────────────────┘
```

`Perlu koreksi?` appears only if the staff grant/role is authorized to correct attendance. A second device racing the first uses this same screen.

---

## WF-26 — Wrong Event

**Goal:** Prevent accidental cross-event attendance writes.  
**Primary CTA:** `Scan Berikutnya`

```text
┌──────────────────────────────────────────┐
│ ! Tamu tidak terdaftar untuk acara ini   │
├──────────────────────────────────────────┤
│ Bapak Andi & Keluarga                    │
│                                          │
│ Scanner aktif:                           │
│ Resepsi · Grand Ballroom                 │
│                                          │
│ QR ini valid, tetapi tamu tidak memiliki │
│ akses normal ke acara ini.               │
│                                          │
│ [ Scan Berikutnya ]                      │
│                                          │
│ Override check-in →                      │
└──────────────────────────────────────────┘
```

### Override

Only render for authorized actor. It opens an explicit confirmation:

```text
Override check-in?
Tindakan ini akan tercatat di audit log.

Jumlah hadir  [1]
Alasan *      [________________]

[ Konfirmasi Override ]
Batal
```

Never switch scanner event automatically, even if the QR is valid for another event in the same invitation.

---

## WF-27 — Manual Search

**Goal:** Find and check in a guest when QR is unavailable.  
**Primary input:** server-side event-scoped search

```text
┌──────────────────────────────────────────┐
│ ← Cari Tamu · Resepsi                    │
├──────────────────────────────────────────┤
│ [ 🔎 Nama tamu / addressee             ] │
│                                          │
│ Hasil untuk “andi”                       │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Bapak Andi & Keluarga                │ │
│ │ Keluarga Pria                        │ │
│ │ RSVP Hadir · maks 4                  │ │
│ │ Belum Check-in                       │ │
│ │                           Pilih →    │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ Andini                               │ │
│ │ RSVP Belum · maks 1                  │ │
│ │ Sudah Check-in · 18.10              │ │
│ │                           Lihat →    │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Search behavior

- Debounced server-side query, event-scoped, paginated.
- Do not download the entire guest list to the client as a search cache.
- Minimum 2 visible characters before remote search is the default UX choice; exact backend threshold may tune performance.
- Empty result: `Tamu tidak ditemukan di acara ini.` with `Coba nama lain` and return to scanner.
- Selecting a not-yet-checked-in guest opens WF-24. Selecting an existing check-in opens WF-25.

---

## WF-28 — Attendance Correction

**Goal:** Correct an operational mistake without erasing audit history.  
**Primary CTA:** `Simpan Koreksi`

```text
┌──────────────────────────────────────────┐
│ ← Koreksi Check-in                       │
├──────────────────────────────────────────┤
│ Bapak Andi & Keluarga                    │
│ Resepsi                                  │
│                                          │
│ Saat ini                                 │
│ Checked-in · 3 orang · 18.42 WIB         │
│                                          │
│ Koreksi menjadi                          │
│ (●) Checked-in                           │
│     [ − ]       2 orang       [ + ]      │
│ ( ) Batalkan check-in                    │
│                                          │
│ Alasan koreksi *                         │
│ [ Salah input jumlah                  ]  │
│                                          │
│ Tindakan ini disimpan dalam riwayat.     │
│                                          │
│ [ Simpan Koreksi ]                       │
│ Batal                                    │
└──────────────────────────────────────────┘
```

### Rules

- Reason is required; chosen minimum UX length is 3 non-whitespace characters, while backend may enforce a stricter bounded text length.
- Reversal is represented as a correction/audited state change, not deletion of the original attendance record.
- Server revalidates current state before commit. If another correction occurred, show current latest state and require the operator to review again.
- Success returns to a corrected status card then scanner/manual-search context.

---

# 6. Cross-Screen Error States

### Invalid/expired/revoked QR

```text
QR tidak dapat digunakan
Kode ini tidak valid atau sudah tidak berlaku.
[ Scan Lagi ]
Cari Tamu Manual
```

Do not reveal whether a guessed credential maps to a guest.

### Outside check-in window

```text
Check-in belum dibuka
Mulai 18.00 WIB · waktu server
[ Muat Ulang ]
```

or

```text
Check-in sudah ditutup
Berakhir 21.00 WIB.
```

### Session expired while operating

Preserve non-sensitive screen context, block mutations, and require re-entry/new staff access. Never retry a write under an expired session automatically.

### Unknown mutation result

If transport fails after submit, the UI must query the current attendance state before offering a second mutation. Copy: `Status belum dapat dipastikan. Memeriksa hasil terakhir…`

## 7. Responsive Notes

- **390px mobile is the acceptance baseline.** Camera preview should use the majority of available vertical space while retaining event identity and manual fallback.
- **Tablet:** center operational content with max-width; do not introduce owner-like sidebars.
- **Landscape:** reduce decorative vertical whitespace; preserve large scan area and controls.
- **Desktop:** camera may occupy a larger centered column; manual search can appear side-by-side only as progressive enhancement.

## 8. Implementation Acceptance Gate

Batch 3 is ready for engineering when all of the following can be demonstrated in a realistic venue test:

- staff enters a scoped grant and sees the correct event;
- valid QR resolves and checks in exactly once;
- party count is bounded and auditable;
- concurrent/repeat scan reports existing attendance;
- wrong-event QR never silently writes attendance;
- authorized override is explicit and audited;
- manual search is server-scoped and uses the same check-in mutation;
- corrections preserve before/after/reason;
- camera-denied and slow-network paths remain usable;
- staff never sees owner-only/private data outside operational minimum.

