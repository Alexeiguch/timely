# Timely usability audit — 13 October 2026

## Conclusion

Timely's main structure is sound: four destinations, one date anchor, a shared task model, immediate local saves, and a warm visual identity. The largest obstacle was the amount of information users had to interpret before a simple action. Routine choices, recovery tools and implementation details often had the same visual importance. Several labels also described an earlier implementation instead of the behavior users actually received.

This review implements the most concrete improvements locally. It preserves the approved palette, recurrence rules, immutable task identities, completion history, account boundaries and the owner's pending daily-summary work. It does not claim that first-release acceptance, physical notifications, provider sign-in or every accessibility gate is complete.

## Review coverage and method

Reviewed the web and native entry points and their paths through sign-in, Planner (Day, Week, Month), task creation/editing, recurrence/streaks, completion/skip/reopen, moving/reordering/deleting, Review, Search, Settings, reminder preferences and offline/sync recovery. Read the canonical product/design/architecture contracts, stage tracker and relevant design/localization/reliability decisions. Inspected the existing web/native screenshot evidence and fresh desktop/320px Chrome screenshots.

Criteria: can a new user identify the next action; is the common path short; do labels explain outcomes; can the user recover safely; does the interface distinguish local saves from synchronization; are optional choices discoverable; and do comparable tasks behave consistently across clients?

This is an engineering and heuristic usability review, with automated real-browser workflows and a limited signed iOS simulator smoke. It is not a study with representative users. Findings about cognitive load are review judgments; verification results below are observed evidence.

## Findings and changes

Priority describes the effect on ordinary use, not a claim about data-security severity.

