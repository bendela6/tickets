# Soft Fill — implementing the input layer redesign

Source: `19 Input Layer FINAL Soft Fill.dc.html` in the Claude Design project
(`a75bdf6d…`), imported 2026-08-05. Read it with DesignSync `get_file`, not
WebFetch.

## How to read the design file

**The rungs are the contract; the specimen hexes are approximations.** The file
states every recipe in rung numbers ("floor rung 4", "rim rung 11 light / 9
dark") and then hand-writes hexes into the specimens. Most of those match our
ramp exactly — `--b7` is `gray-7` in both themes, `--pg` is `gray-1`, `--tx` is
`gray-12` — but several drift (light `--b9` is `#918D80` where our `gray-9` is
`#777368`). Build from the rung, never from the hex, or the tokens stop being
the source of truth.

## The contract — six state recipes

Applies to every control. No control may deviate.

| state | recipe |
| --- | --- |
| rest | floor **rung 4** · 1px transparent border · no shadow |
| hover | floor **rung 5** · trailing affordance appears · 120ms |
| focus | floor **surface** · 1px rim **rung 11 light / 9 dark** · halo 4px @22% light / 30% dark · 0ms |
| active | floor **rung 6** · `inset 0 2px 0` @10% · held until the popup opens |
| disabled | 45° hatch **rung 4 / rung 7**, 5px stripe · value rung 9 · no tab stop |
| read-only | **no floor** · 1px rule rung 7 · value stays rung 12 · keeps tab stop |

This inverts today's model. A field is now a **filled floor with a transparent
border**, not a surface with a visible border; focus *lifts* it to the surface
colour and adds the rim. `border-1 border-gray-7 bg-surface-raised` becomes
`bg-gray-4 border-1 border-transparent`.

## The tone rule — the floor swaps ramp, everything else holds

- unset → **gray rung 4** (the resting field; gray needs rung 4 to register)
- any tone → **that ramp's rung 2**, hover **rung 3**
- a toned field's focus rim and halo take **its own** rung 11/9, so a field in
  error still shows focus without losing the error
- the trailing glyph is shape-coded (disc / diamond / disc-check) and is the
  **only** place tone becomes saturated
- the eleven direct hues get a rung-9 square instead of a glyph, because they
  label a thing rather than report a state

## The size ladder — `xs` / `md` / `lg`

`sm` is gone; `xs` is new and smaller. This is a rename **and** a re-spec, and a
codemod across every call site.

| rung | height | radius | font | pad-x |
| --- | --- | --- | --- | --- |
| xs | 30 | 3 | 12 | 9 |
| md | 38 | 4 | 13 | 12 |
| lg | 46 | 5 | 14 | 14 |

mark 14 / 16 / 20 · icon 12 / 14 / 16 · chip 20 / 24 / 28 · gap 6 / 8 / 9 ·
label 11 / 12 / 13 · help 11 / 12 / 12

Today's ladder is 28 / 36 / 44 at radius 4 / 8 / 12, so every rung moves.

### Radius needs new tokens

Available rungs are `sm:4 md:6 lg:8 xl:12`; the ladder wants 3 / 4 / 5. These
are component-tier tokens in the tokenizing skill's sense — a radius is only
legible against the box it rounds, which is exactly why `border.ts` says four
rungs and not six. Added as `--radius-control-xs|md|lg`. The 4px duplication
against `--radius-sm` is an alias at a different tier, not a stray literal.

## Sequencing

1. **Foundation** — radius tokens, `ControlSize` → `xs|md|lg` + the ladder as
   data, `fieldClass` rewritten to the six recipes, `focusRing` to rim + halo.
2. **Migrate the ten** — Input, Textarea, NumberInput, Combobox, MultiCombobox,
   DatePicker, Checkbox, Switch, RadioGroup, Slider onto the new recipes and
   ladder; codemod `size="sm"` → `size="xs"` across ui, playground, web, board.
3. **The sixteen new** — PasswordInput, SearchInput, PinInput, Select (plain,
   no chip), SegmentedControl, CheckboxGroup, TagInput, RangeSlider, Rating,
   DateRangePicker, TimePicker, DurationInput, ColorPicker, IconPicker,
   UserPicker, FileInput.
4. **Field adapters + registry kinds** for whichever of the sixteen a generated
   form should be able to name.

Per-control detail lives in the design file's own sections — read them there
rather than restating them here, so there is one copy.
