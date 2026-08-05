# Design prompt — the Instrument input layer

Paste into the Claude Design project (`a75bdf6d…`). Everything below is either a
hard constraint from the codebase or an explicit request; anything not stated is
deliberately yours to decide.

---

## What this is

Redesign the **complete form-input layer** of Instrument — every control a user
types into, picks from, or toggles. This is a ticket/project-management app, so
these controls carry real work: assigning people, setting dates and estimates,
tagging, filtering boards, editing every field on a ticket.

They are also about to be driven by a **table/form engine**: a stored config
names a control by kind, and the engine renders it with no knowledge of what it
looks like. So these ten-plus controls are not ten separate designs that happen
to sit near each other — they are one system that has to read as one system when
a generated form stacks eight of them in a column.

The current set works but looks and feels wrong. Start over on the visual
language. Keep the contract below.

---

## The controls

### Text entry
1. **Input** — single-line text. Supports leading and trailing adornments (an
   icon, a unit, a `⌘K` hint, a button).
2. **Textarea** — multi-line, with a size floor rather than a fixed height.
3. **NumberInput** — a stepper: numeric value with increment/decrement affordances.
4. **PasswordInput** — obscured, with a reveal toggle.
5. **SearchInput** — leading search affordance, a clear action once non-empty,
   and a loading state for async results.
6. **PinInput** — fixed-length code, one cell per character.

### Choice — one of many
7. **Select** — *the plain one.* A closed trigger showing the chosen option as
   **plain text, never a pill or chip**, and a popup list. This is the workhorse
   and it does not exist today; every single-select currently renders its value
   as a chip, which is wrong for most uses.
8. **Combobox** — Select plus type-to-filter, for long lists. Needs a
   no-results state.
9. **RadioGroup** — all options visible. Two shapes: a plain list of marks, and
   a card form where the whole row is the target and lights up when selected.
10. **SegmentedControl** — a small exclusive set shown inline as one joined
    control. For 2–5 short options (view mode, priority).

### Choice — many of many
11. **MultiSelect** — multiple values shown as **removable chips** in the
    trigger, with an overflow rule once they exceed the width (a `+N` affordance).
    This is today's MultiCombobox; keep the chips here — that is the one place
    they are right.
12. **CheckboxGroup** — all options visible, multiple selectable.
13. **TagInput** — free text in, chips out. Creates values that were not in a
    list; needs a "create «foo»" affordance and duplicate handling.

### Boolean
14. **Checkbox** — with a genuine **indeterminate** state, not a third colour.
15. **Switch** — an immediate on/off, distinct at a glance from a checkbox.

### Range and rating
16. **Slider** — single value, with an optional step grid and a value readout.
17. **RangeSlider** — two thumbs, a low and a high bound.
18. **Rating** — a small fixed scale of marks.

### Date and time
19. **DatePicker** — trigger plus a calendar.
20. **DateRangePicker** — a start and an end, with the span shown in the calendar.
21. **TimePicker** — a time of day.
22. **DurationInput** — a length of time (`2h 30m`), not a clock time. Estimates
    and time tracking use this.

### The specialised pickers
23. **ColorPicker** — a **fixed palette of predefined swatches**, not a spectrum
    or an eyedropper. The palette is the eleven ramps this system already has:
    red, orange, yellow, green, teal, cyan, blue, indigo, purple, pink, gray.
    Show the selected one clearly in the trigger and mark it in the grid. This
    is what colours labels, statuses and ticket types.
24. **IconPicker** — pick one icon from a searchable grid of a few hundred.
    Needs search, sensible grouping, a scroll that does not feel endless, and a
    trigger that shows the chosen icon.
25. **UserPicker** — pick a person (or several). Avatar plus name, searchable,
    with an unassigned state. Assignment is the single most-used control in the
    app.
26. **FileInput** — a drop target that is also a button. Needs an empty state,
    a dragging-over state, a list of chosen files with per-file removal, upload
    progress, and a per-file error.

> Items 4, 5, 6, 10, 12, 13, 17, 18, 20, 21, 22, 25 and 26 are my proposals to
> complete the set — cut any you do not want. Items 1, 2, 3, 7, 8, 9, 11, 14,
> 15, 16, 23 and 24 are the current controls plus the three explicitly asked for.

---

## The shared contract — every control expresses these

This is the part that is fixed. Each of these props must be visibly legible on
every control it applies to, and must read **consistently across all of them** —
a generated form is the test: eight different controls in a column, all
disabled, must dim the same way.

### `size` — exactly three rungs: `xs`, `md`, `lg`

Three names, no more. **Do not treat the current dimensions as given — choose
what these should be.** The rungs must feel like one ladder across every
control: an `md` Select beside an `md` DatePicker beside an `md` Input must line
up on a row without any of them looking out of place.

