import type { ErdLayout, ErdTable, ErdTables, Point } from './schema';

// The canvas's geometry, in unscaled pixels. A card draws at exactly these
// sizes (its width and its rows' heights are set from them), so a wire can
// find a column's row by arithmetic. Three columns of cards fit a page's 800px
// measure: 24 + 2 × 256 + 208 + 24.

export const NODE_WIDTH = 208;
/** A card's name strip, its bottom rule included. */
export const HEAD_HEIGHT = 32;
/** One column's row, its bottom rule included. */
export const ROW_HEIGHT = 28;
/** A card's own border, around the strip and the rows. */
const BORDER = 1;
/** From one depth's cards to the next: a card and the gap a wire crosses. */
export const COLUMN_WIDTH = NODE_WIDTH + 48;
/** Between cards stacked at the same depth. */
export const ROW_GAP = 24;
/** The first card's corner, and the margin kept past the last. */
export const ORIGIN = 24;
/** How far a wire between overlapping cards bows out past their right edge. */
const LOOP = 32;
/** Beyond this many columns the diagram is wider than any page; deeper tables share the last. */
const MAX_DEPTH = 5;

/** The table a ref names: everything before its first dot. */
const targetOf = (ref: string): string => ref.split('.')[0] ?? '';

function depths(tables: ErdTables): Map<string, number> {
  const depth = new Map(Object.keys(tables).map((name) => [name, 0]));
  for (let pass = 0; pass < depth.size + MAX_DEPTH; pass++) {
    let moved = false;
    for (const [name, table] of Object.entries(tables)) {
      for (const column of Object.values(table.columns)) {
        const target = column.ref === undefined ? undefined : targetOf(column.ref);
        // A Map, not an object: a ref to `toString` must not find Object.prototype's.
        const parent = target === undefined || target === name ? undefined : depth.get(target);
        if (parent === undefined) {
          continue;
        }
        const next = Math.min(MAX_DEPTH, parent + 1);
        if ((depth.get(name) ?? 0) < next) {
          depth.set(name, next);
          moved = true;
        }
      }
    }
    if (!moved) {
      break;
    }
  }
  return depth;
}

/**
 * Depth = the longest chain of refs pointing at a table, so a table always sits
 * right of what it references. Iterated to a fixed point rather than recursed,
 * which also ends a reference cycle: depths only rise and are capped, so
 * `names + MAX_DEPTH` passes always reach the fixed point.
 */
export function depthOf(tables: ErdTables): Record<string, number> {
  return Object.fromEntries(depths(tables));
}

/** The height a card draws at: its border, its strip, and a row per column. */
export const nodeHeight = (columns: number): number => {
  return 2 * BORDER + HEAD_HEIGHT + columns * ROW_HEIGHT;
};

function autoLayout(tables: ErdTables): Map<string, Point> {
  const depth = depths(tables);
  const nextY = new Map<number, number>();
  const out = new Map<string, Point>();
  for (const [name, table] of Object.entries(tables)) {
    const d = depth.get(name) ?? 0;
    const y = nextY.get(d) ?? ORIGIN;
    out.set(name, [ORIGIN + d * COLUMN_WIDTH, y]);
    nextY.set(d, y + nodeHeight(Object.keys(table.columns).length) + ROW_GAP);
  }
  return out;
}

/** Every table's position: a column per depth, stacked within the column by height. */
export function layoutTables(tables: ErdTables): ErdLayout {
  return Object.fromEntries(autoLayout(tables));
}

export interface Placed {
  name: string;
  table: ErdTable;
  at: Point;
}

/**
 * Each table where the first of `layouts` that has it says, or where it is
 * laid out. Resolved fresh from the tables, so one renamed or added since a
 * layout was kept still gets a place.
 */
export function placeTables(tables: ErdTables, ...layouts: ErdLayout[]): Placed[] {
  const auto = autoLayout(tables);
  return Object.entries(tables).map(([name, table]) => {
    // Object.hasOwn on every layout: a table named `toString` must not resolve through the prototype.
    const kept = layouts.find((layout) => Object.hasOwn(layout, name))?.[name];
    return { name, table, at: kept ?? auto.get(name) ?? [ORIGIN, ORIGIN] };
  });
}

/** The canvas the placed cards need: out to the furthest edge, and a margin past it. */
export function extentOf(placed: readonly Placed[]): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const { table, at } of placed) {
    width = Math.max(width, at[0] + NODE_WIDTH);
    height = Math.max(height, at[1] + nodeHeight(Object.keys(table.columns).length));
  }
  return { width: width + ORIGIN, height: height + ORIGIN };
}

/** A position a host handed back: two finite numbers. */
export function isPoint(value: unknown): value is Point {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** One `ref` that names a table in the diagram: the wire it draws. */
export interface Relation {
  /** The referencing table, and its column. */
  from: string;
  column: string;
  fromRow: number;
  /** The referenced table, and the ref as written. */
  to: string;
  ref: string;
  /** The referenced column's row; its first when the ref names none it has. */
  toRow: number;
}

export function relationsOf(tables: ErdTables): Relation[] {
  return Object.entries(tables).flatMap(([from, table]) => {
    return Object.entries(table.columns).flatMap(([column, def], fromRow): Relation[] => {
      if (def.ref === undefined) {
        return [];
      }
      const [to = '', toColumn = ''] = def.ref.split('.');
      // Object.hasOwn: an undeclared target named after a prototype member
      // (`constructor`, `toString`, …) must not resolve through the prototype chain.
      const target = Object.hasOwn(tables, to) ? tables[to] : undefined;
      if (!target) {
        return [];
      }
      const toRow = Object.keys(target.columns).indexOf(toColumn);
      return [{ from, column, fromRow, to, ref: def.ref, toRow: Math.max(0, toRow) }];
    });
  });
}

/** The middle of a column's row, down from a card's corner. */
const rowY = (at: Point, row: number): number => {
  return at[1] + BORDER + HEAD_HEIGHT + row * ROW_HEIGHT + ROW_HEIGHT / 2;
};

/**
 * A cubic from the referencing column's row to the referenced column's row,
 * leaving and arriving horizontally. Cards side by side are joined edge to
 * facing edge; cards that overlap across (stacked at one depth, or a table
 * that references itself) are joined right edge to right edge, bowing out.
 */
export function wirePath(from: Point, fromRow: number, to: Point, toRow: number): string {
  const y1 = rowY(from, fromRow);
  const y2 = rowY(to, toRow);
  if (to[0] >= from[0] + NODE_WIDTH || to[0] + NODE_WIDTH <= from[0]) {
    const rightward = to[0] > from[0];
    const x1 = rightward ? from[0] + NODE_WIDTH : from[0];
    const x2 = rightward ? to[0] : to[0] + NODE_WIDTH;
    const pull = Math.max(30, Math.abs(x2 - x1) / 2) * (rightward ? 1 : -1);
    return `M${x1} ${y1} C${x1 + pull} ${y1} ${x2 - pull} ${y2} ${x2} ${y2}`;
  }
  const x1 = from[0] + NODE_WIDTH;
  const x2 = to[0] + NODE_WIDTH;
  const out = Math.max(x1, x2) + LOOP;
  return `M${x1} ${y1} C${out} ${y1} ${out} ${y2} ${x2} ${y2}`;
}
