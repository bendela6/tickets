import { describe, expect, it } from 'vitest';

import { buildModel, nestedRaw, pkField } from '../../../test/models';
import { GROUP_PALETTE, groupColor } from './group-color';

describe('groupColor', () => {
  it('assigns palette colors by top-level zone index', () => {
    const model = buildModel();
    expect(groupColor(model, 'z1')).toBe(GROUP_PALETTE[0]);
    expect(groupColor(model, 'z2')).toBe(GROUP_PALETTE[1]);
  });

  it('gives a subgroup its parent zone color', () => {
    const model = buildModel(nestedRaw());
    expect(groupColor(model, 's')).toBe(groupColor(model, 'z'));
  });

  it('cycles back to the first color once the palette is exhausted', () => {
    const n = GROUP_PALETTE.length + 1;
    const raw = {
      groups: Array.from({ length: n }, (_, i) => ({ id: 'z' + i, label: 'Z' + i, order: i })),
      entities: Array.from({ length: n }, (_, i) => ({ id: 'e' + i, group: 'z' + i, fields: [pkField] })),
    };
    const model = buildModel(raw);
    expect(groupColor(model, 'z' + GROUP_PALETTE.length)).toBe(GROUP_PALETTE[0]);
    expect(groupColor(model, 'z1')).toBe(GROUP_PALETTE[1]);
  });

  it('falls back to the first palette entry for an unknown id', () => {
    expect(groupColor(buildModel(), 'no-such-group')).toBe(GROUP_PALETTE[0]);
  });

  it('a zone override wins and flows down to its subgroups', () => {
    const model = buildModel(nestedRaw());
    const overrides = new Map([['z', '#123456']]);
    expect(groupColor(model, 'z', overrides)).toBe('#123456');
    expect(groupColor(model, 's', overrides)).toBe('#123456');
  });

  it('a subgroup override beats its parent zone override', () => {
    const model = buildModel(nestedRaw());
    const overrides = new Map([
      ['z', '#123456'],
      ['s', '#abcdef'],
    ]);
    expect(groupColor(model, 's', overrides)).toBe('#abcdef');
    expect(groupColor(model, 'z', overrides)).toBe('#123456');
  });
});
