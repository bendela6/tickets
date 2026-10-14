import { describe, expect, it } from 'vitest';
import { fillText, textPaths } from './text';

// A ticket, its values shown as text: an option by its label, a list joined.
const SHOWN: Record<string, string> = {
  project: 'TIX',
  number: '12',
  title: 'Fix the login',
  status: 'In progress',
  labels: 'auth, web',
  assignee: '',
};

const show = (path: string) => SHOWN[path] ?? '';

describe('fillText', () => {
  it('shows each placeholder’s path as `show` gives it', () => {
    expect(fillText('{project}-{number} {title}', show)).toBe('TIX-12 Fix the login');
    expect(fillText('{status} · {labels}', show)).toBe('In progress · auth, web');
    expect(fillText('{title}', show)).toBe('Fix the login');
  });

  it('leaves text without braces as it is', () => {
    expect(fillText('Blocked', show)).toBe('Blocked');
    expect(fillText('', show)).toBe('');
  });

  it('trims the result and folds its runs of spaces, so an empty value leaves no gap', () => {
    expect(fillText('{assignee} {title}', show)).toBe('Fix the login');
    expect(fillText('{title} {assignee} ({number})', show)).toBe('Fix the login (12)');
    expect(fillText('  {assignee}  ', show)).toBe('');
  });

  it('reads {{ and }} as a brace', () => {
    expect(fillText('{{number}}', show)).toBe('{number}');
    expect(fillText('{{{number}}}', show)).toBe('{12}');
    expect(fillText('a }} b {{', show)).toBe('a } b {');
  });

  it('asks `show` for every path, once per placeholder, in order', () => {
    const asked: string[] = [];
    fillText('{status.kind} {title} {status.kind}', (path) => {
      asked.push(path);
      return path;
    });
    expect(asked).toEqual(['status.kind', 'title', 'status.kind']);
  });

  it('throws on braces that don’t pair, or name nothing, saying where', () => {
    expect(() => fillText('{title', show)).toThrow(/opens a brace at 0 that never closes/);
    expect(() => fillText('{a{b}}', show)).toThrow(/opens a brace at 0/);
    expect(() => fillText('title}', show)).toThrow(/closes a brace at 5 that none opened/);
    expect(() => fillText('{a}}', show)).toThrow(/closes a brace at 3/);
    expect(() => fillText('x {}', show)).toThrow(/names no field in its braces at 2/);
  });
});

describe('textPaths', () => {
  it('names each path once, in the order they first come', () => {
    expect(textPaths('{project}-{number} {title}')).toEqual(['project', 'number', 'title']);
    expect(textPaths('{title} ({status.kind}, {title})')).toEqual(['title', 'status.kind']);
  });

  it('names none in text without placeholders, braces included', () => {
    expect(textPaths('Blocked')).toEqual([]);
    expect(textPaths('{{title}}')).toEqual([]);
  });

  it('throws on a malformed one, as fillText does', () => {
    expect(() => textPaths('{title')).toThrow(/never closes/);
  });
});
