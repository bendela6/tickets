import { describe, expect, it } from 'vitest';
import {
  COLUMN_WIDTH,
  depthOf,
  extentOf,
  isPoint,
  layoutTables,
  NODE_WIDTH,
  nodeHeight,
  ORIGIN,
  placeTables,
  relationsOf,
  wirePath,
} from './layout';
import type { ErdColumn, ErdTables } from './schema';

const col = (type: string, more: Partial<ErdColumn> = {}): ErdColumn => ({ type, ...more });

/** The numbers in a path, in order: `M x1 y1 C … x2 y2`. */
const numbers = (path: string) => path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

describe('layoutTables', () => {
  const tables: ErdTables = {
    jobs: { columns: { id: col('uuid', { pk: true }) } },
    runs: { columns: { id: col('uuid', { pk: true }), job_id: col('uuid', { ref: 'jobs.id' }) } },
    leases: { columns: { run_id: col('uuid', { ref: 'runs.id' }) } },
  };

  it('places a table one column right of what it references', () => {
    expect(depthOf(tables)).toEqual({ jobs: 0, runs: 1, leases: 2 });
    const pos = layoutTables(tables);
    expect(pos.jobs).toEqual([ORIGIN, ORIGIN]);
    expect(pos.runs?.[0]).toBe(ORIGIN + COLUMN_WIDTH);
    expect(pos.leases?.[0]).toBe(ORIGIN + 2 * COLUMN_WIDTH);
  });

  it('stacks tables that share a column, each below the last by its own height', () => {
    const two: ErdTables = {
      a: { columns: { id: col('uuid'), x: col('int') } },
      b: { columns: { id: col('uuid') } },
    };
    const pos = layoutTables(two);
    expect(pos.a?.[0]).toBe(pos.b?.[0]);
    expect(pos.b?.[1]).toBeGreaterThan(ORIGIN + nodeHeight(2));
  });

  it('ignores a ref to a table that is not in the diagram', () => {
    const pos = layoutTables({ a: { columns: { x: col('uuid', { ref: 'ghost.id' }) } } });
    expect(pos.a).toEqual([ORIGIN, ORIGIN]);
  });

  it('caps the depth so a long chain does not run off the canvas', () => {
    const chain: ErdTables = {};
    for (let i = 0; i < 9; i++) {
      chain[`t${i}`] = {
        columns: { id: col('uuid'), ...(i ? { p: col('uuid', { ref: `t${i - 1}.id` }) } : {}) },
      };
    }
    expect(Math.max(...Object.values(depthOf(chain)))).toBe(5);
  });

  it('settles a mutual reference at the cap for both tables', () => {
    const cycle: ErdTables = {
      employees: {
        columns: { id: col('uuid'), department_id: col('uuid', { ref: 'departments.id' }) },
      },
      departments: {
        columns: { id: col('uuid'), manager_id: col('uuid', { ref: 'employees.id' }) },
      },
    };
    expect(depthOf(cycle)).toEqual({ employees: 5, departments: 5 });
  });

  it('leaves a table that references itself where it would be', () => {
    const tree: ErdTables = {
      categories: {
        columns: { id: col('uuid'), parent_id: col('uuid', { ref: 'categories.id' }) },
      },
    };
    expect(depthOf(tree)).toEqual({ categories: 0 });
  });

  it('gives a table named after a prototype member a place of its own', () => {
    const odd: ErdTables = {
      users: { columns: { id: col('uuid') } },
      toString: { columns: { user_id: col('uuid', { ref: 'users.id' }) } },
    };
    expect(depthOf(odd)).toEqual({ users: 0, toString: 1 });
    expect(layoutTables(odd).toString).toEqual([ORIGIN + COLUMN_WIDTH, ORIGIN]);
  });
});

describe('placeTables', () => {
  const tables: ErdTables = {
    users: { columns: { id: col('uuid') } },
    orders: { columns: { user_id: col('uuid', { ref: 'users.id' }) } },
  };

  it('takes each table from the first layout that has it, and lays out the rest', () => {
    const placed = placeTables(tables, { users: [1, 2] }, { users: [9, 9], orders: [5, 6] });
    expect(placed).toEqual([
      { name: 'users', table: tables.users, at: [1, 2] },
      { name: 'orders', table: tables.orders, at: [5, 6] },
    ]);
    expect(placeTables(tables)[1]?.at).toEqual([ORIGIN + COLUMN_WIDTH, ORIGIN]);
  });

  it('does not read a prototype member as a kept position', () => {
    const placed = placeTables({ toString: { columns: {} } }, {});
    expect(placed[0]?.at).toEqual([ORIGIN, ORIGIN]);
  });

  it('measures a canvas out to the furthest card and a margin past it', () => {
    const placed = placeTables(tables, { orders: [400, 300] });
    expect(extentOf(placed)).toEqual({
      width: 400 + NODE_WIDTH + ORIGIN,
      height: 300 + nodeHeight(1) + ORIGIN,
    });
    expect(extentOf([])).toEqual({ width: ORIGIN, height: ORIGIN });
  });
});

describe('relationsOf', () => {
  it('finds the referenced column’s row', () => {
    const tables: ErdTables = {
      users: { columns: { id: col('uuid'), email: col('text') } },
      orders: { columns: { id: col('uuid'), email: col('text', { ref: 'users.email' }) } },
    };
    expect(relationsOf(tables)).toEqual([
      { from: 'orders', column: 'email', fromRow: 1, to: 'users', ref: 'users.email', toRow: 1 },
    ]);
  });

  it('points at the first row when the ref names no column the table has', () => {
    const tables: ErdTables = {
      users: { columns: { id: col('uuid') } },
      orders: { columns: { a: col('uuid', { ref: 'users' }), b: col('uuid', { ref: 'users.x' }) } },
    };
    expect(relationsOf(tables).map((relation) => relation.toRow)).toEqual([0, 0]);
  });

  it('draws nothing for a ref to an undeclared table, a prototype member’s name included', () => {
    const tables: ErdTables = {
      users: {
        columns: {
          a: col('uuid', { ref: 'ghost.id' }),
          b: col('uuid', { ref: 'constructor.id' }),
          c: col('uuid', { ref: 'toString.id' }),
        },
      },
    };
    expect(relationsOf(tables)).toEqual([]);
  });
});

describe('wirePath', () => {
  it('joins facing edges when the referenced card is to the right', () => {
    const [x1, , , , , , x2] = numbers(wirePath([0, 0], 0, [300, 0], 0));
    expect(x1).toBe(NODE_WIDTH);
    expect(x2).toBe(300);
  });

  it('joins facing edges when the referenced card is to the left', () => {
    const [x1, , , , , , x2] = numbers(wirePath([300, 0], 0, [0, 0], 0));
    expect(x1).toBe(300);
    expect(x2).toBe(NODE_WIDTH);
  });

  it('bows out past the right edge between overlapping cards, or a card and itself', () => {
    const [x1, y1, c1, , , , x2, y2] = numbers(wirePath([0, 0], 1, [0, 0], 0));
    expect(x1).toBe(NODE_WIDTH);
    expect(x2).toBe(NODE_WIDTH);
    expect(c1).toBeGreaterThan(NODE_WIDTH);
    expect(y1).toBeGreaterThan(y2 ?? Infinity);
  });
});

describe('isPoint', () => {
  it('takes two finite numbers and nothing else', () => {
    expect(isPoint([1, 2])).toBe(true);
    for (const bad of [[1], [1, 2, 3], ['1', 2], [1, Number.NaN], { 0: 1, 1: 2 }, null]) {
      expect(isPoint(bad)).toBe(false);
    }
  });
});
