# Stage 01 — monorepo, app shells and design primitives

## Goal and dependencies

Establish a runnable workspace for both applications and the shared contracts. Retain the stage 00 proof. External authentication gates may remain blocked while this work continues. Read [architecture](../ARCHITECTURE.md) and [design system](../DESIGN_SYSTEM.md).

## Implement

1. Inspect the existing repository, package manager and user changes. Adapt rather than replace an established project.
2. Create the agreed pnpm workspace and logical package boundaries. Pin the toolchain, compatible Expo/native versions and lockfile. Define named scripts for web/mobile development, lint, types, unit tests, web E2E, DB migration, build and native development builds.
3. Set strict TypeScript, formatting/lint rules and package import boundaries. Guard against server/DB modules entering client/native bundles. Use environment validation with separate public and server schemas.
4. Expand the web and Expo shells with Planner, Review, Search and Settings routes and a usable four-destination navigation. Provide safe areas, error boundaries and realistic loading/empty/error states. No empty routes pretending to be finished features.
5. Create one serializable design-token package with the exact colors, radii, spacing and typography roles. Implement platform Button, Card, Text, Chip, Input, icon control, progress marker and period control components around these tokens.
6. Bundle Baloo 2 and Nunito Sans font files with genuine available weights and licenses. Web font assets and app shell must be cacheable for offline rendering. Prevent unnecessary typography flashes and verify native weight mappings.
7. Configure mobile development builds, URL schemes, bundle/package IDs and environment-specific EAS profiles. Keep placeholders clearly documented until the owner supplies real IDs.
8. Add a local-development seed/test-data strategy; fixtures contain synthetic personal tasks, not the owner's private data.

Use Tailwind for web presentation and React Native StyleSheet/token-based styles for native. Do not add a second styling framework merely to imitate web class names. Use React Native-compatible primitives for touch behavior and platform semantics.

## Documentation

Create root setup instructions covering prerequisites, dependency installation, environment examples, local commands, migrations, native build/test steps and known external dependencies. Keep `.env.example` values descriptive, never real credentials. Add an ADR for the auth choice, database driver, server worker and local-store adapters.

Use shared tool/test setup and retain `docs/progress.md`. Establish a small CI pipeline for type checks, domain tests, lint and web build. Native checks must match the pinned Expo matrix; avoid running slow unrelated suites after every small edit.

## Verification and acceptance

- A clean installation can run the web shell and native development application with documented commands.
- Type checks and representative builds pass for web, shared packages and native imports.
- Mobile routes/deep-link entry points resolve safely.
- Components use the supplied eight colors, font families, shapes and spacing; actual contrast is measured.
- Button/checkbox/menu primitives have keyboard or native accessibility semantics and 44–48 px touch targets.
- Large native text, 200% web zoom and a 320 px viewport remain usable.
- No secret appears in generated client assets, environment examples or logs.

Capture a web/mobile component gallery or seeded shell screenshot showing colors, card, button, chip and heading/body fonts. Update progress with the actual scripts, matrix and outcomes. The next stage builds business behavior behind these primitives.
