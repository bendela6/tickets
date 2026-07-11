import { describe, expect, it } from 'vitest';

import { inferCardinality, loadModel } from './model';

describe('inferCardinality', () => {
  it('uses an explicit valid cardinality verbatim', () => {
    expect(inferCardinality({ cardinality: 'n-m' }, 'pk', 'fk')).toEqual({ value: 'n-m', inferred: false });
  });

  it('coerces a present-but-invalid cardinality to 1-n without inferring', () => {
    expect(inferCardinality({ cardinality: 'bogus' }, 'pk', 'fk')).toEqual({ value: '1-n', inferred: false });
  });

  it('infers from role pairs', () => {
    expect(inferCardinality({}, 'pk', 'fk')).toMatchObject({ value: '1-n', inferred: true });
    expect(inferCardinality({}, 'fk', 'pk')).toMatchObject({ value: 'n-1', inferred: true });
    expect(inferCardinality({}, 'fk', 'fk')).toMatchObject({ value: 'n-m', inferred: true });
  });

  it('treats a shared primary key as an identifying 1-1 relationship', () => {
    // events.id (pk) -> outbox.event_id (pk): the child's PK is the reference.
    expect(inferCardinality({}, 'pk', 'pk')).toMatchObject({ value: '1-1', inferred: true });
  });

  it('infers direction when exactly one endpoint is keyed', () => {
    // items.id (pk) -> events.aggregate_id (untagged): keyed parent, many children.
    expect(inferCardinality({}, 'pk', null)).toMatchObject({ value: '1-n', inferred: true });
    expect(inferCardinality({}, null, 'pk')).toMatchObject({ value: 'n-1', inferred: true });
  });

  it('falls back (and flags) only when neither endpoint is keyed', () => {
    const r = inferCardinality({}, null, null);
    expect(r).toMatchObject({ value: '1-n', inferred: true, fallback: true });
  });

  it('still falls back for a lone fk endpoint (ambiguous: n-1 vs n-m)', () => {
    // A pk is unique, so it confidently pins the "one" side; a lone fk does not
    // tell us whether the untagged partner is one or many — so it must still warn.
    expect(inferCardinality({}, 'fk', null).fallback).toBe(true);
    expect(inferCardinality({}, null, 'fk').fallback).toBe(true);
  });
});

describe('loadModel — cardinality warnings', () => {
  const model = {
    groups: [{ id: 'g', label: 'G' }],
    entities: [
      {
        id: 'items',
        group: 'g',
        fields: [{ name: 'id', type: 'int', role: 'pk' }],
      },
      {
        id: 'events',
        group: 'g',
        fields: [
          { name: 'id', type: 'bigint', role: 'pk' },
          { name: 'aggregate_id', type: 'int' }, // untagged, as in the source
        ],
      },
      {
        id: 'outbox',
        group: 'g',
        fields: [{ name: 'event_id', type: 'bigint', role: 'pk' }], // identifying PK
      },
    ],
    relationships: [
      // items.id (pk) -> events.aggregate_id (untagged): previously a fallback warning.
      { id: 'istream', source: 'items', sourceField: 'id', target: 'events', targetField: 'aggregate_id' },
      // events.id (pk) -> outbox.event_id (pk): identifying, must be 1-1.
      { id: 'e-outbox', source: 'events', sourceField: 'id', target: 'outbox', targetField: 'event_id' },
    ],
  };

  it('no longer warns on keyed-endpoint or identifying relationships', () => {
    const { model: m, errors, warnings } = loadModel(model);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(m).not.toBeNull();
  });

  it('assigns 1-n to the keyed-parent edge and 1-1 to the identifying edge', () => {
    const { model: m } = loadModel(model);
    expect(m!.relById.get('istream')!.cardinality).toBe('1-n');
    expect(m!.relById.get('e-outbox')!.cardinality).toBe('1-1');
  });
});
