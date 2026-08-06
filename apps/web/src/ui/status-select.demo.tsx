import { useState } from 'react';
import { boolean, definePlayground, select } from '@tickets/ui';
import { StatusSelect, type StatusOption } from './status-select';

const STATUSES: StatusOption[] = [
  { key: 'backlog', label: 'Backlog', kind: 'todo' },
  { key: 'in-progress', label: 'In progress', kind: 'active' },
  { key: 'in-review', label: 'In review', kind: 'active' },
  { key: 'blocked', label: 'Blocked', kind: 'blocked' },
  { key: 'shipped', label: 'Shipped', kind: 'done' },
  { key: 'wont-do', label: "Won't do", kind: 'dropped' },
];

function StatusSelectFixture() {
  const [status, setStatus] = useState<string | null>('in-progress');
  return (
    <div className="w-224">
      <StatusSelect
        statuses={STATUSES}
        value={status}
        onChange={setStatus}
        legalTargets={['in-review', 'blocked', 'shipped']}
      />
    </div>
  );
}

function StatusSelectPlaygroundFixture({
  disabled,
  size,
}: {
  disabled: boolean;
  size: 'xs' | 'md' | 'lg' | undefined;
}) {
  const [status, setStatus] = useState<string | null>('in-progress');
  return (
    <div className="w-224">
      <StatusSelect
        statuses={STATUSES}
        value={status}
        onChange={setStatus}
        legalTargets={['in-review', 'blocked', 'shipped']}
        disabled={disabled}
        size={size}
      />
    </div>
  );
}

export const meta = { title: 'StatusSelect', size: 'md' };

export const states = [
  { name: 'basic', render: () => <StatusSelectFixture /> },
];

export const playground = definePlayground({
  controls: {
    disabled: boolean(),
    size: select(['xs', 'md', 'lg'], { allowNone: true }),
  },
  render: (v) => <StatusSelectPlaygroundFixture {...v} />,
});
