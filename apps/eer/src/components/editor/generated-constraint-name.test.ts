import { describe, expect, it } from 'vitest';

import type { Constraint } from '../../engine/model/types';
import { generatedConstraintName } from './generated-constraint-name';

// A bare {id, schema} — everything generatedConstraintName reads off the
// owning entity — for a public-schema table (the common case exercised
// below). The schema-qualified case (Task 12 review, Finding 1) gets its own
// describe block further down.
const entity = (id: string) => ({ id, schema: null });

describe('generatedConstraintName', () => {
  it('names a single-column pk the way an inline .primaryKey() lets POSTGRES name it', () => {
    const c: Constraint = { id: 'c1', kind: 'pk', name: null, columns: ['id'] };
    expect(generatedConstraintName(entity('orders'), c, [c])).toBe('orders_pkey');
  });

  it('names a composite pk the way DRIZZLE names an unnamed table-level primaryKey()', () => {
    const c: Constraint = { id: 'c1', kind: 'pk', name: null, columns: ['order_id', 'product_id'] };
    expect(generatedConstraintName(entity('order_items'), c, [c])).toBe('order_items_order_id_product_id_pk');
  });

  it('names a unique constraint the way DRIZZLE names an unnamed unique().on(...)', () => {
    const c: Constraint = { id: 'c1', kind: 'unique', name: null, columns: ['number'], nullsNotDistinct: false };
    expect(generatedConstraintName(entity('orders'), c, [c])).toBe('orders_number_unique');
  });

  it('names an fk the way DRIZZLE names an unnamed foreignKey() — ForeignKey.getName()', () => {
    const c: Constraint = {
      id: 'c1', kind: 'fk', name: null, columns: ['owner_id'],
      refSchema: null, refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null,
    };
    expect(generatedConstraintName(entity('projects'), c, [c])).toBe('projects_owner_id_users_id_fk');
  });

  it('returns null for an fk with no target table chosen yet (nothing to preview)', () => {
    const c: Constraint = {
      id: 'c1', kind: 'fk', name: null, columns: ['owner_id'],
      refSchema: null, refTable: '', refColumns: [], onDelete: null, onUpdate: null,
    };
    expect(generatedConstraintName(entity('projects'), c, [c])).toBeNull();
  });

  it('returns null for a pk/unique with no columns ticked yet', () => {
    const pk: Constraint = { id: 'c1', kind: 'pk', name: null, columns: [] };
    const unique: Constraint = { id: 'c2', kind: 'unique', name: null, columns: [], nullsNotDistinct: false };
    expect(generatedConstraintName(entity('orders'), pk, [pk])).toBeNull();
    expect(generatedConstraintName(entity('orders'), unique, [unique])).toBeNull();
  });

  it('numbers a table\'s unnamed check constraints the way Postgres numbers unnamed table constraints', () => {
    const c1: Constraint = { id: 'c1', kind: 'check', name: null, expression: 'total > 0' };
    const c2: Constraint = { id: 'c2', kind: 'check', name: null, expression: 'qty > 0' };
    const siblings = [c1, c2];
    expect(generatedConstraintName(entity('orders'), c1, siblings)).toBe('orders_check');
    expect(generatedConstraintName(entity('orders'), c2, siblings)).toBe('orders_check1');
  });

  it('a check that already has its own explicit name still gets a well-defined (if moot) preview', () => {
    // Never actually shown — the input has a real value once named — but the
    // function must not crash/misbehave if called on one anyway.
    const named: Constraint = { id: 'c1', kind: 'check', name: 'ck_total', expression: 'total > 0' };
    expect(generatedConstraintName(entity('orders'), named, [named])).toBe('orders_check');
  });

  // Task 12 review, Finding 1 (IMPORTANT): the entity's own id is
  // schema-qualified for a non-public table ("schema.name" — see
  // export-drizzle.ts's physicalTableName), but drizzle's naming conventions
  // key off the PHYSICAL table name only. Passing the raw id straight through
  // used to leak the schema prefix into the preview.
  describe('a schema-qualified table (non-public schema)', () => {
    const billingOrders = { id: 'billing.orders', schema: 'billing' };

    it('strips the schema prefix for a pk preview', () => {
      const c: Constraint = { id: 'c1', kind: 'pk', name: null, columns: ['id'] };
      expect(generatedConstraintName(billingOrders, c, [c])).toBe('orders_pkey');
    });

    it('strips the schema prefix for a unique preview', () => {
      const c: Constraint = { id: 'c1', kind: 'unique', name: null, columns: ['number'], nullsNotDistinct: false };
      expect(generatedConstraintName(billingOrders, c, [c])).toBe('orders_number_unique');
    });
  });
});
