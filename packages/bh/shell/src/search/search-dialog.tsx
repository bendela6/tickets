// The app's search as a dialog: a field, the results under it, and the keys to
// move through them. It searches nothing itself. The app passes `search`, which
// turns what the reader typed into results, and `onSelect`, which goes to the
// one picked, so the same dialog finds pages, records or commands.

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CornerDownLeft, Search, type LucideIcon } from 'lucide-react';
import { cn, DialogContent, DialogRoot, DialogTitle, Kbd } from '@bh/ui';
import { NAV_STYLES } from '../nav';

/** What the dialog shows of a result. The app's own fields ride along to `onSelect`. */
export interface SearchResult {
  /** Unique among one search's results: the row's key. */
  id: string;
  /** The first line: what the result is called. */
  label: string;
  /** A quieter second line, such as the heading it found or the text around a match. */
  detail?: string;
  /** The heading over a run of results. A result in the same group as the one above it shares that heading. */
  group?: string;
  /** A lucide icon before the label. */
  icon?: LucideIcon;
}

/** Props for SearchDialog component. */
export interface SearchDialogProps<T extends SearchResult = SearchResult> {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called with `false` when it closes: by Esc, a click on the dim, or a pick. */
  onOpenChange: (open: boolean) => void;
  /**
   * The results for what the reader typed, best first. Called while the dialog
   * is open, with `''` as it opens, for what to offer before anything is typed.
   * It answers at once, from what the app already holds.
   */
  search: (query: string) => readonly T[];
  /** Called with the result picked, by Enter or a click, as the dialog closes. */
  onSelect: (result: T) => void;
  /** The dialog's name, for a screen reader, and the field's. */
  label?: string;
  /** The field's placeholder. Without it, the label and an ellipsis: `Search…`. */
  placeholder?: string;
  /** What the dialog says when nothing matches. */
  empty?: ReactNode;
  /** A note at the end of the footer, such as what the search reads. */
  hint?: ReactNode;
}

/**
 * A search in a dialog: type, move with the arrows, open with Enter. The app
 * opens it, from `AppShell`'s `onSearch` or a button of its own, and hands it
 * the search and what to do with a pick.
 */
export function SearchDialog<T extends SearchResult = SearchResult>({
  open,
  onOpenChange,
  search,
  onSelect,
  label = 'Search',
  placeholder,
  empty = 'Nothing matches that.',
  hint,
}: SearchDialogProps<T>) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="top-72 w-[min(36rem,calc(100vw-2rem))] translate-y-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        {/* The content is only drawn while the dialog is open, so the query
            and the lit row start afresh each time it opens, and the app's
            search runs only then. */}
        <SearchBody
          search={search}
          onPick={(result) => {
            onOpenChange(false);
            onSelect(result);
          }}
          label={label}
          placeholder={placeholder ?? `${label}…`}
          empty={empty}
          hint={hint}
        />
      </DialogContent>
    </DialogRoot>
  );
}

interface SearchBodyProps<T extends SearchResult> {
  search: (query: string) => readonly T[];
  onPick: (result: T) => void;
  label: string;
  placeholder: string;
  empty: ReactNode;
  hint: ReactNode;
}

function SearchBody<T extends SearchResult>({
  search,
  onPick,
  label,
  placeholder,
  empty,
  hint,
}: SearchBodyProps<T>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => search(query), [search, query]);
  // Results can shrink under the lit row without the query changing, when the
  // app's data does; the last row is lit then rather than none.
  const lit = Math.min(active, results.length - 1);
  const listRef = useRef<HTMLUListElement>(null);

  // The arrows can move past what the list shows; keep the lit row in view.
  useEffect(() => {
    listRef.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' });
  }, [lit]);

  const pick = (result: T | undefined) => {
    if (result) {
      onPick(result);
    }
  };

  return (
    <>
      <div className="border-gray-6 flex h-48 items-center gap-10 border-b-1 px-16">
        <Search size={16} strokeWidth={1.75} className="text-gray-10 shrink-0" />
        <input
          type="search"
          aria-label={label}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive(Math.max(0, Math.min(lit + 1, results.length - 1)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive(Math.max(lit - 1, 0));
            } else if (event.key === 'Enter') {
              pick(results[lit]);
            }
          }}
          className="text-15 text-gray-12 caret-indigo-9 placeholder:text-gray-9 min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <Kbd keys="esc" />
      </div>

      <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-6">
        {results.length === 0 ? (
          <p className="text-13 text-gray-10 px-10 py-24 text-center">{empty}</p>
        ) : (
          <ul ref={listRef} aria-label="Results" className="flex flex-col">
            {results.map((result, index) => {
              const first = result.group && results[index - 1]?.group !== result.group;
              const isLit = index === lit;
              const Glyph = result.icon;
              return (
                <Fragment key={result.id}>
                  {first ? (
                    <li
                      aria-hidden
                      className="text-11 text-gray-9 px-10 pt-10 pb-4 font-mono tracking-wider uppercase"
                    >
                      {result.group}
                    </li>
                  ) : null}
                  <li>
                    <button
                      type="button"
                      aria-current={isLit ? 'true' : undefined}
                      onMouseMove={() => setActive(index)}
                      onClick={() => pick(result)}
                      className={cn(
                        'rounded-6 text-13 flex min-h-36 w-full items-center gap-10 px-10 py-6 text-left',
                        NAV_STYLES.focusRing,
                        isLit ? NAV_STYLES.active : 'text-gray-11',
                      )}
                    >
                      {Glyph ? (
                        <Glyph
                          size={14}
                          strokeWidth={1.75}
                          className={cn('shrink-0', isLit ? 'text-indigo-9' : 'text-gray-9')}
                        />
                      ) : null}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{result.label}</span>
                        {result.detail ? (
                          <span className="text-12 text-gray-10 truncate">{result.detail}</span>
                        ) : null}
                      </span>
                      {isLit ? (
                        <CornerDownLeft size={14} strokeWidth={1.75} className="shrink-0" />
                      ) : null}
                    </button>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-gray-6 bg-gray-1 text-11 text-gray-9 flex h-36 items-center gap-12 border-t-1 px-16 font-mono">
        <span>
          <Kbd keys="up" size="sm" /> <Kbd keys="down" size="sm" /> move
        </span>
        <span>
          <Kbd keys="enter" size="sm" /> open
        </span>
        <span className="flex-1" />
        {hint ? <span>{hint}</span> : null}
      </div>
    </>
  );
}
