import { expect, test } from 'vitest';
import { remapClonedRows } from './clone-scheme';

test('remaps a foreign key column via the id map', () => {
  const idMap = new Map([
    [10, 100],
    [11, 101],
  ]);
  const rows = [
    { id: 10, ticketTypeId: 10, key: 'a' },
    { id: 11, ticketTypeId: 11, key: 'b' },
  ];
  const out = remapClonedRows(rows, 'ticketTypeId', idMap);
  expect(out).toEqual([
    { ticketTypeId: 100, key: 'a' },
    { ticketTypeId: 101, key: 'b' },
  ]);
});
