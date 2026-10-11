import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: 'overview', label: 'Overview' },
  { value: 'files', label: 'Files', badge: 12 },
  { value: 'settings', label: 'Settings' },
];

export function TabsAndPanel() {
  const [tab, setTab] = useState('overview');
  return (
    <div className="flex flex-col gap-12">
      <Tabs items={ITEMS} value={tab} onChange={setTab} label="Project" />
      <p className="text-13/19 text-gray-11">The {tab} panel.</p>
    </div>
  );
}
