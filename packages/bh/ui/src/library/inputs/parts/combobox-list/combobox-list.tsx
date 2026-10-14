import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Option, OptionGroup } from '../../contract';
import { cn } from '../../../../style/cn';
import { Icon } from '../../../primitives/components/icon';
import { Pill } from '../../../primitives/components/pill';
import { OptionRow } from '../option-row';
import { GroupHeading, groupRuns, inGroupOrder } from './groups';

/**
 * The label with the matched run bolded.
 *
 * Weight rather than colour, per the design — the row already spends colour on
 * three channels (cursor, hover, selection) and the options may carry colours
 * of their own, so a highlight would be a fourth signal competing with all of
 * them. Weight is the one channel nothing else is using.
 *
 * Case-insensitive on the match but the ORIGINAL casing is rendered: showing
 * the query's casing back would silently rewrite the option's own name.
 */
function MatchedLabel({ label, query }: { label: string; query: string }) {
  const needle = query.trim();
  if (!needle) {
    return <>{label}</>;
  }
  const at = label.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1) {
    return <>{label}</>;
  }
  return (
    <>
      {label.slice(0, at)}
      <b className="font-600">{label.slice(at, at + needle.length)}</b>
      {label.slice(at + needle.length)}
    </>
  );
}

interface ComboboxListProps {
  options: Option[];
  isSelected: (value: string) => boolean;
  onPick: (value: string) => void;
  /** Keep focus in the search box after a pick (multi-select). */
  keepOpen?: boolean;
  /**
   * Whether to draw the search box. Default true. Turn it off for a short,
   * fixed set — a search field over three options is noise, and it costs a
   * keystroke to reach the list. The keyboard model does not change: when the
   * box is gone the list itself takes focus and the same keys. Typing, which
   * the box would take, jumps to an option instead, as on a native select.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Group header for an option, e.g. status kind. Options keep input order within a group. */
  groupOf?: (option: Option) => string;
  /** Order + display labels for groups. */
  groups?: OptionGroup[];
  /** Custom rendering for an option's inner content (defaults to Pill/label). */
  renderOption?: (option: Option, selected: boolean) => ReactNode;
  /**
   * Drawn before an option's content: an avatar, a dot, an icon. Where it
   * draws nothing, or isn't given, an option's `icon` is drawn there.
   */
  renderLeading?: (option: Option) => ReactNode;
  /** Drawn after an option's content: a handle, a count. The selection check is drawn apart. */
  renderTrailing?: (option: Option) => ReactNode;
  /**
   * Whether an option answers the search, given the query trimmed and in
   * lower case. Left unset, its label contains the query. A list whose rows
   * carry more than a label (a person's handle, say) searches that too.
   */
  matches?: (option: Option, query: string) => boolean;
  header?: ReactNode;
  footer?: ReactNode;
  /** Shown when there is nothing to offer at all. */
  emptyLabel?: string;
  /**
   * Shown when the filter hid everything — a different fact, and a different
   * fix. Left unset it names the query, which is what tells the reader their
   * own typing is the cause rather than an empty source; a function is given
   * the query to name it in words of its own.
   */
  noMatchLabel?: string | ((query: string) => ReactNode);
  /** A second line under the empty result — what to try instead. */
  noMatchHint?: ReactNode;
  /**
   * Options are still in flight. Draws skeleton rows rather than an empty
   * state: "nothing here" is the wrong answer to "not yet", and a one-line
   * message makes the popup jump the moment results land.
   */
  loading?: boolean;
  /**
   * The search happens somewhere else. Each keystroke is reported here and the
   * list stops filtering `options` itself: they are taken to be the matches
   * already, fetched by the caller for the query it was told. Filtering them a
   * second time would hide a match whose label does not contain the query — a
   * server that also searches ids or aliases finds rows this box cannot.
   */
  onQueryChange?: (query: string) => void;
  /**
   * The key typed on the closed trigger that opened the list. A list without
   * search starts its typeahead with it, so typing on a closed field lands
   * where typing in the open list would.
   */
  openedWith?: string;
  /** The listbox's accessible name, for a list nothing else names. */
  label?: string;
  /** More than one option can be chosen: the listbox says so to a screen reader. */
  multiselectable?: boolean;
  /** Classes for the list's outer box: `w-full` fills a popup at the trigger's width. */
  className?: string;
}

