import { useMemo, useState } from 'react';
import { cn } from '../../../../style';
import { Avatar, type AvatarSize } from '../../../primitives/components/avatar';
import { Icon, type IconSize } from '../../../primitives/components/icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../../contract';
import { fieldClass, fieldState, triggerPrefixClass } from '../../parts/field';
import { Popup } from '../../parts/popup';
import { PeopleList } from './people-list';
import type { Person } from './person';

export type { Person } from './person';

const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };
const AVATAR: Record<ControlSize, AvatarSize> = { xs: 'xs', md: 'sm', lg: 'md' };

export type UserPickerProps = Omit<ControlProps<string[]>, 'value' | 'onChange'> & {
  /** Everyone who can be picked, in the order the list shows them. */
  people: Person[];
  /** Always an array, even for a single picker. "Nobody" has exactly one
   *  spelling — `[]` — rather than being `null` here and `[]` there. */
  value: string[];
  /** The new list of chosen ids. */
  onChange: (value: string[]) => void;
  /** One person, or several. Single closes on pick; multi stays open. */
  multiple?: boolean;
  /** How many avatars before the rest collapse to `+N`. */
  maxAvatars?: number;
  /** Shown on the field while nobody is chosen. */
  placeholder?: string;
  /**
   * Words before the value on the field, in the muted tone, as a filter bar
   * names a field inside its control: "Type:" in "Type: any". With one, the
   * placeholder reads as a value would.
   */
  prefix?: string;
  /** The accessible name of the list of people. */
  label?: string;
};

/**
 * Pick a person — the most-used control in the product, so it gets the shortest
 * path: avatar, name, one keystroke.
 *
 * Unassigned is a DASHED RING rather than an empty avatar. An empty avatar is a
 * person whose picture failed to load; a dashed ring is a slot with nobody in
 * it. Every tracker gets this wrong once and every user reads it as a bug.
 *
 * `value` is `string[]` for both modes. A single picker holding `string | null`
 * and a multi holding `string[]` would need two of everything downstream, and
 * "nobody assigned" would have two spellings that drift.
 *
 * The list is `ComboboxList`, the one every combobox opens, so its keys are
 * theirs: the arrows step over a disabled person, Home and End go to the ends.
 */
export function UserPicker({
  id,
  'aria-describedby': ariaDescribedBy,
  value,
  onChange,
  people,
  multiple = false,
  maxAvatars = 3,
  placeholder = 'Unassigned',
  prefix,
  label = 'People',
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: UserPickerProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);

  const chosen = useMemo(() => {
    return value
      .map((personId) => people.find((p) => p.id === personId))
      .filter(Boolean) as Person[];
  }, [people, value]);

  function toggle(personId: string) {
    if (readOnly) {
      return;
    }
    if (!multiple) {
      onChange([personId]);
      setOpen(false);
      return;
    }
    // Multi stays open: picking three reviewers should not cost three trips.
    onChange(value.includes(personId) ? value.filter((v) => v !== personId) : [...value, personId]);
  }

  const shown = chosen.slice(0, maxAvatars);
  const hidden = chosen.length - shown.length;

  const trigger = (
    <button
      id={id}
      aria-describedby={ariaDescribedBy}
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
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
          chosen.length > 0 || prefix ? 'text-gray-12' : 'text-gray-9',
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
    >
      <span className="flex min-w-0 items-center gap-8">
        {prefix ? <span className={triggerPrefixClass}>{prefix}</span> : null}
        {chosen.length === 0 ? (
          // The dashed ring. NOT an empty avatar — that reads as a picture that
          // failed to load rather than a slot nobody is in.
          <span
            aria-hidden
            className="border-gray-8 size-20 shrink-0 rounded-full border-1 border-dashed"
          />
        ) : (
          // Overlapped, so several people cost less width than several chips.
          <span className="flex shrink-0 -space-x-6">
            {shown.map((person) => {
              return (
                <Avatar
                  key={person.id}
                  name={person.name}
                  size={AVATAR[size]}
                  className="ring-surface-raised ring-1"
                />
              );
            })}
          </span>
        )}
        <span className="truncate">
          {chosen.length === 0
            ? placeholder
            : chosen.length === 1
              ? chosen[0]?.name
              : // A count rather than a list: three names do not fit and the
                // avatars already say who.
                `${chosen.length} people`}
        </span>
        {hidden > 0 ? (
          <span className="text-11 text-gray-9 shrink-0 font-mono">+{hidden}</span>
        ) : null}
      </span>
      {readOnly ? null : (
        <Icon name="chevron-down" size={CHEVRON[size]} className="text-gray-9 shrink-0" />
      )}
    </button>
  );

  return (
    <Popup
      open={open}
      onOpenChange={(next) => setOpen(readOnly ? false : next)}
      trigger={trigger}
      matchTriggerWidth
      // The list draws its own padding, under the search box as on every
      // combobox; the popup's would double it.
      className="p-0"
    >
      {/* Mounted as the popup opens, so each opening starts with an empty
          search and the cursor on the first person chosen. */}
      <PeopleList
        people={people}
        isSelected={(personId) => value.includes(personId)}
        onPick={toggle}
        multiple={multiple}
        label={label}
      />
    </Popup>
  );
}
