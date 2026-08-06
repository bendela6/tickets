import { useEffect, useState } from 'react';
import { cn, cursorRing, focusRing, HUES, type Hue } from '../../../style';
import { Icon, type IconSize } from '../../icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../control';
import { fieldClass, fieldState } from '../field';
import { Popup } from '../popup';

const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

/** Six across, so eleven hues fall into two rows and Up/Down is one step. */
const COLUMNS = 6;

/** Title-cased for the trigger. The token names are lower-case because they are
 *  class fragments; a person reading a label is not reading a class. */
function displayName(hue: string) {
  return hue.charAt(0).toUpperCase() + hue.slice(1);
}

export type ColorPickerProps = ControlProps<string | null> & {
  placeholder?: string;
  /** Accessible name for the swatch grid. */
  label?: string;
};

/**
 * The eleven ramps, and nothing else.
 *
 * No spectrum and no eyedropper, deliberately: every colour in this product
 * labels something — a status, a type, a tag — and a free colour is a colour
 * with no rung, which cannot be given a readable text pair or a fill. Bounding
 * the choice to the ramps is what lets a picked hue drive a chip's fill (rung 2)
 * and its text (rung 11) without anyone checking contrast by hand.
 *
 * Selection is an INSET DOT rather than a border or a ring. A border sits on the
 * swatch's own edge and mixes with it, so the colour you are judging is no
 * longer the colour you will get — the design's reason, and it is the one thing
 * a colour picker must not get wrong. The ring means the cursor here, nothing
 * else.
 */
export function ColorPicker({
  id,
  value,
  onChange,
  placeholder = 'Choose a colour',
  label = 'Colour',
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
  const selectedIndex = HUES.indexOf(value as Hue);
  const selected = selectedIndex >= 0 ? HUES[selectedIndex] : undefined;
  const [cursor, setCursor] = useState(() => Math.max(0, selectedIndex));

  useEffect(() => {
    if (open) setCursor(Math.max(0, selectedIndex));
  }, [open, selectedIndex]);

  function commit(index: number) {
    const hue = HUES[index];
    if (!hue) return;
    onChange(hue);
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
      // Clamped rather than wrapped: a grid whose last row is short would send
      // Right off the end into an index that is not drawn.
      setCursor((index) => Math.min(HUES.length - 1, Math.max(0, index + delta)));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
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
        {/* Swatch AND name, always both. A swatch alone cannot be spoken and
            cannot be searched; a name alone is the thing you were avoiding by
            using colour in the first place. */}
        {selected ? (
          <span aria-hidden className={cn('size-14 shrink-0 rounded-control-xs', `bg-${selected}-9`)} />
        ) : null}
        <span className="truncate">{selected ? displayName(selected) : placeholder}</span>
      </span>
      {readOnly ? null : (
        <Icon name="chevron-down" size={CHEVRON[size]} className="shrink-0 text-gray-9" />
      )}
    </button>
  );

  return (
    <Popup
      open={open}
      onOpenChange={(next) => setOpen(readOnly ? false : next)}
      trigger={trigger}
    >
      {/* A grid, so it takes the shell and no OptionRow — the case the two-layer
          contract exists for. */}
      <div
        role="grid"
        aria-label={label}
        tabIndex={-1}
        autoFocus
        onKeyDown={onKeyDown}
        className="grid grid-cols-[repeat(6,28px)] gap-4 outline-none"
      >
        {HUES.map((hue, index) => {
          const isSelected = hue === selected;
          return (
            <button
              key={hue}
              type="button"
              role="gridcell"
              aria-label={displayName(hue)}
              aria-selected={isSelected}
              tabIndex={index === cursor ? 0 : -1}
              onFocus={() => setCursor(index)}
              onClick={() => commit(index)}
              className={cn(
                'flex size-28 items-center justify-center rounded-control-xs',
                `bg-${hue}-9`,
                focusRing(field.scale, 'focus-visible', 'inward'),
                index === cursor && cursorRing(field.scale),
              )}
            >
              {/* The inset dot. NOT a border: a border sits on the swatch's own
                  edge and mixes with it, so the colour you are judging stops
                  being the colour you will get. `-contrast` is the token the
                  fill was chosen against, so the dot reads on all eleven. */}
              {isSelected ? (
                <span aria-hidden className={cn('size-8 rounded-full', `bg-${hue}-contrast`)} />
              ) : null}
            </button>
          );
        })}
      </div>
    </Popup>
  );
}
