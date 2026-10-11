import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: 'profile', label: 'Profile', icon: 'user' as const },
  { value: 'appearance', label: 'Appearance', icon: 'sun' as const },
  { value: 'files', label: 'Files', icon: 'folder' as const },
];

export function Rail() {
  const [value, setValue] = useState('profile');
  return (
    <Tabs
      variant="rail"
      items={ITEMS}
      value={value}
      onChange={setValue}
      label="Settings"
      className="w-192"
    />
  );
}
