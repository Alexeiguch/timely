# Master implementation prompt

You are building a personal planner as a complete Next.js web application and an Expo React Native application for iOS and Android. The web is a full planner, synchronized with mobile. Read and follow the repository's `AGENTS.md` and all canonical files under `docs/planner/`.

Deliver a working application, not only a plan, mockup, scaffold or collection of placeholder screens. Execute the staged instructions in order and preserve durable progress after each milestone. Routine engineering decisions are yours; ask only for materially missing requirements or externally required credentials/authorization.

## Required outcome

Users sign in through Apple, Google or email OTP. Use self-hosted Better Auth in the Next.js backend with Neon Postgres, not managed Neon Auth. Verify the native sign-in flow before relying on it. Use native Apple on iOS, native Google on iOS/Android, and supported provider browser flows for web and Apple on Android. There is no phone/SMS or password requirement.

Users create dated tasks with optional start time, duration, priority, notes, reminders and customizable recurrence. They complete or skip individual occurrences, move tasks by one tap or drag, and edit recurring tasks with an explicit scope chooser. Tasks become overdue according to the shared time contract; they are never automatically completed. Original dates and completion history survive rescheduling and recurrence edits.

Provide an obvious Day/Week/Month control, clear selected periods, horizontal period navigation, a date picker, rounded vertical task cards, Quick Add, an Overdue section, recurring-task grouping and progress, Review, Search and Settings. Both clients support full local editing and offline reload after initial online authentication. On reconnect, saved changes synchronize through the authenticated API and Neon. Automatically resolve same-field conflicts using deterministic latest-change-wins ordering.

Follow the exact design system: Baloo 2 headings, Nunito Sans body; primary `#1A5FCF`, secondary `#12459A`, lime `#E9FF72`, orange `#FFBC80`, background `#FAF9F1`, white surfaces, text `#14294D`, muted `#667389`; generous spacing, rounded components and restrained doodle illustrations. Do not replace the requested visual style with a generic dashboard.

For opted-in timed tasks, remind 30 minutes before start and 10 minutes after overdue. Untimed tasks use a configurable morning reminder, initially 09:00, and an overdue reminder the following morning. Cancel or revise reminders when tasks become terminal or change schedule. Support offline local notifications without double-sending equivalent remote reminders.

## How to work

1. Inspect the repository. Record existing stack and constraints.
2. Create `docs/progress.md` using the provided template.
3. Read `PRODUCT_SPEC`, `ARCHITECTURE`, `DESIGN_SYSTEM`, `DATA_MODEL`, `RECURRENCE_AND_TIME`, `OFFLINE_SYNC`, `NOTIFICATIONS` and `SOURCES`.
4. Start stage 00. Build the smallest real authentication proof, and retain it in the project.
5. Complete remaining stages with migrations, server handlers, local adapters, UI, tests and documentation.
6. Keep one shared business-domain implementation and shared sync contract across clients.
7. Check actual behavior, including offline reload, sync retries, time-zone changes, recurrence exceptions, native auth and notification cancellation.
8. Capture visual evidence from representative web and mobile screens. Iterate until they match the supplied design and remain accessible.
9. Prepare release instructions and report the final implemented behavior, evidence and remaining external blockers.

You may introduce small justified dependencies but must document their purpose and compatibility. Do not silently change the authentication provider, remove offline editing, simplify flexible recurrence to a few presets, ignore recurring history, or disable tests to make the build pass.

If credentials or hardware are missing, prepare all unaffected implementation and clear verification instructions. Distinguish a documented feasible flow from one actually exercised with real credentials. Do not mark production gates passed based on stubs.

Begin implementation now by inspecting the repository and establishing the authentication proof and progress record.
