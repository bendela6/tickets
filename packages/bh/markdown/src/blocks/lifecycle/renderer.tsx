import type { Renderer } from '../../registry';
import { lifecycleExamples } from './examples';
import { Lifecycle } from './lifecycle';
import { lifecycleSchema, type LifecycleData } from './schema';

const code = (name: string) => `\`${name}\``;
/** A name in a table cell, where a bare `|` would end the cell. */
const cell = (name: string) => code(name).replaceAll('|', '\\|');

/** `a`; `a` or `b`; `a`, `b` or `c`. */
function either(names: readonly string[], word: 'or' | 'and'): string {
  const coded = names.map(code);
  const last = coded.pop() ?? '';
  return coded.length > 0 ? `${coded.join(', ')} ${word} ${last}` : last;
}

/**
 * A lifecycle as plain markdown: the title in bold, where it starts and ends,
 * then every transition as a table row, then the notes as they are. A state
 * no event enters or leaves is named, so the copy drops nothing the diagram
 * shows.
 */
function lifecycleMarkdown({ title, initial, final = [], states, notes }: LifecycleData): string {
  const parts: string[] = [];
  if (title) {
    parts.push(`**${title}**`);
  }
  const ends = final.length > 0 ? ` Ends at ${either(final, 'or')}.` : '';
  parts.push(`Starts at ${code(initial)}.${ends}`);

  const rows: string[] = [];
  const joined = new Set<string>();
  for (const [from, events] of Object.entries(states)) {
    for (const [event, to] of Object.entries(events)) {
      rows.push(`| ${cell(from)} | ${cell(event)} | ${cell(to)} |`);
      joined.add(from).add(to);
    }
  }
  if (rows.length === 0) {
    parts.push('No event leads anywhere.');
  } else {
    parts.push(['| From | Event | To |', '|---|---|---|', ...rows].join('\n'));
    const alone = Object.keys(states).filter((name) => !joined.has(name));
    if (alone.length > 0) {
      parts.push(`No event enters or leaves ${either(alone, 'and')}.`);
    }
  }

  if (notes) {
    parts.push(notes.trimEnd());
  }
  return parts.join('\n\n');
}

export const lifecycleBlock: Renderer<LifecycleData> = {
  name: 'lifecycle',
  group: 'Diagrams',
  body: 'data',
  description:
    'A state machine, drawn as states joined by their events. `states` maps each state to a map of ' +
    'its events, each naming the state it leads to: `running: { finish: done }`; a state with no ' +
    'events is `{}`. Every target must be a declared state. `initial` names the starting state; ' +
    '`final` lists the terminal ones; `title` names the diagram; `notes` is markdown under it.',
  schema: lifecycleSchema,
  toMarkdown: (node) => lifecycleMarkdown(node.data as LifecycleData),
  examples: lifecycleExamples,
  component: ({ data }) => <Lifecycle data={data} />,
};
