# 005 — Native design refinement and Hermes date formatting

Use the existing `@timely/design` palette, font families and shape scale. Applied the installed React Native skill and Expo’s official [design-system skill](https://github.com/expo/skills/blob/main/plugins/expo/skills/expo-design-system/SKILL.md), with [native UI guidance](https://github.com/expo/skills/blob/main/plugins/expo/skills/expo-native-ui/SKILL.md). The canonical Timely design and pinned Expo SDK 55 take precedence over generic semantic palettes or SDK 56-only library examples. No new UI framework or SDK upgrade was introduced.

The planner has one segmented period control, compact previous/date/next navigation, quiet sync status, a clear Add action and restrained progress emphasis. Collapsed overdue and terminal sections protect the primary task list. Cards retain wrapping titles, labelled priority/state, completion targets and an action menu. Original lightweight SVG artwork and native Google/Apple vector logos render offline. Shared primitives now have explicit button variants/loading states, selected chips and consistent typography/surfaces.

Native sheets have fixed headers and reachable Save footers. A recurring edit’s scope chooser is a separate step in the same sheet: the previous implementation appended it below a long form, leaving it off screen after Save. The form draft remains intact when returning to edit. Review/Search filters use disclosure while their downloaded date range remains visible. Dynamic text scaling remains enabled; no large-text acceptance claim is made yet.

## Runtime defects found and corrected

The initial unsigned simulator artifact could not access Keychain. The locally ad-hoc-signed build successfully requests/verifies email OTP and restores its cached account. Use normal signed development builds or the signed simulator command in `mobile-verification.md`; do not disable secure storage or weaken authentication.

After successful authentication, the old planner crashed under Hermes with `Missing internal slot calendar-id` when calling the Temporal polyfill’s `PlainDate.toLocaleString`. The shared `formatCivilDate` validates/extracts civil fields and gives native Intl an ordinary Date carrier with explicit UTC/Gregorian formatting. It never uses that carrier as a task scheduling instant; recurrence/time-zone calculations remain in the shared domain. A regression fixture covers leap day, an adversarial formatting zone, the lower calendar boundary and invalid input. Actual iOS Day/Week/Month rendering now passes.

A root route error boundary provides a retry screen for unexpected rendering failures without clearing saved plans. Native social buttons now check public backend availability and required native Google configuration, preserving email fallback.

## Scope of evidence

iPhone 17 Pro simulator, iOS 26.2, embedded Release bundle: real local SMTP OTP, authenticated planner, creation, daily recurrence, occurrence/future edit scopes, completion/Undo, all four destinations, search, backend-disconnected create/restart/complete/reconnect, sign-out and reauthentication/bootstrap. This is not physical-device airplane-mode, native provider OAuth, push, or Android runtime evidence. See QA evidence for exact results.
