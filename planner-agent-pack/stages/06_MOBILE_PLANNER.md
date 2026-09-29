# Stage 06 — Expo iOS and Android planner

## Goal and dependencies

Deliver the same task capabilities through native interactions. Stages 01–04 supply auth, primitives, domain, API and local store; stage 05 gives a reference product flow. Read [product](../PRODUCT_SPEC.md), [design](../DESIGN_SYSTEM.md), [sync](../OFFLINE_SYNC.md) and [recurrence/time](../RECURRENCE_AND_TIME.md).

## Implement

1. Expand Expo Router's authenticated navigation into the four bottom destinations: Planner, Review, Search and Settings. Handle auth loading/restoration without a blank-screen race or perpetual spinner.
2. Implement Day/Week/Month control, selected date/range, Today/date picker and swipe navigation. Week on phones uses day strips/grouped agenda, not compressed columns. Month uses a readable calendar plus grouped/individual detail cards.
3. Build virtualized rounded task lists and occurrence groups. Reuse the same shared queries, status calculation and priority labels as web. Maintain correct React keys through completion, reordering and rescheduling.
4. Implement Quick Add and the full editor through accessible sheets/screens, keyboard-aware layouts and native-friendly date/time inputs. Time and duration can be cleared independently.
5. Implement recurrence presets/custom fields, summaries, invalid-date warnings and preview with the exact shared engine. Use the same edit-scope choice and history behavior as web.
6. Implement Complete/Reopen, Skip/Unskip, Move to today/date, scoped Delete and short Undo. Long-press drag may move/reorder; one-tap and menu alternatives remain available. Keep vertical scrolling natural and gestures distinguishable.
7. Display local-save/sync status, react to network/foreground transitions, preserve offline edits across process restarts and handle sign-in expiry without losing data.
8. Add safe occurrence/date deep links and routing from future notifications. Verify account ownership before displaying or mutating a deep-linked item.
9. Integrate detection of current IANA zone and foreground zone changes. Feed device zone into shared local calculations and server registration without converting authored civil fields into fixed UTC values.

Use native-safe components and Expo-compatible Gesture Handler/Reanimated versions. Do not embed the web planner in a WebView. Share business rules and tokens while adapting interaction/layout for each platform.

## Platform details

Respect iOS/Android safe areas, bottom bars, keyboard insets, Back behavior, sheet dismissal and text scaling. Distinguish pull-to-refresh from drag-to-move and horizontal date swipes. Use tactile feedback sparingly where available; motion/haptics are not the only confirmation.

Render shipped fonts locally. Match the web palette and shape tokens. Use natural reading order and accessibility checked/selected states. Ensure a completion hit target is large even if its circle visual is small. Doodles should be lightweight and must not delay startup.

## Verification and acceptance

- iOS and Android development builds run the core planner flows with actual local persistence.
- Automated/native flow evidence covers creation, completion, skip, reschedule, recurrence scope and navigation.
- Airplane-mode create/edit/state changes survive force-close/relaunch, then converge after reconnection.
- Cross-device checks between web and mobile preserve distinct-field changes and automatically apply same-group winners.
- Zone changes, DST fixture views and overnight durations match the shared contract.
- Long titles, large accessibility text, 320–430 px phones, landscape and keyboard-open editors remain usable.
- Signed-out or wrong-account deep links do not expose tasks or perform writes.
- Native auth from stage 00 is rechecked with the final installed dependency matrix.

Capture seeded screenshots on both platforms for Day, Week, Month grouped, editor, overdue and completion states. Mark unavailable hardware/provider checks as external blockers, not passes. System notification delivery is implemented next.
