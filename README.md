# timely

**Your day, your pace.**

A personal planner with room to breathe. Capture a plan in a sentence, see the day in front of you, and pick the thread back up on the web or on your phone. Same account. Same plans. Even when the connection drops.

<p align="center">
  <img src="docs/readme/web-day.png" alt="Timely day view on the web, with a short list of plans and a small progress card" width="920">
</p>

## A little space for what matters

Web and mobile share one planner. Day, week, and month are three ways to look at the same work.

<p align="center">
  <img src="docs/readme/web-month.png" alt="Timely month view on the web, with a calendar and the plans for the selected day" width="920">
</p>

Add a task with a title alone. Time, duration, priority, notes, and repeat rules stay optional until you want them. When a repeating plan changes, Timely asks whether that change is just this once or from here on.

<p align="center">
  <img src="docs/readme/web-editor.png" alt="Task editor on the web, with title, date, time, duration, and priority" width="920">
</p>

## In your pocket

The iPhone app is the same planner, built for a thumb: a day list, a week strip, a month you can scan, and a review of the little wins.

<p align="center">
  <img src="docs/readme/ios-day.png" alt="Timely day planner on iPhone" width="200">
  <img src="docs/readme/ios-week.png" alt="Timely week planner on iPhone" width="200">
  <img src="docs/readme/ios-month.png" alt="Timely month planner on iPhone" width="200">
  <img src="docs/readme/ios-review.png" alt="Timely review screen on iPhone, showing completed and open plans" width="200">
</p>

## What you can do with it

- Plan a day, a week, or a month, and jump back to today in one tap.
- Complete, skip, move, or edit a plan without losing its history.
- Repeat something daily, weekly, or on your own rule, and keep past occurrences intact.
- Work offline after you sign in. Edits stay on the device and sync when you are back.
- Review what you finished, what you skipped, and what is still open.
- Sign in with a six-digit email code, Google, or Apple.

<p align="center">
  <img src="docs/readme/web-sign-in.png" alt="Timely sign-in screen, with Google, Apple, and email code options" width="920">
</p>

## Run it locally

You need Node 22.13 or newer, pnpm 10.7, and Docker for local Postgres and mail.

```sh
pnpm install --frozen-lockfile
docker compose up -d
cp apps/web/.env.example apps/web/.env.local
# Put a random 32+ character value in BETTER_AUTH_SECRET.
DATABASE_URL=postgres://timely:timely@127.0.0.1:5432/timely pnpm db:migrate
pnpm dev
```

Open http://localhost:3000 and sign in with any `@example.test` address. The code arrives in the local inbox at http://localhost:8025. The iOS and Android app is an Expo development build:

```sh
pnpm dev:mobile
```

Setup for Google, Apple, hosted email, and Neon is in [docs/setup.md](docs/setup.md). Product behavior lives in [docs/planner](docs/planner/README.md). What is finished, and what is not, is tracked in [docs/progress.md](docs/progress.md).

```sh
pnpm typecheck
pnpm test
pnpm lint
```

## Where it stands

Timely is in active development. The web planner and the iOS app can sign in, keep plans on the device, and sync them back. Local reminders and Expo remote push are implemented, with remote delivery tested on the development iPhone. Android on a device, hosted reminder delivery, and a store release are still ahead.
