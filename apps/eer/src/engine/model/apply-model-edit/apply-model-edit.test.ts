import { describe, expect, it } from 'vitest';

import { buildModel, nestedRaw, pkField } from '../../../test/models';
import { CARD_MAX_W, CARD_MIN_W, HEADER_H, ROW_H } from '../../geometry/metrics';
import { columnRoles } from '../column-roles';
import { loadModel } from '../load-model';
import { applyModelEdit, fkRefsTo, type EditField } from './apply-model-edit';
import seedRaw from '../../../../models/items-platform.json';

const editField = (name: string, type = 'text'): EditField => ({
  name,
  type,
  title: null,
  description: null,
  nullable: true,
  default: null,
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
        entity: {
          id: 'shipments',
          label: 'Shipments',
          group: 'z2',
          description: null,
          fields: [editField('id', 'int'), editField('orders_id', 'int')],
          constraints: [
            { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
            { id: 'c2', kind: 'fk', name: null, columns: ['orders_id'], refTable: 'orders', refColumns: ['id'], onDelete: null, onUpdate: null },
          ],
          indexes: [],
        },
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
        entity: {
          id: 'shipments',
          label: 'Shipments',
          group: 'z2',
          description: null,
          fields: [editField('id', 'int')],
          constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
          indexes: [],
        },
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
          fields: [editField('id', 'int'), editField('users_id', 'int'), editField('tag_id', 'int'), editField('note')],
          constraints: before.constraints,
          indexes: before.indexes,
        },
      });
      const after = m2.entityById.get('orders')!;
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
      expect(after.label).toBe('Orders v2');
      expect(after.description).toBe('updated');
      expect(after.columns).toHaveLength(4);
      expect(after._h).toBe(HEADER_H + 4 * ROW_H);
      expect(before._h).toBe(HEADER_H + 3 * ROW_H); // input untouched
    });
  });

  describe('deleteEntity', () => {
    it('clears fk fields pointing at it and drops its edges', () => {
      const m1 = buildModel(); // users ← orders.users_id (fk)
      const m2 = applyModelEdit(m1, { kind: 'deleteEntity', id: 'users' });
      expect(m2.entityById.has('users')).toBe(false);
      const orders = m2.entityById.get('orders')!;
      // No Column carries role/ref any more (see types.ts) — the fk-ness of
      // orders.users_id lives entirely in its constraint, so "cleared" means
      // the constraint pointing at "users" is gone and the column's FK badge
      // (columnRoles reads constraints) follows suit.
      expect(orders.constraints.some((c) => c.kind === 'fk' && c.refTable === 'users')).toBe(false);
      expect(columnRoles(orders).get('users_id')).toMatchObject({ fk: false });
      expect(m2.relationships.some((r) => r.source === 'users' || r.target === 'users')).toBe(false);
      expect(m1.entityById.has('users')).toBe(true); // input untouched
    });

    it('throws for an unknown entity id', () => {
      const m1 = buildModel();
      expect(() => applyModelEdit(m1, { kind: 'deleteEntity', id: 'ghost' })).toThrow(/ghost/);
    });

    // CRITICAL, reviewer-found (round 2): deleteEntity used to clear only the
    // legacy field.ref, never the fk CONSTRAINT pointing at the deleted table.
    // Since upsertEntity now passes constraints through verbatim (no
    // re-synthesis), a stale fk constraint was never scrubbed: the surviving
    // table kept an FK badge for that column (columnRoles reads constraints,
    // not field.ref), the dangling constraint serialized straight back to the
    // file, and reload was silent about it.
    it('deleting a table removes fk constraints on surviving tables that reference it, not just legacy field.ref', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          { id: 'a', group: 'g', fields: [{ name: 'id', type: 'int' }], constraints: [{ id: 'pk1', kind: 'pk', columns: ['id'] }] },
          {
            id: 'b', group: 'g',
            fields: [{ name: 'id', type: 'int' }, { name: 'a_id', type: 'int' }],
            constraints: [
              { id: 'pk2', kind: 'pk', columns: ['id'] },
              { id: 'fk1', kind: 'fk', columns: ['a_id'], refTable: 'a', refColumns: ['id'] },
            ],
          },
        ],
      };
      const m1 = buildModel(raw);
      expect(m1.relationships.map((r) => r.id)).toEqual(['rel:b:fk1']);

      const m2 = applyModelEdit(m1, { kind: 'deleteEntity', id: 'a' });
      const b = m2.entityById.get('b')!;
      expect(b.constraints.some((c) => c.kind === 'fk' && c.refTable === 'a')).toBe(false);
      expect(columnRoles(b).get('a_id')).toMatchObject({ fk: false }); // no FK badge left on the column
      expect(m2.relationships.some((r) => r.source === 'a' || r.target === 'a')).toBe(false);
      expect(fkRefsTo(m2, 'a')).toEqual([]);
      // pk/other constraints on the surviving table are untouched
      expect(b.constraints.some((c) => c.kind === 'pk' && c.id === 'pk2')).toBe(true);
    });

    it('re-creating a table under the deleted id does not resurrect the dropped edge', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          { id: 'a', group: 'g', fields: [{ name: 'id', type: 'int' }], constraints: [{ id: 'pk1', kind: 'pk', columns: ['id'] }] },
          {
            id: 'b', group: 'g',
            fields: [{ name: 'id', type: 'int' }, { name: 'a_id', type: 'int' }],
            constraints: [
              { id: 'pk2', kind: 'pk', columns: ['id'] },
              { id: 'fk1', kind: 'fk', columns: ['a_id'], refTable: 'a', refColumns: ['id'] },
            ],
          },
        ],
      };
      const m1 = buildModel(raw);
      const deleted = applyModelEdit(m1, { kind: 'deleteEntity', id: 'a' });
      const recreated = applyModelEdit(deleted, {
        kind: 'upsertEntity',
        entity: {
          id: 'a',
          label: 'A',
          group: 'g',
          description: null,
          fields: [editField('id', 'int')],
          constraints: [{ id: 'pk1', kind: 'pk', name: null, columns: ['id'] }],
          indexes: [],
        },
      });
      expect(recreated.relationships.some((r) => r.source === 'a' || r.target === 'a')).toBe(false);
      expect(recreated.entityById.get('b')!.constraints.some((c) => c.kind === 'fk' && c.refTable === 'a')).toBe(false);
    });

    it('fkRefsTo(model, id) agrees with what deleteEntity actually clears — the delete-confirm copy is honest', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          { id: 'a', group: 'g', fields: [{ name: 'id', type: 'int' }], constraints: [{ id: 'pk1', kind: 'pk', columns: ['id'] }] },
          {
            id: 'b', group: 'g',
            fields: [{ name: 'id', type: 'int' }, { name: 'a_id', type: 'int' }],
            constraints: [
              { id: 'pk2', kind: 'pk', columns: ['id'] },
              { id: 'fk1', kind: 'fk', columns: ['a_id'], refTable: 'a', refColumns: ['id'] },
            ],
          },
        ],
      };
      const m1 = buildModel(raw);
      const before = fkRefsTo(m1, 'a');
      expect(before).toEqual([{ entityId: 'b', field: 'a_id' }]);

      const m2 = applyModelEdit(m1, { kind: 'deleteEntity', id: 'a' });
      // Everything fkRefsTo promised as "referencing a" must actually be cleared now.
      for (const ref of before) {
        const e = m2.entityById.get(ref.entityId)!;
        expect(e.constraints.some((c) => c.kind === 'fk' && c.refTable === 'a' && c.columns.join(', ') === ref.field)).toBe(false);
      }
      expect(fkRefsTo(m2, 'a')).toEqual([]);
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
    it('adding an fk constraint via upsertEntity derives its relationship; removing the constraint drops it', () => {
      const m1 = buildModel();
      const tags = m1.entityById.get('tags')!;
      const withFk = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: {
          id: 'tags',
          label: tags.label,
          group: tags.group,
          description: null,
          fields: [editField('id', 'int'), editField('owner_id', 'int')],
          constraints: [
            { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
            { id: 'c2', kind: 'fk', name: null, columns: ['owner_id'], refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
          ],
          indexes: [],
        },
      });
      expect(withFk.relationships.some((r) => r.source === 'users' && r.target === 'tags' && r.targetField === 'owner_id')).toBe(true);

      const removed = applyModelEdit(withFk, {
        kind: 'upsertEntity',
        entity: {
          id: 'tags',
          label: tags.label,
          group: tags.group,
          description: null,
          fields: [editField('id', 'int')], // owner_id field gone entirely
          constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }], // fk constraint gone too
          indexes: [],
        },
      });
      expect(removed.relationships.some((r) => r.target === 'tags' && r.targetField === 'owner_id')).toBe(false);
    });

    // Fields no longer drive derivation at all — a prior version re-derived
    // pk/fk constraints from EditField.role/ref on every upsertEntity, so
    // clearing a field's role (even keeping its name) removed the edge. Now
    // constraints are the ONLY thing upsertEntity ever looks at (passed
    // through verbatim by its caller — see the module's header comment), so
    // the edge only disappears when the CONSTRAINT is dropped, regardless of
    // what happens to the field alongside it.
    it('removing just the fk constraint (fields left unchanged) removes the derived relationship', () => {
      const m1 = buildModel();
      const tags = m1.entityById.get('tags')!;
      const withFk = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: {
          id: 'tags',
          label: tags.label,
          group: tags.group,
          description: null,
          fields: [editField('id', 'int'), editField('owner_id', 'int')],
          constraints: [
            { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
            { id: 'c2', kind: 'fk', name: null, columns: ['owner_id'], refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
          ],
          indexes: [],
        },
      });
      expect(withFk.relationships.some((r) => r.source === 'users' && r.target === 'tags' && r.targetField === 'owner_id')).toBe(true);

      const cleared = applyModelEdit(withFk, {
        kind: 'upsertEntity',
        entity: {
          id: 'tags',
          label: tags.label,
          group: tags.group,
          description: null,
          fields: [editField('id', 'int'), editField('owner_id', 'int')], // field untouched
          constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }], // only the fk constraint removed
          indexes: [],
        },
      });
      expect(cleared.relationships.some((r) => r.target === 'tags' && r.targetField === 'owner_id')).toBe(false);
    });

    // A hand-authored `kind: 'fk'` relationship is no longer "authored data" in
    // its own right — relationships ARE the foreign keys now (see
    // derive-relationships.ts) — a label on a kind:'fk' rel over the same pair
    // as a derived edge merges ONTO that derived edge (see the "a derived edge
    // wins" test below); it never survives as an independent entry once its
    // backing fk constraint is gone entirely, which is what this test covers.
    it('a labelled fk-kind rel is dropped, not kept as an independent entry, once its backing constraint is gone', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          { id: 'a', group: 'g', fields: [pkField] },
          { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' }] },
        ],
        relationships: [{ id: 'lbl', source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id', kind: 'fk', label: 'owns' }],
      };
      const m1 = buildModel(raw);
      expect(m1.relationships).toEqual([expect.objectContaining({ id: 'rel:b:c2' })]); // 'lbl' never survives as its own entry
      const cleared = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: {
          id: 'b',
          label: 'b',
          group: 'g',
          description: null,
          fields: [editField('id', 'int'), editField('a_id', 'int')],
          constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }], // fk constraint dropped
          indexes: [],
        },
      });
      expect(cleared.relationships).toEqual([]); // no backing fk constraint left, so nothing to merge 'lbl' onto either
    });

    // Derivation is fully determined by the (id-stable) constraint, so an
    // unrelated edit (renaming a group, which rebuilds every entity/constraint
    // untouched) reproduces the exact same derived id — no "kept verbatim"
    // bookkeeping needed. b.a_id mirrors the real seed's outbox.event_id:
    // ref/refField set, but no role at all (still fk-worthy — see
    // synthesizeLegacyConstraints, which keys off `ref` alone).
    it('a constraint-backed rel re-derives the identical id across an unrelated edit, even with no field role at all', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          { id: 'a', group: 'g', fields: [pkField] },
          { id: 'b', group: 'g', fields: [{ name: 'a_id', type: 'int', ref: 'a', refField: 'id' }] }, // no role at all
        ],
        relationships: [],
      };
      const m1 = buildModel(raw);
      expect(m1.relationships).toEqual([expect.objectContaining({ id: 'rel:b:c1', cardinality: '1-n' })]);

      const renamed = applyModelEdit(m1, { kind: 'upsertGroup', group: { id: 'g', label: 'G Renamed', parent: null } });
      expect(renamed.relationships.some((r) => r.id === 'rel:b:c1')).toBe(true);
    });

    it('renaming an fk field (constraint columns updated alongside it) drops the stale rel and derives a fresh one under the new name', () => {
      const m1 = buildModel();
      const tags = m1.entityById.get('tags')!;
      const withFk = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: {
          id: 'tags',
          label: tags.label,
          group: tags.group,
          description: null,
          fields: [editField('id', 'int'), editField('owner_id', 'int')],
          constraints: [
            { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
            { id: 'c2', kind: 'fk', name: null, columns: ['owner_id'], refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
          ],
          indexes: [],
        },
      });
      const renamed = applyModelEdit(withFk, {
        kind: 'upsertEntity',
        entity: {
          id: 'tags',
          label: tags.label,
          group: tags.group,
          description: null,
          fields: [editField('id', 'int'), editField('owner_ref', 'int')],
          constraints: [
            { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
            { id: 'c2', kind: 'fk', name: null, columns: ['owner_ref'], refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
          ],
          indexes: [],
        },
      });
      expect(renamed.relationships.some((r) => r.targetField === 'owner_id')).toBe(false);
      expect(renamed.relationships.some((r) => r.source === 'users' && r.target === 'tags' && r.targetField === 'owner_ref')).toBe(true);
    });

    // Renaming the REFERENCED side's field (rather than the fk-owning side, the
    // case above) is the gap the reviewer found: a stale fk constraint
    // elsewhere in the model can still point (by column name) at a field that
    // no longer exists on the renamed target. `ref` resolving used to be
    // treated as enough to derive from — it isn't; the derived rel's
    // sourceField must itself exist, or downstream geometry resolves
    // fieldIndex -1 and mis-anchors the port instead of the derivation simply
    // refusing to produce a dangling edge.
    it('renaming a referenced pk drops the now-dangling derived rel instead of deriving one with a nonexistent sourceField', () => {
      const m1 = buildModel(); // orders.users_id (fk, refColumns ['id']) -> users.id (pk)
      const users = m1.entityById.get('users')!;
      const renamed = applyModelEdit(m1, {
        kind: 'upsertEntity',
        // 'id' renamed to 'key'; manager_id (and its self-fk constraint)
        // dropped entirely so this edit isolates the cross-entity case from
        // the (separately-covered) same-entity one.
        entity: {
          id: 'users',
          label: users.label,
          group: users.group,
          description: null,
          fields: [editField('key', 'int'), editField('name')],
          constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['key'] }],
          indexes: [],
        },
      });
      expect(renamed.entityById.get('users')!.columns.map((f) => f.name)).toEqual(['key', 'name']);
      expect(renamed.relationships.some((r) => r.target === 'orders' && r.targetField === 'users_id')).toBe(false);
      expect(renamed.relationships.some((r) => r.source === 'users' && r.sourceField === 'id')).toBe(false);
    });

    it('re-derives the identical relationship ids across an unrelated edit (twoZoneRaw, all kind:\'fk\')', () => {
      // twoZoneRaw's rels are all kind:'fk' — every one of them is always
      // superseded by its derived twin (same source/target/fields, id
      // 'rel:<entity>:<constraintId>'), not kept verbatim by id/label — so an
      // unrelated edit reproduces the exact same derived list.
      const m1 = buildModel();
      const before = [...m1.relationships].sort((a, b) => a.id.localeCompare(b.id));
      const m2 = applyModelEdit(m1, { kind: 'setMeta', title: 'T', description: 'D' });
      const after = [...m2.relationships].sort((a, b) => a.id.localeCompare(b.id));
      expect(after).toEqual(before);
      expect(after.map((r) => r.id)).toEqual(['rel:orders:c2', 'rel:orders:c3', 'rel:users:c2']);
    });

    // A derived edge always wins over an authored one covering the same pair —
    // "relationships ARE the foreign keys" — its id/shape can't be displaced.
    // But an authored rel over that same pair is still a donor: its label and
    // non-fk kind merge onto the derived edge (see derive-relationships.ts),
    // regardless of which direction it was hand-authored in.
    it('a derived edge wins over an explicit rel authored in the reverse direction for the same pair, but still donates its label/kind', () => {
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
      expect(covering[0]!.id).toBe('rel:b:c2'); // derived id/shape wins
      expect(covering[0]!.label).toBe('rev'); // but the authored label still survives
      expect(covering[0]!.kind).toBe('m2m'); // and its non-fk kind
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
        expect(edited.entityById.get(r.source)?.columns.some((f) => f.name === r.sourceField)).toBe(true);
        expect(edited.entityById.get(r.target)?.columns.some((f) => f.name === r.targetField)).toBe(true);
      }
    });

    // CRITICAL, reviewer-found: 17 of the real seed's 37 authored relationships
    // carry a label that DOES have a backing fk constraint to merge onto, plus
    // 'istream'/"stream" (18 total) — items.events.aggregate_id has no fk
    // field at all, a polymorphic reference, so 'istream' has no derived twin
    // to merge onto and must be kept verbatim instead (see
    // derive-relationships.ts); and 3 carry a non-fk ('m2m', rendered dashed)
    // kind. A prior version of deriveRelationships dropped EVERY authored
    // kind:'fk' relationship in favour of its bare derived twin (label: null)
    // — or, for one with no derived twin at all like 'istream', dropped it
    // entirely — and excluded an 'm2m' rel from the kept-verbatim authored set
    // whenever its pair happened to coincide with a derived fk edge (which is
    // exactly how the seed encodes its 3 m2m annotations) — turning all 17
    // backed labels and all 3 dashed m2m edges into a plain, unlabelled fk,
    // and silently erasing 'istream', on the very next load. Pinned against
    // the real bundled seed so it can't silently regress.
    it('the real seed keeps all 18 authored labels (17 backed + istream, unbacked) and all 3 m2m-kind relationships', () => {
      const { model, errors } = loadModel(seedRaw);
      expect(errors).toEqual([]);
      expect(model!.relationships.filter((r) => r.label).length).toBe(18);
      expect(model!.relById.get('istream')).toMatchObject({ label: 'stream', kind: 'fk' });
      expect(model!.relationships.filter((r) => r.kind === 'm2m').length).toBe(3);
    });
  });

  describe('upsertEntity — constraints/indexes pass through verbatim (never re-derived from fields)', () => {
    it('preserves an entity\'s constraints (pk/unique/check) and index intact across a description-only edit', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          {
            id: 'a', group: 'g',
            fields: [{ name: 'id', type: 'int' }, { name: 'email', type: 'text' }],
            constraints: [
              { id: 'c1', kind: 'pk', columns: ['id'] },
              { id: 'c2', kind: 'unique', columns: ['email'] },
              { id: 'c3', kind: 'check', expression: "email <> ''" },
            ],
            indexes: [{ id: 'i1', name: 'idx_a_email', columns: ['email'], unique: false }],
          },
        ],
      };
      const { model: m1, errors } = loadModel(raw);
      expect(errors).toEqual([]);
      const before = m1!.entityById.get('a')!;

      const m2 = applyModelEdit(m1!, {
        kind: 'upsertEntity',
        entity: {
          id: 'a',
          label: 'a',
          group: 'g',
          description: 'updated',
          fields: [editField('id', 'int'), editField('email', 'text')],
          constraints: before.constraints,
          indexes: before.indexes,
        },
      });
      const after = m2.entityById.get('a')!;
      expect(after.description).toBe('updated');
      expect(after.constraints).toEqual(before.constraints);
      expect(after.indexes).toEqual([{ id: 'i1', name: 'idx_a_email', columns: ['email'], unique: false }]);
    });

    // CRITICAL 2, case (a): a table authored with REAL constraints and no
    // legacy roles at all — the exact shape a prior version's
    // regeneratePkFkConstraints wiped, because such a table has no field
    // role/ref to regenerate keys from, so a description-only Save zeroed its
    // constraints to `[]` and deleted every edge attached to it.
    it('keeps a pk + fk constraint pair, and the derived relationship id, across a description-only edit', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          { id: 'a', group: 'g', fields: [{ name: 'id', type: 'int' }], constraints: [{ id: 'pk1', kind: 'pk', columns: ['id'] }] },
          {
            id: 'b', group: 'g',
            fields: [{ name: 'id', type: 'int' }, { name: 'a_id', type: 'int' }], // no role/ref anywhere
            constraints: [
              { id: 'pk2', kind: 'pk', columns: ['id'] },
              { id: 'fk9', kind: 'fk', columns: ['a_id'], refTable: 'a', refColumns: ['id'] },
            ],
          },
        ],
      };
      const { model: m1, errors } = loadModel(raw);
      expect(errors).toEqual([]);
      expect(m1!.relationships.map((r) => r.id)).toEqual(['rel:b:fk9']);

      const before = m1!.entityById.get('b')!;
      const m2 = applyModelEdit(m1!, {
        kind: 'upsertEntity',
        entity: {
          id: 'b',
          label: 'b',
          group: 'g',
          description: 'unrelated change',
          fields: [editField('id', 'int'), editField('a_id', 'int')],
          constraints: before.constraints,
          indexes: before.indexes,
        },
      });
      expect(m2.entityById.get('b')!.constraints).toEqual(before.constraints); // both constraints survived
      expect(m2.relationships.map((r) => r.id)).toEqual(['rel:b:fk9']); // no churn
    });

    // CRITICAL 2, case (b): same, for a composite fk (multiple columns) — a
    // shape regeneratePkFkConstraints could never even express (it only ever
    // built single-column fk constraints, keyed by `columns[0]`), so it was
    // unrecoverable once wiped.
    it('keeps a composite fk constraint, and its derived relationship, across a description-only edit', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          {
            id: 'a', group: 'g',
            fields: [{ name: 'k1', type: 'int' }, { name: 'k2', type: 'int' }],
            constraints: [{ id: 'pk1', kind: 'pk', columns: ['k1', 'k2'] }],
          },
          {
            id: 'b', group: 'g',
            fields: [{ name: 'a1', type: 'int' }, { name: 'a2', type: 'int' }],
            constraints: [{ id: 'fk1', kind: 'fk', columns: ['a1', 'a2'], refTable: 'a', refColumns: ['k1', 'k2'] }],
          },
        ],
      };
      const { model: m1, errors } = loadModel(raw);
      expect(errors).toEqual([]);
      expect(m1!.relationships).toHaveLength(1);
      const relId = m1!.relationships[0]!.id;

      const before = m1!.entityById.get('b')!;
      const m2 = applyModelEdit(m1!, {
        kind: 'upsertEntity',
        entity: {
          id: 'b',
          label: 'b',
          group: 'g',
          description: 'unrelated change',
          fields: [editField('a1', 'int'), editField('a2', 'int')],
          constraints: before.constraints,
          indexes: before.indexes,
        },
      });
      expect(m2.entityById.get('b')!.constraints).toEqual(before.constraints); // composite fk survived intact
      expect(m2.relationships.map((r) => r.id)).toEqual([relId]); // no churn
    });
  });

  describe('fkRefsTo', () => {
    it('lists every {entityId, field} whose fk constraint references the given entity', () => {
      const m1 = buildModel(); // users ← orders.users_id, users ← users.manager_id (self), tags ← orders.tag_id
      expect(fkRefsTo(m1, 'users').sort((a, b) => a.entityId.localeCompare(b.entityId))).toEqual([
        { entityId: 'orders', field: 'users_id' },
        { entityId: 'users', field: 'manager_id' },
      ]);
      expect(fkRefsTo(m1, 'tags')).toEqual([{ entityId: 'orders', field: 'tag_id' }]);
      expect(fkRefsTo(m1, 'orders')).toEqual([]);
    });

    it('reports a composite fk constraint as its columns joined, not truncated to the first one', () => {
      const raw = {
        groups: [{ id: 'g', label: 'G' }],
        entities: [
          {
            id: 'a', group: 'g',
            fields: [{ name: 'k1', type: 'int' }, { name: 'k2', type: 'int' }],
            constraints: [{ id: 'pk1', kind: 'pk', columns: ['k1', 'k2'] }],
          },
          {
            id: 'b', group: 'g',
            fields: [{ name: 'a1', type: 'int' }, { name: 'a2', type: 'int' }],
            constraints: [{ id: 'fk1', kind: 'fk', columns: ['a1', 'a2'], refTable: 'a', refColumns: ['k1', 'k2'] }],
          },
        ],
      };
      const m1 = buildModel(raw);
      expect(fkRefsTo(m1, 'a')).toEqual([{ entityId: 'b', field: 'a1, a2' }]);
    });

    it('finds an fk constraint synthesized from legacy role/ref fields, regardless of role', () => {
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
          entity: { id: 'new', label: 'New', group: 'ghost-group', description: null, fields: [], constraints: [], indexes: [] },
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
          entity: {
            id: 'new',
            label: 'New',
            group: 'z1',
            description: null,
            fields: [editField('id', 'int'), editField('id', 'text')],
            constraints: [],
            indexes: [],
          },
        }),
      ).toThrow(/duplicate/i);
    });

    it('a new entity can self-reference its own not-yet-existing row via an explicit fk constraint', () => {
      const m1 = buildModel();
      const m2 = applyModelEdit(m1, {
        kind: 'upsertEntity',
        entity: {
          id: 'nodes',
          label: 'Nodes',
          group: 'z1',
          description: null,
          fields: [editField('id', 'int'), editField('parent_id', 'int')],
          constraints: [
            { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
            { id: 'c2', kind: 'fk', name: null, columns: ['parent_id'], refTable: 'nodes', refColumns: ['id'], onDelete: null, onUpdate: null },
          ],
          indexes: [],
        },
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
      entity: {
        id: 'tags',
        label: 'Tags',
        group: 'z2',
        description: null,
        fields: [editField('id', 'int'), editField('owner_id', 'int')],
        constraints: [
          { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
          { id: 'c2', kind: 'fk', name: null, columns: ['owner_id'], refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
        ],
        indexes: [],
      },
    });
    applyModelEdit(m1, {
      kind: 'upsertEntity',
      entity: {
        id: 'new_table',
        label: 'New',
        group: 'z1',
        description: null,
        fields: [editField('id', 'int')],
        constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
        indexes: [],
      },
    });
    applyModelEdit(m1, { kind: 'deleteEntity', id: 'tags' });
    expect(() => applyModelEdit(m1, { kind: 'deleteGroup', id: 'z1' })).toThrow(); // invalid edits must not mutate either

    expect(JSON.stringify(m1, (_, v: unknown) => (v instanceof Map ? [...v] : v))).toBe(snapshot);
  });
});
