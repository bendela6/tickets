import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { JsonViewer } from './json-viewer';
import { collapsedByDepth } from './utils/collapsed-by-depth';
import { errorPosition } from './utils/error-position';
import { jsonFault } from './utils/json-fault';
import { jsonRows } from './utils/json-rows';
import { parseJson } from './utils/parse-json';
import { rowsToText } from './utils/rows-to-text';
import { subtreePaths } from './utils/subtree-paths';
import { visibleRows } from './utils/visible-rows';

const SAMPLE = {
  id: 'run_41',
  ok: true,
  attempts: 3,
  error: null,
  output: { items: [1, 2], note: 'done' },
  tags: [],
};

/** The document as the viewer draws it, one string per line, folds applied. */
function drawn(container: HTMLElement): string[] {
  const body = within(container).getByRole('group');
  return Array.from(body.querySelectorAll(':scope > div > span.whitespace-pre')).map((line) => {
    return line.textContent ?? '';
  });
}

/** The class the viewer drew one run with, found by the exact text of the run. */
function runClass(container: HTMLElement, text: string): string {
  const run = Array.from(container.querySelectorAll('span.whitespace-pre > span')).find((span) => {
    return span.textContent === text;
  });
  return run?.className ?? '';
}

/**
 * A clipboard that records what was written to it. Installed after `userEvent.setup()`, which
 * stubs `navigator.clipboard` itself and would otherwise take the writes.
 */
function recordingClipboard(): string[] {
  const written: string[] = [];
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: (text: string) => {
        written.push(text);
        return Promise.resolve();
      },
    },
    configurable: true,
  });
  return written;
}

describe('jsonRows', () => {
  it('lays a document out as the lines a pretty printer would emit', () => {
    expect(rowsToText(jsonRows(SAMPLE))).toBe(JSON.stringify(SAMPLE, null, 2));
  });

  it('matches stringify on every shape of leaf and container', () => {
    const shapes: unknown[] = [
      //
      {},
      [],
      [[], {}],
      { a: { b: { c: [] } } },
      'bare string',
      42,
      -1.5e10,
      null,
      false,
      [{ x: 1 }, { x: 2 }],
      { 'key with "quotes"': 'and\nnewlines' },
    ];
    for (const shape of shapes) {
      expect(rowsToText(jsonRows(shape))).toBe(JSON.stringify(shape, null, 2));
    }
  });

  it('closes an empty container on the line it opened, with nothing to fold', () => {
    const rows = jsonRows({ tags: [] });
    expect(rows[1]?.container).toEqual({ type: 'array', size: 0, closeRow: 1 });
  });

  it('points each opening row at its own closing row', () => {
    const rows = jsonRows({ a: [1, 2], b: 3 });
    expect(rows[1]?.container?.closeRow).toBe(4);
    expect(rows[4]?.close).toBe(']');
    expect(rows[0]?.container?.closeRow).toBe(rows.length - 1);
  });

  it('serialises through toJSON, so a Date reads as its ISO string', () => {
    const at = new Date('2026-09-16T10:30:00.000Z');
    expect(rowsToText(jsonRows({ at }))).toBe(JSON.stringify({ at }, null, 2));
  });

  it('draws a cycle as a leaf instead of throwing the way stringify does', () => {
    const node: Record<string, unknown> = { name: 'root' };
    node.self = node;
    expect(() => JSON.stringify(node)).toThrow();
    expect(rowsToText(jsonRows(node))).toContain('"self": [Circular]');
  });

  it('treats a repeated reference as sharing rather than as a cycle', () => {
    const shared = { n: 1 };
    expect(rowsToText(jsonRows({ a: shared, b: shared }))).not.toContain('[Circular]');
  });

  it('draws the values JSON has no spelling for rather than dropping them', () => {
    const rows = jsonRows({ missing: undefined, broken: Number.NaN, fn: () => 1 });
    const text = rowsToText(rows);
    expect(text).toContain('"missing": undefined');
    expect(text).toContain('"broken": NaN');
    expect(text).toContain('"fn": function');
    expect(rows.filter((row) => row.value?.kind === 'invalid')).toHaveLength(3);
  });
});

