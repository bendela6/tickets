import type { FieldWrapperProps } from '@bh/form';
import { cn } from '../../../../style';
import { Spinner } from '../../../feedback/components/spinner';
import { InlineFieldContext } from './inline-field';

/**
 * Where a field in a row puts its label, by its kind:
 *
 * - `inside`: the control draws it as its trigger's muted prefix, "Type: any";
 * - `named`: the control's options or its placeholder already say what it is,
 *   so the label only names it for a screen reader: a search box, presets,
 *   a segmented control, tabs, avatars, a filter's rules;
 * - `beside`: the control draws it as the text beside its box, a checkbox's
 *   or a switch's, unless its config gives one of its own: it names the box;
 * - `before`: a muted prefix before a control with no room for one inside,
 *   "Updated in the last [7] days".
 */
export type InlineLabelPlace = 'inside' | 'named' | 'beside' | 'before';

const INSIDE: ReadonlySet<string> = new Set([
  'select',
  'multi-select',
  'date',
  'date-range',
  'user',
]);
const BESIDE: ReadonlySet<string> = new Set(['checkbox', 'toggle']);
const NAMED: ReadonlySet<string> = new Set([
  'search',
  'toggle-chips',
  'segmented',
  'tabs',
  'avatars',
  'rules',
]);

/** Where `InlineFieldWrapper` puts a field's label, by the field's kind. */
export function inlineLabelPlace(type: string | undefined): InlineLabelPlace {
  if (type !== undefined && INSIDE.has(type)) {
    return 'inside';
  }
  if (type !== undefined && BESIDE.has(type)) {
    return 'beside';
  }
  return type !== undefined && NAMED.has(type) ? 'named' : 'before';
}

/**
 * The `inline` layout's field wrapper: one field in a row, at its own width.
 * The label names the control, drawn inside it, before it, or for a screen
 * reader only, as its kind suits. A problem shows beside the control, which
 * is described by it; a commit being saved, as a small spinner after it.
 * A search box grows to fill what the row leaves, from 160 pixels.
 */
export function InlineFieldWrapper({
  name,
  type,
  label,
  description,
  error,
  configError,
  descriptionId,
  errorId,
  saving,
  children,
}: FieldWrapperProps) {
  // A config that failed to load comes first, as it does in FieldWrapper.
  const problem = configError ? configError.message || 'This field could not be loaded.' : error;
  const place = inlineLabelPlace(type);
  const grows = type === 'search';
  return (
    <div className={cn('flex min-w-0 items-center gap-7', grows && 'min-w-160 flex-1')}>
      {label && place !== 'beside' ? (
        <label
          htmlFor={name}
          className={
            place === 'before'
              ? 'text-12 text-gray-11 shrink-0 font-sans whitespace-nowrap'
              : 'sr-only'
          }
        >
          {label}
        </label>
      ) : null}
      <InlineFieldContext
        value={{
          ...((place === 'inside' || place === 'beside') && label ? { label } : {}),
          size: 'xs',
        }}
      >
        <div className={cn('flex min-w-0 items-center', grows && 'flex-1 *:w-full')}>
          {children}
        </div>
      </InlineFieldContext>
      {saving ? (
        <span role="status" className="text-gray-9 inline-flex shrink-0">
          <Spinner size="xs" label="Saving" />
        </span>
      ) : null}
      {/* No room under a control in a row: the description is read, not shown. */}
      {description && !problem ? (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      ) : null}
      {problem ? (
        // Beside the control, in a tooltip's look, and shown while the
        // problem lasts: a problem only a hover found would go unseen.
        <span
          id={errorId}
          className="rounded-4 bg-gray-12 text-12 text-gray-1 inline-flex h-26 shrink-0 items-center px-8 font-sans whitespace-nowrap"
        >
          {problem}
        </span>
      ) : null}
    </div>
  );
}
