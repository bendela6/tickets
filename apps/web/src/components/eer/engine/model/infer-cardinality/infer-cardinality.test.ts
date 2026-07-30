import { describe, expect, it } from 'vitest';

import { inferCardinality } from './infer-cardinality';

const PK = { pk: true, fk: false };
const FK = { pk: false, fk: true };
const NONE = { pk: false, fk: false };
const PK_AND_FK = { pk: true, fk: true }; // shared-primary-key reference

describe('inferCardinality', () => {
  it('uses an explicit valid cardinality verbatim', () => {
    expect(inferCardinality({ cardinality: 'n-m' }, PK, FK)).toEqual({ value: 'n-m', inferred: false });
  });

  it('coerces a present-but-invalid cardinality to 1-n without inferring', () => {
    expect(inferCardinality({ cardinality: 'bogus' }, PK, FK)).toEqual({ value: '1-n', inferred: false });
  });

  it('infers from role pairs', () => {
    expect(inferCardinality({}, PK, FK)).toMatchObject({ value: '1-n', inferred: true });
    expect(inferCardinality({}, FK, PK)).toMatchObject({ value: 'n-1', inferred: true });
    expect(inferCardinality({}, FK, FK)).toMatchObject({ value: 'n-m', inferred: true });
  });

  it('treats a shared primary key as an identifying 1-1 relationship', () => {
    // events.id (pk) -> outbox.event_id (pk): the child's PK is the reference.
    expect(inferCardinality({}, PK, PK)).toMatchObject({ value: '1-1', inferred: true });
  });

  it('infers direction when exactly one endpoint is keyed', () => {
    // items.id (pk) -> events.aggregate_id (untagged): keyed parent, many children.
    expect(inferCardinality({}, PK, NONE)).toMatchObject({ value: '1-n', inferred: true });
    expect(inferCardinality({}, NONE, PK)).toMatchObject({ value: 'n-1', inferred: true });
  });

  it('falls back (and flags) only when neither endpoint is keyed', () => {
    const r = inferCardinality({}, NONE, NONE);
    expect(r).toMatchObject({ value: '1-n', inferred: true, fallback: true });
  });

  it('still falls back for a lone fk endpoint (ambiguous: n-1 vs n-m)', () => {
    // A pk is unique, so it confidently pins the "one" side; a lone fk does not
    // tell us whether the untagged partner is one or many — so it must still warn.
    expect(inferCardinality({}, FK, NONE).fallback).toBe(true);
    expect(inferCardinality({}, NONE, FK).fallback).toBe(true);
  });

  it('a column that is both pk and fk (shared-key reference) is treated as pk, not fk', () => {
    // Matches columnRoles's output for e.g. outbox.event_id: { pk: true, fk: true }.
    // The old legacy-role model could never express "both" (a raw field's
    // `role` was one exclusive tag) — this pins that pk takes priority so the
    // identifying (1-1) case is preserved now that constraints can say both.
    expect(inferCardinality({}, PK_AND_FK, FK)).toMatchObject({ value: '1-n', inferred: true });
    expect(inferCardinality({}, PK_AND_FK, PK_AND_FK)).toMatchObject({ value: '1-1', inferred: true });
  });
});
