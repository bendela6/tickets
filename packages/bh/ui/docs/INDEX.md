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
- [Dot](../src/library/primitives/components/dot/dot.md): An 8-pixel disc in any CSS colour, for a colour known only at runtime.
- [formatBytes](../src/library/primitives/components/format-bytes/format-bytes.md): Writes a size in bytes as a person reads it, 1.5 KiB or 1.5 kB: in binary units or in decimal ones.
- [formatDuration](../src/library/primitives/components/format-duration/format-duration.md): Writes a length of time as a person reads it, 2h 30m or 1m 26s, from minutes, seconds or milliseconds.
- [Icon](../src/library/primitives/components/icon/icon.md): Draws one glyph from the icon registry, in the colour of the text around it.
- [JsonViewer](../src/library/primitives/components/json-viewer/json-viewer.md): Reads a JSON document, folded and numbered, and edits it when given an `onChange`.
- [Kbd](../src/library/primitives/components/kbd/kbd.md): A key hint: one key, or a chord, drawn as a key cap.
- [LogView](../src/library/primitives/components/log-view/log-view.md): Reads any app's log, line by line, its ANSI colours drawn, what failed, warned or passed highlighted, its stack traces folding, in sections the app names, following the end while lines arrive.
- [Pill](../src/library/primitives/components/pill/pill.md): A compact label for one fact: a status, a type, a count.
- [RelativeDate](../src/library/primitives/components/relative-date/relative-date.md): Shows a date as days from now (today, in 3 days), or a moment as minutes and hours (5 minutes ago); formatDateTime writes one out with its time.
- [StatusDot](../src/library/primitives/components/status-dot/status-dot.md): Shows whether something is running right now.
- [TextLink](../src/library/primitives/components/text-link/text-link.md): A link in a line of text: its strongest gray, underlined under the pointer.
- [useCopy](../src/library/primitives/components/use-copy/use-copy.md): Copies text to the clipboard and says whether it worked, for a button of your own.

## Layout

- [Card](../src/library/layout/components/card/card.md): A raised surface with a border, for a panel of content.
- [Disclosure](../src/library/layout/components/disclosure/disclosure.md): A row that folds what follows it: a chevron, a title, and a summary while folded.
- [Figures](../src/library/layout/components/figures/figures.md): A list of figures, a row each: what it is, a note on what it counts, and how much.
- [FoldCard](../src/library/layout/components/fold-card/fold-card.md): A Card whose header folds it: a chevron, the title, and a summary while folded.
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
- [Combobox](../src/library/inputs/components/combobox/combobox.md): One choice from a list, with a search box or without, shown as plain text.
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
- [Slider](../src/library/inputs/components/slider/slider.md): Picks one number between a minimum and a maximum.
- [Switch](../src/library/inputs/components/switch/switch.md): Turns one setting on or off, and can show that a save is in flight.
- [TagInput](../src/library/inputs/components/tag-input/tag-input.md): Turns free text into tags, for values that don't exist until someone types them.
- [Textarea](../src/library/inputs/components/textarea/textarea.md): Several lines of text, held by the caller.
- [TimePicker](../src/library/inputs/components/time-picker/time-picker.md): Picks a time of day from a list, or typed, and holds it as HH:MM.
- [ToggleChips](../src/library/inputs/components/toggle-chips/toggle-chips.md): A multiple choice among a few short options, each a chip one click away, as in a filter bar.
- [UserPicker](../src/library/inputs/components/user-picker/user-picker.md): Picks one person, or several, from a list you can search.

## Fields

- [Field](../src/library/forms/components/field/field.md): A field laid out by hand: its label, its control, then a hint or an error, stacked.
- [FieldError](../src/library/forms/components/field-error/field-error.md): A field's error message, in red, announced as an alert.
- [FieldLabel](../src/library/forms/components/field-label/field-label.md): A field's caption: a label in uppercase, with a mark when the field is required.
- [FieldWrapper](../src/library/forms/components/field-wrapper/field-wrapper.md): Draws one form field: its label, its control, then its description or its error.
- [FilterChanges](../src/library/forms/components/filter-changes/filter-changes.md): Says a filter form holds changes not applied yet: "1 change waiting".
- [FilterCount](../src/library/forms/components/filter-count/filter-count.md): How many rows a filter lets through: "12 of 40 items", "Counting" while it counts.
- [FilterSheet](../src/library/forms/components/filter-sheet/filter-sheet.md): A filter form's fields on a phone: a Filters button that opens a sheet from the bottom.
- [InlineFieldWrapper](../src/library/forms/components/inline-field-wrapper/inline-field-wrapper.md): Draws one field in a row, as a filter bar lays its fields out: the label inside the control, before it, or for a screen reader only.

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

- [CardState](../src/library/feedback/components/card-state/card-state.md): A loading card in its four states: waiting, failed, empty, and its content.
- [Meter](../src/library/feedback/components/meter/meter.md): A share of a whole as a bar: its name, its percent, a caption, and a tone for how full it is.
- [Notice](../src/library/feedback/components/notice/notice.md): A box with a tone for a message on a page: a note, information, a success, a warning or an error.
- [Progress](../src/library/feedback/components/progress/progress.md): A bar showing how far along something is, as a percentage.
- [ScreenState](../src/library/feedback/components/screen-state/screen-state.md): What a screen shows in place of its content: loading, empty, not found, or an error.
- [Spinner](../src/library/feedback/components/spinner/spinner.md): A mark that moves while something loads.
- [Toast](../src/library/feedback/components/toast/toast.md): A short message in the corner of the screen that goes away on its own.
