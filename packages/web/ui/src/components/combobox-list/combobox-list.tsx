import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Hue } from '../../style/tones';
import { cn } from '../../style/cn';
import { Pill } from '../pill';


export type ComboOption = {
  value: string;
  label: string;
  color?: Hue;
  disabled?: boolean;
};

type ComboboxListProps = {
  options: ComboOption[];
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
  groupOf?: (option: ComboOption) => string;
  /** Order + display labels for groups. */
  groups?: { key: string; label: string }[];
  /** Custom rendering for an option's inner content (defaults to Pill/label). */
  renderOption?: (option: ComboOption, selected: boolean) => ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  emptyLabel?: string;
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
  emptyLabel = 'No matches',
}: ComboboxListProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
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

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(activeIndex);
    }
  }

  const activeId = filtered[activeIndex]
    ? `${listId}-opt-${filtered[activeIndex].value}`
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
            // A filter box inside the popup, not the combobox itself. The
            // `combobox` role belongs to the TRIGGER — which is what makes
            // `aria-readonly` legal there, since a plain button does not permit
            // it. Two elements claiming the role would be one too many, and the
            // inner one was never the right owner.
            type="text"
            role="searchbox"
            aria-controls={listId}
            aria-activedescendant={activeId}
            autoFocus
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
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
        aria-activedescendant={searchable ? undefined : activeId}
        tabIndex={searchable ? undefined : -1}
        onKeyDown={searchable ? undefined : onKeyDown}
        className="flex-1 overflow-y-auto p-5 focus:outline-none"
      >
        {filtered.length === 0 ? (
          <li className="px-8 py-12 text-center font-sans text-12/17 text-gray-9">{emptyLabel}</li>
        ) : null}
        {filtered.map((option, index) => {
          const groupKey = groupOf ? groupOf(option) : null;
          const showHeader = groupKey !== null && groupKey !== lastGroup;
          lastGroup = groupKey;
          const groupLabel = groups?.find((group) => group.key === groupKey)?.label ?? groupKey;
          const selected = isSelected(option.value);
          const active = index === activeIndex;
          return (
            <li key={option.value}>
              {showHeader ? (
                <div className="px-9 pb-3 pt-6 font-mono text-10 font-500 uppercase tracking-[0.08em] text-gray-9">
                  {groupLabel}
                </div>
              ) : null}
              <button
                type="button"
                role="option"
                id={`${listId}-opt-${option.value}`}
                aria-selected={selected}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(index)}
                className={cn(
                  'flex w-full items-center justify-between gap-8 rounded-md px-9 py-7 text-left font-sans text-13/19 text-gray-12',
                  active && 'bg-surface-inset',
                  option.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {renderOption ? (
                  renderOption(option, selected)
                ) : option.color ? (
                  <Pill tone={option.color} shape="round" label={option.label} />
                ) : (
                  <span>{option.label}</span>
                )}
                {selected ? (
                  <span className="font-sans text-12/17 font-500 text-indigo-9">✓</span>
                ) : null}
              </button>
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
