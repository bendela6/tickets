import { describe, expect, it } from 'vitest';
import { isAddress, isRoute, linkTarget } from './link';
import { textPaths } from './text';

const ticket = { id: 12, project: 'TIX', number: 12, title: 'Fix the login', status: 'active' };

describe('linkTarget', () => {
  it('fills a route from the record’s values', () => {
    expect(linkTarget('/p/{project}/t/{number}', ticket)).toBe('/p/TIX/t/12');
    expect(linkTarget('/items/{id}?status={status}', ticket)).toBe('/items/12?status=active');
    expect(linkTarget('https://tracker.example/{project}/{number}', ticket)).toBe(
      'https://tracker.example/TIX/12',
    );
  });

  it('encodes each value, so a space or a slash keeps to its place', () => {
    expect(linkTarget('/search/{title}', ticket)).toBe('/search/Fix%20the%20login');
    expect(linkTarget('/files/{path}', { path: '../etc/passwd' })).toBe('/files/..%2Fetc%2Fpasswd');
    expect(linkTarget('/{host}', { host: '/evil.example' })).toBe('/%2Fevil.example');
  });

  it('reads an object entry’s key a level down, as a repeat over a json list gives it', () => {
    const entry = { stack: 'media', services: { name: 'web', state: 'running' } };
    expect(linkTarget('/stacks/{stack}/services/{services.name}', entry)).toBe(
      '/stacks/media/services/web',
    );
  });

  it('links nowhere when a placeholder’s value is empty, or no single value', () => {
    expect(linkTarget('/u/{assignee}', { assignee: null })).toBeUndefined();
    expect(linkTarget('/u/{assignee}', {})).toBeUndefined();
    expect(linkTarget('/u/{assignee}', { assignee: '' })).toBeUndefined();
    expect(linkTarget('/l/{labels}', { labels: ['a', 'b'] })).toBeUndefined();
    expect(linkTarget('/s/{settings}', { settings: { a: 1 } })).toBeUndefined();
  });

  it('links nowhere for a route that is malformed, or fills no address', () => {
    expect(linkTarget('/p/{project', ticket)).toBeUndefined();
    expect(linkTarget('//elsewhere.example/{id}', ticket)).toBeUndefined();
    expect(linkTarget('p/{project}', ticket)).toBeUndefined();
    expect(linkTarget('{url}', { url: 'https://example.com' })).toBeUndefined();
    expect(linkTarget('javascript:alert({id})', ticket)).toBeUndefined();
  });
});

describe('isAddress', () => {
  it('takes a path from the root, or an address with its scheme', () => {
    expect(isAddress('/p/TIX')).toBe(true);
    expect(isAddress('https://example.com/a')).toBe(true);
    expect(isAddress('mailto:ada@example.com')).toBe(true);
  });

  it('refuses another host by the page’s scheme, a relative path, and schemes that run code', () => {
    expect(isAddress('//example.com')).toBe(false);
    expect(isAddress('p/TIX')).toBe(false);
    expect(isAddress('')).toBe(false);
    expect(isAddress('javascript:alert(1)')).toBe(false);
    expect(isAddress('JavaScript:alert(1)')).toBe(false);
    expect(isAddress(' javascript:alert(1)')).toBe(false);
    expect(isAddress('java\tscript:alert(1)')).toBe(false);
    expect(isAddress('data:text/html,<p>')).toBe(false);
    expect(isAddress('vbscript:x')).toBe(false);
  });
});

describe('a route', () => {
  it('has its braces in pairs, and starts as an address does', () => {
    expect(isRoute('/p/{project}/t/{number}')).toBe(true);
    expect(isRoute('https://tracker.example/{id}')).toBe(true);
    expect(isRoute('/p/{project')).toBe(false);
    expect(isRoute('{url}')).toBe(false);
    expect(isRoute('//elsewhere/{id}')).toBe(false);
  });

  it('names its fields, for a check of them against the resource', () => {
    expect(textPaths('/p/{project}/t/{number}')).toEqual(['project', 'number']);
  });
});
