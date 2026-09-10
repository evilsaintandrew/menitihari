# DECISIONS.md --- ADR-Lite

Only consequential decisions that future engineers are likely to reopen
belong here.

## D001 --- Modular monolith

**Decision:** one domain-oriented Next.js/TypeScript codebase.\
**Why:** fastest maintainable MVP; avoids distributed-system complexity.

## D002 --- PostgreSQL-backed jobs, no Redis

**Decision:** PostgreSQL job table + scheduler/workers.\
**Why:** workload is moderate, transactional outbox is valuable, one
less operational system.

## D003 --- Self-hosted PostgreSQL at launch

**Decision:** PostgreSQL on launch VPS.\
**Why:** cost/simple operations initially; architecture keeps migration
to managed DB possible.

## D004 --- Path-based public URLs

**Decision:** `/slug`, not wildcard subdomains.\
**Why:** simpler DNS/cookies/deploy; custom domains/subdomains are
post-MVP.

## D005 --- Manual WhatsApp via `wa.me`

**Decision:** no BSP/WhatsApp Business API.\
**Why:** preserves personalization value without approval, variable
messaging cost, or delivery complexity.

## D006 --- `WHATSAPP_OPENED` is not delivery

**Decision:** only record that owner initiated the deep link.\
**Why:** browser cannot prove WhatsApp delivery/read.

## D007 --- QR check-in online with fallback

**Decision:** no full offline synchronization.\
**Why:** conflict resolution/sync complexity is disproportionate for
MVP; manual search/check-in is fallback.

## D008 --- One paid tier

**Decision:** launch price Rp79,000/invitation, all core features.\
**Why:** simple mass-market positioning and checkout.

## D009 --- Trial starts at creation

**Decision:** 3 days from invitation creation.\
**Why:** simple, predictable entitlement.

## D010 --- No renewal/reactivation

**Decision:** paid active 1 year, then 30-day grace, then deletion.\
**Why:** scope discipline; avoids renewal state/billing complexity.

## D011 --- 500 means people capacity

**Decision:** entitlement counts invited people, not guest rows.\
**Why:** family/party entries otherwise make limits unfair and
misleading.

## D012 --- Generic events model

**Decision:** up to 5 events with guest-event assignments.\
**Why:** supports ceremony/reception/other events without hard-coded
columns.

## D013 --- Single-use personalized activation

**Decision:** opaque URL credential activates scoped server session
once.\
**Why:** limits damage from copied/history/logged personalized URLs.

## D014 --- QR credential separate from guest activation

**Decision:** separate credentials and scopes.\
**Why:** check-in and invitation access have different security
semantics.

## D015 --- Themes share one data contract

**Decision:** theme changes presentation, not domain content/business
logic.\
**Why:** prevents ten divergent applications.

## D016 --- Direct-to-R2 temporary upload

**Decision:** presigned upload → validation/finalization → variants.\
**Why:** avoids proxying large media through app while preserving
validation.

## D017 --- Provider webhook/reconciliation is payment truth

**Decision:** browser return cannot mark paid.\
**Why:** payment correctness and fraud resistance.

## D018 --- No admin UI MVP

**Decision:** privileged operations via audited CLI/scripts.\
**Why:** saves scope; small launch team.

## D019 --- Local + production only

**Decision:** no permanent staging.\
**Why:** keep ops small; CI + local/provider sandbox + careful
production deploy.

## D020 --- Database roll-forward

**Decision:** app image may roll back; DB schema does not.\
**Why:** migration rollback is unsafe; use compatible migrations.

## D021 --- Privacy-safe share metadata

**Decision:** personalized preview never reveals guest identity;
password invitations use generic safe metadata.\
**Why:** link previews are cached/copied outside controlled page access.

## D022 --- Financial retention separated from invitation data

**Decision:** retain only minimal accounting data after product purge.\
**Why:** accounting needs must not justify retaining guest PII/media.

## D023 --- No collaborator/ownership transfer MVP

**Decision:** exactly one owner; staff check-in is scoped operational
access.\
**Why:** collaboration creates complex authorization/support cases;
schema remains future-ready.

## D024 --- No automatic duplicate merge

**Decision:** warn, then owner reconciles.\
**Why:** names/phones are imperfect identity signals and histories may
conflict.

## D025 --- Product defaults to noindex

**Decision:** invitations are link-accessible, not search-discoverable.\
**Why:** aligns with expected wedding-invitation privacy.

## D026 --- No self-service account email change in MVP

**Decision:** MVP does not include a self-service account email change flow;
the verified email remains the account identifier. Any future email migration
requires an explicit product/security decision and a new ticket.\
**Why:** avoids adding identity-recovery, uniqueness, verification, and
security-notification complexity to the MVP account surface.
