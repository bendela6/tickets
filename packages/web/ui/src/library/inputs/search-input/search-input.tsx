import { forwardRef, type InputHTMLAttributes } from 'react';
import { focusRing } from '../../../style';
import { Icon } from '../../icon';
import { Spinner } from '../../spinner';
import { Input } from '../input';
import type { ControlProps } from '../control';

export type SearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'size' | 'type'
> &
  ControlProps<string> & {
    /** Results are in flight. The trailing gutter carries a spinner. */
    loading?: boolean;
    /** Keyboard hint shown while empty — `⌘K`. Dropped as soon as there is a
     *  value, because by then the field is already open and focused. */
    shortcut?: string;
  };

/**
 * A search field: a leading glyph, and one trailing slot that says three
 * different things.
 *
 * The trailing gutter is a small state machine and the order matters. Loading
 * beats everything, because a clear button that vanishes the moment results
 * arrive is a target that moves under the pointer. Then the clear, once there
 * is something to clear. Then the shortcut hint, which is only useful while the
 * field is empty — by the time you have typed, you have already found it.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, loading = false, shortcut, disabled, readOnly, placeholder = 'Search…', ...rest },
  ref,
) {
  const trailing = loading ? (
    <Spinner size="xs" className="shrink-0 text-gray-9" />
  ) : value ? (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Clear search"
      disabled={disabled || readOnly}
      onClick={() => onChange('')}
      className={[
        'shrink-0 rounded-control-xs p-2 text-gray-9 hover:text-gray-12',
        focusRing('indigo', 'focus-visible', 'inward'),
      ].join(' ')}
    >
      <Icon name="x" size="xs" />
    </button>
  ) : shortcut ? (
    <kbd className="shrink-0 font-mono text-11 text-gray-9">{shortcut}</kbd>
  ) : undefined;

  return (
    <Input
      {...rest}
      ref={ref}
      // `search` rather than `text` so the platform knows what this is — but
      // the engine's own clear button is suppressed below, since we draw one
      // that matches the design and works in every browser rather than two.
      type="search"
      value={value}
      onChange={onChange}
      disabled={disabled}
      readOnly={readOnly}
      placeholder={placeholder}
      leading={<Icon name="search" size="xs" className="shrink-0 text-gray-9" />}
      trailing={trailing}
      className="[&::-webkit-search-cancel-button]:appearance-none"
    />
  );
});
