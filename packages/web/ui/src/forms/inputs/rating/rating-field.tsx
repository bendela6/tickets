import type { InputProps } from '@tickets/form';
import { Rating } from '../../../components/inputs/rating';

export type RatingFieldConfig = { max?: number; label?: string; showValue?: boolean };

/** A small fixed scale. 0 is unrated — a real value, not an absence, which is
 *  why this is `number` and not `number | null`. */
export function RatingField(p: InputProps<RatingFieldConfig, number>) {
  return (
    <div onBlur={p.onBlur}>
      <Rating
        id={p.name}
        label={p.config.label ?? p.name}
        value={p.value ?? 0}
        max={p.config.max}
        showValue={p.config.showValue}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
