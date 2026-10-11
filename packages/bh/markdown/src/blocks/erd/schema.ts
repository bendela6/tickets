import * as v from 'valibot';

// Each field's description is what an editor's form and page.schema.json show
// beside it. The shape is docs-renderer's: an ERD says what the tables are and
// nothing about where they sit, so a table takes no position and the diagram
// no zoom (strict objects reject both).

export const erdColumnSchema = v.object({
  type: v.pipe(
    v.string(),
    v.description('Its type, as the database names it: uuid, text, int, timestamptz.'),
  ),
  pk: v.optional(v.pipe(v.boolean(), v.description('Part of the primary key.'))),
  unique: v.optional(v.pipe(v.boolean(), v.description('No two rows hold the same value.'))),
  ref: v.optional(
    v.pipe(
      v.string(),
      v.description('The column it references, as `table.column`. Draws the relation.'),
    ),
  ),
});

export const erdTableSchema = v.pipe(
  v.strictObject({
    columns: v.pipe(
      v.record(v.string(), erdColumnSchema),
      v.description('Each key is a column name, drawn in the order written.'),
    ),
  }),
  v.description('A table: its columns.'),
);

/** An entity relationship diagram: its tables and the columns that reference other tables. */
export const erdSchema = v.strictObject({
  title: v.optional(
    v.pipe(
      v.string(),
      v.description(
        'Names the diagram, and is what a host keeps the reader’s arrangement under. Untitled, it resets on reload.',
      ),
    ),
  ),
  tables: v.pipe(
    v.record(v.string(), erdTableSchema),
    v.description('Each key is a table name. Tables are placed for you; the reader drags them.'),
  ),
});

export type ErdModel = v.InferOutput<typeof erdSchema>;
export type ErdTables = ErdModel['tables'];
export type ErdTable = v.InferOutput<typeof erdTableSchema>;
export type ErdColumn = v.InferOutput<typeof erdColumnSchema>;

/** A table's top-left corner on the canvas, unscaled: `[x, y]`. */
export type Point = [number, number];

/** Where each table sits, by name: what a host keeps, and what a drag reports. */
export type ErdLayout = Record<string, Point>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

function columnOf(def: Record<string, unknown>, type: string): ErdColumn {
  const column: ErdColumn = { type };
  if (def.pk === true) {
    column.pk = true;
  }
  if (def.unique === true) {
    column.unique = true;
  }
  if (typeof def.ref === 'string') {
    column.ref = def.ref;
  }
  return column;
}

/**
 * A diagram as the block draws it, from its data as written.
 *
 * A block is handed its data as written, not the schema's output, and
 * valibot's `record` passes over a key named `__proto__`, `prototype` or
 * `constructor` without reading its value. So a table or column by one of
 * those names arrives unchecked: a well-formed one is kept like any other, and
 * one that is not is left out rather than thrown on. `Object.fromEntries`
 * defines every name as an own key, `__proto__` included.
 */
export function readErd(data: unknown): ErdModel {
  const body = isRecord(data) ? data : {};
  const tables = isRecord(body.tables) ? body.tables : {};
  const read = Object.entries(tables).flatMap(([name, table]): [string, ErdTable][] => {
    if (!isRecord(table) || !isRecord(table.columns)) {
      return [];
    }
    const columns = Object.entries(table.columns).flatMap(
      ([column, def]): [string, ErdColumn][] => {
        return isRecord(def) && typeof def.type === 'string'
          ? [[column, columnOf(def, def.type)]]
          : [];
      },
    );
    return [[name, { columns: Object.fromEntries(columns) }]];
  });
  const model: ErdModel = { tables: Object.fromEntries(read) };
  if (typeof body.title === 'string') {
    model.title = body.title;
  }
  return model;
}
