# Wedding Platform Documentation Pack

Generated from the current MVP spec, architecture draft, market-research
context, and the completed product/architecture interview.

## Start Here

1.  `docs/PRODUCT.md` --- what the MVP does and its business rules.
2.  `docs/ARCHITECTURE.md` --- how it must be built and architectural
    invariants.
3.  `docs/DATA_MODEL.md` --- conceptual relational model.
4.  `docs/STATE_MACHINES.md` --- lifecycle transitions.
5.  `docs/SECURITY.md` --- security/privacy baseline.
6.  `docs/OPERATIONS.md` --- deploy, jobs, backup, incidents.
7.  `docs/TESTING.md` --- required verification.
8.  `docs/DECISIONS.md` --- ADR-lite for choices likely to be reopened.
9.  `docs/API_CONTRACTS.md` --- internal mutation/read contract conventions.
10. `docs/backlog/README.md` --- stable execution specification and ticket index.
11. `AGENTS.md` --- permanent operating contract for coding agents.
12. `docs/IMPLEMENTATION_WORKFLOW.md` --- ticket-to-PR execution, verification, documentation, and completion workflow.

The original draft files remain separate; this pack is the consolidated
v2 implementation baseline.

13. `docs/UX.md` --- actors, navigation, user flows, screen inventory,
    states, and wireframe plan.

14. `docs/WIREFRAMES_BATCH_1.md` --- low-fidelity critical vertical slice wireframes for acquisition, creation, publication, guest distribution, and RSVP.

15. `docs/WIREFRAMES_BATCH_2.md` --- low-fidelity monetization wireframes for trial status/expiry, invitation-scoped checkout, QRIS pending/retry, activation success, and payment receipt.

16. `docs/WIREFRAMES_BATCH_3.md` --- low-fidelity event-operations wireframes for scoped staff access, QR scanning, check-in, repeat/wrong-event handling, manual search, and audited correction.

17. `docs/WIREFRAMES_BATCH_4.md` --- low-fidelity secondary-product wireframes for guest import, guestbook moderation, media/music, e-angpao, sharing/privacy, export, grace, and destructive deletion flows.

18. `docs/WIREFRAMES_INDEX.md` --- consolidated index and cross-batch implementation invariants for the complete MVP low-fidelity wireframe set.
19. `docs/UI_COMPONENT_CONTRACTS.md` --- shared UI/domain presentation contracts and authority boundaries.


## Implementation Reconciliation

The MVP wireframes WF-01–WF-35 have been reconciled into the implementation backlog. See `docs/backlog/WIREFRAME_TRACEABILITY.md` for screen-to-ticket ownership and `docs/backlog/00-foundation.md` (`FOUND-008`) for the shared UI design-system foundation. There is intentionally no separate frontend-only feature backlog.


## Coding-Agent Execution Model

The implementation workflow is now explicitly agent-ready. `AGENTS.md` defines the permanent rules every coding agent must follow; `docs/IMPLEMENTATION_WORKFLOW.md` defines the Ready → Context → Plan → Implement → Verify → Review → Done lifecycle. GitHub Issues/Projects are the intended live progress system, while the Markdown backlog remains the stable specification. `.github/ISSUE_TEMPLATE/implementation-ticket.yml` and `.github/PULL_REQUEST_TEMPLATE.md` provide the execution and review gates.

Do not create or maintain a duplicate `PROGRESS.md`. Source-of-truth documents are updated only when an approved behavior/contract changes, not merely because implementation status changed.

## Local Development with Docker Compose

Requirements: Docker Desktop (or Docker Engine) with Compose v2.

Start the PostgreSQL database and Next.js development server:

```sh
docker compose up --build
```

Open <http://localhost:3000>, or from another device on the same network use
`http://<IP-LAN-komputer>:3000`. The app container waits for PostgreSQL to be
healthy, installs the locked pnpm dependencies, applies existing Prisma
migrations, and starts Next.js with hot reload. Development configuration is
defined directly in `compose.yaml`; no `.env` file is required. Next.js and
Better Auth allow localhost plus common private LAN ranges (`192.168.x.x` and
`10.x.x.x`).

Useful commands:

```sh
docker compose exec app pnpm test
docker compose exec app pnpm lint
docker compose down
```

PostgreSQL is available from the host at `localhost:5432` and is not published
to the LAN. The database is stored in the `postgres_data` named volume; remove
it only when you intentionally want a fresh local database
(`docker compose down -v`).
