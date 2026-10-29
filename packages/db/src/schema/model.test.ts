// packages/db/src/schema/model.test.ts
import { describe, expect, it } from 'vitest';
import { loadModel } from './model';

describe('items-platform model', () => {
  const model = loadModel();
  const byId = new Map(model.entities.map((e) => [e.id, e]));

  it('has all 23 entities — 22 product tables plus attachments', () => {
    expect(model.entities).toHaveLength(23);
    expect(byId.has('records.item_values')).toBe(true);
    expect(byId.has('structure.option_transitions')).toBe(true);
    expect(byId.has('history.outbox')).toBe(true);
  });

  it('identifies a namespaced entity by its qualified name and carries its schema', () => {
    // The 22 product tables moved out of public in Plan 2 (core/structure/records/history).
    expect(byId.get('records.items')!.schema).toBe('records');
    expect(byId.get('core.users')!.schema).toBe('core');
  });

  it('declares every column as explicitly nullable or not', () => {
    for (const entity of model.entities) {
      for (const column of entity.columns) {
        expect(typeof column.nullable, `${entity.id}.${column.name}`).toBe('boolean');
      }
    }
  });

  it('declares the three enums, qualified by schema', () => {
    const names = model.enums
      .map((e) => (e.schema ? `${e.schema}.${e.name}` : e.name))
      .sort();
    expect(names).toEqual([
      'core.user_kind',
      'structure.field_type',
      'structure.status_kind',
    ]);
    const fieldType = model.enums.find((e) => e.name === 'field_type')!;
    expect(fieldType.values).toEqual([
      'string', 'number', 'boolean', 'date', 'datetime', 'option', 'user', 'json',
    ]);
  });

  it('gives options a nullable kind column (the model amendment)', () => {
    const kind = byId.get('structure.options')!.columns.find((c) => c.name === 'kind')!;
    expect(kind.type).toBe('status_kind');
    expect(kind.nullable).toBe(true);
  });

  it('carries the item_values integrity check', () => {
    const check = byId.get('records.item_values')!.constraints.find((c) => c.kind === 'check');
    expect(check).toBeDefined();
    expect(check!.expression).toMatch(/num_nonnulls/);
  });

  it('carries the item_values partial unique indexes', () => {
    const indexes = byId.get('records.item_values')!.indexes;
    const scalar = indexes.find((i) => i.name === 'iv_scalar')!;
    expect(scalar.unique).toBe(true);
    expect(scalar.where).toBe('option_id IS NULL AND value_user_id IS NULL');
  });

  it('carries the events stream-seq unique', () => {
    const unique = byId
      .get('history.events')!
      .constraints.filter((c) => c.kind === 'unique')
      .find((c) => c.name === 'events_stream_seq')!;
    expect(unique.columns).toEqual(['aggregate_type', 'aggregate_id', 'seq']);
  });

  it('carries composite primary keys on the join tables', () => {
    const pk = byId.get('structure.item_type_fields')!.constraints.find((c) => c.kind === 'pk')!;
    expect(pk.columns).toEqual(['item_type_id', 'field_id']);
  });

  it('leaves no entity with an empty index list where the schema needs one', () => {
    expect(byId.get('records.items')!.indexes.length).toBeGreaterThan(0);
    expect(byId.get('history.events')!.indexes.length).toBeGreaterThan(0);
  });
});
