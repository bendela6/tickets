import { describe, expect, it } from 'vitest';

import type { Entity } from '../types';
import { columnRoles } from './column-roles';

const entity = (constraints: Entity['constraints']): Entity =>
  ({
    id: 't', label: 't', group: 'z', description: null,
    columns: [
      { name: 'a', type: 'int', title: null, description: null, nullable: false, default: null },
      { name: 'b', type: 'int', title: null, description: null, nullable: false, default: null },
      { name: 'c', type: 'int', title: null, description: null, nullable: true, default: null },
    ],
    constraints, indexes: [], x: 0, y: 0, _w: 0, _h: 0,
  }) as Entity;

describe('columnRoles', () => {
  it('marks pk columns from the pk constraint, composite included', () => {
    const roles = columnRoles(entity([{ id: 'c1', kind: 'pk', name: null, columns: ['a', 'b'] }]));
    expect(roles.get('a')!.pk).toBe(true);
    expect(roles.get('b')!.pk).toBe(true);
    expect(roles.get('c')!.pk).toBe(false);
  });

  it('marks fk columns from every fk constraint', () => {
    const roles = columnRoles(
      entity([
        { id: 'c1', kind: 'fk', name: null, columns: ['b'], refTable: 'o', refColumns: ['id'], onDelete: null, onUpdate: null },
        { id: 'c2', kind: 'fk', name: null, columns: ['c'], refTable: 'p', refColumns: ['id'], onDelete: null, onUpdate: null },
      ]),
    );
    expect(roles.get('b')!.fk).toBe(true);
    expect(roles.get('c')!.fk).toBe(true);
    expect(roles.get('a')!.fk).toBe(false);
  });

  it('a single-column pk and a single-column unique are both unique; a composite is not', () => {
    const roles = columnRoles(
      entity([
        { id: 'c1', kind: 'pk', name: null, columns: ['a'] },
        { id: 'c2', kind: 'unique', name: null, columns: ['b'] },
        { id: 'c3', kind: 'unique', name: null, columns: ['b', 'c'] },
      ]),
    );
    expect(roles.get('a')!.unique).toBe(true);
    expect(roles.get('b')!.unique).toBe(true);
    expect(roles.get('c')!.unique).toBe(false);
  });

  it('a column may be both pk and fk (shared-primary-key reference)', () => {
    const roles = columnRoles(
      entity([
        { id: 'c1', kind: 'pk', name: null, columns: ['a'] },
        { id: 'c2', kind: 'fk', name: null, columns: ['a'], refTable: 'o', refColumns: ['id'], onDelete: null, onUpdate: null },
      ]),
    );
    expect(roles.get('a')).toEqual({ pk: true, fk: true, unique: true });
  });
});
