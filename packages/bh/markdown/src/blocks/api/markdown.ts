import { fenced } from '../../page';
import type { ApiData, Route } from './schema';

// An api block as plain markdown, for a page's markdown copy: the resource in
// bold, then each route as a line naming its method, path and summary, its
// detail under it (the description as written, parameters and responses as
// tables, response bodies and the example call as fences).

/** A table cell's text: one line, its pipes escaped. */
const cell = (text: string | undefined) => {
  return (text ?? '').replace(/\s*\n\s*/g, ' ').replaceAll('|', '\\|');
};

/** A GFM table, an empty cell written `| |`. */
function table(head: string[], rows: string[][]): string {
  const line = (row: string[]) => `|${row.map((text) => (text ? ` ${text} ` : ' ')).join('|')}|`;
  const rule = `|${head.map(() => '---').join('|')}|`;
  return [line(head), rule, ...rows.map(line)].join('\n');
}

function routeMarkdown(route: Route): string[] {
  const line = `**\`${route.method} ${route.path}\`**`;
  const parts = [route.summary ? `${line} — ${cell(route.summary)}` : line];

  if (route.description) {
    parts.push(route.description.trim());
  }
  if (route.params?.length) {
    const rows = route.params.map((param) => {
      return [
        `\`${cell(param.name)}\``,
        param.in,
        `\`${cell(param.type)}\``,
        param.required ? 'yes' : 'no',
        cell(param.description),
      ];
    });
    parts.push('Parameters:', table(['Name', 'In', 'Type', 'Required', 'Description'], rows));
  }
  if (route.responses?.length) {
    const rows = route.responses.map((response) => {
      return [String(response.status), cell(response.description)];
    });
    parts.push('Responses:', table(['Status', 'Description'], rows));
    for (const response of route.responses) {
      if (response.example) {
        parts.push(`Example ${response.status} body:`, fenced('json', response.example));
      }
    }
  }
  if (route.transcript) {
    parts.push('Example call:', fenced('', route.transcript));
  }
  return parts;
}

/** The block as markdown: paragraphs, tables and fences, never YAML. */
export function apiMarkdown(data: ApiData): string {
  const parts = data.resource ? [`**${data.resource}**`] : [];
  for (const route of data.routes) {
    parts.push(...routeMarkdown(route));
  }
  return parts.join('\n\n');
}
