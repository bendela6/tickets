import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Option } from '../control';
import { cn } from '../../../style/cn';
import { Pill } from '../../pill';
import { OptionRow } from '../option-row';


/**
 * Retired in favour of `Option`, which is the same four fields and covers the
 * radio group too — a control that never had a "combo" anything. Kept as an
 * alias only so a consumer outside this repo does not break on the rename.
 *
 * Both combobox conversions flagged the duplicate independently: MultiCombobox
 * was already handing `Option[]` to this component and compiling purely because
 * the shapes matched, so a drift in either would have broken it silently.
 *
 * @deprecated Use `Option`.
 */
export type ComboOption = Option;

type ComboboxListProps = {
  options: Option[];
  isSelected: (value: string) => boolean;
  onPick: (value: string) => void;
  /** Keep focus in the search box after a pick (multi-select). */
  keepOpen?: boolean;
  /**
   * Whether to draw the search box. Default true. Turn it off for a short,
   * fixed set — a search field over three options is noise, and it costs a
   * keystroke to reach the list. The keyboard model does not change: when the
   * box is gone the list itself takes focus and the same arrow/Enter handling.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Group header for an option, e.g. status kind. Options keep input order within a group. */
  groupOf?: (option: Option) => string;
  /** Order + display labels for groups. */
  groups?: { key: string; label: string }[];
  /** Custom rendering for an option's inner content (defaults to Pill/label). */
  renderOption?: (option: Option, selected: boolean) => ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  /** Shown when there is nothing to offer at all. */
  emptyLabel?: string;
  /** Shown when the filter hid everything — a different fact, and a different fix. */
  noMatchLabel?: string;
};

// The keyboard-navigable listbox shared by Combobox, MultiCombobox and
// StatusSelect. Selection semantics live in the caller via isSelected/onPick.
// Searching is on by default and can be turned off for a short fixed set.
export function ComboboxList({
  options,
  isSelected,
  onPick,
  keepOpen = false,
  searchable = true,
  searchPlaceholder = 'Search…',
  groupOf,
  groups,
  renderOption,
  header,
  footer,
  emptyLabel = 'Nothing to pick',
  noMatchLabel = 'No matches',
}: ComboboxListProps) {
  const [query, setQuery] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // The search input takes focus on mount via `autoFocus`; with no input there
  // is nothing to receive it, and the popover would open with focus left on the
  // trigger — so arrow keys would scroll the page instead of moving the
  // selection. Focus the list itself instead. Done in an effect rather than
  // with `autoFocus` on the <ul>, because that attribute is only honoured for
  // form controls in jsdom, which would make this untestable.
  useEffect(() => {
    if (!searchable) {
      listRef.current?.focus();
    }
  }, [searchable]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? options.filter((option) => option.label.toLowerCase().includes(q))
      : options;
    if (!groupOf || !groups) {
      return matched;
    }
    // stable group order, options in input order within each group
    return groups.flatMap((group) => matched.filter((option) => groupOf(option) === group.key));
  }, [options, query, groupOf, groups]);

  function pick(index: number) {
    const option = filtered[index];
    if (!option || option.disabled) {
      return;
    }
    onPick(option.value);
    if (keepOpen) {
      inputRef.current?.focus();
    }
  }

  /**
   * The next selectable row in `step` direction, skipping disabled ones.
   *
   * Arrowing onto a disabled option used to be possible, and Enter there did
   * nothing at all — no move, no pick, no sound. Silence is the worst answer a
   * keypress can get, so the highlight never stops somewhere Enter cannot act.
   * Returns `from` unchanged when there is nowhere else to go.
   */
  function nextEnabled(from: number, step: number): number {
    for (let i = from + step; i >= 0 && i < filtered.length; i += step) {
      if (!filtered[i]?.disabled) {
        return i;
      }
    }
    return from;
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursorIndex((index) => nextEnabled(index, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursorIndex((index) => nextEnabled(index, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(cursorIndex);
    }
  }

  const cursorId = filtered[cursorIndex]
    ? `${listId}-opt-${filtered[cursorIndex].value}`
    : undefined;

  let lastGroup: string | null = null;

  return (
    <div className="flex max-h-288 w-256 flex-col">
      {searchable ? (
        <div className="flex items-center gap-8 border-b-1 border-gray-6 px-12 py-9">
          <span aria-hidden className="font-sans text-12/17 text-gray-9">
            ⌕
          </span>
          <input
            ref={inputRef}
            // A filter box inside the popup, not a combobox. It claimed
            // `role="combobox"` before, which belongs to whatever OPENS a list
            // rather than to a field that narrows one already open.
            type="text"
            role="searchbox"
            aria-controls={listId}
            aria-activedescendant={cursorId}
            autoFocus
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursorIndex(0);
            }}
            onKeyDown={onKeyDown}
            className={cn(
              'min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-13/19 text-gray-12',
              'placeholder:text-gray-9 focus:outline-none focus:ring-0',
            )}
          />
        </div>
      ) : null}
      {header ? <div className="border-b-1 border-gray-6 px-6 py-4">{header}</div> : null}
      {/* Without the search box the list is what opens focused, so it carries
          the arrow/Enter handling and the active-descendant pointer the input
          would otherwise own. `tabIndex={-1}` makes it programmatically
          focusable without adding a tab stop. */}
      <ul
        id={listId}
        role="listbox"
        ref={listRef}
        aria-activedescendant={searchable ? undefined : cursorId}
        tabIndex={searchable ? undefined : -1}
        onKeyDown={searchable ? undefined : onKeyDown}
        className="flex-1 overflow-y-auto p-5 focus:outline-none"
      >
        {filtered.length === 0 ? (
          <li className="px-8 py-12 text-center font-sans text-12/17 text-gray-9">
            {/* Two different empties. "No matches" in front of a list that was
                never populated reads as though a filter is hiding something,
                and sends you looking for the filter to clear. */}
            {options.length === 0 ? emptyLabel : noMatchLabel}
          </li>
        ) : null}
        {filtered.map((option, index) => {
          const groupKey = groupOf ? groupOf(option) : null;
          const showHeader = groupKey !== null && groupKey !== lastGroup;
          lastGroup = groupKey;
          const groupLabel = groups?.find((group) => group.key === groupKey)?.label ?? groupKey;
          const selected = isSelected(option.value);
          return (
            <li key={option.value}>
              {showHeader ? (
                <div className="px-9 pb-3 pt-6 font-mono text-10 font-500 uppercase tracking-[0.08em] text-gray-9">
                  {groupLabel}
                </div>
              ) : null}
              {/* No onMouseEnter. The cursor is the parent's state and hover
                  is CSS inside OptionRow, so a mouse resting over the list can
                  no longer decide what Enter commits. OptionRow also draws the
                  selection check, which is why none is passed here. */}
              <OptionRow
                id={`${listId}-opt-${option.value}`}
                selected={selected}
                cursor={index === cursorIndex}
                disabled={option.disabled}
                onPick={() => pick(index)}
              >
                {renderOption ? (
                  renderOption(option, selected)
                ) : option.color ? (
                  // Same shape as the trigger: a Pill is an unshrinkable flex
                  // item, so it needs `min-w-0` before the label's `truncate`
                  // can fire at all.
                  <Pill
                    tone={option.color}
                    shape="round"
                    className="min-w-0"
                    label={<span className="truncate">{option.label}</span>}
                  />
                ) : (
                  option.label
                )}
              </OptionRow>
            </li>
          );
        })}
      </ul>
      {footer ? (
        <div className="border-t-1 border-gray-6 px-12 py-7 font-sans text-11 text-gray-9">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
