# @tickets/ui Gallery — Navigation + Playground Design

Extends the P2 gallery (merged @ 5295347): a sidebar to choose which component to view, and per-component prop controls ("playground") to explore variations live. All engine work lands in `packages/web/ui/src/gallery/`; both hosts (dev app :4650, web `/gallery`) get the features for free.

## Decisions (locked with user)

1. **Navigation:** persistent sidebar (groups → component links + an "All" entry); selecting a component shows only that component's page (states grid + playground). Selection lives in `location.hash` (`#button`) — shareable, back-button-friendly, router-free, works in both hosts. Default view: All (preserves screenshot sweeps / design-sync flows).
2. **Controls:** declared per demo via typed helper constructors (NOT auto-generated from TS types — rejected: our composed prop APIs (options arrays, callbacks, ReactNode) defeat docgen, and it would add the repo's heaviest build tooling to serve its easiest 20%).
3. **Scope:** every component whose props usefully vary gets a playground (24 of 30). Skip list (states grid already exhaustive or fixture-driven): ItemKey, KindGlyph, SessionKindGlyph, Swatches, MessageStream, PromptComposer.

## Contract (canonical example)

Demo files gain an optional export:

```tsx
export const playground = definePlayground({
  controls: {
    // required-feeling select: always has a value, starts at 'primary'
    variant: select(['primary', 'secondary', 'ghost', 'destructive'], { initial: 'primary' }),

    // optional prop: "(unset)" option → undefined → Button's own default ('regular') applies
    size: select(['compact', 'regular', 'touch', 'icon'], { allowNone: true }),

    // boolean, off by default, custom panel label
    loading: boolean(false, { label: 'show spinner' }),
    disabled: boolean(),                          // initial defaults to false

    // free text with placeholder
    children: text('New ticket', { placeholder: 'button label…' }),

    // bounded number (e.g. NumberInput's max)
    max: number(13, { min: 0, max: 100, step: 1 }),
  },
  render: ({ children, ...props }) => <Button {...props}>{children}</Button>,
});
```

## Control vocabulary

| Helper | Signature | Required | Optional (defaults) | Inferred value type |
|---|---|---|---|---|
| `select` | `select(options, opts?)` | `options: readonly string[]` | `initial` → first option · `label` → control key · `allowNone: false` | `options[number]`, or `options[number] \| undefined` when `allowNone: true` |
| `boolean` | `boolean(initial?, opts?)` | — | `initial` → `false` · `label` → key | `boolean` |
| `text` | `text(initial?, opts?)` | — | `initial` → `''` · `label` → key · `placeholder` → `''` | `string` |
| `number` | `number(initial?, opts?)` | — | `initial` → `0` · `min`/`max` → unbounded · `step` → `1` · `label` → key | `number` |

- `allowNone: true` prepends an "(unset)" choice yielding `undefined`; since `render` spreads values into props, `undefined` = prop not passed = the component's real default applies.
- `render(values)` is fully typed via a `ControlValues<C>` mapped type; `definePlayground` is the identity function that enables inference.
- NOT in the vocabulary (fixture territory): arrays/objects (Combobox `options`, `statuses`), callbacks, non-string ReactNode, dates (ISO strings via `text` for now; a `date()` helper only if it earns it later).

## Engine changes (`packages/web/ui/src/gallery/`)

| Unit | Responsibility |
|---|---|
| `controls.ts` | `select`/`boolean`/`text`/`number` constructors → `ControlDef` discriminated union; `ControlValues<C>` inference; `definePlayground` |
| `collect-demos.ts` | Validates the optional `playground` export (malformed → error entry, same as bad meta/states). Gains the **duplicate-slug guard** (P3 carry-forward): a repeated demo slug across the merged list becomes an error entry instead of double-rendering with colliding ids |
| `controls-panel.tsx` | Renders one control row per def: select → native `<select>` (with "(unset)" when `allowNone`), boolean → checkbox, text → text input, number → number input with min/max/step. Native elements styled with Instrument tokens (the real primitives live in apps/web until P3 — the panel must stay app-independent; P3 may upgrade it) |
| `playground-card.tsx` | ControlsPanel beside a live preview; local state holds current values (initials from defs); every change re-renders `render(values)`. Rendered under the states grid on a component's page. Values are not persisted |
| `gallery-shell.tsx` v2 | Sidebar: groups → component links (`href="#slug"`, active highlight) + "All". Reads `location.hash`, listens to `hashchange`; a recognized slug filters to that single component (StateGrid + playground if declared), unknown/empty hash = All view. Replaces the inert nav `<span>`s. Theme toggle unchanged. Providers seam unchanged |

Compatibility: state-anchor ids (`#button--loading`) still exist inside a component's page; a hash matching `slug--state` selects the component and scrolls to the state.

## Playground wave (24 demos)

Form controls: button, input, textarea, number-input, checkbox, switch, radio-group, field-label. Pickers: combobox, multi-combobox, status-select, date-picker, popover (data-shaped props stay fixture-pinned; controls cover placeholder/disabled/clearable/size-style props). Display: status-badge, option-chip, type-badge, avatar, relative-date, session-status-pill. Overlays/AI: tooltip, dialog, menu, toast (trigger-level useful props), cost-meter. Playground exports use `satisfies`/`definePlayground` typing — this becomes the P3 demo-template convention.

## Folded-in follow-ups (same files, from the P2 final review)

Dead `cn` import in `state-grid.tsx`; AI-session group order swap (pill before glyph); sidebar replaces the inert nav labels.

## Testing

- Unit: each constructor's defaults + `ControlValues` inference (`expect-type` style), `allowNone` yielding `undefined`, duplicate-slug guard, malformed-playground validation.
- Component (testing-library): ControlsPanel emits value changes per control type; PlaygroundCard re-renders preview on change; shell filters on hash and falls back to All on unknown hash.
- Gates: standard battery (`ui`/`web` tests, typecheck, build, `tokens:verify` — panel classes are scanned via the tokens.css `@source`). Browser pass on both hosts, both themes.

## Out of scope

Generated code snippets; control-value persistence/URL-encoding of values; auto-generation from TS types; `date()`/`color()` helpers; controls for composed-data props; eer; upgrading the panel to real primitives (P3).
