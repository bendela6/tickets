import { describe, expect, it } from 'vitest';

import { buildModel, nestedRaw } from '../../../test/models';
import { entityIdsInGroup } from './entity-ids-in-group';

describe('entityIdsInGroup', () => {
  const model = buildModel(nestedRaw());

  it('a zone owns its loose cards plus everything in its subgroups', () => {
    expect(entityIdsInGroup(model, 'z')).toEqual(new Set(['loose', 'm1', 'm2']));
  });

  it('a subgroup owns only its direct members', () => {
    expect(entityIdsInGroup(model, 's')).toEqual(new Set(['m1', 'm2']));
  });
});
