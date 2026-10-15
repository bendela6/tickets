import type { InputProps } from '@bh/form';
import type { ControlSize, Option } from '../../../inputs/contract';
import { SegmentedControl } from '../../../inputs/components/segmented-control';
import { useInlineField } from '../../components/inline-field-wrapper';
import { withHues } from '../option-hues';

export interface SegmentedFieldConfig {
  options?: Option[];
  /** Accessible name for the group. Falls back to the field's label, then its name. */
  label?: string;
  /** The control's height: 30, 38 or 46 pixels. */
  size?: ControlSize;
  /**
   * A first segment, labelled as given ("Any"), that holds `''`, the kind's
   * empty value: the choice of none, which in a filter is no condition.
   */
  placeholder?: string;
  /**
   * In a filter form: fill each option's `count` with the rows picking it
   * would show, from the form's `countsBy` (a presets field's from its
   * `countFor`). The control itself reads only the options.
   */
  counts?: boolean;
}

/**
 * The third single-choice kind, beside `select` and `radio`.
 *
 * Three rather than one with a variant, for the same reason those two are
 * separate: which to use is a decision about how many options there are and how
 * much width they deserve, and a stored config needs a name to record it with.
 */
export function SegmentedField(p: InputProps<SegmentedFieldConfig, string>) {
  // In a filter bar's row, the row's size.
  const inline = useInlineField();
  const options = withHues(p.config.options);
  const { placeholder } = p.config;
  return (
    <div onBlur={p.onBlur}>
      <SegmentedControl
        id={p.name}
        aria-describedby={p.describedBy}
        label={p.config.label ?? p.label ?? p.name}
        options={
          placeholder === undefined ? options : [{ value: '', label: placeholder }, ...options]
        }
        value={p.value ?? ''}
        size={p.config.size ?? inline?.size}
        readOnly={p.readOnly}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
