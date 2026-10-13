import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../../../style';
import { Icon, type IconSize } from '../../../primitives/components/icon';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../../contract';
import { fieldClass, fieldState } from '../../parts/field';
import { OptionRow } from '../../parts/option-row';
import { Popup } from '../../parts/popup';

const CHEVRON: Record<ControlSize, IconSize> = { xs: 'sm', md: 'sm', lg: 'md' };

/**
 * Minutes since midnight from `HH:MM`, or null.
 *
 * Strict about the range as well as the shape: `25:99` matches the digits but
 * is not a time of day, and accepting it would store a number no clock can
 * show.
 */
export function parseTime(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/** `870` → `14:30`. Zero-padded both halves, so a column of times aligns. */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The last listed time before `minutes`, or at it when `orAt`. */
function listedBefore(times: number[], minutes: number, orAt = false): number | undefined {
  for (let i = times.length - 1; i >= 0; i--) {
    const time = times[i];
    if (time !== undefined && (time < minutes || (orAt && time === minutes))) {
      return time;
    }
  }
  return undefined;
}

/**
 * Scrolls the list, and only the list, until `row` shows: centred, or moved
 * the least distance. Not `scrollIntoView`, which scrolls every scrolling
 * ancestor, the page included, whenever the row is outside the window.
 */
function reveal(list: HTMLElement, row: HTMLElement | null, where: 'center' | 'nearest') {
  if (!row) {
    return;
  }
  const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
  const bottom = top + row.offsetHeight;
  if (where === 'center') {
    list.scrollTop += top - (list.clientHeight - row.offsetHeight) / 2;
  } else if (top < 0) {
    list.scrollTop += top;
  } else if (bottom > list.clientHeight) {
    list.scrollTop += bottom - list.clientHeight;
  }
}

export type TimePickerProps = ControlProps<string | null> & {
  /** Minutes between offered times. 15 unless the schedule is finer. */
  stepMinutes?: number;
  /** Shown in the field while it is empty. */
  placeholder?: string;
  /** Names the list of times for a screen reader; it does not name the field. */
  label?: string;
  /**
   * The accessible name, for a control with no visible label to point at it —
   * a filter under a column header, where the header is the only caption. A
   * control that has a `<label htmlFor>` should use that instead.
   */
  'aria-label'?: string;
};

/**
 * A time of day, held as `HH:MM`.
 *
 * A string rather than minutes-since-midnight because that is what an API
 * stores and what a person reads; the conversion belongs here, once, not at
 * every call site.
 *
 * Typing is always available beside the list. A 15-minute list is 96 rows, and
 * the one time you want is reliably the one that is not on it.
 */
export function TimePicker({
  id,
  'aria-describedby': ariaDescribedBy,
  value,
  onChange,
  stepMinutes = 15,
  placeholder = 'Set time…',
  label = 'Times',
  'aria-label': ariaLabel,
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const field = fieldState(tone);
  const selected = value ? parseTime(value) : null;
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const optionId = (minutes: number) => `${listId}-opt-${minutes}`;

  const times = useMemo(() => {
    const out: number[] = [];
    for (let m = 0; m < 24 * 60; m += stepMinutes) {
      out.push(m);
    }
    return out;
  }, [stepMinutes]);

  const parsedDraft = draft.trim() === '' ? null : parseTime(draft);
  const unparsed = draft.trim() !== '' && parsedDraft === null;

  /**
   * The keyboard cursor: the listed time the field holds, when it holds one.
   *
   * Read off the field rather than kept beside it, so the two cannot disagree.
   * The arrows write the cursor's time into the field, typing a listed time
   * puts the cursor on it, and Enter commits what the field shows either way.
   * It opens on the chosen time because the field opens holding it.
   *
   * It is not the selection: the chosen row keeps its check and
   * `aria-selected` while the cursor moves, the two channels OptionRow draws.
   */
  const cursor = parsedDraft !== null && times.includes(parsedDraft) ? parsedDraft : null;
  const cursorId = cursor === null ? undefined : optionId(cursor);

  // A cursor moved by a key or by typing is kept in view: the list shows a few
  // of its 96 rows, and a ring on a row scrolled away tells nobody anything.
  useEffect(() => {
    const list = listRef.current;
    if (list && cursorId) {
      reveal(list, document.getElementById(cursorId), 'nearest');
    }
  }, [cursorId]);

  // The design: "Scrolls to the selected time on open." The list mounts a
  // render after `open` turns true, because the popover portals its content,
  // so an effect on `open` found no rows and the list opened at midnight. The
  // list's ref is the first moment the rows exist. A value between two rows
  // opens on the row before it.
  const openOn = selected === null ? undefined : listedBefore(times, selected, true);
  const openOnId = openOn === undefined ? undefined : optionId(openOn);
  const attachList = useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (node && openOnId) {
        reveal(node, document.getElementById(openOnId), 'center');
      }
    },
    [openOnId],
  );

  function commit(minutes: number) {
    onChange(formatTime(minutes));
    setOpen(false);
  }

  function onFieldKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (parsedDraft !== null) {
        commit(parsedDraft);
      }
      return;
    }
    // Where each key takes the cursor, counted from the time in the field, so
    // a time typed between two rows steps to its neighbours. From a field
    // holding no time, the arrows start at either end of the list.
    const moves: Record<string, () => number | undefined> = {
      ArrowDown: () => {
        return parsedDraft === null ? times[0] : times.find((time) => time > parsedDraft);
      },
      ArrowUp: () => {
        return parsedDraft === null ? times.at(-1) : listedBefore(times, parsedDraft);
      },
      Home: () => times[0],
      End: () => times.at(-1),
    };
    const move = moves[event.key];
    if (!move) {
      return;
    }
    event.preventDefault();
    const next = move();
    if (next !== undefined) {
      setDraft(formatTime(next));
    }
  }

  const trigger = (
    <button
      id={id}
      aria-describedby={ariaDescribedBy}
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
      disabled={disabled}
      aria-disabled={readOnly ? true : undefined}
      aria-invalid={field.invalid || undefined}
      className={fieldClass({
        size,
        state: field.state,
        scale: field.scale,
        focus: 'focus-visible',
        className: cn(
          'flex w-full items-center justify-between gap-8',
          selected !== null ? 'text-gray-12' : 'text-gray-9',
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
    >
      {/* Mono, like every date and time in the system, so a column aligns. The
          placeholder stays proportional: it is prose, not a time. */}
      {selected !== null ? (
        <span className="font-mono tabular-nums">{formatTime(selected)}</span>
      ) : (
        <span className="font-sans">{placeholder}</span>
      )}
      {readOnly ? null : (
        <Icon name="chevron-down" size={CHEVRON[size]} className="text-gray-9 shrink-0" />
      )}
    </button>
  );

  return (
    <Popup
      open={open}
      onOpenChange={(next) => {
        const opening = next && !readOnly;
        // Set as it opens rather than in an effect after, so the first frame
        // of the list already has its cursor on the value.
        if (opening) {
          setDraft(value ?? '');
        }
        setOpen(opening);
      }}
      trigger={trigger}
      matchTriggerWidth
    >
      <div className="flex flex-col gap-6">
        <input
          type="text"
          aria-label="Enter a time"
          // Focus stays here while the arrows move the cursor, so the field
          // names the list and the row under the cursor, as Combobox's search
          // box does.
          aria-controls={listId}
          aria-activedescendant={cursorId}
          autoFocus
          value={draft}
          placeholder="HH:MM"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onFieldKeyDown}
          className={fieldClass({
            size: 'xs',
            state: unparsed ? 'toned' : field.state,
            scale: unparsed ? 'red' : field.scale,
            className: 'w-full font-mono tabular-nums',
          })}
        />
        {unparsed ? (
          <p role="alert" className="text-11 text-red-11 px-2 font-sans">
            Not a time of day.
          </p>
        ) : null}

        <div
          id={listId}
          ref={attachList}
          role="listbox"
          aria-label={label}
          className="flex max-h-224 flex-col gap-2 overflow-y-auto"
        >
          {times.map((minutes) => {
            return (
              <OptionRow
                key={minutes}
                id={optionId(minutes)}
                selected={minutes === selected}
                cursor={minutes === cursor}
                onPick={() => commit(minutes)}
                className="font-mono tabular-nums"
              >
                {formatTime(minutes)}
              </OptionRow>
            );
          })}
        </div>
      </div>
    </Popup>
  );
}
