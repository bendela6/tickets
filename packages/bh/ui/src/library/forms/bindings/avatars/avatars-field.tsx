import type { InputProps } from '@bh/form';
import { useState } from 'react';
import { axis, cn, focusRing, HUES, over, variants } from '../../../../style';
import { Avatar } from '../../../primitives/components/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../overlays/components/popover';
import { disabledTreatment, type Option, readOnlyMarkClass } from '../../../inputs/contract';
import type { Person } from '../../../inputs/components/user-picker';
import { PeopleList } from '../../../inputs/components/user-picker/people-list';
import { peopleOf } from '../people-of';

export interface AvatarsFieldConfig {
  /** Everyone who can be picked, in order: the first `maxVisible` as avatars. */
  people?: Person[];
  /**
   * People as options, as a filter form gives a ref field's rows: each
   * option's value is the person's id, its label their name. `people` wins.
   */
  options?: Option[];
  /** How many people are drawn as avatars; the rest sit behind a `+N`. Default 6. */
  maxVisible?: number;
  /** Accessible name for the group. Falls back to the field's label, then its name. */
  label?: string;
}

// Which ramp a pressed avatar's ring paints from: the primary tone's, or the
// danger tone's while the field has a problem.
const SCALE = axis('scale', HUES, 'indigo');

/**
 * One person's toggle: their avatar in a 30px circle whose 2px rim is clear at
 * rest and the tone's when pressed, so pressing it doesn't move a pixel.
 *
 * Through `variants()` because the classes are interpolated per hue, and the
 * safelist holds `variants()` output only.
 */
const toggleClass = variants({
  base: 'inline-flex size-30 shrink-0 items-center justify-center rounded-full border-2 p-0 transition-colors',
  config: {
    pressed: {
      default: 'off',
      options: {
        off: 'border-transparent hover:border-gray-7',
        on: over(SCALE, (hue) => `border-${hue}-9`),
      },
    },
    focus: {
      default: 'on',
      options: { on: over(SCALE, (hue) => focusRing(hue, 'focus-visible')) },
    },
  },
});

/**
 * People as a row of avatar toggles: press one to keep their rows, as a
 * filter bar's assignees. The same value as `user`, `string[]` of ids, with
 * every choice one click away.
 *
 * "No one" is no toggle here. In a filter it would need an any-group with the
 * others, so it is a preset of its own (`assignee empty`).
 */
export function AvatarsField(p: InputProps<AvatarsFieldConfig, string[]>) {
  const [open, setOpen] = useState(false);
  const people = peopleOf(p.config);
  const value = p.value ?? [];
  const label = p.config.label ?? p.label ?? p.name;
  const disabled = (p.disabled ?? false) || p.loading;
  const readOnly = p.readOnly ?? false;
  const locked = disabled || readOnly;
  const scale = p.error ? 'red' : 'indigo';
  const maxVisible = p.config.maxVisible ?? 6;
  const shown = people.slice(0, maxVisible);
  const hidden = people.slice(maxVisible);
  const hiddenChosen = hidden.filter((person) => value.includes(person.id)).length;

  function toggle(personId: string) {
    if (locked) {
      return;
    }
    p.onChange(
      value.includes(personId) ? value.filter((id) => id !== personId) : [...value, personId],
    );
  }

  return (
    <div
      id={p.name}
      aria-describedby={p.describedBy}
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onBlur={p.onBlur}
      className={cn(
        'flex flex-wrap items-center gap-4',
        disabled && disabledTreatment,
        readOnly && readOnlyMarkClass,
      )}
    >
      {shown.map((person) => {
        const pressed = value.includes(person.id);
        return (
          <button
            key={person.id}
            type="button"
            aria-label={person.name}
            aria-pressed={pressed}
            // ARIA allows no `aria-readonly` on a button: read-only keeps the
            // tab stop and says not-operable, as ToggleChips does.
            aria-disabled={readOnly || undefined}
            disabled={disabled || person.disabled}
            title={person.disabled ? person.disabledReason : undefined}
            onClick={() => {
              toggle(person.id);
            }}
            className={toggleClass({ pressed: pressed ? 'on' : 'off', scale })}
          >
            <Avatar name={person.name} size="lg" className="text-11 size-26" />
          </button>
        );
      })}
      {hidden.length > 0 ? (
        <Popover
          open={open && !locked}
          onOpenChange={(next) => {
            if (!locked) {
              setOpen(next);
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${hidden.length} more people`}
              aria-disabled={readOnly || undefined}
              disabled={disabled}
              className={toggleClass({
                pressed: hiddenChosen > 0 ? 'on' : 'off',
                scale,
                className: 'bg-gray-4 text-11 text-gray-11 font-mono',
              })}
            >
              +{hidden.length}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-280 p-0">
            <PeopleList
              people={hidden}
              isSelected={(personId) => value.includes(personId)}
              onPick={toggle}
              multiple
              label={label}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
