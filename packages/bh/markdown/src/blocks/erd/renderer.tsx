import type { RenderContext, Renderer } from '../../registry';
import { Erd } from './erd';
import { erdExamples } from './examples';
import { isPoint } from './layout';
import {
  erdSchema,
  readErd,
  type ErdColumn,
  type ErdLayout,
  type ErdModel,
  type Point,
} from './schema';

// A host keeps a reader's arrangement through `ctx`, by the diagram's title:
// `ctx.erdLayout` holds what it kept, `{ [title]: { [table]: [x, y] } }`, and
// `ctx.onErdLayoutChange(title, layout)` hears every move, and `{}` on a
// reset. An untitled diagram has no key, so nothing of it is kept.

/** What the host kept for this diagram: its points only, whatever else it holds. */
function keptLayout(ctx: RenderContext, key: string): ErdLayout {
  const store = ctx.erdLayout;
  // Object.hasOwn: a diagram titled `constructor` must not read the store's prototype.
  if (typeof store !== 'object' || store === null || !Object.hasOwn(store, key)) {
    return {};
  }
  const kept: unknown = (store as Record<string, unknown>)[key];
  if (typeof kept !== 'object' || kept === null) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(kept).filter((entry): entry is [string, Point] => isPoint(entry[1])),
  );
}

function keepLayout(ctx: RenderContext, key: string, layout: ErdLayout): void {
  const sink = ctx.onErdLayoutChange;
  if (typeof sink === 'function') {
    (sink as (key: string, layout: ErdLayout) => void)(key, layout);
  }
}

/** Code, in a span longer than any run of backticks inside it. */
const code = (text: string): string => (text.includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``);

/** A table cell: a pipe would end it. */
const cell = (text: string): string => text.replaceAll('|', '\\|');

/** What a column is to its table: PK, unique, and what it references. */
function keyCell(column: ErdColumn): string {
  const keys: string[] = [];
  if (column.pk) {
    keys.push('PK');
  }
  if (column.unique) {
    keys.push('unique');
  }
  if (column.ref !== undefined) {
    keys.push(`→ ${code(column.ref)}`);
  }
  return keys.join(', ');
}

/**
 * A diagram as plain markdown: its title in bold, then each table as a table
 * of its columns, whose Key says PK, unique, or which column it references.
 */
function erdMarkdown({ title, tables }: ErdModel): string {
  const parts: string[] = title ? [`**${title}**`] : [];
  for (const [name, table] of Object.entries(tables)) {
    const rows = Object.entries(table.columns).map(([column, def]) => {
      return `| ${cell(code(column))} | ${cell(def.type)} | ${cell(keyCell(def))} |`;
    });
    parts.push(
      `Table ${code(name)}:`,
      rows.length > 0
        ? ['| Column | Type | Key |', '|---|---|---|', ...rows].join('\n')
        : 'No columns.',
    );
  }
  return parts.join('\n\n');
}

export const erdBlock: Renderer<ErdModel> = {
  name: 'erd',
  group: 'Diagrams',
  body: 'data',
  description:
    'An entity relationship diagram. Each key under `tables` is a table name; each key under its ' +
    '`columns` is a column with a `type` and optional `pk`, `unique` and `ref` fields. A `ref` of ' +
    '`table.column` draws a relation. Tables are placed for you, each right of what it references, ' +
    'and the reader drags them; a `title` names the diagram and is what keeps their arrangement.',
  schema: erdSchema,
  toMarkdown: (node) => erdMarkdown(readErd(node.data)),
  examples: erdExamples,
  component: ({ data, ctx }) => {
    const model = readErd(data);
    const key = model.title;
    return (
      <Erd
        model={model}
        layout={key ? keptLayout(ctx, key) : undefined}
        onLayoutChange={key ? (next) => keepLayout(ctx, key, next) : undefined}
      />
    );
  },
};
