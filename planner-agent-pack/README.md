# Personal Planner — agent implementation pack

Specification date: 29 September 2026. This is a development instruction pack, not an implemented application.

Build a full Next.js web planner and an Expo React Native iOS/Android planner that share one personal account, one task model, and one offline synchronization protocol. Apply the supplied playful blue, lime, orange, and warm-neutral design system.

## Start here

1. Put this folder in the target repository as `docs/planner/`.
2. Copy [AGENTS.md](AGENTS.md) to the repository root, merging it with existing instructions rather than discarding them.
3. Give the implementation agent [MASTER_PROMPT.md](MASTER_PROMPT.md).
4. Read the canonical contracts below before starting a stage. Run stages in the listed order.
5. Create `docs/progress.md` from [the progress template](templates/PROGRESS_TEMPLATE.md). Keep it current so another agent can continue reliably.

The owner has authorized writing these instructions. The implementation agent should work through authorized development without asking for confirmation at every stage. Provider credentials, domains, store accounts, and paid infrastructure are external dependencies; do not invent them or claim they have been verified.

## Canonical contracts

| File | Purpose |
| --- | --- |
| [PRODUCT_SPEC.md](PRODUCT_SPEC.md) | Scope, screens, behaviors, and product defaults |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, package boundaries, runtime and deployment choices |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Exact visual tokens and interaction requirements |
| [DATA_MODEL.md](DATA_MODEL.md) | Storage, API resources, ownership and historical records |
| [RECURRENCE_AND_TIME.md](RECURRENCE_AND_TIME.md) | Recurrence grammar, dates, overdue rules and edits |
| [OFFLINE_SYNC.md](OFFLINE_SYNC.md) | Local persistence, operations, last-change-wins and recovery |
| [NOTIFICATIONS.md](NOTIFICATIONS.md) | Before-task and overdue reminder delivery and cancellation |
| [SOURCES.md](SOURCES.md) | Primary documentation and feasibility findings |

These contracts contain deliberate engineering defaults where the owner did not choose a library or edge case. Record changes in an architecture decision record; never silently weaken an approved product requirement.

## Development stages

| Order | Stage | Required result |
| --- | --- | --- |
| 00 | [Authentication feasibility](stages/00_AUTH_FEASIBILITY.md) | Demonstrate the chosen web/native authentication path |
| 01 | [Foundation and design primitives](stages/01_FOUNDATION.md) | Working monorepo, tokens, migration/tooling setup |
| 02 | [Shared task and recurrence domain](stages/02_DOMAIN.md) | One deterministic implementation for all clients |
| 03 | [Database and authenticated API](stages/03_DATABASE_API.md) | Durable, authorized, versioned server behavior |
| 04 | [Offline storage and synchronization](stages/04_OFFLINE_SYNC.md) | Durable local edits and convergence on both platforms |
| 05 | [Web planner](stages/05_WEB_PLANNER.md) | Full usable responsive planner, including offline reload |
| 06 | [Mobile planner](stages/06_MOBILE_PLANNER.md) | Native iOS/Android planner with equivalent capabilities |
| 07 | [Reminders and notifications](stages/07_REMINDERS.md) | Offline local reminders and durable remote delivery |
| 08 | [Review, search and settings](stages/08_REVIEW_SETTINGS.md) | Progress, history, account and preference management |
| 09 | [Quality assurance and release](stages/09_QA_RELEASE.md) | Evidence, operational guides and release-ready builds |

## Authentication decision

Use **self-hosted Better Auth mounted in the Next.js backend, with Neon Postgres**. This is distinct from managed Neon Auth. The published managed provider API checked for this project accepts Google, GitHub, Microsoft and Vercel, but excludes Apple. Upstream Better Auth documents Apple/Google native ID-token exchange and Expo integration. The owner requested the pack after that recommendation; this pack proceeds with that architecture and makes real-device authentication the first gate.

No SMS or phone authentication. Email uses a one-time code, without requiring a password. Native Apple is required on iOS; Apple on Android uses the supported browser flow because Android has no Apple system sign-in sheet. Google uses native sign-in on iOS and Android. The web uses provider browser flows.

## Definition of a finished application

- Tasks, recurrence, completion, skip, priorities, rescheduling, review and settings work on web and mobile.
- Previously authenticated users can create, edit, complete, skip, move and delete locally, reload offline, and later sync.
- Repeated delivery does not duplicate tasks or operations; two devices converge predictably.
- Recurrence editing and rescheduling preserve completion history.
- Design tokens match the supplied system; keyboard access, screen-reader labels, contrast and reduced motion are verified.
- Reminders obey timing, permission, deduplication and cancellation rules, with documented platform limits.
- Production authentication and notifications have actual evidence; mocks are clearly identified.
- The repo includes setup, environment examples, migrations, tests, recovery and deployment documentation.

Do not add calendar integrations, widgets, collaboration, subscriptions, an AI assistant, or richer analytics to this release.
