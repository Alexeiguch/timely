# App design system

## Visual intent

Build a playful, modern, friendly and premium planner. Rounded components, expressive headings, generous space, selective color and simple doodle illustrations give the interface personality. Most screens remain warm and neutral. This is the owner's supplied visual direction and applies to both web and mobile.

## Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `brand.primary` | `#1A5FCF` | Primary actions, active navigation, links |
| `brand.secondary` | `#12459A` | Hover/pressed states, headers, occasional dark sections |
| `accent.lime` | `#E9FF72` | Highlights and selected feature cards |
| `accent.orange` | `#FFBC80` | Highlights, gentle overdue or progress accents |
| `background` | `#FAF9F1` | Main screen background |
| `surface` | `#FFFFFF` | Cards, panels and sheets |
| `text.primary` | `#14294D` | Main text and icons |
| `text.muted` | `#667389` | Secondary text and inactive items |

Use white text on dark brand blue, navy text on lime/orange, and verify actual contrast rather than relying on approximate supplied ratios. Optional derived tokens for separators, input borders and focus rings must be documented and tested. Do not modify the eight supplied colors. Error/success semantic tokens may be added where needed; status must also have text/icon cues.

The main relationship is dark primary, soft orange, playful secondary accents and warm neutrals. Avoid filling every task card with saturated blue. Use orange or a subtle orange tint for overdue accents, with a readable **Overdue** label. Priority uses compact words and a restrained accent; never encode priority by color alone.

## Typography

Choose **Baloo 2** for headings and **Nunito Sans** for UI/body, consistently across platforms. The supplied alternate spelling “Freedoka” is not the selected font; do not fetch an unknown font under that name. Bundle mobile fonts and self-host/cache web font assets so existing screens render offline. Include font license files.

| Role | Size | Weight | Notes |
| --- | --- | --- | --- |
| Hero | 48–64 px | 800 | Optional onboarding/large empty-state use; not required on every screen |
| Screen title | 28–34 px | 700–800 | Expressive but concise |
| Section title | 22–26 px | 700–800 | Strong hierarchy |
| Card title | 16–18 px | 700 | Wrap gracefully; do not hide every long title |
| Body | 15–17 px | 400–500 | Comfortable reading |
| Caption | 12–14 px | 500–600 | Dates, hints and supporting labels |

Use only shipped font weights. The owner suggested hero weights up to 900; use the highest genuine available weight (800 for the selected Baloo 2 family) rather than synthesize an unsupported face. Do not use a heavy display face for dense body text. Important progress numbers may be 32–48 px where space allows. Respect platform text scaling, wrapping and locale-dependent number width.

## Shape and spacing tokens

| Token | Value |
| --- | --- |
| Small radius | 12 px |
| Medium radius | 18 px |
| Card radius | 20–24 px; default 24 |
| Large container | 28–32 px; default 32 |
| Pill | 999 px |
| Spacing scale | 4, 8, 12, 16, 24, 32, 48, 64 px |
| Horizontal phone padding | 20–24 px; default 24, compact fallback 20 |
| Card padding | 16–24 px; default 20 |

Use density adaptations thoughtfully on narrow screens, not arbitrary values everywhere. Native dimensions use logical units corresponding to design px. Small dividers and outlined icons may require 1–2 px strokes independently of the spacing scale.

## Components

**Task card:** white surface, 24 px radius, subtle border or minimal shadow, clear title, 24 px completion visual inside a generous hit target, optional time/duration, a compact priority pill, recurrence hint and accessible menu. Overdue highlight should be an accent/label, not a continuous flashing animation. Completed cards may be subdued but their readable text must remain accessible.

**Buttons:** primary blue with white bold text, 18–24 px radius, comfortable horizontal padding and at least a 44 px interactive target (prefer 48 on mobile). Support loading, disabled, pressed, hover and focus states. Do not lower disabled opacity so much that important explanatory text becomes unreadable.

**Chips:** full radius, compact high-contrast labels. Make selected weekday/recurrence chips visibly selected through more than hue. A row of chips must wrap or scroll clearly without hiding choices.

**Period control:** three adjacent rounded choices, a clear selected state and stable dimensions. Week/month/date headings must not jump when content changes. Provide keyboard navigation and descriptive accessibility labels.

**Forms:** visible labels, helper/error text, rounded fields and an inline readable summary of date/recurrence/reminder effects. Use progressive disclosure, but essential save behavior must remain obvious. Sheets on mobile respect the keyboard and safe area; dialogs on web trap/restore focus correctly.

**Progress group:** bold task title, a useful progress number, status legend, horizontal occurrence markers with date labels and an accessible equivalent list. Upcoming, completed, skipped and overdue markers remain distinguishable without color. Expose status and date to assistive technology.

**Empty states:** a short actionable sentence and an original simple doodle. Do not add illustrations where dense data needs the space. Loading shells should preserve overall layout and avoid dramatic flashing.

## Icons and illustrations

Use Lucide on both platforms, normally 20–24 px, stroke 2–2.5 px, with rounded caps. Give icon-only controls accessible names. An active navigation icon may have a blue rounded background and stronger stroke; inactive items use muted text/icon styling.

Doodles should use slightly imperfect simple lines, one or two colors, little/no shading, friendly proportions and clear silhouettes. Prefer original lightweight vector assets for repo-native illustration. Do not trace or import another app's artwork. Check licenses for external assets. Keep decorative illustration hidden from screen readers; meaningful illustration needs useful alternative text.

## Layout and responsiveness

Avoid pure-white full-screen backgrounds; use the warm background with white cards. Phones use the four-destination bottom navigation. On desktop, use a sidebar or header and a content width that keeps Day cards readable; Week may expand into columns. Compact web should feel like the same product, not a separate generic dashboard.

Design widths: 320–430 px phone, 768 px tablet, and 1280–1440 px desktop. Support landscape, long titles, large text, safe-area insets and keyboard opening. At small widths, reduce padding before reducing text readability. Prevent horizontal overflow outside intentionally scrollable occurrence/weekday strips.

## Motion and feedback

Use small, purposeful animations for completion, card movement, sheet entry and mode changes. Target approximately 120–220 ms for common transitions. Respect reduced motion on each platform. Swipe-to-navigate must not conflict with horizontal occurrence scrolling or drag-to-move. Long press may start mobile dragging; scrolling remains easy. Every gesture has an explicit button/menu equivalent.

## Accessibility and visual acceptance

- Verify normal text at 4.5:1 contrast and large text/non-text UI at the applicable 3:1 target, including chips and focus indicators.
- Web supports keyboard creation, completion, navigation and moving; focus is visible and predictable.
- Native controls expose roles, labels, selected/checked states and meaningful reading order.
- Preserve usable layouts at 200% web zoom and large native text settings.
- Use animation plus label/icon for overdue, never animation alone.
- Capture the same seeded tasks on web and mobile: Day, Week, Month grouped, editor recurrence, overdue, Review and Settings.
- Check the supplied color values, actual font families/weights, radius and spacing against screenshots. Iterate before calling the visual stage finished.

Dark mode is deferred. Do not invent a second palette before the supplied light design is implemented.