/** Enough rows to hold a popup's height without pretending to know the count. */
const SKELETON_ROWS = 5;

/** A pause this long ends a typeahead, as on a native select. */
const TYPEAHEAD_PAUSE_MS = 1000;

/** The search a list makes unless told otherwise: the label contains the query. */
function labelContains(option: Option, query: string): boolean {
  return option.label.toLowerCase().includes(query);
}

/**
 * The options a query leaves, in the order the list shows them. Without
 * `matches` the list doesn't filter, as when the search happens elsewhere.
 */
function shownFor(
  options: Option[],
  query: string,
  matches: ((option: Option, query: string) => boolean) | undefined,
  groupOf?: (option: Option) => string,
  groups?: OptionGroup[],
): Option[] {
  const q = query.trim().toLowerCase();
  const matched = q && matches ? options.filter((option) => matches(option, q)) : options;
  return inGroupOrder(matched, groupOf, groups);
}

/**
 * The next row in `step`'s direction that can be picked, or `from` when there
 * is none.
 *
 * Arrowing onto a disabled option used to be possible, and Enter there did
 * nothing at all — no move, no pick, no sound. Silence is the worst answer a
 * keypress can get, so the highlight never stops somewhere Enter cannot act.
 */
function nextEnabled(rows: Option[], from: number, step: 1 | -1): number {
  for (let i = from + step; i >= 0 && i < rows.length; i += step) {
    if (!rows[i]?.disabled) {
      return i;
    }
  }
  return from;
}

/**
 * Where the cursor starts: on the chosen row, so opening the list and pressing
 * Enter keeps the value rather than silently changing it. With nothing chosen,
 * on the first row that can be picked, where Home goes.
 */
function seatOf(rows: Option[], isSelected: (value: string) => boolean): number {
  const chosen = rows.findIndex((option) => isSelected(option.value));
  return chosen >= 0 ? chosen : nextEnabled(rows, -1, 1);
}

/** The first row from `from` on, wrapping round, that can be picked and whose label starts with `typed`. */
function typeaheadMatch(rows: Option[], typed: string, from: number): number | undefined {
  for (let step = 0; step < rows.length; step += 1) {
    const index = (from + step) % rows.length;
    const option = rows[index];
    if (option && !option.disabled && option.label.toLowerCase().startsWith(typed)) {
      return index;
    }
  }
  return undefined;
}

