import { describe, expect, it } from 'vitest';

import { loadModel } from '../load-model';
import { deriveRelationships } from './derive-relationships';

const raw = (constraints: unknown[], extra: Record<string, unknown> = {}) => ({
  groups: [{ id: 'z', label: 'Z' }],
  entities: [
    { id: 'users', group: 'z', fields: [{ name: 'id', type: 'serial' }], constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }] },
    {
      id: 'orders', group: 'z',
      fields: [{ name: 'id', type: 'serial' }, { name: 'user_id', type: 'int' }],
      constraints,
    },
  ],
  ...extra,
});

describe('deriveRelationships', () => {
  it('derives one 1-n edge per fk constraint, ided by entity + constraint', () => {
    const model = loadModel(raw([
      { id: 'c1', kind: 'pk', columns: ['id'] },
      { id: 'c2', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'] },
    ])).model!;
    const rels = deriveRelationships(model);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toMatchObject({
      id: 'rel:orders:c2', source: 'users', sourceField: 'id',
      target: 'orders', targetField: 'user_id', kind: 'fk', cardinality: '1-n',
    });
  });

  it('is 1-1 when the fk columns are the referencing table’s primary key', () => {
    const model = loadModel(raw([
      { id: 'c1', kind: 'pk', columns: ['user_id'] },
      { id: 'c2', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'] },
    ])).model!;
    expect(deriveRelationships(model)[0]!.cardinality).toBe('1-1');
  });

  it('is 1-1 when the fk columns are covered by a unique constraint', () => {
    const model = loadModel(raw([
      { id: 'c1', kind: 'pk', columns: ['id'] },
      { id: 'c2', kind: 'unique', columns: ['user_id'] },
      { id: 'c3', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'] },
    ])).model!;
    expect(deriveRelationships(model).find((r) => r.id === 'rel:orders:c3')!.cardinality).toBe('1-1');
  });

  it('anchors a composite fk on its lead column pair', () => {
    const model = loadModel({
      groups: [{ id: 'z', label: 'Z' }],
      entities: [
        {
          id: 'a', group: 'z', fields: [{ name: 'k1', type: 'int' }, { name: 'k2', type: 'int' }],
          constraints: [{ id: 'c1', kind: 'pk', columns: ['k1', 'k2'] }],
        },
        {
          id: 'b', group: 'z', fields: [{ name: 'a1', type: 'int' }, { name: 'a2', type: 'int' }],
          constraints: [{ id: 'c1', kind: 'fk', columns: ['a1', 'a2'], refTable: 'a', refColumns: ['k1', 'k2'] }],
        },
      ],
    }).model!;
    const rels = deriveRelationships(model);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toMatchObject({ source: 'a', sourceField: 'k1', target: 'b', targetField: 'a1' });
  });

  it('skips an fk whose target table or column does not exist', () => {
    const model = loadModel(raw([
      { id: 'c2', kind: 'fk', columns: ['user_id'], refTable: 'nope', refColumns: ['id'] },
      { id: 'c3', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['nope'] },
    ])).model!;
    expect(deriveRelationships(model)).toEqual([]);
  });

  it('keeps a non-fk authored relationship and puts it first', () => {
    const model = loadModel(
      raw(
        [{ id: 'c2', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'] }],
        {
          kinds: [{ id: 'nm', label: 'Many-to-many', style: 'dashed' }],
          relationships: [
            { id: 'doc', source: 'users', sourceField: 'id', target: 'orders', targetField: 'id',
              kind: 'nm', label: 'documented', cardinality: 'n-m' },
          ],
        },
      ),
    ).model!;
    const rels = deriveRelationships(model);
    expect(rels.map((r) => r.id)).toEqual(['doc', 'rel:orders:c2']);
    expect(rels[0]!.label).toBe('documented');
  });
});