| Area | Finding | Priority | Result in this change |
| --- | --- | --- | --- |
| Web sign-in | Disabled, unconfigured social providers looked like broken choices. Absence explanations distracted from the working email path. | High | Render only available providers. Show the divider only when social sign-in exists. Keep error recovery and working email access. |
| Email code | Web repeated the recipient and expiry in two sections. | Medium | One recipient/expiry statement; short entry instructions in the code card. Preserve resend cooldown, autofill and validation. Prevent changing email while a request is running. |
| Quick Add | Web opened the full date/time/duration/priority/notes/repeat form for a title-only task. | High | Title, readable date context and Save are the initial view. Optional fields disclose on request; edits start with details visible. Native keeps its existing title-first path. |
| Editor language | Poetic editor headings made Add and Edit harder to distinguish; preview dates were raw storage strings. | Medium | Use Add task / Edit task headings. Format date context and next-repeat dates with the chosen language and shared civil-date formatter. |
| Editor exit | Web Cancel/Escape could silently lose a changed draft. | High | Ask before discarding; Keep editing preserves the draft, focuses the safe action, and Discard returns focus to the launch control. Block closing during save. |
| Editor length | Save was below long recurrence forms on web. | High | Give the form its own scrolling body with a persistent header/footer. Optional controls do not compete with the Save action. |
| Repeat customization | A common daily/weekly preset immediately exposed the entire recurrence grammar. | Medium | Keep preset choice, streak opt-in and preview visible; disclose advanced repeat customization on both platforms. Preserve custom selectors, intervals, end rules and existing values. |
| Invalid dates | Formatting a temporarily empty web date could throw while editing/searching. | High | Validate civil dates before formatting. Show useful date guidance; reject repeat selection without a date. Preserve normal form/domain validation. |
| Web task reminders | The editor showed a stale delivery-development notice instead of editable task reminder choices. | High | Add real per-task opt-in/before/overdue controls using the existing task schema and durable save path. Explain mobile permission and Settings timing without promising browser delivery. |
| Task cards | Web showed up to seven action buttons per card. Repetition was not stated on web; native had only an icon. | Medium | Keep completion and Edit visible. Put secondary web actions under More actions; add a readable Repeats hint on both clients. All explicit action alternatives remain available. |
| Completion control | Web called a checked completion box Complete even though clicking it reopened the task. | Medium | Use Reopen plus the task title for completed items. Preserve checkbox semantics and existing Undo. |
| Day empty state | A day containing only completed/skipped tasks looked like a completely empty day. | Medium | State that no unfinished tasks remain and point to completed/skipped items below. |
| Week creation | Add inside an empty web day used the overall anchor date instead of that column's day. Seven empty days also repeated the full illustration. | High | Pass the actual day into Quick Add. Use a compact No tasks for this day prompt in week sections. |
| Creation outside Planner | Web Add from Review/Search/Settings used the last planner date. | Medium | Use today outside Planner, as specified. Inside Planner, use the focused date. |
| Month representation | A single web button showed the current representation without making the alternative obvious. | Medium | Show Grouped and All occurrences together with explicit selected states, matching native choice semantics. |
| Search | Web said Search this month, displayed the planner range instead of the history range and said older history was unfinished. Search appeared after the filter form. | High | Put title/notes search first. Describe the selected history range accurately and explain how to change it. Keep authenticated online historical pagination. |
| No search results | Web reused the planner's Add something empty state. Native lacked a direct filter reset. | Medium | Explain that no plans match; offer Clear filters and date-range guidance on both clients. Keep saved data intact. |
| Filters | Web showed every advanced filter at once, while native lacked the pending/unfinished state choice. | Medium | Keep web dates visible and disclose status/priority/series filters; indicate active restrictions in the summary. Add native Unfinished filter and expanded-state semantics. |
| History source | Fixed server snapshot / downloaded plans wording exposed implementation concepts. | Medium | Say saved plans work offline and online history can find older account plans. Retain the explicit online action and return-to-saved-data path. |
| Review | Pending tasks were called still to come, including overdue tasks. Ratios and historical coverage could be misread. | High | Call them unfinished; label the numerator as tasks completed. State that progress reflects plans saved on this device. Preserve scheduled/elapsed denominators and skipped exclusion. |
| Reminder Settings | Daily summary, task defaults, permission status, scheduling budgets and remote testing were all presented at once. | Medium | Keep the daily summary prominent on native; show its time when enabled. Separate Task reminder defaults and Notification status. Retain permission controls and show denial guidance visibly. Web defaults are disclosed with a real local-save confirmation. |
| Account Settings | Delete account had similar visual prominence to routine actions. Retry was shown even with no pending work. | Medium | Put deletion behind Manage account with an explicit consequence; retain confirmation/recent-auth checks. Show retry when there are saved changes or native attention state. |
| Accessibility | Native disclosure controls had no explicit expanded state. Broad web finished-section typography leaked into the new card disclosure. | Medium | Expose expanded state and chevrons on native; use standard HTML details/summary on web. Give card disclosures explicit typography and focus indication. |

## Visual examples

Fresh synthetic-account evidence: [simple desktop task entry](evidence/usability-quick-add-desktop.png), [320px task entry](evidence/usability-quick-add-phone.png), and [clearer Search](evidence/usability-search-desktop.png).

## Interaction decisions

- Optional details are presentation state, not task state. Hiding fields keeps the values in the editor draft; saving still validates the complete task.
- The recurrence preview remains visible after selecting a preset, even with customization closed. Streak opt-in is still explicit and Skip restrictions are unchanged.
- More actions is an ordinary disclosure containing real buttons, not a custom ARIA menu with incomplete keyboard behavior.
- Reminder opt-in on web changes the real task data. Delivery remains governed by the existing mobile permission/device policies and external release gates.
- Search remains bounded to a visible date range of at most 366 days. This review does not silently change its scope to all account history.
- Review totals continue to use the current local projection; explicitly naming that coverage is safer than presenting a paginated remote result as a complete account total.
- Language stays device-specific; calendar/task/reminder preferences retain their existing synchronization rules.

See [ADR 019](decisions/019-usability-simplification.md).

## Remaining priorities

