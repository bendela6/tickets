import { useRef, useState } from 'react';
import { cn } from '../../../../style';
import { Chip } from '../../parts/chip';
import {
  CONTROL_LADDER,
  type ControlProps,
  type Option,
  disabledTreatment,
  readOnlyFieldClass,
} from '../../contract';
import { fieldClass, fieldState } from '../../parts/field';

export type TagInputProps = ControlProps<string[]> & {
  /** Existing tags to offer while typing. Free text is still allowed — these
   *  only save keystrokes and spelling. */
  suggestions?: Option[];
  /** Shown in the field while there are no tags. */
  placeholder?: string;
};

/**
 * Free text in, chips out — for values that do not exist until someone types
 * them, which is what separates this from MultiCombobox.
 *
 * A duplicate is REFUSED rather than silently ignored, and the refusal points
 * at the chip that already exists: the message says which tag, and the chip
 * nudges once. Silently doing nothing is the same response as a broken Enter
 * key, and adding a second identical chip is worse.
 */
export function TagInput({
  id,
  'aria-describedby': ariaDescribedBy,
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add a tag…',
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const field = fieldState(tone);
  const rung = CONTROL_LADDER[size];
  const locked = Boolean(disabled) || Boolean(readOnly);

  const trimmed = draft.trim();
  const matching = trimmed
    ? suggestions.filter((option) => {
        return (
          option.label.toLowerCase().includes(trimmed.toLowerCase()) &&
          !value.includes(option.value)
        );
      })
    : [];
  const exact = value.some((tag) => tag.toLowerCase() === trimmed.toLowerCase());

  function add(tag: string) {
    const next = tag.trim();
    if (!next || locked) {
      return;
    }
    if (value.some((existing) => existing.toLowerCase() === next.toLowerCase())) {
      // Name the collision and point at it. Cleared on the next keystroke, so
      // it never becomes a message you have to dismiss.
      setDuplicate(next);
      return;
    }
    onChange([...value, next]);
    setDraft('');
    setDuplicate(null);
  }

  function remove(tag: string) {
    if (locked) {
      return;
    }
    onChange(value.filter((existing) => existing !== tag));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      add(draft);
      return;
    }
    // Backspace on an EMPTY draft removes the last chip. Guarded on empty so it
    // cannot eat a chip while you are still correcting a typo.
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      event.preventDefault();
      const last = value[value.length - 1];
      if (last !== undefined) {
        remove(last);
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={fieldClass({
          size,
          state: field.state,
          scale: field.scale,
          focus: 'focus-within',
          className: cn(
            // A tag list grows: the ladder's height becomes a floor.
            'flex h-auto w-full flex-wrap items-center py-4',
            rung.gap,
            disabled && disabledTreatment,
            readOnly && readOnlyFieldClass,
            className,
          ),
        })}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => {
          return (
            <Chip
              key={tag}
              label={tag}
              size={size}
              tone={tone ?? 'primary'}
              onRemove={readOnly || disabled ? undefined : () => remove(tag)}
              className={cn(duplicate?.toLowerCase() === tag.toLowerCase() && 'animate-nudge')}
            />
          );
        })}
        <input
          ref={inputRef}
          id={id}
          aria-describedby={ariaDescribedBy}
          type="text"
          value={draft}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={value.length === 0 ? placeholder : undefined}
          aria-invalid={duplicate !== null || undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setDuplicate(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          className="text-13 text-gray-12 placeholder:text-gray-9 min-w-64 flex-1 bg-transparent p-0 font-sans outline-none"
        />
      </div>

      {duplicate ? (
        <p role="alert" className="text-11 text-red-11 font-sans">
          “{duplicate}” is already added.
        </p>
      ) : null}

      {/* Offered, never forced: this is free text, so the suggestions save
          spelling rather than bounding the answer. */}
      {trimmed && !locked ? (
        <div className="flex flex-wrap items-center gap-6">
          {!exact ? (
            <button
              type="button"
              onClick={() => add(trimmed)}
              className="rounded-3 text-11 text-gray-11 hover:bg-gray-4 hover:text-gray-12 px-6 py-2 font-mono"
            >
              + Create “{trimmed}” ↩
            </button>
          ) : null}
          {matching.slice(0, 4).map((option) => {
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => add(option.value)}
                className="rounded-3 text-11 text-gray-11 hover:bg-gray-4 hover:text-gray-12 px-6 py-2 font-mono"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
