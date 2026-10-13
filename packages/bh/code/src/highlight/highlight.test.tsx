import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { highlightLines, isBlankLine } from '.';

const drawn = (lines: ReactNode[][]) => {
  const { container } = render(
    <pre>
      {lines.map((line, index) => {
        return <div key={index}>{line}</div>;
      })}
    </pre>,
  );
  return container;
};

describe('highlightLines', () => {
  it('keeps the source text intact, one array per line', () => {
    const lines = highlightLines("const a = 'x';\nreturn a;", 'ts');
    expect(lines).toHaveLength(2);
    expect(drawn(lines).textContent).toBe("const a = 'x';return a;");
  });

  it('paints a keyword and a string with different classes', () => {
    const spans = [...drawn(highlightLines("const a = 'x';", 'ts')).querySelectorAll('span')];
    const keyword = spans.find((span) => span.textContent === 'const');
    const string = spans.find((span) => span.textContent === "'x'");
    expect(keyword?.className).toBe('text-indigo-11');
    expect(string?.className).toBe('text-green-11');
  });

  it.each([
    ['ts', 'const n: number = 1;'],
    ['tsx', 'const a = <Button tone="danger" />;'],
    ['js', 'export const f = () => 1;'],
    ['json', '{ "a": 1 }'],
    ['yaml', 'type: warning'],
    ['css', '.a { color: red; }'],
    ['sh', 'echo "$HOME" # where'],
    ['shell', 'if true; then exit 0; fi'],
    ['bash', 'set -eu'],
    ['dockerfile', 'FROM node:22\nRUN pnpm install'],
  ])('colours %s', (lang, sample) => {
    expect(drawn(highlightLines(sample, lang)).querySelectorAll('span').length).toBeGreaterThan(0);
  });

  it("colours a Dockerfile's instructions as keywords, as the editor does", () => {
    const spans = [...drawn(highlightLines('FROM node:22', 'dockerfile')).querySelectorAll('span')];
    expect(spans.find((span) => span.textContent === 'FROM')?.className).toBe('text-indigo-11');
  });

  it('returns plain lines for a language it does not know, and for none', () => {
    expect(highlightLines('a\nb', 'cobol')).toEqual([['a'], ['b']]);
    expect(highlightLines('a\nb')).toEqual([['a'], ['b']]);
  });

  it('does not resolve an inherited Object property as a language', () => {
    expect(highlightLines('x', 'constructor')).toEqual([['x']]);
  });

  it('recognises a blank line from a grammar and from plain text', () => {
    expect(isBlankLine([])).toBe(true);
    expect(isBlankLine([''])).toBe(true);
    expect(isBlankLine(['x'])).toBe(false);
  });
});
