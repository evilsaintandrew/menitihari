# Implementation Workflow

This document defines the execution protocol from approved backlog ticket to merged implementation. It complements `../AGENTS.md`; it does not replace the product, architecture, UX, security, or testing specifications.

## 1. Systems of Record

Use each artifact for one purpose:

| Artifact | Purpose |
|---|---|
| `PRODUCT.md`, architecture/security/data/state/API/UX docs | What the product must do and the contracts it must preserve |
| `backlog/*.md` | Stable implementation specification and ticket IDs |
| GitHub Issue | Live execution record for one ticket |
| GitHub Project | Live status, priority, dependency, milestone, assignee/agent |
| Pull Request | Review boundary and exact proposed code/doc changes |
| CI | Independent automated verification |
| Git history | What actually shipped |

Do not create a separate `PROGRESS.md`. Do not use source-of-truth documentation as a day-to-day status tracker.

## 2. Recommended Project States

`Backlog → Ready → In Progress → In Review → Done`

Use `Blocked` when an external dependency or unresolved material decision prevents progress.

A merged PR is the normal boundary for moving an issue to `Done`.

## 3. Ticket Lifecycle

### Gate A — Ready

A ticket may move to `Ready` when:

- its required dependencies are complete or explicitly waived;
- acceptance criteria are sufficiently specific;
- relevant UX references exist for user-facing work;
- no known unresolved product/architecture decision blocks implementation.

If these conditions are not met, resolve the specification gap before coding.

### Gate B — Context

When work starts:

1. Assign/open the GitHub Issue for the exact backlog ticket ID.
2. Move it to `In Progress`.
3. Read `../AGENTS.md`, the ticket, `ARCHITECTURE.md`, and `TESTING.md`.
4. Read only the additional domain documents and WF references relevant to the ticket.
5. Inspect the current repository and recent changes before planning.

### Gate C — Plan

Produce a concise execution plan containing:

- ticket ID/title;
- acceptance criteria to satisfy;
- dependencies confirmed;
- modules/files expected to change;
- migration/API/security/lifecycle implications;
- verification plan.

A routine plan belongs in the task/issue/PR conversation, not a new permanent repository file.

### Gate D — Implement

Implement one coherent ticket end-to-end. Keep changes scoped. Add tests with the implementation rather than deferring them to a later “testing ticket” unless the backlog explicitly says otherwise.

For user-facing tickets, completion includes the relevant UI, server/domain behavior, persistence, state handling, and integration required by the ticket.

### Gate E — Verify

Run risk-appropriate checks. The expected baseline is:

1. lint/format checks;
2. typecheck;
3. unit tests for changed logic;
4. integration tests for boundaries/transactions/provider adapters as applicable;
5. component/UI tests for meaningful interaction states;
6. build;
7. E2E for critical journeys affected by the ticket.

Follow `TESTING.md` when it requires stricter or domain-specific scenarios.

For UI tickets, visually verify applicable referenced wireframes at representative mobile and desktop widths and exercise relevant loading, empty, validation, success, error, dialog/sheet, keyboard/focus, and recovery states. Low-fidelity wireframes define behavior and hierarchy; they are not pixel-diff targets.

If verification fails, the issue stays `In Progress`. Do not downgrade or delete tests to obtain a green result unless the specification itself is being intentionally corrected.

### Gate F — Review

Open a PR using `../.github/PULL_REQUEST_TEMPLATE.md` and move the issue to `In Review`.

The PR should:

- reference the backlog/GitHub ticket;
- explain user-visible/domain behavior changed;
- list WF references where applicable;
- disclose migrations/config/security implications;
- report actual verification performed;
- include source-of-truth documentation changes only when contracts changed;
- explicitly identify deviations and unresolved follow-ups.

CI must repeat the repository's automated gates independently of the coding agent's local checks.

### Gate G — Done

Move the issue to `Done` only after:

- acceptance criteria pass;
- required tests/checks pass;
- required review is complete;
- CI is green;
- the PR is merged;
- any required atomic documentation update is included.

An agent's completion report alone does not make a ticket Done.

## 4. Documentation Change Decision

At the end of implementation, ask: **Did behavior or an approved contract change?**

If **no**, do not update source-of-truth docs just to record completion. The Issue/PR/Project already records progress.

If **yes**, update the relevant documentation in the same PR. Examples:

- business rule → `PRODUCT.md`;
- architecture/infrastructure invariant → `ARCHITECTURE.md` and possibly `DECISIONS.md`;
- state transition → `STATE_MACHINES.md`;
- schema/data semantics → `DATA_MODEL.md`;
- server contract → `API_CONTRACTS.md`;
- authorization/privacy/abuse rule → `SECURITY.md`;
- runtime/job/deploy behavior → `OPERATIONS.md`;
- required verification → `TESTING.md`;
- navigation/interaction/state behavior → `UX.md` / `WIREFRAMES_*.md`;
- material reopened choice → `DECISIONS.md`.

Never let code silently drift from the documentation.

## 5. Prompt Contract for Coding Agents

Once this workflow and `../AGENTS.md` exist in the implementation repository, the normal user prompt can stay short:

> Implement `TICKET-ID`. Follow `../AGENTS.md` and `IMPLEMENTATION_WORKFLOW.md`. Inspect the current repository and ticket dependencies first. Implement only the ticket scope plus necessary supporting changes, run all required verification, and finish with the required completion report. Do not declare it ready for review while any acceptance criterion or required check is unresolved.

For a coordinated set of tightly coupled tickets, explicitly list all ticket IDs and ask the agent to preserve each ticket's acceptance criteria and completion reporting. Default remains one ticket per PR.

## 6. Completion Report Template

```text
Ticket
TICKET-ID — Title

Implemented
- ...

Acceptance Criteria
- PASS — ...
- PASS — ...

Verification
- PASS — lint: <command>
- PASS — typecheck: <command>
- PASS — tests: <command/result>
- PASS — build: <command>

UX Verification
- WF-xx — mobile/desktop + relevant states checked
(or N/A)

Documentation
No source-of-truth changes required.
(or list changed documents and why)

Deviations
None.

Known Issues / Follow-ups
None.

Ready for Review
Yes
```

If anything required is unverified or failing, use `Ready for Review: No` and state the blocker.

## 7. Branch and PR Convention

Recommended, not product-critical:

- Branch: `<type>/<ticket-id>-short-slug`, e.g. `feat/guest-003-party-management`.
- PR title: `<type>(<TICKET-ID>): short description`.
- Keep one primary ticket per PR unless atomicity genuinely requires a small coordinated group.

## 8. Milestone Acceptance

Ticket-level green checks are necessary but not sufficient. At the end of each milestone in `backlog/README.md`, run an integrated acceptance journey across the milestone's features.

The Golden E2E journey in `TESTING.md` should grow with implementation and act as the MVP integration heartbeat. Do not wait until launch to connect all critical flows for the first time.

## 9. Parallel Agent Work

Multiple coding agents may work in parallel only when dependencies and file ownership make conflicts manageable.

Prefer parallel tickets that:

- do not modify the same migrations/contracts/shared primitives simultaneously;
- have completed dependencies;
- have distinct ticket IDs and PRs;
- use the same source-of-truth branch/revision.

Before merging parallel PRs, rebase/update and rerun affected integration/E2E tests. Contract changes in one PR may invalidate assumptions in another; resolve that before merge.
