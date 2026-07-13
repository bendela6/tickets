import { describe, expect, it } from 'vitest';

import { buildModel, nestedRaw, pkField } from '../../../test/models';
import { CARD_MAX_W, CARD_MIN_W, HEADER_H, ROW_H } from '../../geometry/metrics';
import { loadModel } from '../load-model';
import { applyModelEdit, fkRefsTo, type EditField } from './apply-model-edit';
import seedRaw from '../../../../models/items-platform.json';

const editPk = (name = 'id', type = 'int'): EditField => ({ name, type, role: 'pk', ref: null, refField: null, description: null });
const editPlain = (name: string, type = 'text'): EditField => ({ name, type, role: null, ref: null, refField: null, description: null });
const editFk = (name: string, ref: string, refField = 'id', type = 'int'): EditField => ({
  name,
  type,
  role: 'fk',
  ref,
  refField,
  description: null,
});

describe('applyModelEdit', () => {
  describe('setMeta', () => {
    it('replaces meta immutably', () => {
      const m1 = buildModel();
      const m2 = applyModelEdit(m1, { kind: 'setMeta', title: 'New title', description: 'New description' });
      expect(m2.meta).toEqual({ title: 'New title', description: 'New description' });
      expect(m1.meta).toEqual({ title: 'Fixture', description: 'test model' }); // input untouched
    });
  });

  describe('upsertGroup', () => {
    it('adds a new top-level group with a box at (content.w+80, 40, 360, 260)', () => {
      const m1 = buildModel();
      const contentW = m1._content.w;
      const m2 = applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'z3', label: 'Zone Three', parent: null } });
      expect(m2.groups.some((g) => g.id === 'z3' && g.label === 'Zone Three' && g.parent === null)).toBe(true);
      expect(m2._groupBounds.find((b) => b.id === 'z3')).toMatchObject({
        x: contentW + 80,
        y: 40,
        w: 360,
        h: 260,
        parent: null,
        level: 0,
      });
      expect(m2._content.w).toBe(m1._content.w + 520); // box right edge (+80+360) plus LAYOUT_MARGIN (80)
      expect(m2._content.h).toBeGreaterThanOrEqual(380); // box bottom edge (40+260) plus LAYOUT_MARGIN (80)
      expect(m2._content.h).toBeGreaterThanOrEqual(m1._content.h); // never shrinks
      expect(m1.groups.some((g) => g.id === 'z3')).toBe(false); // input untouched
    });

    it('creates a new subgroup with level 1, parented under its zone', () => {
      const m1 = buildModel();
      const m2 = applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'sub1', label: 'Sub One', parent: 'z1' } });
      const g = m2.groups.find((x) => x.id === 'sub1')!;
      expect(g.parent).toBe('z1');
      expect(m2._groupBounds.find((b) => b.id === 'sub1')).toMatchObject({ parent: 'z1', level: 1 });
    });

    it('relabels an existing group without touching its membership or order', () => {
      const m1 = buildModel();
      const before = m1.groups.find((g) => g.id === 'z2')!;
      const m2 = applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'z2', label: 'Zone Two Renamed', parent: null } });
      const after = m2.groups.find((g) => g.id === 'z2')!;
      expect(after.label).toBe('Zone Two Renamed');
      expect(after.order).toBe(before.order);
      expect(m2.entities.filter((e) => e.group === 'z2')).toHaveLength(2); // membership unchanged
      expect(m1.groups.find((g) => g.id === 'z2')!.label).toBe('Zone Two'); // input untouched
    });

    it('reparents an existing group and flips its box level to match', () => {
      const m1 = buildModel(nestedRaw()); // zone 'z' with subgroup 's' (parent 'z', level 1)
      const m2 = applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 's', label: 'Sub', parent: null } });
      const g = m2.groups.find((x) => x.id === 's')!;
      expect(g.parent).toBeNull();
      expect(m2._groupBounds.find((b) => b.id === 's')).toMatchObject({ parent: null, level: 0 });
    });
  });

  describe('deleteGroup', () => {
    it('throws "Group still contains N table(s)" when member entities exist', () => {
      const m1 = buildModel(); // z2 holds orders + tags
      expect(() => applyModelEdit(m1, { kind: 'deleteGroup', id: 'z2' })).toThrow('Group still contains 2 table(s)');
    });

    it('throws "Group has subgroups" when child groups exist', () => {
      const m1 = buildModel(nestedRaw()); // zone 'z' has loose member + subgroup 's'
      const noLoose = applyModelEdit(m1, { kind: 'deleteEntity', id: 'loose' });
      expect(() => applyModelEdit(noLoose, { kind: 'deleteGroup', id: 'z' })).toThrow('Group has subgroups');
    });

    it('deletes an empty, childless group and removes its box', () => {
      const m1 = buildModel();
      const withNew = applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'z3', label: 'Z3', parent: null } });
      const m2 = applyModelEdit(withNew, { kind: 'deleteGroup', id: 'z3' });
      expect(m2.groups.some((g) => g.id === 'z3')).toBe(false);
      expect(m2._groupBounds.some((b) => b.id === 'z3')).toBe(false);
    });
  });

  describe('upsertEntity — new', () => {
    it('measures the entity and spawns at its group bounds + 50/50', () => {
      const m1 = buildModel();
      const box = m1._groupBounds.find((b) => b.id === 'z2')!;
      const m2 = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: { id: 'shipments', label: 'Shipments', group: 'z2', description: null, fields: [editPk(), editFk('orders_id', 'orders')] },
      });
      const e = m2.entityById.get('shipments')!;
      expect(e.x).toBe(box.x + 50);
      expect(e.y).toBe(box.y + 50);
      expect(e._h).toBe(HEADER_H + 2 * ROW_H);
      expect(e._w).toBeGreaterThanOrEqual(CARD_MIN_W);
      expect(e._w).toBeLessThanOrEqual(CARD_MAX_W);
      expect(m1.entityById.has('shipments')).toBe(false); // input untouched
    });

    it('spawns at 50,50 when the group has no box yet', () => {
      const m1 = buildModel();
      const boxless = { ...m1, _groupBounds: m1._groupBounds.filter((b) => b.id !== 'z2') };
      const m2 = applyModelEdit(boxless, {
        kind: 'upsertEntity',
        entity: { id: 'shipments', label: 'Shipments', group: 'z2', description: null, fields: [editPk()] },
      });
      const e = m2.entityById.get('shipments')!;
      expect(e.x).toBe(50);
      expect(e.y).toBe(50);
    });
  });

  describe('upsertEntity — existing', () => {
    it('replaces label/group/description/fields but keeps x/y, recomputing _w/_h', () => {
      const m1 = buildModel();
      const before = m1.entityById.get('orders')!;
      const m2 = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: {
          id: 'orders',
          label: 'Orders v2',
          group: before.group,
          description: 'updated',
          fields: [editPk(), editFk('users_id', 'users'), editFk('tag_id', 'tags'), editPlain('note')],
        },
      });
      const after = m2.entityById.get('orders')!;
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
      expect(after.label).toBe('Orders v2');
      expect(after.description).toBe('updated');
      expect(after.fields).toHaveLength(4);
      expect(after._h).toBe(HEADER_H + 4 * ROW_H);
      expect(before._h).toBe(HEADER_H + 3 * ROW_H); // input untouched
    });
  });

  describe('deleteEntity', () => {
    it('clears fk fields pointing at it and drops its edges', () => {
      const m1 = buildModel(); // users ← orders.users_id (fk)
      const m2 = applyModelEdit(m1, { kind: 'deleteEntity', id: 'users' });
      expect(m2.entityById.has('users')).toBe(false);
      const f = m2.entityById.get('orders')!.fields.find((x) => x.name === 'users_id')!;
      expect(f.role).toBeNull();
      expect(f.ref).toBeNull();
      expect(m2.relationships.some((r) => r.source === 'users' || r.target === 'users')).toBe(false);
      expect(m1.entityById.has('users')).toBe(true); // input untouched
    });

    it('throws for an unknown entity id', () => {
      const m1 = buildModel();
      expect(() => applyModelEdit(m1, { kind: 'deleteEntity', id: 'ghost' })).toThrow(/ghost/);
    });

    it('drops explicit non-fk relationships whose endpoint no longer exists', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G', order: 0 }],
        entities: [
          { id: 'a', group: 'g', fields: [pkField] },
          { id: 'b', group: 'g', fields: [pkField] },
        ],
        relationships: [{ id: 'ann', source: 'a', sourceField: 'id', target: 'b', targetField: 'id', kind: 'nm' }],
      };
      const m1 = buildModel(raw);
      const m2 = applyModelEdit(m1, { kind: 'deleteEntity', id: 'b' });
      expect(m2.relationships.some((r) => r.id === 'ann')).toBe(false);
      expect(m2.relById.has('ann')).toBe(false);
    });
  });

  describe('relationship derivation', () => {
    it('an fk field derives its relationship; removing the field drops it', () => {
      const m1 = buildModel();
      const tags = m1.entityById.get('tags')!;
      const withFk = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: { id: 'tags', label: tags.label, group: tags.group, description: null, fields: [editPk(), editFk('owner_id', 'users')] },
      });
      expect(withFk.relationships.some((r) => r.source === 'users' && r.target === 'tags' && r.targetField === 'owner_id')).toBe(true);

      const removed = applyModelEdit(withFk, {
        kind: 'upsertEntity',
        entity: { id: 'tags', label: tags.label, group: tags.group, description: null, fields: [editPk()] }, // owner_id field gone entirely
      });
      expect(removed.relationships.some((r) => r.target === 'tags' && r.targetField === 'owner_id')).toBe(false);
    });

    // A derived rel is derivable-shaped (derived id scheme, kind fk, no label,
    // '1-n'), so it is never kept verbatim — it re-derives from the CURRENT
    // fields on every edit. Clearing the backing field's fk role (keeping the
    // name) therefore removes the edge; authored data (two tests down) doesn't.
    it('clearing an fk role (keeping the field name) removes its derived relationship', () => {
      const m1 = buildModel();
      const tags = m1.entityById.get('tags')!;
      const withFk = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: { id: 'tags', label: tags.label, group: tags.group, description: null, fields: [editPk(), editFk('owner_id', 'users')] },
      });
      expect(withFk.relationships.some((r) => r.source === 'users' && r.target === 'tags' && r.targetField === 'owner_id')).toBe(true);

      const cleared = applyModelEdit(withFk, {
        kind: 'upsertEntity',
        entity: { id: 'tags', label: tags.label, group: tags.group, description: null, fields: [editPk(), editPlain('owner_id', 'int')] },
      });
      expect(cleared.relationships.some((r) => r.target === 'tags' && r.targetField === 'owner_id')).toBe(false);
    });

    it('a labelled fk-kind rel survives clearing its backing field role — kept verbatim while endpoints stay valid', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          { id: 'a', group: 'g', fields: [pkField] },
          { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' }] },
        ],
        relationships: [{ id: 'lbl', source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id', kind: 'fk', label: 'owns' }],
      };
      const m1 = buildModel(raw);
      const cleared = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: { id: 'b', label: 'b', group: 'g', description: null, fields: [editPk(), editPlain('a_id', 'int')] },
      });
      expect(cleared.relationships).toHaveLength(1); // and no label-less twin appears either
      expect(cleared.relationships[0]).toMatchObject({ id: 'lbl', label: 'owns', kind: 'fk' });
    });

    it('renaming an fk field drops the stale rel and derives a fresh one under the new name', () => {
      const m1 = buildModel();
      const tags = m1.entityById.get('tags')!;
      const withFk = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: { id: 'tags', label: tags.label, group: tags.group, description: null, fields: [editPk(), editFk('owner_id', 'users')] },
      });
      const renamed = applyModelEdit(withFk, {
        kind: 'upsertEntity',
        entity: { id: 'tags', label: tags.label, group: tags.group, description: null, fields: [editPk(), editFk('owner_ref', 'users')] },
      });
      expect(renamed.relationships.some((r) => r.targetField === 'owner_id')).toBe(false);
      expect(renamed.relationships.some((r) => r.source === 'users' && r.target === 'tags' && r.targetField === 'owner_ref')).toBe(true);
    });

    // Renaming the REFERENCED side's field (rather than the fk-owning side, the
    // case above) is the gap the reviewer found: `orders.users_id` still says
    // ref:'users', refField:'id' after the rename below, but 'users' no longer
    // has a field called 'id' at all. `ref` resolving was treated as enough to
    // derive from — it isn't; the derived rel's sourceField must itself exist,
    // or downstream geometry resolves fieldIndex -1 and mis-anchors the port
    // instead of the derivation simply refusing to produce a dangling edge.
    it('renaming a referenced pk drops the now-dangling derived rel instead of deriving one with a nonexistent sourceField', () => {
      const m1 = buildModel(); // orders.users_id (fk, refField 'id') -> users.id (pk)
      const users = m1.entityById.get('users')!;
      const renamed = applyModelEdit(m1, {
        kind: 'upsertEntity',
        // 'id' renamed to 'key'; manager_id dropped entirely so this edit isolates
        // the cross-entity case from the (separately-covered) same-entity one.
        entity: { id: 'users', label: users.label, group: users.group, description: null, fields: [editPk('key'), editPlain('name')] },
      });
      expect(renamed.entityById.get('users')!.fields.map((f) => f.name)).toEqual(['key', 'name']);
      expect(renamed.relationships.some((r) => r.target === 'orders' && r.targetField === 'users_id')).toBe(false);
      expect(renamed.relationships.some((r) => r.source === 'users' && r.sourceField === 'id')).toBe(false);
    });

    it('keeps a hand-authored fk-kind rel verbatim (id/label/cardinality) across an unrelated edit', () => {
      // twoZoneRaw's rels are all kind:'fk', hand-authored ids ('u-o','t-o','self')
      // that coincide with valid fk fields — the old design blew these away and
      // rederived fresh (differently-shaped) ids on every single edit.
      const m1 = buildModel();
      const before = [...m1.relationships].sort((a, b) => a.id.localeCompare(b.id));
      const m2 = applyModelEdit(m1, { kind: 'setMeta', title: 'T', description: 'D' });
      const after = [...m2.relationships].sort((a, b) => a.id.localeCompare(b.id));
      expect(after).toEqual(before);
      expect(after.map((r) => r.id)).toEqual(['self', 't-o', 'u-o']);
    });

    it('does not double-derive a pair already covered by an explicit rel authored in the reverse direction', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          { id: 'a', group: 'g', fields: [pkField] },
          { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' }] },
        ],
        // Authored in reverse: source is the fk-owning side, target is the referenced side.
        relationships: [{ id: 'reversed', source: 'b', sourceField: 'a_id', target: 'a', targetField: 'id', kind: 'm2m', label: 'rev' }],
      };
      const m1 = buildModel(raw);
      const m2 = applyModelEdit(m1, { kind: 'setMeta', title: 'T', description: 'D' });
      const covering = m2.relationships.filter(
        (r) => (r.source === 'a' && r.target === 'b') || (r.source === 'b' && r.target === 'a'),
      );
      expect(covering).toHaveLength(1);
      expect(covering[0]!.id).toBe('reversed');
    });

    it('rebuilds relById to match relationships exactly, even for edits that touch no entities', () => {
      const m1 = buildModel();
      const m2 = applyModelEdit(m1, { kind: 'setMeta', title: 'T', description: 'D' });
      expect(m2.relById.size).toBe(m2.relationships.length);
      for (const r of m2.relationships) expect(m2.relById.get(r.id)).toEqual(r);
      expect(m2.relById).not.toBe(m1.relById);
    });

    // Rule invariant, pinned against the real bundled seed model (not just the
    // small test fixture) so it can't drift unnoticed as that file grows.
    it('relById.size === relationships.length for the real seed model, after an edit', () => {
      const { model, errors } = loadModel(seedRaw);
      expect(errors).toEqual([]);
      const edited = applyModelEdit(model!, { kind: 'setMeta', title: model!.meta.title ?? '', description: model!.meta.description ?? '' });
      expect(edited.relById.size).toBe(edited.relationships.length);
      for (const r of edited.relationships) expect(edited.relById.get(r.id)).toEqual(r);
    });

    // Rule invariant: derivation must never emit a relationship whose
    // sourceField/targetField don't actually resolve on their entities. Geometry
    // indexes fields by name and silently falls back to fieldIndex -1 for a miss
    // (mis-anchoring the port one row off) rather than crashing, so this can only
    // be caught by checking the model directly — pinned against the real seed
    // model so a future field rename that reintroduces the gap fails loudly here.
    it('every relationship\'s sourceField/targetField resolve on their entities, for the real seed model after an edit', () => {
      const { model, errors } = loadModel(seedRaw);
      expect(errors).toEqual([]);
      const edited = applyModelEdit(model!, { kind: 'setMeta', title: model!.meta.title ?? '', description: model!.meta.description ?? '' });
      for (const r of edited.relationships) {
        expect(edited.entityById.get(r.source)?.fields.some((f) => f.name === r.sourceField)).toBe(true);
        expect(edited.entityById.get(r.target)?.fields.some((f) => f.name === r.targetField)).toBe(true);
      }
    });
  });

  describe('fkRefsTo', () => {
    it('lists every {entityId, field} whose fk field references the given entity', () => {
      const m1 = buildModel(); // users ← orders.users_id, users ← users.manager_id (self), tags ← orders.tag_id
      expect(fkRefsTo(m1, 'users').sort((a, b) => a.entityId.localeCompare(b.entityId))).toEqual([
        { entityId: 'orders', field: 'users_id' },
        { entityId: 'users', field: 'manager_id' },
      ]);
      expect(fkRefsTo(m1, 'tags')).toEqual([{ entityId: 'orders', field: 'tag_id' }]);
      expect(fkRefsTo(m1, 'orders')).toEqual([]);
    });

    it('matches on `ref` alone, regardless of role — the same test deleteEntity uses to clear fields', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          { id: 'a', group: 'g', fields: [pkField] },
          // `ref` set but role is not 'fk' — an inconsistent-but-possible loaded shape.
          { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int', role: null, ref: 'a', refField: 'id' }] },
        ],
        relationships: [],
      };
      const m1 = buildModel(raw);
      expect(fkRefsTo(m1, 'a')).toEqual([{ entityId: 'b', field: 'a_id' }]);
    });
  });

  describe('input validation', () => {
    it('upsertEntity into an unknown group throws', () => {
      const m1 = buildModel();
      expect(() =>
        applyModelEdit(m1, {
          kind: 'upsertEntity',
          entity: { id: 'new', label: 'New', group: 'ghost-group', description: null, fields: [editPk()] },
        }),
      ).toThrow(/ghost-group/);
    });

    it('deleteGroup of an unknown id throws', () => {
      const m1 = buildModel();
      expect(() => applyModelEdit(m1, { kind: 'deleteGroup', id: 'ghost' })).toThrow(/ghost/);
    });

    it('upsertEntity with duplicate field names throws', () => {
      const m1 = buildModel();
      expect(() =>
        applyModelEdit(m1, {
          kind: 'upsertEntity',
          entity: { id: 'new', label: 'New', group: 'z1', description: null, fields: [editPk(), editPlain('id', 'text')] },
        }),
      ).toThrow(/duplicate/i);
    });

    it('upsertEntity fk field with no ref throws', () => {
      const m1 = buildModel();
      const badFk: EditField = { name: 'x_id', type: 'int', role: 'fk', ref: null, refField: null, description: null };
      expect(() =>
        applyModelEdit(m1, {
          kind: 'upsertEntity',
          entity: { id: 'new', label: 'New', group: 'z1', description: null, fields: [editPk(), badFk] },
        }),
      ).toThrow(/x_id/);
    });

    it('upsertEntity fk field referencing an unknown entity throws', () => {
      const m1 = buildModel();
      expect(() =>
        applyModelEdit(m1, {
          kind: 'upsertEntity',
          entity: { id: 'new', label: 'New', group: 'z1', description: null, fields: [editPk(), editFk('x_id', 'ghost')] },
        }),
      ).toThrow(/ghost/);
    });

    it('upsertEntity fk field referencing an unknown field on a known entity throws', () => {
      const m1 = buildModel();
      expect(() =>
        applyModelEdit(m1, {
          kind: 'upsertEntity',
          entity: { id: 'new', label: 'New', group: 'z1', description: null, fields: [editPk(), editFk('x_id', 'users', 'ghost_field')] },
        }),
      ).toThrow(/ghost_field/);
    });

    it('upsertEntity allows a new entity whose fk field self-references its own not-yet-existing row', () => {
      const m1 = buildModel();
      const m2 = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: { id: 'nodes', label: 'Nodes', group: 'z1', description: null, fields: [editPk(), editFk('parent_id', 'nodes')] },
      });
      expect(m2.entityById.has('nodes')).toBe(true);
      expect(m2.relationships.some((r) => r.source === 'nodes' && r.target === 'nodes' && r.targetField === 'parent_id')).toBe(true);
    });

    it('upsertGroup with parent equal to its own id throws', () => {
      const m1 = buildModel();
      expect(() => applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'z1', label: 'Zone One', parent: 'z1' } })).toThrow(/z1/);
    });

    it('upsertGroup with an unknown parent throws', () => {
      const m1 = buildModel();
      expect(() =>
        applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'sub1', label: 'Sub One', parent: 'ghost' } }),
      ).toThrow(/ghost/);
    });

    it('upsertGroup whose parent is itself a subgroup throws (nesting is one level)', () => {
      const m1 = buildModel(nestedRaw()); // zone 'z' with subgroup 's'
      expect(() =>
        applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'deeper', label: 'Deeper', parent: 's' } }),
      ).toThrow(/s/);
    });

    it('a new group gets order = max(existing orders) + 1, not a same-parent sibling count', () => {
      const m1 = buildModel(); // z1 order 0, z2 order 1
      const withSub = applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'sub1', label: 'Sub One', parent: 'z1' } });
      expect(withSub.groups.find((g) => g.id === 'sub1')!.order).toBe(2);
      // A same-parent sibling count for a new top-level zone would collide with
      // sub1's order (2 existing top-level zones -> 2, same as sub1) — max+1 doesn't.
      const withZone = applyModelEdit(withSub, { kind: 'upsertGroup', group: { id: 'z3', label: 'Zone Three', parent: null } });
      expect(withZone.groups.find((g) => g.id === 'z3')!.order).toBe(3);
    });
  });

  it('is pure — never mutates the input model, across every edit kind', () => {
    const m1 = buildModel();
    const snapshot = JSON.stringify(m1, (_, v: unknown) => (v instanceof Map ? [...v] : v));

    applyModelEdit(m1, { kind: 'setMeta', title: 'X', description: 'Y' });
    applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'z3', label: 'Z3', parent: null } });
    applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'z1', label: 'Zone One Renamed', parent: null } });
    applyModelEdit(m1, {
      kind: 'upsertEntity',
      entity: { id: 'tags', label: 'Tags', group: 'z2', description: null, fields: [editPk(), editFk('owner_id', 'users')] },
    });
    applyModelEdit(m1, {
      kind: 'upsertEntity',
      entity: { id: 'new_table', label: 'New', group: 'z1', description: null, fields: [editPk()] },
    });
    applyModelEdit(m1, { kind: 'deleteEntity', id: 'tags' });
    expect(() => applyModelEdit(m1, { kind: 'deleteGroup', id: 'z1' })).toThrow(); // invalid edits must not mutate either

    expect(JSON.stringify(m1, (_, v: unknown) => (v instanceof Map ? [...v] : v))).toBe(snapshot);
  });
});
