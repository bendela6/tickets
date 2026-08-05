import { cn } from '../../../style';
import { Checkbox } from '../checkbox';
import { CONTROL_LADDER, type ControlProps, type Option } from '../control';

export type CheckboxGroupProps = ControlProps<string[]> & {
  options: Option[];
  /**
   * The group's accessible name. Required, and rendered as a `<legend>`: a
   * `<fieldset>` cannot be named from outside, because `for` points at a form
   * control and a fieldset is not one. Same reasoning as RadioGroup.
   */
  label: string;
  /** Show the legend. Off by default — a FieldWrapper usually draws the caption,
   *  and two of them say the same thing twice. */
  showLabel?: boolean;
  /**
   * Offer a parent that checks and clears the whole group.
   *
   * It goes INDETERMINATE when some but not all children are on — a real third
   * display state, not a third colour. A half-selected parent painted as
   * "checked but paler" is indistinguishable from a disabled one, and the
   * platform gives us a genuine `indeterminate` for exactly this.
   */
  selectAllLabel?: string;
};

/**
 * Several independent choices, all visible.
 *
 * The multi-select counterpart to RadioGroup, and the same trade against
 * MultiSelect that RadioGroup makes against Select: width, in exchange for
 * reading every option without opening anything.
 */
export function CheckboxGroup({
  id,
  value,
  onChange,
  options,
  label,
  showLabel = false,
  selectAllLabel,
  size = 'md',
  tone = 'primary',
  disabled = false,
  readOnly = false,
  className,
}: CheckboxGroupProps) {
  const rung = CONTROL_LADDER[size];
  // Only the options that can actually be toggled count toward the parent — a
  // disabled option nobody can reach would otherwise hold it permanently
  // indeterminate.
  const reachable = options.filter((option) => !option.disabled);
  const chosen = reachable.filter((option) => value.includes(option.value));
  const allOn = reachable.length > 0 && chosen.length === reachable.length;
  const someOn = chosen.length > 0 && !allOn;

  function toggle(optionValue: string, next: boolean) {
    if (readOnly) return;
    onChange(next ? [...value, optionValue] : value.filter((v) => v !== optionValue));
  }

  function toggleAll(next: boolean) {
    if (readOnly) return;
    // Clearing keeps any disabled option that was already on: the parent
    // controls what the user could have set by hand, and nothing else.
    const locked = value.filter((v) => options.find((o) => o.value === v)?.disabled);
    onChange(next ? [...locked, ...reachable.map((o) => o.value)] : locked);
  }

  return (
    <fieldset
      id={id}
      aria-readonly={readOnly || undefined}
      disabled={disabled}
      className={cn('flex flex-col border-0 p-0', rung.gap, className)}
    >
      <legend className={cn(showLabel ? 'mb-6 font-sans text-gray-11' : 'sr-only', rung.label)}>
        {label}
      </legend>

      {selectAllLabel ? (
        <>
          <Checkbox
            label={selectAllLabel}
            value={allOn}
            indeterminate={someOn}
            size={size}
            tone={tone}
            readOnly={readOnly}
            onChange={(next) => toggleAll(next)}
          />
          <hr className="my-2 border-0 border-t-1 border-gray-6" />
        </>
      ) : null}

      {options.map((option) => (
        <Checkbox
          key={option.value}
          label={option.label}
          value={value.includes(option.value)}
          disabled={option.disabled}
          readOnly={readOnly}
          size={size}
          tone={tone}
          onChange={(next) => toggle(option.value, next)}
        />
      ))}
    </fieldset>
  );
}
