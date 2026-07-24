import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@tickets/ui/cn';
import { Pill } from '@tickets/ui/pill';
import type { OptionColor } from '../registry/option-color';

export type ComboOption = {
  value: string;
  label: string;
  color?: OptionColor;
  disabled?: boolean;
};

type ComboboxListProps = {
  options: ComboOption[];
  isSelected: (value: string) => boolean;
  onPick: (value: string) => void;
  /** Keep focus in the search box after a pick (multi-select). */
  keepOpen?: boolean;
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

// The searchable, keyboard-navigable listbox shared by Combobox, MultiCombobox
// and StatusSelect. Selection semantics live in the caller via isSelected/onPick.
export function ComboboxList({
  options,
  isSelected,
  onPick,
  keepOpen = false,
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
    <div className="flex max-h-72 w-64 flex-col">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.25">
        <span aria-hidden className="font-sans text-meta text-ink-3">
          ⌕
        </span>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded
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
            'min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-ui text-ink',
            'placeholder:text-ink-3 focus:outline-none focus:ring-0',
          )}
        />
      </div>
      {header ? <div className="border-b border-hairline px-1.5 py-1">{header}</div> : null}
      <ul id={listId} role="listbox" className="flex-1 overflow-y-auto p-1.25">
        {filtered.length === 0 ? (
          <li className="px-2 py-3 text-center font-sans text-meta text-ink-3">{emptyLabel}</li>
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
                <div className="px-2.25 pb-0.75 pt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">
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
                  'flex w-full items-center justify-between gap-2 rounded-ctrl px-2.25 py-1.75 text-left font-sans text-ui text-ink',
                  active && 'bg-inset',
                  option.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {renderOption ? (
                  renderOption(option, selected)
                ) : option.color ? (
                  <Pill tone={option.color} shape="full" label={option.label} />
                ) : (
                  <span>{option.label}</span>
                )}
                {selected ? (
                  <span className="font-sans text-meta font-medium text-accent">✓</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {footer ? (
        <div className="border-t border-hairline px-3 py-1.75 font-sans text-[11px] text-ink-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
