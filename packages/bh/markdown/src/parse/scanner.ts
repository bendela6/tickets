import type { Segment } from '../registry/types';
import { parseAttrs } from './attrs';

// Ticks, a language when another word follows it, the name, attributes:
// ```erd, ```erd{zoom=2}, ```yaml callout{x=1}.
const FENCE_OPEN =
  /^(`{3,})\s*(?:([A-Za-z][\w-]*)\s+(?=[A-Za-z]))?([A-Za-z][\w-]*)?\s*(\{[^}]*\})?\s*$/;
const DIRECTIVE_OPEN = /^(:{3,})\s*([A-Za-z][\w-]*)\s*(\{[^}]*\})?\s*$/;

/**
 * Splits a source into markdown runs and blocks. A fence is a block only when
 * its language is a registered name; any other fence stays markdown, with
 * whatever it contains. A directive is always a block, so an unregistered
 * name reaches the renderer's fallback rather than vanishing.
 *
 * A fence may name its language before the block, as GitHub and editors read
 * it: ```yaml callout is a `callout` block, highlighted there as YAML. The
 * language becomes the block's `lang` attribute, unless its `{…}` sets one.
 *
 * It knows nothing of markdown's containers: a fence or directive indented in
 * a list item or quoted in a blockquote stays markdown. Validation warns about
 * the directive case.
 */
export function scanBlocks(source: string, names: ReadonlySet<string>): Segment[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const segments: Segment[] = [];
  let buffer: string[] = [];
  let bufferLine = 1;

  const flush = (endLine: number) => {
    if (buffer.length === 0) {
      return;
    }
    segments.push({ kind: 'markdown', text: buffer.join('\n'), line: bufferLine });
    buffer = [];
    bufferLine = endLine;
  };

  // The lines from `from` up to the first one `close` matches, and that line's index.
  const bodyUntil = (from: number, close: RegExp): [string[], number] => {
    const body: string[] = [];
    let at = from;
    while (at < lines.length && !close.test(lines[at] ?? '')) {
      body.push(lines[at] ?? '');
      at += 1;
    }
    return [body, at];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      const [, ticks = '```', lang, name, attrs] = fence;
      const [body, end] = bodyUntil(i + 1, new RegExp(`^\`{${ticks.length},}\\s*$`));
      if (name && names.has(name)) {
        flush(i + 1);
        segments.push({
          kind: 'block',
          syntax: 'fence',
          name,
          attrs: lang ? { lang, ...parseAttrs(attrs ?? '') } : parseAttrs(attrs ?? ''),
          body: body.join('\n'),
          line: i + 1,
        });
        bufferLine = end + 2;
      } else {
        // An unregistered fence is markdown, closing line included.
        buffer.push(line, ...body);
        if (end < lines.length) {
          buffer.push(lines[end] ?? '');
        }
      }
      i = end;
      continue;
    }

    const directive = DIRECTIVE_OPEN.exec(line);
    if (directive) {
      const [, colons = ':::', name = '', attrs] = directive;
      flush(i + 1);
      const [body, end] = bodyUntil(i + 1, new RegExp(`^:{${colons.length},}\\s*$`));
      segments.push({
        kind: 'block',
        syntax: 'directive',
        name,
        attrs: parseAttrs(attrs ?? ''),
        body: body.join('\n'),
        line: i + 1,
      });
      i = end;
      bufferLine = end + 2;
      continue;
    }

    buffer.push(line);
  }
  flush(lines.length + 1);
  return segments;
}
