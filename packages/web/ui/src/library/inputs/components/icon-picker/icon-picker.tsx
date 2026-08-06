import { useEffect, useMemo, useState } from 'react';
import { cn, cursorRing, focusRing } from '../../../../style';
import { Icon, ICON_NAMES, type IconName, type IconSize } from '../../../icon';
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
  placeholder?: string;
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
    if (open) setQuery('');
  }, [open]);

  function commit(index: number) {
    const name = matches[index];
    if (!name) return;
    onChange(name);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -COLUMNS,
      ArrowDown: COLUMNS,
    };
    const delta = moves[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      setCursor((index) => Math.min(matches.length - 1, Math.max(0, index + delta)));
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
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="dialog"
      disabled={disabled}
      aria-disabled={readOnly || undefined}
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
        <span className="truncate font-mono text-12">{selected ?? placeholder}</span>
      </span>
      {readOnly ? null : (
        <Icon name="chevron-down" size={CHEVRON[size]} className="shrink-0 text-gray-9" />
      )}
    </button>
  );

  return (
    <Popup open={open} onOpenChange={(next) => setOpen(readOnly ? false : next)} trigger={trigger}>
      <div className="flex w-288 flex-col gap-6">
        <div className="flex items-center gap-8 border-b-1 border-gray-6 px-4 pb-6">
          <Icon name="search" size="xs" className="shrink-0 text-gray-9" />
          <input
            type="text"
            role="searchbox"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Search ${icons.length} icons`}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-13 text-gray-12 outline-none placeholder:text-gray-9"
          />
        </div>

        {matches.length === 0 ? (
          // Names the query and offers a way forward. "No results" alone leaves
          // you guessing whether the set is small or the spelling was wrong.
          <div className="px-8 py-16 text-center">
            <p className="font-sans text-12 text-gray-11">No icon matches “{query}”</p>
            <p className="mt-2 font-sans text-11 text-gray-9">
              Try “circle”, “chevron” or “arrow”.
            </p>
          </div>
        ) : (
          <div
            role="grid"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            className="grid grid-cols-[repeat(8,32px)] gap-2 overflow-y-auto outline-none"
            style={{ maxHeight: VISIBLE_ROWS * 34 }}
          >
            {matches.map((name, index) => (
              <button
                key={name}
                type="button"
                role="gridcell"
                aria-label={name}
                aria-selected={name === selected}
                tabIndex={index === cursor ? 0 : -1}
                onFocus={() => setCursor(index)}
                onClick={() => commit(index)}
                className={cn(
                  'flex size-32 items-center justify-center rounded-control-xs text-gray-11',
                  'hover:bg-gray-4 hover:text-gray-12',
                  focusRing(field.scale, 'focus-visible', 'inward'),
                  index === cursor && cursorRing(field.scale),
                  name === selected && `bg-${field.scale}-9 text-${field.scale}-contrast`,
                )}
              >
                <Icon name={name} size="xs" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Popup>
  );
}