| Next priority | Why it remains | Concrete next verification/change |
| --- | --- | --- |
| Native keyboard, large text, VoiceOver/TalkBack and Android Back | Compilation and simulator launch do not prove these flows. | Exercise title-only Add, long optional editor, repeat customization and Settings disclosures on signed iOS/Android builds, at enlarged text sizes and with screen readers. Confirm Save remains reachable and focus returns correctly. |
| Equivalent web recurring-edit scope step | Web still offers the existing scope selector before saving; native has a separate apply-to step. Both preserve history, but they teach different interactions. | Move web scope selection into the same explicit pre-save step after testing occurrence/future/series changes, including edits to the recurrence itself. Do not silently expand an occurrence edit to a series edit. |
| More specific validation | Schema errors can still say Check the task fields for complex custom recurrence mistakes. | Map validation paths to localized inline field guidance; focus/open the affected section. Cover no weekday, out-of-range interval, invalid monthly dates and end-before-start. |
| Friendly recurrence terms | Some advanced fields still use occurrence, ordinal and series language. | Test simpler wording with users, then change labels while preserving the structured recurrence grammar and exact scope consequences. |
| Date presets in Search/Review | Explicit From/Through dates are accurate but require effort for common ranges. | Consider This month / Last month / Custom shortcuts without hiding the actual range or expanding offline promises. |
| Complete historical metrics | Current progress is scoped to saved local plans; paginated history is not a complete metric source. | Add an authenticated owner-scoped aggregate if full historical statistics are required. A partial page must never be presented as the whole denominator. |
| Dense month occurrence strips | Large recurring schedules remain a lot of information, especially on narrow phones. | Verify the existing scrollable marker lists with long titles, many occurrences and screen readers before changing their presentation. Keep date/status alternatives accessible. |
| Destructive/recovery discoverability | Discarding failed unsynced work remains an advanced, consequential choice. | Verify two-account/offline reauthentication and sign-out paths on native. Keep recovery explanations and normal retry ahead of discard. |
| Provider and notification release evidence | Existing external gates are unchanged by this presentation pass. | Follow [release readiness](release-readiness.md), [setup](setup.md#gentle-daily-summary), and [mobile verification](mobile-verification.md). Do not treat a disabled/unverified service as delivered. |
| User study | Heuristic simplification does not measure whether the intended audience understands it. | Ask representative Spanish/English users to add an untimed plan, edit one recurring date, move unfinished work and find last month's completed task without coaching. Observe confusion and task completion before adding onboarding. |

## Verification and reproduction

Final command outcomes and local artifact paths are recorded in [progress](progress.md#usability-review--2026-10-13). Browser fixtures use real SMTP capture, authenticated API handlers, PostgreSQL persistence and IndexedDB; only provider-availability failure is deliberately simulated in the existing recovery test. No production account or planner data is used.

```sh
# Local prerequisites: Docker/Mailpit running; the disposable test database is migrated.
APP_ENV=local MAIL_MODE=capture \
DATABASE_URL=postgres://timely:timely@127.0.0.1:5432/timely_daily_summary_20261012 \
BETTER_AUTH_URL=http://localhost:3017 pnpm build
APP_ENV=local MAIL_MODE=capture \
DATABASE_URL=postgres://timely:timely@127.0.0.1:5432/timely_daily_summary_20261012 \
BETTER_AUTH_URL=http://localhost:3017 pnpm --filter @timely/web start --port 3017
# In another terminal:
QA_SCREENSHOT_DIR=/tmp/timely-ux-evidence TEST_BASE_URL=http://localhost:3017 pnpm test:e2e
pnpm test
pnpm typecheck
pnpm lint
EXPO_NO_DOTENV=1 APP_VARIANT=development EXPO_PUBLIC_API_URL=http://localhost:3017 \
pnpm --filter @timely/mobile exec expo export --platform ios --platform android \
--output-dir /tmp/timely-ux-native-export-verified
```

`QA_SCREENSHOT_DIR` keeps fresh test screenshots from replacing historical repository evidence. Use local capture mode exclusively for synthetic `@example.test` accounts; retain the existing ignored auth secret locally. Native simulator smoke covers launch, language switching and sign-in-option recovery; authenticated mobile planner workflows, physical delivery and Android UI acceptance remain unverified in this pass.
