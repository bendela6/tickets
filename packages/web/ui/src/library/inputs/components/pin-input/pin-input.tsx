import { useRef } from 'react';
import { cn } from '../../../../style';
import { CONTROL_LADDER, readOnlyFieldClass, type ControlProps, disabledTreatment } from '../../contract';
import { fieldClass, fieldState } from '../../parts/field';

export type PinInputProps = ControlProps<string> & {
  /** How many cells. Six unless the code says otherwise. */
  length?: number;
  /** Accessible name for the group of cells. */
  label?: string;
};

/**
 * A fixed-length code, one cell per character.
 *
 * The cells are a presentation of ONE value, not six values — `value` is the
 * whole string and `onChange` reports the whole string. Six independent fields
 * would leave the caller reassembling them and would make a paste, which is how
 * most codes are actually entered, somebody else's problem.
 *
 * Pasting is handled explicitly for that reason: a six-character paste into cell
 * one fills all six and lands focus on the last, rather than putting the whole
 * code in the first cell and truncating it.
 */
export function PinInput({
  id,
  value,
  onChange,
  length = 6,
  label = 'Verification code',
  size = 'md',
  tone,
  disabled,
  readOnly,
  className,
}: PinInputProps) {
  const field = fieldState(tone);
  const rung = CONTROL_LADDER[size];
  const cells = useRef<(HTMLInputElement | null)[]>([]);
  const characters = value.padEnd(length, ' ').slice(0, length).split('');

  function write(next: string) {
    if (readOnly) return;
    onChange(next.slice(0, length));
  }

  function setAt(index: number, character: string) {
    const chars = value.padEnd(length, ' ').slice(0, length).split('');
    chars[index] = character || ' ';
    // Trailing blanks are trimmed so a half-entered code is "429" rather than
    // "429   " — the caller compares against a length, and padding would make
    // an incomplete code look complete.
    write(chars.join('').trimEnd());
  }

  function onCellChange(index: number, raw: string) {
    // Only ever the LAST character typed: a cell that already holds a digit
    // should be overwritten rather than appended to.
    const character = raw.slice(-1);
    if (!character) return;
    setAt(index, character);
    cells.current[Math.min(length - 1, index + 1)]?.focus();
  }

  function onCellKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (characters[index]?.trim()) {
        setAt(index, '');
      } else if (index > 0) {
        // Empty cell: step back and clear that one, so a run of backspaces
        // walks the code rather than stalling on the first blank.
        setAt(index - 1, '');
        cells.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      cells.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      cells.current[index + 1]?.focus();
    }
  }

  function onPaste(index: number, event: React.ClipboardEvent) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').trim();
    if (!pasted) return;
    const chars = value.padEnd(length, ' ').slice(0, length).split('');
    [...pasted].forEach((character, offset) => {
      if (index + offset < length) chars[index + offset] = character;
    });
    write(chars.join('').trimEnd());
    cells.current[Math.min(length - 1, index + pasted.length - 1)]?.focus();
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-invalid={field.invalid || undefined}
      className={cn('flex', rung.gap, disabled && disabledTreatment, className)}
    >
      {characters.map((character, index) => (
        <input
          // Position IS the identity here; there is nothing else to key on.
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          ref={(node) => {
            cells.current[index] = node;
          }}
          id={index === 0 ? id : undefined}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Character ${index + 1} of ${length}`}
          maxLength={1}
          value={character.trim()}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(event) => onCellChange(index, event.target.value)}
          onKeyDown={(event) => onCellKeyDown(index, event)}
          onPaste={(event) => onPaste(index, event)}
          onFocus={(event) => event.target.select()}
          className={fieldClass({
            size,
            state: field.state,
            scale: field.scale,
            // The shared read-only treatment, like every other field. It was
            // only taking `cursor-default`, so a locked code kept its filled
            // cells while the field above it in the same form became a printed
            // row — visible only on the all-inputs page, where the column makes
            // the odd one out obvious.
            className: cn(
              'w-38 text-center font-mono tabular-nums',
              readOnly && readOnlyFieldClass,
            ),
          })}
        />
      ))}
    </div>
  );
}
