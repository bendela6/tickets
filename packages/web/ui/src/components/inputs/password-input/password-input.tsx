import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { focusRing } from '../../../style';
import { Input } from '../input';
import type { ControlProps } from '../control';

export type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'size' | 'type'
> &
  ControlProps<string>;

/**
 * A secret, with a reveal.
 *
 * The toggle is the WORD "show"/"hide", not an eye glyph — the design's choice
 * and the right one: a crossed-out eye is ambiguous about whether it describes
 * the current state or the action, and every product resolves that ambiguity
 * differently. The word says which of the two it means.
 *
 * Revealing is deliberately local state with no way in from outside. A caller
 * that could force `revealed` would be a caller that can reveal a password the
 * user did not ask to see, and there is no screen in this product that needs
 * that.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ value, onChange, disabled, readOnly, ...rest }, ref) {
    const [revealed, setRevealed] = useState(false);

    return (
      <Input
        {...rest}
        ref={ref}
        type={revealed ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        readOnly={readOnly}
        trailing={
          <button
            type="button"
            // Never a tab stop of its own. Tabbing out of a password field
            // should reach the next field, not a control most people never use
            // — it stays reachable by pointer, and by Shift+Tab from the field.
            tabIndex={-1}
            // Dropped when disabled, kept when read-only: a value you may not
            // edit is still a value you may need to read.
            disabled={disabled}
            aria-pressed={revealed}
            onClick={() => setRevealed((current) => !current)}
            className={[
              'shrink-0 rounded-control-xs px-4 font-mono text-11 text-gray-11',
              'hover:text-gray-12 disabled:opacity-50',
              focusRing('indigo', 'focus-visible', 'inward'),
            ].join(' ')}
          >
            {revealed ? 'hide' : 'show'}
          </button>
        }
      />
    );
  },
);
