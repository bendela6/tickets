import { describe, expect, it } from 'vitest';

import { buildModel, deepNestedRaw, nestedRaw, pkField, twoZoneRaw } from '../../test/models';
import { buildOutline, outlineCount, type OutlineNode } from './build-outline';

// Compact shape assertions — the tree's identity is which groups survived and
// which entities hang off them, not the Group/Entity objects themselves.
const shape = (nodes: OutlineNode[]): unknown =>
  nodes.map((n) => ({
    group: n.group.id,
    entities: n.entities.map((e) =>
      e.columns.length ? `${e.entity.id}(${e.columns.join(',')})` : e.entity.id,
    ),
    children: shape(n.children),
  }));

describe('buildOutline', () => {
  it('keeps every group and entity when the query is empty', () => {
    expect(shape(buildOutline(buildModel(twoZoneRaw()), ''))).toEqual([
      { group: 'z1', entities: ['users'], children: [] },
      { group: 'z2', entities: ['orders', 'tags'], children: [] },
    ]);
  });

  it('sorts entities alphabetically rather than in packing order', () => {
    // twoZoneRaw declares z2 as [orders, tags]; a fixture declared the other
    // way round must still read alphabetically, so this pins the sort rather
    // than the fixture's declaration order.
    const raw = twoZoneRaw();
    raw.entities.reverse();
    const z2 = buildOutline(buildModel(raw), '').find((n) => n.group.id === 'z2')!;
    expect(z2.entities.map((e) => e.entity.label)).toEqual(['orders', 'tags']);
  });

  it('nests subgroups under their parent and keeps each group its OWN members', () => {
    // `loose` belongs to the zone directly; m1/m2 belong to the subgroup. A
    // flattened tree would hang all three off the zone.
    expect(shape(buildOutline(buildModel(nestedRaw()), ''))).toEqual([
      {
        group: 'z',
        entities: ['loose'],
        children: [{ group: 's', entities: ['m1', 'm2'], children: [] }],
      },
    ]);
  });

  it('prunes groups with no match and keeps the one that has it', () => {
    expect(shape(buildOutline(buildModel(twoZoneRaw()), 'tags'))).toEqual([
      { group: 'z2', entities: ['tags'], children: [] },
    ]);
  });

  it('surfaces an entity whose COLUMN matches, and names the matching columns', () => {
    // 'manager_id' is a column of `users` and appears in no entity name — the
    // only way it can be found is by column, and the column has to be named or
    // the row gives no reason for being there.
    expect(shape(buildOutline(buildModel(twoZoneRaw()), 'manager'))).toEqual([
      { group: 'z1', entities: ['users(manager_id)'], children: [] },
    ]);
  });

  it('lists no columns when the entity NAME is what matched', () => {
    // `users` also owns the column `users_id`… on `orders`. So this query hits
    // the users card by name (no columns listed) AND orders by column.
    expect(shape(buildOutline(buildModel(twoZoneRaw()), 'users'))).toEqual([
      { group: 'z1', entities: ['users'], children: [] },
      { group: 'z2', entities: ['orders(users_id)'], children: [] },
    ]);
  });

  it('matches an entity by its qualified id, not only its label', () => {
    // A database graph ids entities by SCHEMA-qualified name while labelling
    // them bare, so `terminal.` is findable only through the id.
    const raw = {
      groups: [{ id: 'g', label: 'Group', order: 0 }],
      entities: [
        { id: 'terminal.sessions', label: 'sessions', group: 'g', fields: [pkField] },
        { id: 'agent.sessions', label: 'sessions', group: 'g', fields: [pkField] },
      ],
      relationships: [],
    };
    expect(shape(buildOutline(buildModel(raw), 'terminal.'))).toEqual([
      { group: 'g', entities: ['terminal.sessions'], children: [] },
    ]);
  });

  it('takes a matching group WHOLE, without filtering its entities', () => {
    // 'Zone Two' matches the group label; both its entities come along even
    // though neither name nor column contains the query.
    expect(shape(buildOutline(buildModel(twoZoneRaw()), 'zone two'))).toEqual([
      { group: 'z2', entities: ['orders', 'tags'], children: [] },
    ]);
  });

  it('keeps the ancestor chain of a match nested three levels down', () => {
    // Only `d_card` matches. Dropping `z` or `s` for having no match of their
    // own would orphan it out of the tree entirely.
    expect(shape(buildOutline(buildModel(deepNestedRaw()), 'd_card'))).toEqual([
      {
        group: 'z',
        entities: [],
        children: [
          {
            group: 's',
            entities: [],
            children: [{ group: 'd', entities: ['d_card'], children: [] }],
          },
        ],
      },
    ]);
  });

  it('returns nothing when the query matches nothing', () => {
    expect(buildOutline(buildModel(twoZoneRaw()), 'zzzz')).toEqual([]);
  });

  it('ignores surrounding whitespace and case', () => {
    expect(shape(buildOutline(buildModel(twoZoneRaw()), '  TAGS  '))).toEqual([
      { group: 'z2', entities: ['tags'], children: [] },
    ]);
  });
});

describe('outlineCount', () => {
  it('counts a group plus everything nested below it', () => {
    const [zone] = buildOutline(buildModel(nestedRaw()), '');
    // 1 direct member (`loose`) + 2 in the subgroup.
    expect(outlineCount(zone!)).toBe(3);
    expect(outlineCount(zone!.children[0]!)).toBe(2);
  });
});
