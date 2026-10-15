import type { InputProps } from '@bh/form';
import { useEffect, useRef } from 'react';
import type { Commit } from '../../../inputs/contract';
import { SearchInput } from '../../../inputs/components/search-input';
import { isShortcut, isTyping } from './shortcut';
import { useInlineField } from '../../components/inline-field-wrapper';

export interface SearchFieldConfig {
  placeholder?: string;
  /**
   * When the field hands its text to the form, as `text`'s does: `'change'`
   * (the default) at every keystroke, `'leave'` on Enter and on leaving it,
   * `{ after: 300 }` on those and after a pause in typing. A filter form's
   * search wants the pause, so the list isn't asked again at every letter.
   */
  commit?: Commit;
  /**
   * A key that puts the focus in the box, `'/'` or `'mod+K'`: drawn as the
   * box's hint while it is empty, and bound on the page while the field is
   * drawn, unless the focus is in another field, where the key types.
   */
  shortcut?: string;
}

/**
 * A search box. It holds its text like any text field; a filter form keeps it
 * as its query's `search`.
 */
export function SearchField(p: InputProps<SearchFieldConfig, string>) {
  // In a filter bar's row, the row's size.
  const inline = useInlineField();
  const ref = useRef<HTMLInputElement>(null);
  const { shortcut } = p.config;

  useEffect(() => {
    if (!shortcut) {
      return;
    }
    const jump = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTyping(event.target) || !isShortcut(event, shortcut)) {
        return;
      }
      // Kept from the box, so `/` doesn't land in it as it takes the focus.
      event.preventDefault();
      ref.current?.focus();
    };
    document.addEventListener('keydown', jump);
    return () => {
      document.removeEventListener('keydown', jump);
    };
  }, [shortcut]);

  return (
    <SearchInput
      ref={ref}
      id={p.name}
      size={inline?.size}
      aria-describedby={p.describedBy}
      name={p.name}
      value={p.value ?? ''}
      placeholder={p.config.placeholder}
      shortcut={shortcut}
      readOnly={p.readOnly}
      disabled={p.disabled}
      tone={p.error ? 'danger' : undefined}
      onChange={(next) => p.onChange(next)}
      commit={p.config.commit ?? p.commit}
      onDraft={p.onDraft}
      onBlur={p.onBlur}
    />
  );
}
