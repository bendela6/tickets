# Input standardisation

The table engine joins the stack at layer 5: `propsToForm` emits a FormConfig
and the form layer renders it. That only works if a control can be driven
without knowing which control it is. Today it cannot — there are two
incompatible drive shapes, three size domains, and a name collision that has
already forced one component to be called `NumberFormInput`.

This plan makes the ten controls answer to one contract, then names them for
what they hold.

**Written:** 2026-08-05, after the playground was moved onto the library.

## Inventory — ten controls, seven field adapters

`components/` holds the controls; `forms/inputs/` already holds a field layer
that binds them to `@tickets/form`.

| value kind | control(s) | field adapter today |
| --- | --- | --- |
| text | `Input`, `Textarea` | `TextInput`, `TextareaInput` |
| number | `NumberInput`, `Slider` | `NumberFormInput` |
| boolean | `Checkbox`, `Switch` | `ToggleInput` (wraps **Switch**) |
| single select | `Combobox`, `RadioGroup` | `SelectInput` |
| multi select | `MultiCombobox` | `MultiSelectInput` |
| date | `DatePicker` | — none |
| json | — | `JsonInput` (wraps `Textarea`) |

`ComboboxList` is internal — shared by the two comboboxes and nothing else.
`field/` holds the shared `fieldClass`/`fieldState` chrome and is not a control.

Call sites: `Input` 121 · `Combobox` 63 · `Checkbox` 38 · `Textarea` 27 ·
`MultiCombobox` 27 · `Switch` 26 · `NumberInput` 21 · `RadioGroup` 14 ·
`Slider` 12 · `DatePicker` 11.

## What is actually wrong

Measured from source, not impression.

| # | problem | who |
| --- | --- | --- |
| 1 | **Two drive shapes.** `value` + `onChange(value)` vs spread HTML attrs + `onChange(event)` | value-prop: NumberInput, Combobox, MultiCombobox, DatePicker, RadioGroup, Slider · native: Input, Textarea, Checkbox, Switch |
| 2 | `onValueChange` rather than `onChange` | RadioGroup alone |
| 3 | **Three size domains.** `FieldSize` and `ToggleSize` are identical unions declared separately; `SliderSize` is `sm\|md` with no `lg` | 6 / 3 / 1 |
| 4 | `forwardRef` on four of ten | Input, Textarea, Checkbox, Switch |
| 5 | No `id`, so it cannot be associated with a `FieldLabel` | DatePicker |
| 6 | `label` required on some, absent on others | required: Checkbox, Switch, RadioGroup, Slider |
| 7 | `disabled` declared vs inherited through HTML attrs | 6 vs 4 |

**#1 is the blocker.** Everything else is tidying; a generic driver cannot bind
`onChange` two ways.

Already right, and not to be disturbed: **every control takes `tone` and none
takes `invalid`.** That was a locked decision and it held.

## The pairs are not variants

Three value kinds have two controls each. A `variant` prop would be the obvious
consolidation and it is wrong, because in each pair the difference is in the
type or the state space rather than the appearance:

- **Checkbox / Switch** — Checkbox has `indeterminate`, a real third state
  pushed onto the DOM node in an effect. A switch has no such state, and the
  roles differ (`type="checkbox"` vs `role="switch"`).
- **NumberInput / Slider** — `number | null` vs `number`. A number field can be
  empty; a slider's thumb is always somewhere. Slider also carries `valueText`
  for the spoken form, and the roles differ (`spinbutton` vs `slider`).
- **Combobox / RadioGroup** — `string | null` vs `string`. RadioGroup requires
  `name` and renders every option inline; Combobox is a popover.

A single component would need a discriminated union to keep `indeterminate`
from typechecking under the switch branch — two components wearing one name.
So they stay separate, and the shared kind lives in the prefix.

**The engine only ever needs the default per kind.** Slider, RadioGroup and
Checkbox are choices a human makes; `propsToForm` never picks them. The kind →
control map has four entries and the alternates sit outside the engine's path.

## Target

### The contract every control satisfies

```ts
type ControlProps<T> = {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  size?: ControlSize;          // one domain, replacing three
  tone?: Tone;                 // never `invalid` — precedence is resolved a layer up
  disabled?: boolean;
  className?: string;
};
```

