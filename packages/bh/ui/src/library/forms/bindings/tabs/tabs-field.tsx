import type { InputProps } from '@bh/form';
import type { Option } from '../../../inputs/contract';
import { Tabs } from '../../../navigation/components/tabs';
import { withHues } from '../option-hues';

export interface TabsFieldConfig {
  /** The tabs, in order: each option's `count` is drawn as its tab's badge. */
  options?: Option[];
  /** Accessible name for the strip. Falls back to the field's label, then its name. */
  label?: string;
  /**
   * In a filter form: fill each option's `count` with the rows picking it
   * would show, from the form's `countsBy` (a presets field's from its
   * `countFor`). The control itself reads only the options.
   */
  counts?: boolean;
}

/**
 * One choice as a strip of tabs, each with its count: a list's statuses,
 * "Open 12 · Resolved 40 · Ignored 3". The same value as `segmented`, drawn as
 * a place to be rather than a setting.
 *
 * A group of toggles, not a tablist: the choice changes what is shown in
 * place, and there are no panels for a tablist to promise.
 */
export function TabsField(p: InputProps<TabsFieldConfig, string>) {
  const items = withHues(p.config.options).map((option) => {
    return {
      value: option.value,
      label: option.label,
      icon: option.icon,
      badge: option.count,
    };
  });
  return (
    <div onBlur={p.onBlur}>
      <Tabs
        id={p.name}
        aria-describedby={p.describedBy}
        variant="pill"
        role="group"
        label={p.config.label ?? p.label ?? p.name}
        items={items}
        value={p.value ?? ''}
        readOnly={p.readOnly}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
