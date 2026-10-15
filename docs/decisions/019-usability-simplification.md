# 019 — Simplify ordinary planner actions

Date: 2026-10-13. Status: accepted for local implementation.

The owner requested a thorough app-wide review to make Timely friendlier, simpler and easier to understand. Keep the approved visual system and shared task behavior. Reduce initial choices through progressive disclosure and correct misleading descriptions of implemented behavior.

Both editors keep recurrence presets, optional streak opt-in and preview ahead of custom recurrence controls. Web Quick Add starts with a title and readable date context; existing task edits reveal details. Its independently scrolling form body keeps Save available, and a changed draft requires an explicit discard. Mobile retains its existing draft/scope/keyboard-aware sheet behavior and gains labeled disclosures with expanded accessibility state, following the installed-version [React Native 0.86 accessibility contract](https://reactnative.dev/docs/0.86/accessibility#accessibilitystate).

The owner's 2026-10-13 follow-up moves the web unsaved-draft warning out of scrolling form content into a centered lime alert dialog. Opening it with [the native dialog `showModal` API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal) places it above the editor in the browser's top layer and makes the background inert. A 220ms slide/scale entrance respects the existing reduced-motion rule. Keep editing receives initial focus; it and Escape preserve the draft and restore editor focus. Only explicit Discard closes the editor without saving. Saved-task behavior is unchanged.

Web task cards keep completion and Edit visible and place secondary actions in standard HTML disclosures. All explicit move/order/skip/delete buttons remain available. Recurrence receives a textual hint, and completed checkboxes say Reopen. Empty states describe the actual context: finished work, an empty day, or an unsuccessful filtered search. Week-section Add uses that day's date; Add outside Planner uses today.

Search states its actual history range, puts the text query before filters and offers recovery from no results. Online history copy describes user outcomes instead of server snapshot internals. Review calls pending tasks unfinished and identifies its local coverage; its scheduled/elapsed formulas are unchanged. Both month representations are visible as choices on web.

Reminder settings prioritize the pending owner-selected daily summary while disclosing task defaults and technical status. The web task editor now writes real reminder opt-ins through the existing schema/local-first command path. Copy explains mobile permission and timing, without claiming browser/remote delivery. Account deletion stays available behind Manage account with its existing recent-auth and confirmation protections.

No new dependencies, migrations, providers, auth shortcuts, domain rules or deployment are required. Existing daily-summary changes are preserved. Native signed builds/exports are compile evidence; simulator sign-in presentation checks do not replace authenticated native flows, screen-reader/large-text acceptance or physical notification/provider proof. Detailed findings, remaining priorities and reproduction steps are in [the usability audit](../usability-audit.md); actual results are in [progress](../progress.md#usability-review--2026-10-13).
