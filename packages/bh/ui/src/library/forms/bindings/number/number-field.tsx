import type { InputProps } from '@bh/form';
import type { Commit } from '../../../inputs/contract';
import { NumberInput } from '../../../inputs/components/number-input';
import { useInlineField } from '../../components/inline-field-wrapper';

export interface NumberFieldConfig {
  min?: number;
  max?: number;
  step?: number;
  /** Trailing unit label, e.g. `hours`. Static text, not part of the value. */
  suffix?: string;
  /**
   * When the field hands its value to the form: `'change'` (the default) at
   * every keystroke and step, `'leave'` on Enter and on leaving it,
   * `{ after: 800 }` on those and after a pause. A run of steps commits once.
   * It wins over the form's own `commit`.
   */
  commit?: Commit;
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined) {
    next = Math.max(min, next);
  }
  if (max !== undefined) {
    next = Math.min(max, next);
  }
  return next;
}

/**
 * Named `NumberField` so it does not shadow the `NumberInput` primitive it
 * wraps.
 *
 * The primitive exposes no `onBlur`, so the wrapper div carries it — React's
 * synthetic blur bubbles, unlike the native event. Clamping happens here
 * rather than in the primitive because `min`/`max` arrive as authored form
 * config, and the primitive is also used outside forms where the caller owns
 * that policy.
 */
export function NumberField(p: InputProps<NumberFieldConfig, number | null>) {
  // In a filter bar's row, the row's size.
  const inline = useInlineField();
  return (
    <div onBlur={p.onBlur} className="flex items-center gap-8">
      <NumberInput
        id={p.name}
        size={inline?.size}
        // A few digits' width in a row, which has no column to fill.
        className={inline ? 'w-80' : undefined}
        aria-describedby={p.describedBy}
        value={p.value ?? null}
        min={p.config.min}
        max={p.config.max}
        step={p.config.step}
        readOnly={p.readOnly}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        commit={p.config.commit ?? p.commit}
        // What the form hears is what it would get: clamped, as on commit.
        onDraft={(draft) => {
          p.onDraft?.(draft === null ? null : clamp(draft, p.config.min, p.config.max));
        }}
        onChange={(next) => {
          p.onChange(next === null ? null : clamp(next, p.config.min, p.config.max));
        }}
      />
      {p.config.suffix ? (
        <span className="text-13/19 text-gray-11 font-sans">{p.config.suffix}</span>
      ) : null}
    </div>
  );
}
