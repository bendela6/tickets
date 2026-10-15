import type { InputProps } from '@bh/form';
import type { Tone } from '../../../../style';
import { ToggleChips } from '../../../inputs/components/toggle-chips';
import type { ControlSize, Option } from '../../../inputs/contract';
import { useInlineField } from '../../components/inline-field-wrapper';
import { withHues } from '../option-hues';

export interface ToggleChipsFieldConfig {
  options?: Option[];
  /** Accessible name for the group. Falls back to the field's label, then its name. */
  label?: string;
  /** How many options are drawn as chips; the rest sit behind a `+N` chip. Default 6. */
  maxVisible?: number;
  /** The chips' height: 30, 38 or 46 pixels; in a filter bar's row, the row's. */
  size?: ControlSize;
  /** The colour a pressed chip without a `color` of its own is painted in. */
  tone?: Tone;
  /**
   * In a filter form: fill each option's `count` with the rows picking it
   * would show, from the form's `countsBy` (a presets field's from its
   * `countFor`). The control itself reads only the options.
   */
  counts?: boolean;
}

/**
 * Several choices, every one a chip a click presses: the inline sibling of
 * `multi-select`, as `segmented` is of `select`. A filter bar's statuses.
 */
export function ToggleChipsField(p: InputProps<ToggleChipsFieldConfig, string[]>) {
  // In a filter bar's row, the row's size.
  const inline = useInlineField();
  return (
    <div onBlur={p.onBlur}>
      <ToggleChips
        id={p.name}
        aria-describedby={p.describedBy}
        label={p.config.label ?? p.label ?? p.name}
        options={withHues(p.config.options)}
        maxVisible={p.config.maxVisible}
        size={p.config.size ?? inline?.size}
        value={p.value ?? []}
        readOnly={p.readOnly}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : p.config.tone}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
