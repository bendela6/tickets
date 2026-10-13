/**
 * How a project's git link shows. An http(s) link is a page a browser opens
 * (GitHub, GitLab, Gitea all show the repository at its clone URL, less the
 * `.git`); anything else (ssh://…, git@host:path) is a link for git, not a
 * browser, so it is text to copy.
 */
export type RepositoryLink =
  | { kind: 'web'; href: string; label: string }
  | { kind: 'copy'; text: string };

export function repositoryLink(url: string): RepositoryLink {
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.replace(/\/+$/, '').replace(/\.git$/i, '');
      // `origin` drops any user name, which the page doesn't need.
      return { kind: 'web', href: `${parsed.origin}${path}`, label: `${parsed.host}${path}` };
    } catch {
      // Not a URL a browser takes after all: shown as text.
    }
  }
  return { kind: 'copy', text: url };
}
