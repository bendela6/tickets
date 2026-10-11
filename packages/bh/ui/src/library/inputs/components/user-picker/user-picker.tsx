import { useEffect, useId, useMemo, useState } from 'react';
import { cn } from '../../../../style';
import { Avatar, type AvatarSize } from '../../../primitives/components/avatar';
import { Icon, type IconSize } from '../../../primitives/components/icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../../contract';
import { fieldClass, fieldState } from '../../parts/field';
import { OptionRow } from '../../parts/option-row';
import { Popup } from '../../parts/popup';

const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };
const AVATAR: Record<ControlSize, AvatarSize> = { xs: 'xs', md: 'sm', lg: 'md' };

/** Someone a UserPicker offers. */
export interface Person {
  /** What `value` holds for this person. */
  id: string;
  /** Shown in the list, and on the field when only this person is chosen; the avatar takes its initials. */
  name: string;
  /** Secondary line in the list — a handle, a team, a role. */
  detail?: string;
}

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
  label = 'People',
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: UserPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const field = fieldState(tone);

  const chosen = useMemo(() => {
    return value
      .map((personId) => people.find((p) => p.id === personId))
      .filter(Boolean) as Person[];
  }, [people, value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return people;
    }
    return people.filter(
      (p) => p.name.toLowerCase().includes(q) || p.detail?.toLowerCase().includes(q),
    );
  }, [people, query]);

  const [cursor, setCursor] = useState(0);
  // The search box keeps focus while the arrows move the highlight, so it
  // names the highlighted row (`aria-activedescendant`) and the list.
  const listId = useId();
  const optionId = (personId: string) => `${listId}-opt-${personId}`;
  const current = matches[cursor];
  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    if (open) {
      setQuery('');
    }
  }, [open]);

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

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((index) => Math.min(matches.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const person = matches[cursor];
      if (person) {
        toggle(person.id);
      }
    }
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
          chosen.length > 0 ? 'text-gray-12' : 'text-gray-9',
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
    >
      <span className="flex min-w-0 items-center gap-8">
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
    >
      <div className="flex flex-col gap-6">
        <div className="border-gray-6 flex items-center gap-8 border-b-1 px-4 pb-6">
          <Icon name="search" size="xs" className="text-gray-9 shrink-0" />
          <input
            type="text"
            role="searchbox"
            aria-controls={listId}
            aria-activedescendant={current ? optionId(current.id) : undefined}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search people"
            className="text-13 text-gray-12 placeholder:text-gray-9 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans outline-none"
          />
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label={label}
          aria-multiselectable={multiple || undefined}
          className="flex max-h-256 flex-col gap-2 overflow-y-auto"
        >
          {matches.length === 0 ? (
            <p className="text-12 text-gray-9 px-9 py-12 text-center font-sans">
              Nobody matches “{query}”
            </p>
          ) : null}
          {matches.map((person, index) => {
            return (
              <OptionRow
                key={person.id}
                id={optionId(person.id)}
                selected={value.includes(person.id)}
                cursor={index === cursor}
                onPick={() => toggle(person.id)}
                leading={<Avatar name={person.name} size="xs" />}
                trailing={
                  person.detail ? (
                    <span className="text-11 text-gray-9 shrink-0 font-mono">{person.detail}</span>
                  ) : undefined
                }
              >
                {person.name}
              </OptionRow>
            );
          })}
        </div>
      </div>
    </Popup>
  );
}