describe('visibleRows', () => {
  it('hides a folded container, its members and its closing bracket', () => {
    const rows = jsonRows(SAMPLE);
    const output = rows.find((row) => row.key === 'output');
    const lines = visibleRows(rows, new Set([output?.path ?? '']));
    expect(lines.map(({ row }) => row.key)).toEqual([
      //
      null,
      'id',
      'ok',
      'attempts',
      'error',
      'output',
      'tags',
      null,
    ]);
  });

  it('numbers lines by the unfolded document, skipping across a fold', () => {
    const rows = jsonRows({ a: { b: 1, c: 2 }, d: 3 });
    expect(visibleRows(rows, new Set(['/a'])).map(({ line }) => line)).toEqual([1, 2, 6, 7]);
    expect(visibleRows(rows, new Set()).map(({ line }) => line)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('never folds an empty container, which has nothing to hide', () => {
    const rows = jsonRows({ tags: [] });
    // Deep enough to shut everything under the root that can shut. The empty array is not one.
    const collapsed = collapsedByDepth(rows, 1);
    expect([...collapsed]).toEqual([]);
    expect(visibleRows(rows, collapsed)).toHaveLength(rows.length);
  });
});

describe('collapsedByDepth', () => {
  it('shuts every container at the given depth or deeper', () => {
    const rows = jsonRows(SAMPLE);
    expect(collapsedByDepth(rows, Number.POSITIVE_INFINITY).size).toBe(0);
    expect([...collapsedByDepth(rows, 1)]).toEqual(['/output', '/output/items']);
    expect([...collapsedByDepth(rows, 2)]).toEqual(['/output/items']);
  });
});

describe('subtreePaths', () => {
  it('names every container inside one, itself included', () => {
    const rows = jsonRows({ a: { b: { c: 1 } }, d: { e: 2 } });
    expect(subtreePaths(rows, 0)).toEqual(['', '/a', '/a/b', '/d']);
    expect(subtreePaths(rows, 1)).toEqual(['/a', '/a/b']);
  });

  it('names nothing for a line that opens nothing', () => {
    expect(subtreePaths(jsonRows({ a: 1 }), 1)).toEqual([]);
  });
});

describe('jsonFault', () => {
  it('passes every document JSON.parse accepts', () => {
    const valid = [
      //
      '{}',
      '[]',
      '  null  ',
      '-1.5e-10',
      '"\\u00e9 \\" \\\\"',
      '{"a":[1,{"b":[true,false,null]}],"c":"d"}',
      '[\n  1,\n  2\n]',
    ];
    for (const text of valid) {
      expect(() => JSON.parse(text)).not.toThrow();
      expect(jsonFault(text)).toBeNull();
    }
  });

  it('points at the first character that cannot be where it is', () => {
    expect(jsonFault('{\n  "a": 1,\n  "b":,\n}')).toBe(18);
    expect(jsonFault('{"a":1,}')).toBe(7);
    expect(jsonFault("{'a':1}")).toBe(1);
    expect(jsonFault('[1 2]')).toBe(3);
    expect(jsonFault('{"a" 1}')).toBe(5);
  });

  it('points at the end of the text when the text runs out', () => {
    expect(jsonFault('[1,2,')).toBe(5);
    expect(jsonFault('{"a":')).toBe(5);
    expect(jsonFault('')).toBe(0);
    expect(jsonFault('"unterminated')).toBe(0);
  });

  it('faults on a second document after the first', () => {
    expect(jsonFault('{} []')).toBe(3);
  });
});

describe('parseJson', () => {
  it('hands back the value when the text is JSON', () => {
    expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('reports where the text stopped being JSON, on a message that names no position', () => {
    const result = parseJson('{\n  "a": 1,\n  "b":,\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.line).toBe(3);
      expect(result.column).toBe(7);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('keeps the position out of the message, which reports it separately', () => {
    const result = parseJson('{ nope');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toMatch(/at position/);
      expect(result.line).toBe(1);
    }
  });
});

describe('errorPosition', () => {
  it('reads the position V8 used to report on its own', () => {
    expect(errorPosition('Unexpected token } in JSON at position 8', '{\n  "a":\n}')).toEqual({
      line: 2,
      column: 7,
    });
  });

  it('prefers the line and column when the engine spells them out', () => {
    const message = "Expected property name or '}' in JSON at position 13 (line 2 column 3)";
    expect(errorPosition(message, '{\n  ,\n}')).toEqual({ line: 2, column: 3 });
  });

  it('scans the text itself when the engine named no position', () => {
    expect(errorPosition('Unexpected token x is not valid JSON', '{\n  x\n}')).toEqual({
      line: 2,
      column: 3,
    });
  });

  it('says nothing about text it cannot fault, rather than guessing', () => {
    expect(errorPosition('Something went wrong', '{"a":1}')).toBeNull();
  });
});

describe('JsonViewer', () => {
  it('draws the document pretty-printed, one row per line', () => {
    const { container } = render(<JsonViewer value={{ a: 1, b: [true] }} />);
    expect(drawn(container)).toEqual(['{', '  "a": 1,', '  "b": [', '    true', '  ]', '}']);
  });

  it('numbers the lines and counts them', () => {
    const { container } = render(<JsonViewer value={{ a: 1 }} />);
    const gutter = Array.from(container.querySelectorAll('.tabular-nums')).map((cell) => {
      return cell.textContent;
    });
    expect(gutter).toEqual(['1', '2', '3']);
    expect(screen.getByText('3 lines')).toBeTruthy();
  });

  it('leaves the gutter out when asked', () => {
    const { container } = render(<JsonViewer value={{ a: 1 }} lineNumbers={false} />);
    expect(container.querySelectorAll('.tabular-nums')).toHaveLength(0);
  });

  it('colours each run by what it is', () => {
    const { container } = render(<JsonViewer value={{ key: 'text', n: 1, t: true, z: null }} />);
    expect(runClass(container, '"key"')).toContain('text-blue-11');
    expect(runClass(container, '"text"')).toContain('text-green-11');
    expect(runClass(container, '1')).toContain('text-orange-11');
    expect(runClass(container, 'true')).toContain('text-purple-11');
    expect(runClass(container, 'null')).toContain('text-gray-9');
  });

  it('folds a container into its own line and opens it again', async () => {
    const user = userEvent.setup();
    const { container } = render(<JsonViewer value={{ output: { items: [1, 2] } }} />);

    await user.click(screen.getByRole('button', { name: 'Collapse output' }));
    expect(drawn(container)).toEqual(['{', '  "output": { 1 key }', '}']);

    await user.click(screen.getByRole('button', { name: 'Expand output' }));
    expect(drawn(container)).toContain('    "items": [');
  });

  it('counts items in an array and keys in an object', async () => {
    const user = userEvent.setup();
    const { container } = render(<JsonViewer value={{ one: [1], many: [1, 2, 3] }} />);

    await user.click(screen.getByRole('button', { name: 'Collapse one' }));
    await user.click(screen.getByRole('button', { name: 'Collapse many' }));
    expect(drawn(container)).toEqual(['{', '  "one": [ 1 item ],', '  "many": [ 3 items ]', '}']);
  });

  it('keeps the comma on whichever line ends the value', async () => {
    const user = userEvent.setup();
    const { container } = render(<JsonViewer value={{ a: { b: 1 }, c: 2 }} />);
    expect(drawn(container)).toContain('  },');

    await user.click(screen.getByRole('button', { name: 'Collapse a' }));
    expect(drawn(container)).toContain('  "a": { 1 key },');
  });

  it('folds a whole branch on alt-click, and opens the same branch again', async () => {
    const user = userEvent.setup();
    const { container } = render(<JsonViewer value={{ a: { b: { c: 1 } } }} />);

    await user.keyboard('{Alt>}');
    await user.click(screen.getByRole('button', { name: 'Collapse a' }));
    await user.keyboard('{/Alt}');
    expect(drawn(container)).toEqual(['{', '  "a": { 1 key }', '}']);

    await user.keyboard('{Alt>}');
    await user.click(screen.getByRole('button', { name: 'Expand a' }));
    await user.keyboard('{/Alt}');
    expect(drawn(container)).toContain('      "c": 1');
  });

  it('collapses and expands the whole document from the toolbar', async () => {
    const user = userEvent.setup();
    const { container } = render(<JsonViewer value={{ a: { b: 1 }, c: { d: 2 } }} />);

    await user.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(drawn(container)).toEqual(['{', '  "a": { 1 key },', '  "c": { 1 key }', '}']);

    await user.click(screen.getByRole('button', { name: 'Expand' }));
    expect(drawn(container)).toHaveLength(8);
  });

  it('opens only the given number of levels', () => {
    const { container } = render(
      <JsonViewer value={{ a: { b: { c: 1 } } }} defaultExpandedDepth={1} />,
    );
    expect(drawn(container)).toEqual(['{', '  "a": { 1 key }', '}']);
  });

  it('offers no fold control on an empty container', () => {
    render(<JsonViewer value={{ tags: [] }} />);
    expect(screen.queryByRole('button', { name: /tags/ })).toBeNull();
  });

  it('parses text it is handed, and draws it formatted', () => {
    const { container } = render(<JsonViewer source='{"a":[1,2]}' />);
    expect(drawn(container)).toEqual(['{', '  "a": [', '    1,', '    2', '  ]', '}']);
  });

  it('reports invalid text with its line and column, and shows the text as given', () => {
    const { container } = render(<JsonViewer source={'{\n  "a": 1,\n  "b":,\n}'} />);
    expect(screen.getByRole('alert').textContent).toMatch(/^Line 3, column 7: /);
    expect(drawn(container)).toEqual(['{', '  "a": 1,', '  "b":,', '}']);
    expect(container.querySelectorAll('.bg-red-3').length).toBeGreaterThan(0);
  });

  it('says nothing when the text is valid', () => {
    render(<JsonViewer source='{"a":1}' />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('copies the whole document unfolded, whatever is open', async () => {
    const user = userEvent.setup();
    const written = recordingClipboard();
    render(<JsonViewer value={SAMPLE} />);

    await user.click(screen.getByRole('button', { name: 'Collapse' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(written.at(-1)).toBe(JSON.stringify(SAMPLE, null, 2));
  });

  it('copies invalid text back exactly as it came in', async () => {
    const user = userEvent.setup();
    const written = recordingClipboard();
    render(<JsonViewer source="{ nope" />);

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(written.at(-1)).toBe('{ nope');
  });

  it('keeps folds through a re-render that rebuilds the value', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<JsonViewer value={{ a: { b: 1 } }} />);

    await user.click(screen.getByRole('button', { name: 'Collapse a' }));
    rerender(<JsonViewer value={{ a: { b: 1 } }} />);
    expect(drawn(container)).toEqual(['{', '  "a": { 1 key }', '}']);
  });

  it('opens a long document as an outline rather than in full', () => {
    const wide = Object.fromEntries(
      Array.from({ length: 300 }, (_, index) => [`k${index}`, { deep: index }]),
    );
    const { container } = render(<JsonViewer value={wide} />);
    expect(drawn(container)).toHaveLength(302);
    expect(drawn(container)[1]).toBe('  "k0": { 1 key },');
  });
});
