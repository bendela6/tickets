# Soft Fill — the four shared contracts

Approved 2026-08-05. Reviewed as an artifact first:
<https://claude.ai/code/artifact/83ae3097-07ca-440e-9e16-f4524895c368>

Source design: `19 Input Layer FINAL Soft Fill.dc.html` in the Claude Design
project (`a75bdf6d…`). Read it with DesignSync `get_file`, never WebFetch.
Foundation and ladder: `2026-08-05-soft-fill-input-layer.md`.

## Why this comes before the sixteen controls

The design defines recipes that eight-plus controls depend on. We built the
*field* contract; the other four do not exist. Building controls first would
re-implement each of them per control, and they would drift — which is the exact
failure `fieldClass` was created to end, when seven components each carried
their own copy of the field chrome and five hardcoded the accent to indigo.

Nothing new appears on screen from this work. Everything after it gets cheaper.

## The four locked decisions

1. **Contracts before controls.** The shared recipes land first.
2. **Two layers, not one.** A `Popup` shell plus a separate `OptionRow`. Colour
   and Icon pickers are grids — they take the shell and no rows, so a single
   do-everything list component would accrete branches as pickers land.
3. **Cursor commits; hover is visual only.** Enter picks the keyboard cursor row
   wherever the mouse rests. This is the accessibility-safe reading: a resting
   mouse can never change what a keyboard user commits, and it is the only
   reading under which the design's "three independent channels" is literally
   true.
4. **A separate `Chip` in `inputs/`.** `Pill` keeps its own four-rung size
   domain and stays a display tag for boards and detail panes. Merging them
   would force Pill's sizes to be renegotiated against `CONTROL_LADDER` and give
   a board tag interactive affordances it never needs.

## What gets built

All four live in `packages/web/ui/src/components/inputs/`.

### 1. `popup/` — the shell

Anchoring, geometry and elevation, built on the existing `Popover`. Knows
nothing about rows or grids, which is what lets the swatch and icon grids use it
unmodified.

    4px below the trigger · radius 6 · 5px padding · elevation · open/close motion

### 2. `option-row/` — three independent channels

The subtlest piece, and the reason this is a contract rather than a class.
Today's `ComboboxList` collapses the keyboard cursor and hover into one `active`
flag. The design states three channels, and any combination must be renderable —
a row can be hovered without being the cursor, and selected without being either.

    34px · radius 3
    cursor   → inward ring   (the parent owns the index)
    hover    → floor step    (CSS :hover, never touching cursor state)
    selected → trailing check + 500 weight

### 3. `chip/` — the chip

Lives only inside multi-value triggers. The remove affordance is the **full
square**, not a glyph inside it. `+N` is the same component with an `onClick`,
so overflow is focusable rather than decorative, and opens the popup with the
hidden items first.

    rung-2 fill · rung-11 text · 20 / 24 / 28 from CONTROL_LADDER · remove = full square

### 4. `focusRing` inward mode, and monospace dates

Inside a joined control or a popup row there is no room for an outward halo, so
the rim draws inset instead — needed by segmented items, option rows and
calendar cells. Dates become monospace everywhere so a column aligns on digits.

    focusRing(hue, trigger, 'inward') · inset rim, no halo

## The retrofit — where the contracts get proven

A contract with no consumer is theory. Each of these also closes a gap the
design already called out, so the retrofit pays for itself.

| Consumer | Change |
| --- | --- |
| `ComboboxList` | Composes `Popup` + `OptionRow`; its single `active` flag splits into `cursor` and `:hover` |
| `Combobox` | Bolded match rather than a colour highlight · skeleton rows that hold the popup height · result count · real no-results copy |
| `MultiCombobox` | Chips become `Chip` · `+N` focusable, opening the popup with hidden items first |
| `DatePicker` | Popup through `Popup` · inward-ring cursor · solid rung-9 selected tile · inset today outline |

## Testing

**No token values** — a test naming a rung fails when a designer moves it, and
can only ever catch a value copied wrong twice. Assert the contracts:

- the three channels are independent, in every combination
- Enter commits the cursor row regardless of where the mouse rests
- the chip's remove target is the full square; `+N` is focusable
- `ComboboxList`'s existing suite passes **unchanged** — the proof the retrofit
  altered no behaviour

## Not in this chunk

- The sixteen new controls (Select, Password, Search, Pin, Segmented,
  CheckboxGroup, TagInput, RangeSlider, Rating, DateRange, TimePicker, Duration,
  Colour, Icon, User, File).
- The ten's remaining gaps: slider thumb-focus, switch pending spinner, input
  character counter, number-input floor dimming.
- Field adapters and registry kinds for anything new.

## Open, and deliberately not decided here

- Field-level `readOnly`: `FieldNode` carries no availability concept at all
  (`disabled` is only `isSubmitting`). Authored into the stored FormConfig, or
  supplied at render time as context? The second is arguably more correct —
  permission is not a property of a form's shape.
- `propsToForm` scope: kinds→controls only, or also validation, defaults and
  layout?