`xs` is a real working size, not a token gesture — it is what a dense table cell
and a filter bar use, so it has to stay usable and legible at that size.

### `tone` — seventeen names, and an unset state that is not one of them

Six semantic roles:

`primary` · `secondary` · `success` · `warning` · `danger` · `neutral`

Eleven direct hues:

`red` · `orange` · `yellow` · `green` · `teal` · `cyan` · `blue` · `indigo` ·
`purple` · `pink` · `gray`

**Keep exactly these names.** They already exist in the token system and are not
up for redesign.

**Critical:** *unset* is its own resting state, not a quiet `primary`. A field
nobody has said anything about draws a **neutral, uncoloured** chrome. It takes
colour only when a tone is named. If every field wore its tone at rest the whole
form would be indigo — design the resting state first, and treat a toned field
as a field that is *saying something* (validated, warning, in error).

The mark controls are the exception: a checkbox or a switch is always painted
from some ramp, because there is no such thing as a colourless checkbox. Those
default to `primary`.

There is deliberately **no `invalid` or `error` prop.** An error is
`tone="danger"` and nothing else, so whatever you design for `danger` is what
every validation failure in the product looks like. Design it accordingly.

### `disabled` vs `readOnly` — two states, and they must not look alike

The most common mistake in this layer, and the one worth spending design effort on.

- **`disabled`** — *not applicable to you.* Out of the tab order, dropped from
  form submission. It may dim its value, because the value does not matter.
- **`readOnly`** — *not editable here, but it still counts.* Keeps its tab stop,
  keeps its place in submission, and the value **keeps full contrast** because
  reading it is the entire point. What goes is the affordance: nothing invites a
  click, nothing responds to hover.

Put them side by side and make the difference obvious without a legend.

---

## States — every control, every one of these

An unrendered state is an unverified state. For each control show:

**Interaction**
- rest
- hover
- focus (keyboard) — see the focus rule below
- active / pressed
- disabled
- read-only

**Content**
- empty / placeholder
- filled — typical value
- overflow — a value far too long for the control, and how it degrades
- loading — where the control fetches (Combobox, UserPicker, SearchInput)
- error — i.e. `tone="danger"`

**Per-control states** where they apply
- open vs closed, for anything with a popup — and the popup itself
- checked / unchecked / **indeterminate** (Checkbox)
- on / off (Switch)
- no results (Combobox, UserPicker, IconPicker)
- selected, hovered and keyboard-highlighted rows inside a list — three
  different things that are routinely collapsed into two
- chips overflowing to `+N` (MultiSelect, TagInput)
- dragging-over, uploading, per-file error (FileInput)

**Both themes.** Light and dark are equal citizens; the app ships both. Do not
design light and invert it.

Also give me **one grid per control showing size × tone × state together**, and
**one page showing every control side by side** in the same states — that
cross-control view is where a system either holds together or does not, and it
is the view I most want to see.

Out of scope: RTL.

---

## Hard constraints

1. **The focus indicator must be genuinely visible** — at least 3:1 against
   whatever sits behind it, in both themes (WCAG 2.2 Focus Appearance). The
   current one uses a near-background tint that measures 1.00:1 in dark: it is
   invisible, and that is a large part of why this redesign is happening. Focus
   must also read as *different from hover*, and a toned field must still show
   focus without losing its tone.
2. **Every state must differ from its neighbours perceptibly.** Rest, hover and
   focus each need their own appearance. A one-step colour move on a one-pixel
   border is not a state change — today's hover measures 1.17:1 against rest and
   is invisible. If two states are within roughly 1.3:1, they are the same state.
3. **Colour comes from the existing ramps.** Each hue has twelve rungs, used as:
   1–2 page grounds · 3–5 component fills · 6–8 borders · 9–10 solid fills ·
   11–12 text. Stay on this ladder — no new hues, no off-ramp values.
4. **One focus treatment for the whole library.** Whatever you design, it is
   defined once and worn by every control identically. Do not give the checkbox
   a different focus idiom from the Select.
5. **Everything is keyboard-operable**, and the design has to show what that
   looks like — especially the highlighted row in every popup list.

---

## What is free — and I want you to use it

Everything not listed above. Specifically: the shape and weight of a field's
chrome; radius; density and internal spacing; how a popup is anchored and
animated; whether fields are bordered, filled, underlined or something else;
where and how labels, help text and error text sit relative to the control; the
entire feel of the focus treatment; iconography and affordances; motion.

The current look is conventional and flat and I am not attached to any of it.
Take a real position on what a form in this product should feel like, and make
the whole layer answer to it.
