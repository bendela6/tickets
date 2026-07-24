# Claude Design prompt — Playground Workbench v2

Paste the block below into the Instrument design project (claude.ai/design, project `a75bdf6d…`).
Spec being designed: `docs/superpowers/specs/2026-07-24-playground-workbench-v2-design.md`.

After designing: keep results as `.dc.html` cards (suggested names: `Workbench.dc.html`,
`WorkbenchCode.dc.html`, `WorkbenchSource.dc.html`, `WorkbenchA11y.dc.html`,
`WorkbenchSplit.dc.html`, `WorkbenchMatrix.dc.html`, `WorkbenchPalette.dc.html`), then ask
Claude Code to pull via design-sync — it will update `docs/design/design-system.html` and
reconcile the v2 spec against the design before planning. Where design and spec diverge, the
design wins.

---

```
Design the "Playground Workbench" for the Instrument design system — the internal tool where we
browse, test, and document every UI component. This extends the existing gallery designs in this
project (see ComponentGallery.dc.html, Atomic Library.dc.html) and must use the established
Instrument vocabulary exactly: quiet-industrial, IBM Plex Sans for UI text, IBM Plex Mono for
labels/keys/code, paper background #F7F6F2 (dark: #1C1B18), ink #25231D, accent #4E46C6, danger
#A03028, hairline borders, radii 5/8/12px, uppercase 11px tracked section labels, 12px meta,
13px UI text. No new colors; semantic status colors come from the existing kind/opt palettes.

Screen: desktop, ~1440px wide, both light and dark theme variants.

LAYOUT
- Left sidebar (~224px, raised surface, hairline right border): a filter input at top
  ("Filter components…" with ⌘K hint chip), an "All" entry, then component links grouped under
  uppercase mono group labels (AI SESSION, DISPLAY, FORM CONTROLS, FOUNDATION, OVERLAYS, PICKERS).
  Active component gets an accent-subtle background + accent text.
- Main area, single component selected (use Button as the example):
  - Header row: component title (24px semibold) + group chip, right side: "Split themes" toggle
    and theme toggle button.
  - Tab strip: Preview | Code | Source | A11y (underline tabs, accent underline on active).
  - Below the tabs, a horizontal split: the STAGE (left, ~70%) and the CONTROLS RAIL (right,
    ~30%, resizable — show a subtle drag handle: 1px hairline that becomes accent on hover).

PREVIEW TAB (main design)
- Stage: the component's states grid (labeled cells like the existing gallery: component render
  + mono 11px caption under each) followed by a "Playground" card: live preview area (min 80px)
  rendering one Button, on a raised card with hairline border.
- Controls rail: one row per prop — uppercase mono label left, control right. Show all four
  control types: select dropdown ("variant: destructive"), select with "(unset)" option
  ("size: (unset)"), checkbox ("show spinner" checked, "disabled" unchecked), text input
  ("children: Delete forever"), number input with steppers ("max: 13").
- Under the playground: a PROPS TABLE — columns: prop, type, options/range, default, unset?
  Compact, mono values, hairline row separators.

CODE TAB
- Generated JSX snippet in a code block: dark inset surface (in light theme: #25231D-ish block
  with light syntax colors; in dark theme: slightly raised block), 13px mono, syntax-highlighted
  (tags accent-ish, strings green-ish from the opt palette, props neutral), a "Copy" ghost
  button top-right. Example content:
  <Button variant="destructive" loading>Delete forever</Button>

SOURCE TAB (small variant card is enough)
- Same code-block treatment but a full demo file (~30 lines) with line numbers gutter.

A11Y TAB (small variant card)
- "Run audit" secondary button + findings list: each finding is a card with an impact chip
  (serious = danger-subtle, moderate = orange opt-subtle), rule name (13px medium), description
  (12px ink-2), mono target selector, "Learn more ↗" link. Include an all-clear state:
  green kind-done-subtle banner "No violations found · 12 elements checked".

ADDITIONAL VARIANTS (separate cards)
1. SPLIT THEMES: the stage duplicated side-by-side — identical states grid rendered on light
   paper and dark paper simultaneously, labeled "light" / "dark" in mono 11px.
2. MATRIX MODE: stage shows a cross-product grid — variant (rows: primary, secondary, ghost,
   destructive) × size (columns: compact, regular, touch, icon) with a Button in every cell,
   axis labels in uppercase mono, "matrix: variant × size" caption and two small selects above
   choosing the axes.
3. COMMAND PALETTE: centered modal over a scrimmed gallery (black 40% scrim), search input
   "Jump to component…", grouped fuzzy results with the matched substring emphasized, selected
   row accent-subtle, footer hint row "↑↓ navigate · ↵ open · esc close" in mono 11px.

Deliver as one main screen (Preview tab, light) plus compact variant cards for: dark main,
Code tab, Source tab, A11y tab (findings + all-clear), Split themes, Matrix mode, Command
palette. Keep everything on the Instrument grid: generous whitespace, hairline dividers, no
shadows heavier than the existing shadow-sm, nothing rounded beyond 12px.
```
