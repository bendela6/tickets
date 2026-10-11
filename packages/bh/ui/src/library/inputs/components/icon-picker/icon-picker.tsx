import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn, cursorRing, focusRing } from '../../../../style';
import {
  Icon,
  ICON_NAMES,
  type IconName,
  type IconSize,
} from '../../../primitives/components/icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../../contract';
import { fieldClass, fieldState } from '../../parts/field';
import { Popup } from '../../parts/popup';

const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

/** Eight across, six rows visible — the design's "groups keep the scroll
 *  finite · 6 rows visible", achieved here with a max height because our
 *  registry is small enough not to need the groups. */
const COLUMNS = 8;
const VISIBLE_ROWS = 6;

export type IconPickerProps = ControlProps<string | null> & {
  /** Shown on the field while no icon is chosen. */
  placeholder?: string;
  /** The accessible name of the icon grid. */
  label?: string;
  /**
   * Restrict and order the offered set. Defaults to the whole registry.
   *
   * This is also where grouping would enter if the registry ever carries it:
   * today it is a flat map with no category metadata, so the design's
   * "LAYOUT · 24 / STATUS · 18" headers have no data behind them and are NOT
   * implemented. Inventing a taxonomy for the icon set is a separate decision
   * from building the picker.
   */
  icons?: IconName[];
};

/**
 * Pick one icon from a searchable grid.
 *
 * The trigger shows the GLYPH, not just its name — the design is explicit, and
 * the reason is that a name like `circle-dashed` describes a drawing far less
 * well than the drawing does. The name stays too, because it is what you search
 * by and what a screen reader can say.
 */
export function IconPicker({
  id,
  'aria-describedby': ariaDescribedBy,
  value,
  onChange,
  placeholder = 'Choose an icon',
  label = 'Icons',
  icons = ICON_NAMES,
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const field = fieldState(tone);
  const selected = icons.includes(value as IconName) ? (value as IconName) : undefined;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? icons.filter((name) => name.includes(q)) : icons;
  }, [icons, query]);

  const [cursor, setCursor] = useState(0);
  // A filter that leaves the cursor where it was would point past the end of a
  // shorter list, so it resets with every query.
  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    if (open) {
      setQuery('');
    }
  }, [open]);

  function commit(index: number) {
    const name = matches[index];
    if (!name) {
      return;
    }
    onChange(name);
    setOpen(false);
  }

  // Focus stays in the search box while the arrows move the highlight, so the
  // box names the highlighted cell; a cell that has focus hands it on instead.
  const gridId = useId();
  const cellId = (index: number) => `${gridId}-cell-${index}`;
  const gridRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => {
    const out: IconName[][] = [];
    for (let at = 0; at < matches.length; at += COLUMNS) {
      out.push(matches.slice(at, at + COLUMNS));
    }
    return out;
  }, [matches]);

  function onKeyDown(event: React.KeyboardEvent, moves: Record<string, number>) {
    const delta = moves[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      const next = Math.min(matches.length - 1, Math.max(0, cursor + delta));
      setCursor(next);
      if (event.target instanceof HTMLElement && event.target.getAttribute('role') === 'gridcell') {
        gridRef.current?.querySelectorAll<HTMLElement>('[role="gridcell"]')[next]?.focus();
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(cursor);
    }
  }

  const trigger = (
    <button
      id={id}
      aria-describedby={ariaDescribedBy}
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="dialog"
      disabled={disabled}
      aria-disabled={readOnly ? true : undefined}
      aria-invalid={field.invalid || undefined}
      className={fieldClass({
        size,
        state: field.state,
        scale: field.scale,
        focus: 'focus-visible',
        className: cn(
          'flex w-full items-center justify-between gap-8 font-sans',
          selected ? 'text-gray-12' : 'text-gray-9',
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
    >
      <span className="flex min-w-0 items-center gap-8">
        {/* The glyph itself. `circle-dashed` describes a drawing far less well
            than the drawing does. */}
        {selected ? <Icon name={selected} size="xs" className="shrink-0" /> : null}
        <span className="text-12 truncate font-mono">{selected ?? placeholder}</span>
      </span>
      {readOnly ? null : (
        <Icon name="chevron-down" size={CHEVRON[size]} className="text-gray-9 shrink-0" />
      )}
    </button>
  );

  return (
    <Popup open={open} onOpenChange={(next) => setOpen(readOnly ? false : next)} trigger={trigger}>
      <div className="flex w-288 flex-col gap-6">
        <div className="border-gray-6 flex items-center gap-8 border-b-1 px-4 pb-6">
          <Icon name="search" size="xs" className="text-gray-9 shrink-0" />
          <input
            type="text"
            role="searchbox"
            aria-controls={matches.length > 0 ? gridId : undefined}
            aria-activedescendant={matches[cursor] ? cellId(cursor) : undefined}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // Up and Down only: Left and Right are the text caret's.
            onKeyDown={(event) => onKeyDown(event, { ArrowUp: -COLUMNS, ArrowDown: COLUMNS })}
            placeholder={`Search ${icons.length} icons`}
            className="text-13 text-gray-12 placeholder:text-gray-9 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans outline-none"
          />
        </div>

        {matches.length === 0 ? (
          // Names the query and offers a way forward. "No results" alone leaves
          // you guessing whether the set is small or the spelling was wrong.
          <div className="px-8 py-16 text-center">
            <p className="text-12 text-gray-11 font-sans">No icon matches “{query}”</p>
            <p className="text-11 text-gray-9 mt-2 font-sans">
              Try “circle”, “chevron” or “arrow”.
            </p>
          </div>
        ) : (
          <div
            ref={gridRef}
            id={gridId}
            role="grid"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={(event) => {
              onKeyDown(event, {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -COLUMNS,
                ArrowDown: COLUMNS,
              });
            }}
            className="flex flex-col gap-2 overflow-y-auto outline-none"
            style={{ maxHeight: VISIBLE_ROWS * 34 }}
          >
            {/* Rows, as a grid's cells must be in: eight cells a row. */}
            {rows.map((row, rowIndex) => {
              return (
                <div key={row[0]} role="row" className="flex gap-2">
                  {row.map((name, column) => {
                    const index = rowIndex * COLUMNS + column;
                    return (
                      <button
                        key={name}
                        id={cellId(index)}
                        type="button"
                        role="gridcell"
                        aria-label={name}
                        aria-selected={name === selected}
                        tabIndex={index === cursor ? 0 : -1}
                        onFocus={() => setCursor(index)}
                        onClick={() => commit(index)}
                        className={cn(
                          'rounded-3 text-gray-11 flex size-32 shrink-0 items-center justify-center',
                          'hover:bg-gray-4 hover:text-gray-12',
                          focusRing(field.scale, 'focus-visible', 'inward'),
                          index === cursor && cursorRing(field.scale),
                          name === selected && `bg-${field.scale}-9 text-${field.scale}-contrast`,
                        )}
                      >
                        <Icon name={name} size="xs" />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Popup>
  );
}