Each control extends it with its own extras (`options`, `min`/`max`/`step`,
`placeholder`, `indeterminate`) and keeps native-attribute passthrough via
`Omit<…HTMLAttributes<…>, 'value' | 'onChange' | 'size'>`.

### Names

| today | becomes | why |
| --- | --- | --- |
| `Input` | `TextInput` | value kind |
| `Textarea` | `TextArea` | same kind, other shape |
| `NumberInput` | `NumberInput` | unchanged |
| `Slider` | `NumberSlider` | same kind, other shape |
| `Checkbox` | `ToggleInput` | see the open question below |
| `Switch` | `ToggleSwitch` | " |
| `Combobox` | `SelectInput` | value kind |
| `RadioGroup` | `SelectRadio` | same kind, other shape |
| `MultiCombobox` | `MultiSelectInput` | matches the field name already in use |
| `DatePicker` | `DateInput` | only one date control |

The field layer moves to `XField`, which is what frees `NumberInput`:

`TextField` · `TextAreaField` · `NumberField` · `SelectField` ·
`MultiSelectField` · `ToggleField` · `JsonField`

## Steps

Ordered so the risky work lands first, while the tree is otherwise still.
Renames are cheap and mechanical; the drive-shape change is neither.

### 1. One `ControlSize`, replacing three domains

`FieldSize` and `ToggleSize` are the same union declared twice — collapse them.
`SliderSize` gains `lg` or documents why it cannot. Type-only change, no
runtime effect; typecheck is the whole verification.

### 2. Unify the drive shape — one control per commit

The four native-attr controls take `value` + `onChange(value)`. Order by call
sites ascending, so the pattern is proven on the small ones: **Switch (26) →
Textarea (27) → Checkbox (38) → Input (121)**.

Per control:

1. `Omit` the conflicting native props, add `value`/`onChange`.
2. Codemod the call sites: `onChange={(e) => f(e.target.value)}` → `onChange={f}`.
   Repo-wide there are 104 event destructures and 60 match the mechanical
   one-liner shape; 8 files use a block body and get read by hand.
3. `RadioGroup.onValueChange` → `onChange` in the same pass.

**Verification, because a wrong handler still compiles.** The codemod prints
every call site it declines. A handler that reads anything other than
`target.value`/`target.checked` — `preventDefault`, `currentTarget`, the event
object passed onward — must fail the run rather than be rewritten.

### 3. `forwardRef` on all ten, `id` on DatePicker

Small and independent. `id` on DatePicker is what lets a `FieldLabel` point at
it; its absence is why it cannot be labelled today.

### 4. Move to `components/inputs/`

Pure file moves plus barrel updates, once the props are settled. `field/` and
`combobox-list/` move too — they are the shared parts of the same layer.

### 5. Rename

Controls to the value-kind names, field layer to `XField`. One commit per
rename so any single one can be reverted. The collision resolves here.

### 6. The engine seam

`ControlProps<T>` exported, plus the four-entry kind → control map that
`propsToForm` targets. This is the first step that the table engine can
actually build on.

## Verification

- Every step: `pnpm --filter @tickets/ui test` · `run typecheck` · the
  playground's 194 and web's 713, since both consume these controls.
- Step 2 additionally: the declined-call-site list, read in full.
- Step 4 additionally: `tokens:verify`, because moving files moves what the
  safelist extractor walks.
- At the end: a browser pass on `/gallery`, which renders every control's state
  matrix and is where a broken handler shows up as a control that does nothing.

## Open

- **Which boolean control is the default `ToggleInput`?** The table above says
  Checkbox, on the convention that a form's boolean field is a checkbox and a
  switch is for settings that take effect immediately. But `forms/inputs/toggle`
  wraps **Switch** today, so naming Checkbox `ToggleInput` flips what the field
  layer renders. Cheap to settle either way, and it needs settling before step 5.

## Rejected

- **A `variant` prop per value kind.** See "The pairs are not variants" — the
  differences are in the types, and a prop whose validity depends on another
  prop needs a discriminated union that propagates into every caller.
- **Adapting in the field layer instead of fixing the controls.** Fewer call
  sites move, but the controls stay inconsistent and anything driving one
  directly — the gallery, the playground, app code — still has to know which
  family it holds.
