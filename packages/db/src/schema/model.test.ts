// packages/db/src/schema/model.test.ts
import { describe, expect, it } from 'vitest';
import { loadModel } from './model';

describe('items-platform model', () => {
  const model = loadModel();
  const byId = new Map(model.entities.map((e) => [e.id, e]));

  it('has all 29 entities — 22 product tables plus the split', () => {
    expect(model.entities).toHaveLength(29);
    expect(byId.has('records.item_values')).toBe(true);
    expect(byId.has('structure.option_transitions')).toBe(true);
    expect(byId.has('history.outbox')).toBe(true);
  });

  it('identifies a namespaced entity by its qualified name and carries its schema', () => {
    // terminal.sessions and agent.sessions share the bare name `sessions`;
    // the qualified id is what keeps them two entities rather than one.
    expect(byId.get('terminal.sessions')!.schema).toBe('terminal');
    expect(byId.get('agent.sessions')!.schema).toBe('agent');
    expect(byId.get('core.workdirs')!.schema).toBe('core');
    // The 22 product tables moved out of public in Plan 2 (core/structure/records/history).
    expect(byId.get('records.items')!.schema).toBe('records');
  });

  it('keeps terminal and agent independent — no fk crosses between them', () => {
    // The invariant the whole split exists to buy, asserted on the SSOT itself
    // (packages/db has its own drizzle-side independence test).
    for (const [id, entity] of byId) {
      const from = entity.schema;
      if (from !== 'terminal' && from !== 'agent') continue;
      const other = from === 'terminal' ? 'agent.' : 'terminal.';
      for (const c of entity.constraints) {
        if (c.kind !== 'fk') continue;
        expect(c.refTable.startsWith(other), `${id}.${c.columns[0]} -> ${c.refTable}`).toBe(false);
      }
    }
  });

  it('declares every column as explicitly nullable or not', () => {
    for (const entity of model.entities) {
      for (const column of entity.columns) {
        expect(typeof column.nullable, `${entity.id}.${column.name}`).toBe('boolean');
      }
    }
  });

  it('declares the eight enums, qualified by schema', () => {
    const names = model.enums
      .map((e) => (e.schema ? `${e.schema}.${e.name}` : e.name))
      .sort();
    expect(names).toEqual([
      'agent.permission_mode',
      'agent.permission_status',
      'agent.session_status',
      'core.runner_kind',
      'core.user_kind',
      'structure.field_type',
      'structure.status_kind',
      'terminal.session_status',
    ]);
    const fieldType = model.enums.find((e) => e.name === 'field_type')!;
    expect(fieldType.values).toEqual([
      'string', 'number', 'boolean', 'date', 'datetime', 'option', 'user', 'json',
    ]);
  });

  it('splits session_status per kind so neither can hold the other\'s states', () => {
    // The nine-value merged enum was the wrong model; each side now carries
    // only reachable states. live/disconnected are PTY facts; running/idle/
    // awaiting_input are agent-turn facts.
    const terminal = model.enums.find((e) => e.schema === 'terminal' && e.name === 'session_status')!;
    const agent = model.enums.find((e) => e.schema === 'agent' && e.name === 'session_status')!;
    expect(terminal.values).toEqual(['starting', 'live', 'disconnected', 'exited', 'failed']);
    expect(agent.values).toEqual([
      'starting', 'running', 'idle', 'awaiting_input', 'interrupted', 'exited', 'failed',
    ]);
    expect(terminal.values).not.toContain('running');
    expect(agent.values).not.toContain('live');
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
