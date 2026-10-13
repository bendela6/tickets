import { describe, expect, it } from 'vitest';
import { branchProblem, gitUrlProblem } from './repository';

describe('gitUrlProblem', () => {
  it.each([
    'https://github.com/bendela6/tickets',
    'https://github.com/bendela6/tickets.git',
    'http://192.168.1.5:3000/owner/repo.git',
    'https://dev.azure.com/org/project/_git/repo',
    'https://user@bitbucket.org/owner/repo.git',
    'ssh://git@github.com/bendela6/tickets.git',
    'ssh://git@gateway:2222/srv/git/tickets.git',
    'git://example.org/repo.git',
    'git@github.com:bendela6/tickets.git',
    'git@gateway:repos/tickets.git',
    'github.com:bendela6/tickets',
    'git@host.example:/srv/git/repo.git',
  ])('keeps %s', (url) => {
    expect(gitUrlProblem(url)).toBeNull();
  });

  it.each([
    'hello',
    'github.com/bendela6/tickets',
    'ftp://example.org/repo.git',
    'mailto:me@example.org',
    'javascript:alert(1)',
    'todo:later',
    'https://github.com/owner/repo?tab=readme',
    'https://',
  ])('refuses %s as no git link, naming the shapes it takes', (url) => {
    expect(gitUrlProblem(url)).toMatch(/^Not a git link\. Use https:/);
  });

  it.each([
    'C:/Users/bbend/Desktop/Projects/tickets',
    'C:\\Users\\bbend\\tickets',
    '/srv/git/tickets.git',
    './tickets',
    '~/code/tickets',
    'file:///srv/git/tickets.git',
    '\\\\server\\share\\tickets',
  ])('refuses the local folder %s, saying the checkout lives on each machine', (url) => {
    expect(gitUrlProblem(url)).toMatch(/folder on one machine/);
  });

  it('refuses a link with a password or token in it, since everyone sees it', () => {
    expect(gitUrlProblem('https://me:ghp_secret@github.com/owner/repo.git')).toMatch(/password or token/);
  });

  it('refuses a host with no repository', () => {
    expect(gitUrlProblem('https://github.com')).toMatch(/Name the repository/);
    expect(gitUrlProblem('https://github.com/')).toMatch(/Name the repository/);
    expect(gitUrlProblem('git@github.com:/')).toMatch(/Name the repository/);
  });

  it('refuses spaces and an overlong link', () => {
    expect(gitUrlProblem('https://github.com/owner/my repo')).toMatch(/no spaces/);
    expect(gitUrlProblem(`https://github.com/${'a'.repeat(2050)}`)).toMatch(/longer than/);
  });
});

it('words no refusal with "; ", which describeIssues joins issues with', () => {
  const refusals = [
    gitUrlProblem('hello'), gitUrlProblem('C:/x'), gitUrlProblem('https://a:b@h.org/r'), gitUrlProblem('https://h.org'),
    gitUrlProblem('git@h.org:/'), gitUrlProblem('https://h.org/a b'), gitUrlProblem(`https://h.org/${'a'.repeat(2050)}`),
    ...['a b', 'a..b', 'a:b', '@', '-a', '/a', 'a.', '.a', 'a.lock', 'x'.repeat(300)].map(branchProblem),
  ];
  for (const message of refusals) {
    expect(message).toEqual(expect.any(String));
    expect(message).not.toContain('; ');
  }
});

describe('branchProblem', () => {
  it.each(['main', 'master', 'develop', 'release/2026.10', 'feature/tk-92_repo', 'v1.2.3'])('keeps %s', (name) => {
    expect(branchProblem(name)).toBeNull();
  });

  it.each([
    ['my branch', /no spaces/],
    ['a..b', /\.\./],
    ['feat:x', /none of/],
    ['what?', /none of/],
    ['-main', /start with -/],
    ['/main', /start or end with \//],
    ['main/', /start or end with \//],
    ['a//b', /start or end with \//],
    ['main.', /end with a dot/],
    ['.hidden', /starts with a dot/],
    ['x/main.lock', /\.lock/],
    ['@', /not @/],
    ['a@{1}', /@\{/],
  ])('refuses %s', (name, reason) => {
    expect(branchProblem(name)).toMatch(reason);
  });
});
