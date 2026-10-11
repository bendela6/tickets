import { useState } from 'react';
import { Table, useTable, type Column } from '@bh/table';
import {
  ActionsColumn,
  BadgeColumn,
  DateColumn,
  ImageColumn,
  LinkColumn,
  NumberColumn,
  TextColumn,
  tableRender,
} from '@bh/ui';

interface Member {
  id: string;
  name: string;
  /** A picture, or none: then an avatar from the name. */
  photo: string | null;
  card: string;
  plan: 'reader' | 'family' | 'student';
  borrowed: number;
  fees: number;
  joined: string;
  visited: string;
}

/** A drawn square rather than a picture from elsewhere: the example needs no network. */
const SWATCH =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%2330a46c"/></svg>';

const MEMBERS: Member[] = [
  {
    id: 'ana',
    name: 'Ana',
    photo: SWATCH,
    card: 'C-0142',
    plan: 'reader',
    borrowed: 41,
    fees: 0,
    joined: '2023-02-11T10:00:00Z',
    visited: '2026-09-29T16:20:00Z',
  },
  {
    id: 'giorgi',
    name: 'Giorgi',
    photo: null,
    card: 'C-0187',
    plan: 'family',
    borrowed: 112,
    fees: 2.5,
    joined: '2021-06-03T10:00:00Z',
    visited: '2026-09-30T11:05:00Z',
  },
  {
    id: 'marta',
    name: 'Marta',
    photo: null,
    card: 'C-0203',
    plan: 'student',
    borrowed: 17,
    fees: 0,
    joined: '2025-09-15T10:00:00Z',
    visited: '2026-08-21T09:40:00Z',
  },
  {
    id: 'luca',
    name: 'Luca',
    photo: SWATCH,
    card: 'C-0219',
    plan: 'reader',
    borrowed: 8,
    fees: 6,
    joined: '2026-01-20T10:00:00Z',
    visited: '2026-06-02T18:15:00Z',
  },
  {
    id: 'nino',
    name: 'Nino',
    photo: null,
    card: 'C-0230',
    plan: 'family',
    borrowed: 64,
    fees: 0,
    joined: '2022-11-30T10:00:00Z',
    visited: '2026-09-27T13:30:00Z',
  },
];

const PLAN_LABEL: Record<Member['plan'], string> = {
  reader: 'Reader',
  family: 'Family',
  student: 'Student',
};

export function EveryRenderer() {
  const table = useTable();
  const [said, setSaid] = useState('');

  const columns: Column<Member>[] = [
    {
      key: 'photo',
      header: 'Photo',
      value: (m) => m.photo,
      as: ImageColumn({ fallback: (row) => (row as Member).name }),
      width: 72,
      resizable: false,
    },
    {
      key: 'name',
      header: 'Name',
      value: (m) => m.name,
      as: LinkColumn({ href: (row) => `#member-${(row as Member).id}` }),
      width: 'minmax(120px, 1fr)',
    },
    {
      key: 'card',
      header: 'Card',
      value: (m) => m.card,
      as: TextColumn({ mono: true }),
      width: 100,
    },
    {
      key: 'plan',
      header: 'Plan',
      value: (m) => m.plan,
      as: BadgeColumn<Member['plan']>({
        tone: (plan) => (plan === 'family' ? 'purple' : plan === 'student' ? 'teal' : 'blue'),
        label: (plan) => PLAN_LABEL[plan],
      }),
      width: 110,
    },
    {
      key: 'borrowed',
      header: 'Borrowed',
      value: (m) => m.borrowed,
      as: NumberColumn({ format: 'integer' }),
      align: 'right',
      width: 110,
    },
    {
      key: 'fees',
      header: 'Fees',
      value: (m) => m.fees,
      as: NumberColumn({ format: 'currency', currency: 'EUR' }),
      align: 'right',
      width: 100,
    },
    {
      key: 'joined',
      header: 'Joined',
      value: (m) => m.joined,
      as: DateColumn({ style: 'absolute' }),
      width: 190,
    },
    { key: 'visited', header: 'Last visit', value: (m) => m.visited, as: DateColumn(), width: 130 },
    {
      key: 'actions',
      header: 'Actions',
      as: ActionsColumn({
        items: [
          {
            icon: 'pencil',
            label: 'Edit member',
            onClick: (row) => setSaid(`Edit ${(row as Member).name}`),
          },
          {
            icon: 'trash',
            label: 'Remove member',
            tone: 'danger',
            onClick: (row) => setSaid(`Remove ${(row as Member).name}`),
          },
        ],
      }),
      align: 'right',
      width: 100,
      resizable: false,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="h-320 w-full overflow-auto">
        <Table<Member>
          {...table}
          columns={columns}
          rows={MEMBERS}
          isLoading={false}
          render={tableRender<Member>()}
        />
      </div>
      <p className="text-12/17 text-gray-11 h-17 font-mono">{said}</p>
    </div>
  );
}
