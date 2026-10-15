import { describe, expect, it } from 'vitest';
import type { LogLevel, LogSectionRule } from '../types';
import {
  buildLogTree,
  sectionReader,
  sectionSpan,
  sectionState,
  sectionsOf,
  shownLines,
  type LogNode,
} from './sections';

/** Lines as the tree reads them: a line ending in `!` is an error line. */
function read(texts: readonly string[]): { text: string; level?: LogLevel }[] {
  return texts.map((text) => (text.endsWith('!') ? { text, level: 'error' } : { text }));
}

// Steps at the top start with `==>`, the steps inside them with `#`.
const RULES: readonly LogSectionRule[] = [
  { match: /^==> /, level: 0 },
  { match: /^#\d+ /, level: 1 },
];

/** The tree as text: each section's first line with what it holds, an entry as its line range. */
function outline(nodes: readonly LogNode[], texts: readonly string[]): unknown[] {
  return nodes.map((node) => {
    if (node.kind === 'line') {
      return texts[node.index];
    }
    if (node.kind === 'entry') {
      return `entry ${node.start}-${node.end - 1}`;
    }
    return { [texts[node.head] ?? '']: outline(node.children, texts) };
  });
}

const tree = (texts: readonly string[], entries = true) => {
  return buildLogTree(read(texts), sectionReader(RULES), entries);
};

describe('buildLogTree', () => {
  it('is the lines alone with no sections', () => {
    const texts = ['one', 'two'];
    expect(outline(buildLogTree(read(texts), undefined, true), texts)).toEqual(['one', 'two']);
  });

  it('runs a section to the next at its level, and nests a deeper one inside it', () => {
    const texts = [
      'before',
      '==> build',
      'building',
      '#1 load',
      'loaded',
      '#2 copy',
      '==> start',
      'started',
    ];
    expect(outline(tree(texts), texts)).toEqual([
      'before',
      { '==> build': ['building', { '#1 load': ['loaded'] }, { '#2 copy': [] }] },
      { '==> start': ['started'] },
    ]);
  });

  it('nests to any depth, and a shallower level closes every deeper one', () => {
    const levels = (text: string) => {
      const depth = /^(>+) /.exec(text)?.[1]?.length;
      return depth === undefined ? undefined : { level: depth };
    };
    const texts = ['> a', '>> b', '>>> c', 'deep', '>> d', '> e'];
    expect(outline(buildLogTree(read(texts), levels, true), texts)).toEqual([
      { '> a': [{ '>> b': [{ '>>> c': ['deep'] }] }, { '>> d': [] }] },
      { '> e': [] },
    ]);
  });

  it('starts a section at the top when the level above it never came', () => {
    const texts = ['#1 alone', 'line', '==> top'];
    expect(outline(tree(texts), texts)).toEqual([{ '#1 alone': ['line'] }, { '==> top': [] }]);
  });

  it('groups multi-line entries within a section’s own lines', () => {
    const texts = [
      '==> run',
      'error: boom!',
      '    at a (x.js:1:1)',
      '    at b (x.js:2:1)',
      'after',
    ];
    expect(outline(tree(texts), texts)).toEqual([{ '==> run': ['entry 1-3', 'after'] }]);
    expect(outline(tree(texts, false), texts)).toEqual([{ '==> run': texts.slice(1) }]);
  });

  it('marks a section failed when it holds an error line, and the sections around it too', () => {
    const texts = ['==> build', '#1 ok', 'fine', '#2 bad', 'broke!', '==> next', 'fine'];
    const failed = sectionsOf(tree(texts)).map(({ section }) => {
      return [texts[section.head], section.failed];
    });
    expect(failed).toEqual([
      ['==> build', true],
      ['#1 ok', false],
      ['#2 bad', true],
      ['==> next', false],
    ]);
  });

  it('says each section’s parent', () => {
    const texts = ['==> build', '#1 ok', '==> next'];
    const parents = sectionsOf(tree(texts)).map(({ section, parent }) => {
      return [texts[section.head], parent === undefined ? null : texts[parent.head]];
    });
    expect(parents).toEqual([
      ['==> build', null],
      ['#1 ok', '==> build'],
      ['==> next', null],
    ]);
  });
});

describe('sectionReader', () => {
  it('takes the first rule that matches, a string anywhere in the line', () => {
    const at = sectionReader([
      { match: 'STEP', level: 2 },
      { match: /STEP/, level: 5 },
    ]);
    expect(at?.('a STEP here', 0)).toMatchObject({ level: 2 });
    expect(at?.('nothing', 0)).toBeUndefined();
  });

  it('matches a global pattern on every line, not every other', () => {
    const at = sectionReader([{ match: /^#/g }]);
    expect([at?.('#1', 0), at?.('#2', 1), at?.('#3', 2)].every(Boolean)).toBe(true);
  });

  it('passes a function through, and is nothing without rules', () => {
    const of = () => ({ level: 1 });
    expect(sectionReader(of)).toBe(of);
    expect(sectionReader([])).toBeUndefined();
    expect(sectionReader(undefined)).toBeUndefined();
  });
});

describe('shownLines', () => {
  it('shows a folded section’s first line only', () => {
    const texts = ['==> a', 'one', '#1 x', 'two', '==> b'];
    const nodes = tree(texts);
    expect(shownLines(nodes, () => true)).toEqual([0, 1, 2, 3, 4]);
    expect(shownLines(nodes, () => false)).toEqual([0, 4]);
  });
});

describe('a section’s state and span', () => {
  const texts = ['==> a', 'one', '==> b', 'two'];
  const [a, b] = sectionsOf(tree(texts)).map(({ section }) => section);

  it('runs while the log streams and it holds the last line, and is done otherwise', () => {
    expect(a && sectionState(a, texts.length, true)).toBe('done');
    expect(b && sectionState(b, texts.length, true)).toBe('running');
    expect(b && sectionState(b, texts.length, false)).toBe('done');
  });

  it('is failed once it holds an error line, running or not', () => {
    const failing = ['==> a', 'boom!'];
    const [section] = sectionsOf(tree(failing)).map((found) => found.section);
    expect(section && sectionState(section, failing.length, true)).toBe('failed');
  });

  it('spans from its first line’s time to the next line’s, or its own last line’s at the end', () => {
    const lines = [0, 1000, 4000, 4500].map((time, index) => ({ text: texts[index] ?? '', time }));
    expect(a && sectionSpan(a, lines, false)).toEqual({ from: 0, to: 4000 });
    expect(b && sectionSpan(b, lines, false)).toEqual({ from: 4000, to: 4500 });
    // Still running: its end is not known yet.
    expect(b && sectionSpan(b, lines, true)).toEqual({ from: 4000 });
    expect(
      a &&
        sectionSpan(
          a,
          texts.map((text) => ({ text })),
          false,
        ),
    ).toEqual({});
  });
});
