import { useState } from 'react';
import { SegmentedControl, type Option } from '@bh/ui';

const THEMES: Option[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
];

export function WithIcons() {
  const [value, setValue] = useState('system');
  return <SegmentedControl label="Theme" options={THEMES} value={value} onChange={setValue} />;
}
