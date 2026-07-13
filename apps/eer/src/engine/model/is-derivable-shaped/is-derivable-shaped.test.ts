import { describe, expect, it } from 'vitest';

import { isDerivableShaped } from './is-derivable-shaped';
import type { Relationship } from '../types';

const base: Relationship = {
  id: 'e-a.id->b.a_id',
  source: 'a',
  sourceField: 'id',
  target: 'b',
  targetField: 'a_id',
  cardinality: '1-n',
  cardinalityInferred: true,
  kind: 'fk',
  label: null,
};

describe('isDerivableShaped', () => {
  it('is true for a derived-id, unlabelled, 1-n, fk-kind relationship', () => {
    expect(isDerivableShaped(base)).toBe(true);
  });

  it('is false when the id does not match the derived scheme, even if everything else matches', () => {
    // The exact shape the reviewer's finding hinges on: a hand-authored id that
    // otherwise looks fully derivable must NOT be treated as derivable-shaped,
    // or callers (apply-model-edit, serialize-model) will silently discard it.
    expect(isDerivableShaped({ ...base, id: 'owns-custom-id' })).toBe(false);
  });

  it('is false for a non-fk kind', () => {
    expect(isDerivableShaped({ ...base, kind: 'nm' })).toBe(false);
  });

  it('is false when labelled', () => {
    expect(isDerivableShaped({ ...base, label: 'owns' })).toBe(false);
  });

  it('is false for a hand-set cardinality other than 1-n', () => {
    expect(isDerivableShaped({ ...base, cardinality: '1-1' })).toBe(false);
  });
});
