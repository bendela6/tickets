import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: 'list', label: 'List', icon: 'list' as const },
  { value: 'columns', label: 'Columns', icon: 'columns' as const },
];

export function ToggleGroup() {
  const [view, setView] = useState('list');
  return (
    <Tabs variant="pill" role="group" items={ITEMS} value={view} onChange={setView} label="View" />
  );
}
