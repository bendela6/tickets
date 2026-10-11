# @bh/ui

[//]: # 'written by pnpm docs:index from each page’s frontmatter; edit the pages, not this file'

Every page in this package, as the docs site groups them. Each link is the page’s
markdown copy: its prose, its examples’ code, and its props tables from the types.

## Foundations

- [Colours](../docs/foundations/colours.md): Twelve-step scales, the roles that pick one, and the surfaces no step can be.
- [Tones](../docs/foundations/tones.md): A component's tone takes a role or a scale by name; its variant decides how much of the tone it spends.
- [Typography](../docs/foundations/typography.md): Twelve sizes named by their pixels, leading set where the text is, three weights and two families.
- [Spacing](../docs/foundations/spacing.md): One pixel is the unit, so the number in a spacing or size class is pixels on screen.
- [Radius](../docs/foundations/radius.md): Six radii named by their pixels, each with its jobs; a component's radius moves with its size.
- [Elevation](../docs/foundations/elevation.md): A shadow says how far above the page a thing sits; a layer, what it sits over.
- [Motion](../docs/foundations/motion.md): Three durations by the kind of change, two easings, three animations, and what stops for reduced motion.
- [Layout](../docs/foundations/layout.md): The breakpoints a screen changes at, the widths a form rearranges at, and the widths of borders and focus.
- [Dark mode](../docs/foundations/dark-mode.md): Dark is data-theme="dark" on <html>; every colour and shadow has both values, and dark classes follow the attribute.

## Primitives

- [Avatar](../src/library/primitives/components/avatar/avatar.md): Shows a name as its initials in a coloured disc or square.
- [Button](../src/library/primitives/components/button/button.md): Starts an action: save, open a dialog, run a job.
- [CopyButton](../src/library/primitives/components/copy-button/copy-button.md): Copies a string to the clipboard and says whether it worked.
- [Dot](../src/library/primitives/components/dot/dot.md): An 8-pixel disc in any CSS colour, for a colour known only at runtime.
- [Icon](../src/library/primitives/components/icon/icon.md): Draws one glyph from the icon registry, in the colour of the text around it.
- [JsonViewer](../src/library/primitives/components/json-viewer/json-viewer.md): Reads a JSON document, folded and numbered, and edits it when given an `onChange`.
- [Pill](../src/library/primitives/components/pill/pill.md): A compact label for one fact: a status, a type, a count.
- [RelativeDate](../src/library/primitives/components/relative-date/relative-date.md): Shows a date as days from now: today, in 3 days, 2 days ago.
- [StatusDot](../src/library/primitives/components/status-dot/status-dot.md): Shows whether something is running right now.

## Layout

- [Card](../src/library/layout/components/card/card.md): A raised surface with a border, for a panel of content.
- [Row](../src/library/layout/components/row/row.md): Lays its children out side by side, with a gap between them.
- [SectionHeader](../src/library/layout/components/section-header/section-header.md): A section's caption row: an uppercase title, an optional count, and an action on the right.
- [Stack](../src/library/layout/components/stack/stack.md): Lays its children out in a column, with a gap between them.

## Navigation

- [Tabs](../src/library/navigation/components/tabs/tabs.md): A strip of items with one selected: tabs over a panel, or a group of toggles.
- [Tree](../src/library/navigation/components/tree/tree.md): A hierarchy of rows that expand and collapse, which the keyboard can walk.

## Inputs

- [Checkbox](../src/library/inputs/components/checkbox/checkbox.md): One yes-or-no choice, with an optional label beside the box.
- [CheckboxGroup](../src/library/inputs/components/checkbox-group/checkbox-group.md): Several independent choices, all visible, held as one array of values.
- [ColorPicker](../src/library/inputs/components/color-picker/color-picker.md): Picks one of the eleven colour scales.
- [Combobox](../src/library/inputs/components/combobox/combobox.md): One choice from a list with a search box, shown as plain text.
- [DatePicker](../src/library/inputs/components/date-picker/date-picker.md): Picks one day, from a calendar or typed, and holds it as an ISO string.
- [DateRangePicker](../src/library/inputs/components/date-range-picker/date-range-picker.md): Picks a span of days, or of months, and holds its two ends as ISO strings.
- [DurationInput](../src/library/inputs/components/duration-input/duration-input.md): A length of time, typed as text and held in minutes.
- [FileInput](../src/library/inputs/components/file-input/file-input.md): Takes files by drop or by browse, and lists them with their size, progress or error.
- [IconPicker](../src/library/inputs/components/icon-picker/icon-picker.md): Picks one icon from a grid you can search.
- [Input](../src/library/inputs/components/input/input.md): A single line of text, held by the caller.
- [MultiCombobox](../src/library/inputs/components/multi-combobox/multi-combobox.md): Several choices from a list with a search box, shown as chips.
- [NumberInput](../src/library/inputs/components/number-input/number-input.md): A number, typed or stepped; an empty field is null, not zero.
- [PasswordInput](../src/library/inputs/components/password-input/password-input.md): A secret, with a button that shows it.
- [PinInput](../src/library/inputs/components/pin-input/pin-input.md): A short code of fixed length, one character to a cell.
- [RadioGroup](../src/library/inputs/components/radio-group/radio-group.md): One choice from a few options, every option visible.
- [RangeSlider](../src/library/inputs/components/range-slider/range-slider.md): Picks a span of numbers with two thumbs, a low end and a high one.
- [Rating](../src/library/inputs/components/rating/rating.md): A small fixed scale, picked by clicking one of a row of marks.
- [SearchInput](../src/library/inputs/components/search-input/search-input.md): A search field, with a clear button once there is something to clear.
- [SegmentedControl](../src/library/inputs/components/segmented-control/segmented-control.md): An exclusive choice among two to five short options, shown inline.
- [Select](../src/library/inputs/components/select/select.md): One choice from a short list, shown as plain text.
- [Slider](../src/library/inputs/components/slider/slider.md): Picks one number between a minimum and a maximum.
- [Switch](../src/library/inputs/components/switch/switch.md): Turns one setting on or off, and can show that a save is in flight.
- [TagInput](../src/library/inputs/components/tag-input/tag-input.md): Turns free text into tags, for values that don't exist until someone types them.
- [Textarea](../src/library/inputs/components/textarea/textarea.md): Several lines of text, held by the caller.
- [TimePicker](../src/library/inputs/components/time-picker/time-picker.md): Picks a time of day from a list, or typed, and holds it as HH:MM.
- [ToggleChips](../src/library/inputs/components/toggle-chips/toggle-chips.md): A multiple choice among a few short options, each a chip one click away, as in a filter bar.
- [UserPicker](../src/library/inputs/components/user-picker/user-picker.md): Picks one person, or several, from a list you can search.

## Fields

- [FieldError](../src/library/forms/components/field-error/field-error.md): A field's error message, in red, announced as an alert.
- [FieldLabel](../src/library/forms/components/field-label/field-label.md): A field's caption: a label in uppercase, with a mark when the field is required.
- [FieldWrapper](../src/library/forms/components/field-wrapper/field-wrapper.md): Draws one form field: its label, its control, then its description or its error.

## Overlays

- [Dialog](../src/library/overlays/components/dialog/dialog.md): A modal window over the page, for a short task or a question.
- [DialogFooter](../src/library/overlays/components/dialog-footer/dialog-footer.md): The row of buttons at the bottom of a dialog.
- [Drawer](../src/library/overlays/components/drawer/drawer.md): A modal panel that slides in from the left or right edge of the page.
- [Dropdown](../src/library/overlays/components/dropdown/dropdown.md): A trigger of your choosing and the panel it opens, with the open state kept for you.
- [Menu](../src/library/overlays/components/menu/menu.md): A list of commands that opens from a button.
- [Popover](../src/library/overlays/components/popover/popover.md): A panel that floats beside the button that opens it.
- [SidePanel](../src/library/overlays/components/side-panel/side-panel.md): A column beside the content that the reader can resize and collapse.
- [Tooltip](../src/library/overlays/components/tooltip/tooltip.md): A short hint that shows when its trigger is hovered or focused.

## Feedback

- [Progress](../src/library/feedback/components/progress/progress.md): A bar showing how far along something is, as a percentage.
- [ScreenState](../src/library/feedback/components/screen-state/screen-state.md): What a screen shows in place of its content: empty, not found, or an error.
- [Spinner](../src/library/feedback/components/spinner/spinner.md): A mark that moves while something loads.
- [Toast](../src/library/feedback/components/toast/toast.md): A short message in the corner of the screen that goes away on its own.
