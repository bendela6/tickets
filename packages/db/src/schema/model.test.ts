// packages/db/src/schema/model.test.ts
import { describe, expect, it } from 'vitest';
import { loadModel } from './model';

describe('items-platform model', () => {
  const model = loadModel();
  const byId = new Map(model.entities.map((e) => [e.id, e]));

  it('has all 22 entities', () => {
    expect(model.entities).toHaveLength(22);
    expect(byId.has('item_values')).toBe(true);
    expect(byId.has('option_transitions')).toBe(true);
    expect(byId.has('outbox')).toBe(true);
  });

  it('declares every column as explicitly nullable or not', () => {
    for (const entity of model.entities) {
      for (const column of entity.columns) {
        expect(typeof column.nullable, `${entity.id}.${column.name}`).toBe('boolean');
      }
    }
  });

  it('declares the three enums', () => {
    const names = model.enums.map((e) => e.name).sort();
    expect(names).toEqual(['field_type', 'status_kind', 'user_kind']);
    const fieldType = model.enums.find((e) => e.name === 'field_type')!;
    expect(fieldType.values).toEqual([
      'string', 'number', 'boolean', 'date', 'datetime', 'option', 'user', 'json',
    ]);
  });

  it('gives options a nullable kind column (the model amendment)', () => {
    const kind = byId.get('options')!.columns.find((c) => c.name === 'kind')!;
    expect(kind.type).toBe('status_kind');
    expect(kind.nullable).toBe(true);
  });

  it('carries the item_values integrity check', () => {
    const check = byId.get('item_values')!.constraints.find((c) => c.kind === 'check');
    expect(check).toBeDefined();
    expect(check!.expression).toMatch(/num_nonnulls/);
  });

  it('carries the item_values partial unique indexes', () => {
    const indexes = byId.get('item_values')!.indexes;
    const scalar = indexes.find((i) => i.name === 'iv_scalar')!;
    expect(scalar.unique).toBe(true);
    expect(scalar.where).toBe('option_id IS NULL AND value_user_id IS NULL');
  });

  it('carries the events stream-seq unique', () => {
    const unique = byId
      .get('events')!
      .constraints.filter((c) => c.kind === 'unique')
      .find((c) => c.name === 'events_stream_seq')!;
    expect(unique.columns).toEqual(['aggregate_type', 'aggregate_id', 'seq']);
  });

  it('carries composite primary keys on the join tables', () => {
    const pk = byId.get('item_type_fields')!.constraints.find((c) => c.kind === 'pk')!;
    expect(pk.columns).toEqual(['item_type_id', 'field_id']);
  });

  it('leaves no entity with an empty index list where the schema needs one', () => {
    expect(byId.get('items')!.indexes.length).toBeGreaterThan(0);
    expect(byId.get('events')!.indexes.length).toBeGreaterThan(0);
  });
});
