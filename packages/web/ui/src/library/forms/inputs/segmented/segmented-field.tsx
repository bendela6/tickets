import type { InputProps } from '@tickets/form';
import type { Option } from '../../../inputs/control';
import { SegmentedControl } from '../../../inputs/segmented-control';

export type SegmentedFieldConfig = {
  options?: Option[];
  /** Accessible name for the group. Falls back to the field name. */
  label?: string;
};

/**
 * The third single-choice kind, beside `select` and `radio`.
 *
 * Three rather than one with a variant, for the same reason those two are
 * separate: which to use is a decision about how many options there are and how
 * much width they deserve, and a stored config needs a name to record it with.
 */
export function SegmentedField(p: InputProps<SegmentedFieldConfig, string>) {
  return (
    <div onBlur={p.onBlur}>
      <SegmentedControl
        id={p.name}
        label={p.config.label ?? p.name}
        options={p.config.options ?? []}
        value={p.value ?? ''}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
