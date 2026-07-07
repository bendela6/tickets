import { expect, test } from 'vitest';
import {
  deriveTypeFields,
  deriveTypeLinks,
  remapViewConfig,
  type LinkUsageRow,
  type SharedFieldRow,
  type SharedLinkRow,
  type TicketTypeFieldRow,
} from './derive';

// --- deriveTypeFields ------------------------------------------------------

const sharedFields: SharedFieldRow[] = [
  { id: 1, key: 'priority', label: 'Priority', type: 'select', system: false, config: {} },
  { id: 2, key: 'status', label: 'Status', type: 'status', system: true, config: { locked: true } },
];

const ticketTypeFields: TicketTypeFieldRow[] = [
  { ticketTypeId: 10, fieldId: 1, position: 0, required: true },
  { ticketTypeId: 10, fieldId: 2, position: 1, required: false },
  { ticketTypeId: 20, fieldId: 1, position: 0, required: false },
];

test('deriveTypeFields produces one row per attachment with required/position from the junction', () => {
  const out = deriveTypeFields(sharedFields, ticketTypeFields);
  expect(out).toHaveLength(3);

  expect(out[0]).toEqual({
    typeId: 10,
    fromFieldId: 1,
    key: 'priority',
    label: 'Priority',
    type: 'select',
    system: false,
    config: {},
    required: true,
    position: 0,
  });

  // Same shared field attached to two types: required/position come from
  // each type's own junction row, not from the shared field.
  const type20Priority = out.find((f) => f.typeId === 20 && f.fromFieldId === 1);
  expect(type20Priority?.required).toBe(false);
  expect(type20Priority?.position).toBe(0);

  const type10Status = out.find((f) => f.typeId === 10 && f.fromFieldId === 2);
  expect(type10Status).toEqual({
    typeId: 10,
    fromFieldId: 2,
    key: 'status',
    label: 'Status',
    type: 'status',
    system: true,
    config: { locked: true },
    required: false,
    position: 1,
  });
});

test('deriveTypeFields throws on an attachment referencing an unknown field id', () => {
  expect(() =>
    deriveTypeFields(sharedFields, [{ ticketTypeId: 10, fieldId: 999, position: 0, required: false }]),
  ).toThrow();
});

// --- remapViewConfig --------------------------------------------------------

test('remapViewConfig rewrites field ids to keys everywhere', () => {
  const out = remapViewConfig(
    {
      columns: [{ source: 'number' }, { source: 'field', fieldId: 35, width: 80 }],
      sort: { source: 'field', fieldId: 35, dir: 'desc' },
      filters: { rules: [{ fieldId: 34, op: 'eq', value: 'x' }] },
    },
    new Map([
      [35, 'priority'],
      [34, 'status'],
    ]),
  );
  expect((out.columns as unknown[])[1]).toEqual({ source: 'field', fieldKey: 'priority', width: 80 });
  expect(out.sort).toEqual({ source: 'field', fieldKey: 'priority', dir: 'desc' });
  expect((out.filters as any).rules[0]).toEqual({ fieldKey: 'status', op: 'eq', value: 'x' });
});

test('remapViewConfig leaves configs with no field references untouched', () => {
  const config = { columns: [{ source: 'number' }, { source: 'progress' }], sort: null };
  expect(remapViewConfig(config, new Map())).toEqual(config);
});

test('remapViewConfig throws when a fieldId has no mapped key', () => {
  expect(() => remapViewConfig({ sort: { source: 'field', fieldId: 99, dir: 'asc' } }, new Map())).toThrow();
});

// --- deriveTypeLinks ---------------------------------------------------------

const sharedLinks: SharedLinkRow[] = [
  { id: 100, key: 'blocks', label: 'Blocks', inverseLabel: 'Blocked by', directional: true },
  { id: 101, key: 'relates-to', label: 'Relates to', inverseLabel: 'Relates to', directional: false },
];

test('deriveTypeLinks fans unused links to every type with all-type targets', () => {
  const linkUsage: LinkUsageRow[] = [
    { sourceTypeId: 10, targetTypeId: 20, oldLinkTypeId: 100 },
    { sourceTypeId: 10, targetTypeId: 30, oldLinkTypeId: 100 },
  ];
  const allTypeIds = [10, 20, 30];

  const out = deriveTypeLinks(sharedLinks, linkUsage, allTypeIds);

  // 'blocks' was only ever used from type 10 -> a single owned link, not fanned out.
  const blocksRows = out.filter((l) => l.key === 'blocks');
  expect(blocksRows).toEqual([
    {
      sourceTypeId: 10,
      fromLinkId: 100,
      key: 'blocks',
      label: 'Blocks',
      inverseLabel: 'Blocked by',
      directional: true,
      targetTypeIds: [20, 30],
    },
  ]);

  // 'relates-to' was never used -> fanned to every type, targeting every type.
  const relatesRows = out.filter((l) => l.key === 'relates-to');
  expect(relatesRows).toHaveLength(3);
  expect(relatesRows.map((l) => l.sourceTypeId).sort((a, b) => a - b)).toEqual([10, 20, 30]);
  for (const row of relatesRows) {
    expect(row.targetTypeIds).toEqual([10, 20, 30]);
    expect(row.fromLinkId).toBe(101);
    expect(row.label).toBe('Relates to');
  }
});

test('deriveTypeLinks keeps distinct observed source types as separate owned links', () => {
  const linkUsage: LinkUsageRow[] = [
    { sourceTypeId: 10, targetTypeId: 20, oldLinkTypeId: 100 },
    { sourceTypeId: 20, targetTypeId: 10, oldLinkTypeId: 100 },
  ];
  const out = deriveTypeLinks(sharedLinks, linkUsage, [10, 20, 30]);
  const blocksRows = out.filter((l) => l.key === 'blocks').sort((a, b) => a.sourceTypeId - b.sourceTypeId);
  expect(blocksRows).toEqual([
    {
      sourceTypeId: 10,
      fromLinkId: 100,
      key: 'blocks',
      label: 'Blocks',
      inverseLabel: 'Blocked by',
      directional: true,
      targetTypeIds: [20],
    },
    {
      sourceTypeId: 20,
      fromLinkId: 100,
      key: 'blocks',
      label: 'Blocks',
      inverseLabel: 'Blocked by',
      directional: true,
      targetTypeIds: [10],
    },
  ]);
});
