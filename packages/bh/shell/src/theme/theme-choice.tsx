// The theme control: a segmented strip of the preferences the app offers. One
// app offers all three; another may leave `system` out and flip between two.

import { SegmentedControl, type Option } from '@bh/ui';
import type { ThemePreference } from './theme-types';

const ALL_OPTIONS: readonly (Option & { value: ThemePreference })[] = [
  //
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
];

/** Props for ThemeChoice component. */
export interface ThemeChoiceProps {
  /** The option shown as picked: `useTheme`'s `preference`, or its `theme` to offer two. */
  preference: ThemePreference;
  /** Called with the option picked; the control applies nothing itself. */
  onChange: (next: ThemePreference) => void;
  /**
   * Which preferences to offer. Defaults to all three. They are drawn in the
   * order light, dark, system, whatever the order here.
   */
  offer?: readonly ThemePreference[];
}

/**
 * The theme control: a segmented strip of Light, Dark and System, or of the
 * ones the app offers.
 *
 * A segmented control: short options worth reading without opening anything.
 * The value coming back is looked up rather than cast, so a string that is not
 * one of the offered preferences is ignored instead of written to the document.
 */
export function ThemeChoice({
  preference,
  onChange,
  offer = ['light', 'dark', 'system'],
}: ThemeChoiceProps) {
  const options = ALL_OPTIONS.filter((option) => offer.includes(option.value));
  return (
    <SegmentedControl
      size="xs"
      label="Theme"
      // `flex w-full` rather than the default `inline-flex`: the control sits
      // in a fixed-width menu column, and a strip narrower than it reads loose.
      className="flex w-full"
      options={options}
      value={preference}
      onChange={(next) => {
        const picked = options.find((option) => option.value === next);
        if (picked) {
          onChange(picked.value);
        }
      }}
    />
  );
}
