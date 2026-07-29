/**
 * Pulls the authored text of each `defineState` render body out of a demo
 * file's own source.
 *
 * The Source tab under a DERIVED axis is generated — a cell is a set of
 * control values, so `generateSnippet` prints it. An authored section has no
 * values, only a closure, and `Function.prototype.toString` gives back the
 * COMPILED output (`_jsx(Grid, { children: … })`), not the TSX anyone wrote.
 * The demo file's raw text is already loaded eagerly for the Demo tab, so the
 * honest source is right there — it just has to be found.
 */

const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

/** Index of the quote-closing character after `src[i]`, which opens the string. */
function skipQuoted(src: string, i: number): number {
  const quote = src[i]!;
  let j = i + 1;
  while (j < src.length) {
    const c = src[j]!;
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === quote) return j + 1;
    j += 1;
  }
  return j;
}

function skipTemplate(src: string, i: number): number {
  let j = i + 1;
  while (j < src.length) {
    const c = src[j]!;
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === '`') return j + 1;
    // An interpolation is code again, and can hold anything — including
    // another template. Hand it back to the matcher rather than scanning for
    // a `}` that might be inside a nested string.
    if (c === '$' && src[j + 1] === '{') {
      const close = findMatching(src, j + 1);
      if (close === -1) return src.length;
      j = close + 1;
      continue;
    }
    j += 1;
  }
  return j;
}

/**
 * Index of the delimiter closing the one at `open`, or -1 if it never closes.
 * Skips over strings, templates and comments so a `)` inside `'a)b'` or
 * `// )` never ends the scan early.
 */
export function findMatching(src: string, open: number): number {
  const close = OPENERS[src[open]!];
  if (!close) return -1;
  const stack: string[] = [close];
  let i = open + 1;
  while (i < src.length) {
    const c = src[i]!;
    const two = src.slice(i, i + 2);
    if (two === '//') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      i = skipQuoted(src, i);
      continue;
    }
    if (c === '`') {
      i = skipTemplate(src, i);
      continue;
    }
    if (OPENERS[c]) {
      stack.push(OPENERS[c]!);
      i += 1;
      continue;
    }
    if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
      i += 1;
      continue;
    }
    i += 1;
  }
  return -1;
}

/**
 * The text of `key`'s value in an object literal's interior, or null. Depth is
 * tracked so a nested `render:` inside a child object never shadows the real
 * one, and the value runs to the next top-level comma or the end.
 */
function propertyValue(interior: string, key: string): string | null {
  const pattern = new RegExp(`(^|[\\s,{])${key}\\s*:`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(interior))) {
    const colon = interior.indexOf(':', match.index + match[1]!.length);
    // Only a match at the top level of this object is the property we mean.
    if (depthAt(interior, match.index + match[1]!.length) !== 0) continue;
    let i = colon + 1;
    while (i < interior.length) {
      const c = interior[i]!;
      const two = interior.slice(i, i + 2);
      if (two === '//') {
        const nl = interior.indexOf('\n', i);
        i = nl === -1 ? interior.length : nl;
        continue;
      }
      if (two === '/*') {
        const end = interior.indexOf('*/', i + 2);
        i = end === -1 ? interior.length : end + 2;
        continue;
      }
      if (c === "'" || c === '"') {
        i = skipQuoted(interior, i);
        continue;
      }
      if (c === '`') {
        i = skipTemplate(interior, i);
        continue;
      }
      if (OPENERS[c]) {
        const close = findMatching(interior, i);
        if (close === -1) return interior.slice(colon + 1).trim();
        i = close + 1;
        continue;
      }
      if (c === ',') return interior.slice(colon + 1, i).trim();
      i += 1;
    }
    return interior.slice(colon + 1).trim();
  }
  return null;
}

/** Nesting depth of `index` within `interior`, ignoring strings and comments. */
function depthAt(interior: string, index: number): number {
  let depth = 0;
  let i = 0;
  while (i < index && i < interior.length) {
    const c = interior[i]!;
    const two = interior.slice(i, i + 2);
    if (two === '//') {
      const nl = interior.indexOf('\n', i);
      i = nl === -1 ? interior.length : nl;
      continue;
    }
    if (two === '/*') {
      const end = interior.indexOf('*/', i + 2);
      i = end === -1 ? interior.length : end + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      i = skipQuoted(interior, i);
      continue;
    }
    if (c === '`') {
      i = skipTemplate(interior, i);
      continue;
    }
    if (OPENERS[c]) depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    i += 1;
  }
  return depth;
}

/** Strips the shared left margin so a nested block reads as its own file. */
function dedent(text: string): string {
  const lines = text.split('\n');
  const indents = lines
    .slice(1)
    .filter((line) => line.trim() !== '')
    .map((line) => line.length - line.trimStart().length);
  const margin = indents.length > 0 ? Math.min(...indents) : 0;
  return [lines[0], ...lines.slice(1).map((line) => line.slice(margin))].join('\n').trim();
}

/**
 * `() => (<Wrap>…</Wrap>)` is a thunk because a demo state must not render at
 * module scope; the arrow and its wrapping parens are ceremony, not content,
 * so the Source tab shows what is inside them.
 */
function unwrapThunk(text: string): string {
  const body = text.replace(/^\(\s*\)\s*=>\s*/, '').trim();
  if (body.startsWith('(') && findMatching(body, 0) === body.length - 1) {
    return dedent(body.slice(1, -1).replace(/^\n/, ''));
  }
  return dedent(body);
}

/**
 * Every `defineState` call in a demo file, as `{ [title]: renderSource }`.
 * A section whose title or render cannot be read is simply absent — the tab
 * hides itself rather than showing a half-parsed block.
 */
export function extractStateSources(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const calls = /defineState\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = calls.exec(source))) {
    const open = match.index + match[0].length - 1;
    const close = findMatching(source, open);
    if (close === -1) break;
    calls.lastIndex = close;
    const arg = source.slice(open + 1, close).trim();
    if (!arg.startsWith('{')) continue;
    const objectEnd = findMatching(arg, 0);
    if (objectEnd === -1) continue;
    const interior = arg.slice(1, objectEnd);
    const title = propertyValue(interior, 'title');
    const render = propertyValue(interior, 'render');
    if (!title || !render) continue;
    const name = title.match(/^['"](.*)['"]$/)?.[1];
    if (name === undefined) continue;
    out[name] = unwrapThunk(render);
  }
  return out;
}
