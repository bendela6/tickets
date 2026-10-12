import { describe, expect, it } from 'vitest';
import { repositoryLink } from './repository-link';

describe('repositoryLink', () => {
  it('opens a GitHub link on GitHub, without its .git', () => {
    expect(repositoryLink('https://github.com/bendela6/tickets.git')).toEqual({
      kind: 'web',
      href: 'https://github.com/bendela6/tickets',
      label: 'github.com/bendela6/tickets',
    });
  });

  it('opens any http(s) link, keeping its port and dropping a user name', () => {
    expect(repositoryLink('http://me@gateway:3000/owner/repo/')).toEqual({
      kind: 'web',
      href: 'http://gateway:3000/owner/repo',
      label: 'gateway:3000/owner/repo',
    });
  });

  it.each(['git@github.com:bendela6/tickets.git', 'ssh://git@github.com/bendela6/tickets.git', 'git://example.org/repo.git'])(
    'shows %s as text to copy',
    (url) => {
      expect(repositoryLink(url)).toEqual({ kind: 'copy', text: url });
    },
  );
});
