# Stage 05 — full responsive Next.js web planner

## Goal and dependencies

Build a complete web workspace using the local-first repositories from stage 04 and the design primitives from stage 01. Read [product](../PRODUCT_SPEC.md), [design](../DESIGN_SYSTEM.md) and [recurrence/time](../RECURRENCE_AND_TIME.md). The web is a fully capable planner.

## Implement

1. Build the authenticated shell and Planner/Review/Search/Settings navigation, with responsive desktop/sidebar and phone/bottom-navigation layouts. Restore the previous mode/date safely; Today remains easy to reach.
2. Implement the visible Day/Week/Month control, date/range heading, Today, previous/next buttons, horizontal period gestures on touch and accessible date picker. Keep the focused anchor date when switching modes.
3. Build Day's vertical rounded task cards, compact Overdue section, optional time/duration/priority hints and collapsed completed/skipped section. Show derived overdue state live at due boundaries.
4. Build desktop Week columns and compact grouped agenda. Implement task drag between dates and manual reorder where appropriate, with an explicit Move menu/keyboard alternative. Moving a recurring occurrence writes an exception and preserves cadence.
5. Build Month's date overview, grouped recurring cards and horizontally scrollable labeled occurrence markers. Add Grouped/All occurrences toggle. One-off tasks and monthly single occurrences remain discoverable.
6. Build Quick Add and full task editor with progressive optional fields, meaningful validation, priority chips, Warn me switches, structured recurrence builder, readable summary and next-five preview.
7. Implement the post-edit/pre-save scope chooser for recurring content and scoped deletion. Provide complete, reopen, skip, unskip, move to today, date/time adjustment and Undo feedback through durable commands.
8. Integrate local query subscriptions, sync statuses, initial bootstrap, paginated/history coverage and auth expiry. Offline errors must not block locally available planning.
9. Deep link to a focused date/occurrence safely, checking ownership and current existence. Preserve useful navigation state in URLs where appropriate without exposing private note content.

Native-style gestures on web are enhancements; all functionality must work without them. Use semantic buttons/checkboxes and a keyboard-usable menu/dialog/date picker. Prevent horizontal swipes from stealing scroll inside occurrence strips. Do not duplicate the domain's state logic in presentation.

## Visual work

Follow supplied colors/fonts/radii rather than the default styles of a component library. Use navy text on warm background/white surfaces, blue primary actions, selective lime/orange highlights and sparse original doodles. Avoid a dense spreadsheet appearance in Day view. Include real content states, not only empty-state mockups.

Test long titles, mixed priorities, many overdue items, large text, empty ranges and narrow phones. Preserve layout while fonts/data load. Use restrained motion and reduced-motion alternatives.

## Verification and acceptance

- Playwright covers create/edit/complete/skip/move, all planner modes, recurrence preview/scopes and grouped/all consistency.
- A previously used planner reloads offline; edits persist and later sync with a second client.
- Date navigation, first-weekday preferences and time/duration overdue timing match shared fixtures.
- Dragging does not change occurrence identity or corrupt original dates; explicit move works by keyboard.
- Keyboard focus, checkbox semantics, menu/dialog focus restoration and contrast pass targeted accessibility checks.
- Screens are usable at 320, 390, 768, 1280 and 1440 px, and at 200% zoom.
- Seeded screenshots show Day, Week, Month, recurrence editor, overdue and completed states, matching the design tokens.

Do not count static UI placeholders as functional Review/Search/Settings; their detailed content is completed in stage 08. Document implemented routes and tests, update progress, and retain visual evidence for release QA.
