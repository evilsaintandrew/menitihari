# Coding Agent Operating Contract

This repository is specification-driven. Coding agents must treat the documentation in this repository as the source of truth and use backlog ticket IDs as the unit of implementation work.

## 1. Source-of-Truth Order

Before implementing a ticket, read only the material needed for that ticket, but never skip the relevant source-of-truth documents.

Always inspect:

1. `AGENTS.md` (this file).
2. The target ticket in `docs/backlog/`.
3. `docs/ARCHITECTURE.md` for architectural invariants.
4. `docs/TESTING.md` for required verification.

Read when relevant to the ticket:

- `docs/PRODUCT.md` — product/business rules.
- `docs/STATE_MACHINES.md` — lifecycle and transition rules.
- `docs/DATA_MODEL.md` — persistence concepts and relationships.
- `docs/API_CONTRACTS.md` — server mutation/read contracts.
- `docs/SECURITY.md` — authorization, privacy, tokens, abuse controls.
- `docs/OPERATIONS.md` — jobs, deployment, backup, incidents, runtime concerns.
- `docs/UX.md` — navigation, responsive behavior, screen states, UX rules.
- `docs/WIREFRAMES_INDEX.md` and the referenced `docs/WIREFRAMES_BATCH_*.md` — approved low-fidelity UI contract.
- `docs/DECISIONS.md` — existing decisions that must not be silently reopened.
- `docs/backlog/WIREFRAME_TRACEABILITY.md` — screen-to-ticket ownership.

If documents appear to conflict, do not choose silently. Prefer the more specific approved contract, then stop and report the conflict if it materially changes product behavior, security, architecture, data semantics, or lifecycle rules.

## 2. Unit of Work

- Implement one backlog ticket at a time unless the user explicitly asks for a coordinated group.
- A ticket ID remains stable across documentation, GitHub Issue, branch/PR, and completion report.
- Implement the ticket scope plus only the supporting refactors/migrations necessary to make it correct.
- Do not opportunistically implement adjacent backlog or Post-MVP scope.
- Respect ticket dependencies. If a dependency is missing, either implement only a minimal prerequisite explicitly allowed by the ticket or report the block.

## 3. Before Coding

Inspect the current repository first. Do not assume files, frameworks, dependencies, schemas, or infrastructure exist merely because the specification describes the intended end state.

Create a concise execution plan covering:

- target ticket and dependencies;
- acceptance criteria being implemented;
- likely modules/files affected;
- migrations or API-contract impact;
- security/lifecycle risks;
- required automated and manual verification.

Do not create a permanent planning document for routine tickets unless requested; the plan may live in the agent's task/PR notes.

## 4. Implementation Rules

- Server-side rules are authoritative for authorization, invitation lifecycle, payment state, RSVP eligibility, QR/check-in eligibility, destructive actions, and other security-sensitive state.
- Validate untrusted inputs at trust boundaries.
- Preserve transactionality and idempotency where required by the specification.
- Never leak PII, access tokens, QR payloads, secrets, or sensitive provider payloads into logs or analytics.
- Keep domain behavior separate from presentation concerns where the architecture requires it.
- User-facing tickets are end-to-end work: UI-only or backend-only completion does not satisfy the ticket unless the ticket explicitly says so.
- UI implementation must follow the referenced wireframe's hierarchy, states, responsive behavior, and interaction contract. Low-fidelity wireframes are behavioral contracts, not pixel-perfect visual specifications.
- Shared UI primitives belong to `FOUND-008`; do not create incompatible one-off patterns without a documented reason.
- Do not add excluded/Post-MVP technologies or features unless explicitly promoted by a product/architecture decision.

## 5. Ambiguity and Decision Policy

Agents may decide routine implementation details that do not change an approved contract, for example internal naming, local component decomposition, or equivalent library usage already allowed by the architecture.

Stop and surface a recommendation before implementing when a missing decision would materially change any of the following:

- product/business rule;
- architecture invariant or infrastructure choice;
- security/privacy boundary;
- lifecycle/state transition;
- data ownership/retention semantics;
- public/internal API contract relied on by other modules;
- payment or check-in correctness;
- approved UX behavior with user-visible consequences;
- MVP versus Post-MVP scope.

Do not invent constants that the source of truth intentionally leaves server/config authoritative (for example a deletion cooling-off duration represented by `cancellable_until`).

## 6. Verification Before Declaring Complete

Run the checks required by the ticket and `docs/TESTING.md`. At minimum, where the repository supports them:

- formatting/lint;
- type checking;
- relevant unit tests;
- relevant integration tests;
- relevant component/UI tests;
- build;
- relevant E2E journey for critical user-facing flows.

For UI work also verify the relevant desktop/mobile surfaces, applicable loading/empty/validation/error/success states, keyboard/focus behavior, and browser console errors.

Resource-conscious verification rules:

- Run verification commands serially, one at a time. Do not run build, tests, database setup, or browser checks concurrently when doing so could increase memory use.
- Always run builds with a 1 GB Node heap, for example `NODE_OPTIONS=--max-old-space-size=1024 pnpm build`.
- Integration tests that require PostgreSQL use a temporary disposable Docker container. Apply the checked-in migrations, point the test URL at that container, and remove the container after verification.
- Browser verification uses the `agent-browser` skill/CLI for dev-server and UI checks. Close the browser session when verification is complete.

Never report a check as passing if it was not run. If a check cannot run, state exactly why and what remains unverified.

## 7. Documentation Policy

Documentation is not a progress log.

Do **not** edit source-of-truth documents merely to say a ticket was implemented. Live progress belongs in GitHub Issues/Projects and PRs.

Update documentation in the same change when implementation legitimately changes or clarifies an approved contract, including product rules, architecture, state machines, data model, API contracts, security, operations, testing requirements, UX/wireframes, or an ADR-level decision.

Rule: **code must conform to documentation, or code and documentation must change atomically.**

Material decisions should be recorded in `docs/DECISIONS.md`. Routine implementation choices do not need an ADR.

## 8. Completion Report

At the end of a ticket, report:

- **Ticket** — ID and title.
- **Implemented** — concise summary of behavior delivered.
- **Acceptance Criteria** — pass/fail per criterion.
- **Verification** — commands/checks actually run and results.
- **UX Verification** — referenced WF IDs and states checked, if applicable.
- **Documentation** — files changed, or `No source-of-truth changes required`.
- **Deviations** — any approved or unresolved deviation; otherwise `None`.
- **Known Issues / Follow-ups** — concrete remaining work; otherwise `None`.
- **Ready for Review** — `Yes` only if all required acceptance/verification gates pass.

“Implementation complete” is not the same as `Done`. A ticket becomes Done only after the repository's review/CI/merge workflow is satisfied.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
