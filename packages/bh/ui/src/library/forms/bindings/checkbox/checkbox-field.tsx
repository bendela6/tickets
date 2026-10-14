import type { InputProps } from '@bh/form';
import { Checkbox } from '../../../inputs/components/checkbox';

export interface CheckboxFieldConfig {
  /**
   * The text beside the box — the thing being agreed to, not the field's
   * caption. The wrapper already renders the caption from the FieldNode's own
   * `label`, so an author sets one or the other: a checkbox usually wants its
   * sentence here ("Email me about replies") and no caption above it.
   */
  label?: string;
  /**
   * A line under `label`, saying what checking the box does. It sits with the
   * box, where the FieldNode's own `description` is the field's help, under
   * the whole field; the box is described by both, its own line first.
   */
  description?: string;
}

/**
 * A boolean shown as a box, where `toggle` shows one as a switch.
 *
 * Two kinds rather than one with a variant, because the choice is semantic and
 * the stored config is what carries it: a switch reads as taking effect the
 * moment you flip it, a checkbox as a value that will be saved with the rest of
 * the form. A generated form picking between them is picking that meaning.
 */
export function CheckboxField(p: InputProps<CheckboxFieldConfig, boolean>) {
  return (
    <div onBlur={p.onBlur}>
      <Checkbox
        id={p.name}
        aria-describedby={p.describedBy}
        name={p.name}
        label={p.config.label}
        description={p.config.description}
        value={Boolean(p.value)}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
