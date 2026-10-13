import * as v from 'valibot';

// A project's repository: the git link everyone clones and the branch work
// lands on. tickets keeps the link only. Where each developer has it checked
// out is theirs, in a file on their machine, so a local folder is refused here.
//
// Each check answers with what is wrong, in words for the settings field the
// value was typed into, or null when the value is fine.

const MAX_URL_LENGTH = 2048;
const MAX_BRANCH_LENGTH = 255;

const SHAPES = 'Use https://host/owner/repo, ssh://host/owner/repo or git@host:owner/repo.';
const NOT_A_GIT_LINK = `Not a git link. ${SHAPES}`;
const LOCAL_FOLDER =
  // No "; " in any message: describeIssues joins issues with it.
  "That's a folder on one machine. Give the git link everyone clones. Each developer's own checkout is set on their machine.";

const SCHEMES = new Set(['https:', 'http:', 'ssh:', 'git:']);

// `/srv/git/x`, `./x`, `~/x`, `C:\x`, `C:/x`, `\\server\x`, `file:///x`.
const LOCAL_PATH = /^(?:\/|\.{1,2}(?:\/|\\|$)|~|[A-Za-z]:(?:[\\/]|$)|\\\\|file:)/i;

// git's scp-like form, `[user@]host:path`. git reads it only when no slash
// comes before the first colon, which the character classes here enforce.
// The path is a repository path's characters only, so `javascript:alert(1)`
// is no git link.
const SCP_LIKE = /^(?:([^@\s/:\\]+)@)?([A-Za-z0-9._-]+):([A-Za-z0-9._~/%+-]+)$/;

/** Why `url` isn't a git link tickets can keep, or null when it is. */
export function gitUrlProblem(url: string): string | null {
  if (url.length > MAX_URL_LENGTH) return `The link is longer than ${MAX_URL_LENGTH} characters.`;
  if (/\s/.test(url)) return `A git link has no spaces. ${SHAPES}`;
  if (LOCAL_PATH.test(url)) return LOCAL_FOLDER;

  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(url)) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NOT_A_GIT_LINK;
    }
    if (!SCHEMES.has(parsed.protocol)) return NOT_A_GIT_LINK;
    if (parsed.hostname === '') return NOT_A_GIT_LINK;
    // Everyone on the project sees the link, so a secret in it would be shared.
    if (parsed.password !== '') return 'Leave the password or token out of the link: everyone on the project sees it.';
    if (parsed.search !== '' || parsed.hash !== '') return NOT_A_GIT_LINK;
    if (parsed.pathname.replace(/^\/+|\/+$/g, '') === '') {
      return `Name the repository, not just the host: ${parsed.protocol}//${parsed.host}/owner/repo.`;
    }
    return null;
  }

  const scp = SCP_LIKE.exec(url);
  if (scp) {
    const [, user, host, path] = scp;
    // One letter before the colon is a Windows drive (`C:repo`), as git reads it.
    if (host!.length === 1) return LOCAL_FOLDER;
    // `word:word` with neither a user nor a dotted host is a word with a colon
    // in it (`todo:later`), not a server.
    if (user === undefined && !host!.includes('.') && host !== 'localhost') return NOT_A_GIT_LINK;
    if (path!.replace(/^\/+|\/+$/g, '') === '') return `Name the repository after the colon: git@${host}:owner/repo.`;
    return null;
  }

  return NOT_A_GIT_LINK;
}

/** Why `name` isn't a branch name git accepts, or null when it is (git's check-ref-format rules). */
export function branchProblem(name: string): string | null {
  if (name.length > MAX_BRANCH_LENGTH) return `A branch name is at most ${MAX_BRANCH_LENGTH} characters.`;
  if (/[\s\x00-\x1f\x7f]/.test(name)) return 'A branch name has no spaces.';
  if (/[~^:?*[\\]/.test(name)) return 'A branch name has none of ~ ^ : ? * [ \\';
  if (name === '@' || name.includes('@{')) return 'A branch name is not @ and has no @{ in it.';
  if (name.startsWith('-')) return 'A branch name does not start with -';
  if (name.includes('..')) return 'A branch name has no .. in it.';
  if (name.startsWith('/') || name.endsWith('/') || name.includes('//')) {
    return 'A branch name does not start or end with /, nor have // in it.';
  }
  if (name.endsWith('.')) return 'A branch name does not end with a dot.';
  for (const part of name.split('/')) {
    if (part.startsWith('.')) return 'No part of a branch name starts with a dot.';
    if (part.endsWith('.lock')) return 'No part of a branch name ends with .lock';
  }
  return null;
}

// Both take a trimmed string, '' for "clear it", or null for the same.
export const repositoryUrlInput = v.nullable(
  v.pipe(
    v.string(),
    v.trim(),
    v.check(
      (url) => url === '' || gitUrlProblem(url) === null,
      (issue) => gitUrlProblem(String(issue.input).trim()) ?? NOT_A_GIT_LINK,
    ),
  ),
);

export const defaultBranchInput = v.nullable(
  v.pipe(
    v.string(),
    v.trim(),
    v.check(
      (name) => name === '' || branchProblem(name) === null,
      (issue) => branchProblem(String(issue.input).trim()) ?? 'Not a branch name.',
    ),
  ),
);
