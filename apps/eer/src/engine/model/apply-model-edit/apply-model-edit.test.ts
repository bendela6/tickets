import { describe, expect, it } from 'vitest';

import { buildModel, nestedRaw, pkField } from '../../../test/models';
import { CARD_MAX_W, CARD_MIN_W, HEADER_H, ROW_H } from '../../geometry/metrics';
import { applyModelEdit, fkRefsTo, type EditField } from './apply-model-edit';

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
    it('an fk field derives its relationship; clearing the role removes it', () => {
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

    it('rebuilds relById to match relationships exactly, even for edits that touch no entities', () => {
      const m1 = buildModel();
      const m2 = applyModelEdit(m1, { kind: 'setMeta', title: 'T', description: 'D' });
      expect(m2.relById.size).toBe(m2.relationships.length);
      for (const r of m2.relationships) expect(m2.relById.get(r.id)).toEqual(r);
      expect(m2.relById).not.toBe(m1.relById);
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