/** A key that types a character, not one held with a modifier for a shortcut. */
function typesACharacter(event: React.KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

// The keyboard-navigable listbox shared by Combobox, MultiCombobox,
// ToggleChips and UserPicker. Selection semantics live in the caller via
// isSelected/onPick. Searching is on by default and can be turned off for a
// short fixed set. The keys are the same either way but for typing, which goes
// to the search box when there is one and to the typeahead when there isn't.
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
  renderLeading,
  renderTrailing,
  matches = labelContains,
  header,
  footer,
  emptyLabel = 'Nothing to pick',
  noMatchLabel,
  noMatchHint,
  loading = false,
  onQueryChange,
  openedWith,
  label,
  multiselectable,
  className,
}: ComboboxListProps) {
  const searchedElsewhere = onQueryChange !== undefined;
  // The list filters only when the search is its own.
  const search = searchedElsewhere ? undefined : matches;
  const [query, setQuery] = useState('');
  // The keyboard cursor, which is NOT the selection — the same split OptionRow
  // draws as two channels. The list mounts as it opens, so this is where the
  // cursor opens: on the chosen row, or where the opening key's typeahead lands.
  const [cursorIndex, setCursorIndex] = useState(() => {
    const rows = shownFor(options, '', undefined, groupOf, groups);
    const seat = seatOf(rows, isSelected);
    if (!openedWith || searchable) {
      return seat;
    }
    // From the row after the chosen one, as a native select does, so the first
    // letter of the value moves on to the next option starting with it.
    const chosen = rows.findIndex((option) => isSelected(option.value));
    return typeaheadMatch(rows, openedWith.toLowerCase(), chosen + 1) ?? seat;
  });
  // What has been typed so far, and when the last key came.
  const typed = useRef('');
  const typedAt = useRef(0);
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

  // The key that opened the list is the typeahead's first, so the next key
  // goes on from it rather than starting a search of its own.
  useEffect(() => {
    if (openedWith && !searchable) {
      typed.current = openedWith.toLowerCase();
      typedAt.current = Date.now();
    }
  }, [openedWith, searchable]);

  const filtered = useMemo(() => {
    return shownFor(options, query, search, groupOf, groups);
  }, [options, query, search, groupOf, groups]);

  const cursorId = filtered[cursorIndex]
    ? `${listId}-opt-${filtered[cursorIndex].value}`
    : undefined;

  // Keep the cursor's row in sight when a key moves it out of the list's
  // scrolled window — End, or a typeahead, can jump past the bottom. The list
  // scrolls, never the page: the popup may still be off-screen while it is
  // being placed.
  useEffect(() => {
    const list = listRef.current;
    const row = cursorId ? document.getElementById(cursorId) : null;
    if (!list || !row) {
      return;
    }
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) {
      list.scrollTop = top;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [cursorId]);

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

  /** Whether a typeahead is under way, so a Space is part of it rather than a pick. */
  function typing(): boolean {
    return typed.current !== '' && Date.now() - typedAt.current < TYPEAHEAD_PAUSE_MS;
  }

  /**
   * Moves the cursor to the first option whose label starts with what has
   * been typed, as a native select does. One letter pressed again and again
   * steps through the options that start with it.
   */
  function typeahead(key: string) {
    const sofar = typing() ? typed.current : '';
    const next = sofar + key.toLowerCase();
    typed.current = next;
    typedAt.current = Date.now();
    const repeated = [...next].every((character) => character === next[0]);
    const found = repeated
      ? typeaheadMatch(filtered, next.slice(0, 1), cursorIndex + 1)
      : typeaheadMatch(filtered, next, Math.max(cursorIndex, 0));
    if (found !== undefined) {
      setCursorIndex(found);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const { key } = event;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      setCursorIndex((index) => nextEnabled(filtered, index, key === 'ArrowDown' ? 1 : -1));
    } else if ((key === 'Home' || key === 'End') && !event.shiftKey) {
      // In the search box too, where they would otherwise move the caret: the
      // list is what the keys drive. Shift is left alone, so Shift+Home still
      // selects the query.
      event.preventDefault();
      const edge =
        key === 'Home' ? nextEnabled(filtered, -1, 1) : nextEnabled(filtered, filtered.length, -1);
      if (filtered[edge]) {
        setCursorIndex(edge);
      }
    } else if (key === 'Enter') {
      event.preventDefault();
      pick(cursorIndex);
    } else if (!searchable && typesACharacter(event)) {
      // Space picks, as on a select, unless it comes inside a typeahead, where
      // it is part of a label: "In r" for "In review".
      event.preventDefault();
      if (key === ' ' && !typing()) {
        pick(cursorIndex);
      } else {
        typeahead(key);
      }
    }
  }

  function row(option: Option, index: number) {
    const selected = isSelected(option.value);
    // No onMouseEnter. The cursor is the parent's state and hover is CSS inside
    // OptionRow, so a mouse resting over the list can no longer decide what
    // Enter commits. OptionRow also draws the selection check, which is why
    // none is passed here.
    return (
      <OptionRow
        key={option.value}
        id={`${listId}-opt-${option.value}`}
        selected={selected}
        cursor={index === cursorIndex}
        disabled={option.disabled}
        reason={option.disabledReason}
        // The caller's leading first; an option's own icon where it has none.
        leading={
          renderLeading?.(option) ??
          (option.icon ? <Icon name={option.icon} size="md" /> : undefined)
        }
        trailing={renderTrailing?.(option)}
        onPick={() => pick(index)}
      >
        {renderOption ? (
          renderOption(option, selected)
        ) : option.color ? (
          // Same shape as the trigger: a Pill is an unshrinkable flex item, so
          // it needs `min-w-0` before the label's `truncate` can fire at all.
          <Pill
            tone={option.color}
            shape="round"
            className="min-w-0"
            label={<span className="truncate">{option.label}</span>}
          />
        ) : (
          <MatchedLabel label={option.label} query={query} />
        )}
      </OptionRow>
    );
  }

  return (
    <div className={cn('flex max-h-288 w-256 flex-col', className)}>
      {searchable ? (
        <div className="border-gray-6 flex items-center gap-8 border-b-1 px-12 py-9">
          <span aria-hidden className="text-12/17 text-gray-9 font-sans">
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
              const next = event.target.value;
              setQuery(next);
              // The first row the new query leaves that can be picked, so the
              // cursor never starts where Enter cannot act.
              const rows = shownFor(options, next, search, groupOf, groups);
              setCursorIndex(Math.max(nextEnabled(rows, -1, 1), 0));
              onQueryChange?.(next);
            }}
            onKeyDown={onKeyDown}
            className={cn(
              'text-13/19 text-gray-12 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans',
              'placeholder:text-gray-9 focus:ring-0 focus:outline-none',
            )}
          />
        </div>
      ) : null}
      {header ? <div className="border-gray-6 border-b-1 px-6 py-4">{header}</div> : null}
      {/* Only while filtering. On an unfiltered list the total says nothing the
          list itself does not, and a permanent counter over three options is
          noise; while filtering it is the difference between "this is a short
          list" and "your query hid 211 things". */}
      {/* Not for a list searched elsewhere either: "12 of 12" would be the
          size of one page of results, not of what the query hid. */}
      {query.trim() && filtered.length > 0 && !searchedElsewhere ? (
        <div className="text-10 text-gray-9 px-12 pt-6 font-mono">
          {filtered.length} of {options.length}
        </div>
      ) : null}
      {/* Without the search box the list is what opens focused, so it carries
          the key handling and the active-descendant pointer the input would
          otherwise own. `tabIndex={-1}` makes it programmatically focusable
          without adding a tab stop. `relative` makes it the rows' offset
          parent, which is what keeping the cursor in sight measures from. */}
      <ul
        id={listId}
        role="listbox"
        ref={listRef}
        aria-label={label}
        aria-multiselectable={multiselectable ? true : undefined}
        aria-activedescendant={searchable ? undefined : cursorId}
        tabIndex={searchable ? undefined : -1}
        onKeyDown={searchable ? undefined : onKeyDown}
        className="relative flex-1 overflow-y-auto p-5 focus:outline-none"
      >
        {loading
          ? Array.from({ length: SKELETON_ROWS }, (_, row) => {
              return (
                <li
                  key={row}
                  role="presentation"
                  // The same 34px an OptionRow occupies, so the popup does not
                  // resize when the real rows replace these.
                  className="flex h-34 items-center px-9"
                >
                  <span className="rounded-3 bg-gray-5 h-8 w-full animate-pulse" />
                </li>
              );
            })
          : null}
        {!loading && filtered.length === 0 ? (
          <li className="text-12/17 text-gray-9 px-8 py-12 text-center font-sans">
            {/* Two different empties. "No matches" in front of a list that was
                never populated reads as though a filter is hiding something,
                and sends you looking for the filter to clear.
                When a query IS the cause, naming it back is what makes that
                obvious — and it must never be invented for a list that was
                simply empty. */}
            {options.length === 0 ? (
              emptyLabel
            ) : (
              <>
                <div className="text-gray-11">
                  {typeof noMatchLabel === 'function'
                    ? noMatchLabel(query.trim())
                    : (noMatchLabel ?? (
                        <>
                          No matches for <span className="font-500">“{query.trim()}”</span>
                        </>
                      ))}
                </div>
                {noMatchHint ? <div className="text-11 pt-4">{noMatchHint}</div> : null}
              </>
            )}
          </li>
        ) : null}
        {/* Each `li` is `role="none"`. A listbox holds options and groups, and
            a list item between them breaks the chain from option to list. */}
        {loading
          ? null
          : groupOf
            ? groupRuns(filtered, groupOf, groups).map((run, at) => {
                // A group its heading names, so a screen reader says which
                // group the cursor has moved into, not only which option.
                const headingId = `${listId}-group-${at}`;
                return (
                  <li key={`${at}-${run.key}`} role="none">
                    <div role="group" aria-labelledby={headingId}>
                      <GroupHeading id={headingId}>{run.label}</GroupHeading>
                      {run.rows.map(({ option, index }) => row(option, index))}
                    </div>
                  </li>
                );
              })
            : filtered.map((option, index) => {
                return (
                  <li key={option.value} role="none">
                    {row(option, index)}
                  </li>
                );
              })}
      </ul>
      {footer ? (
        <div className="border-gray-6 text-11 text-gray-9 border-t-1 px-12 py-7 font-sans">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
