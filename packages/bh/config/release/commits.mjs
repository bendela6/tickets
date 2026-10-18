// A commit message read as a release reads it: type, scope, headline, bullets,
// breaking change. Also what each change bumps, and the check a commit-msg hook runs.

/** The conventional types. */
export const TYPES = [
  'feat',
  'fix',
  'perf',
  'build',
  'chore',
  'docs',
  'refactor',
  'test',
  'style',
  'ci',
  'revert',
];

const HEADER = /^(\w+)(?:\(([^)]*)\))?(!)?: (.+)$/;
const BREAKING = /^BREAKING[ -]CHANGE: ?/;
const BULLET = /^[-*] +(.+)$/;
/** A ticket id: `TK-79`, `BH-20.1`. Standards like `UTF-8` and `ISO-8601` are not. */
const TICKET =
  /\b(?!(?:UTF|ISO|SHA|ES|RFC|CVE|ECMA|HTTP|TLS|IPV|IEEE)-)[A-Z]{2,6}-\d{1,5}(?:\.\d+)*\b/;
/** Headers git writes itself. */
const GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/;

/**
 * @typedef {object} Message
 * @property {string | null} type `feat`; null when the header is not conventional.
 * @property {string | null} scope The header's scope, as written.
 * @property {boolean} breaking A `!` before the colon, or a `BREAKING CHANGE:` footer.
 * @property {string} headline The header after the colon; the whole header when not conventional.
 * @property {string[]} bullets The body's `- ` lines, each joined with its indented continuation.
 * @property {string | null} change The `BREAKING CHANGE:` text, as one line.
 * @property {boolean} generated A header git writes: a merge, a revert, a fixup.
 */

/** Reads a commit message. @returns {Message} */
export function parseMessage(message) {
  const lines = message.replace(/\r/g, '').split('\n');
  const header = (lines[0] ?? '').trim();
  const match = HEADER.exec(header);
  const body = lines.slice(1);
  const bullets = [];
  let change = null;
  for (let i = 0; i < body.length; i += 1) {
    const line = body[i];
    if (BREAKING.test(line)) {
      const text = [line.replace(BREAKING, '')];
      while (i + 1 < body.length && body[i + 1].trim() !== '') {
        i += 1;
        text.push(body[i].trim());
      }
      change = text.join(' ').trim();
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      bullets.push(bullet[1].trim());
    } else if (
      bullets.length > 0 &&
      /^\s+\S/.test(line) &&
      BULLET.exec(body[i - 1] ?? '') !== null
    ) {
      bullets[bullets.length - 1] += ` ${line.trim()}`;
    }
  }
  return {
    type: match ? match[1].toLowerCase() : null,
    scope: match?.[2] ?? null,
    breaking: match?.[3] === '!' || change !== null,
    headline: match ? match[4].trim() : header,
    bullets,
    change,
    generated: GENERATED.test(header),
  };
}

/** The change a commit makes: `breaking`, `feature`, `fix`, or null for none of its own. */
export function changeOf(message) {
  if (message.breaking) {
    return 'breaking';
  }
  if (message.type === 'feat') {
    return 'feature';
  }
  if (['fix', 'perf', 'build'].includes(message.type ?? '')) {
    return 'fix';
  }
  if (message.type === 'chore' && message.scope === 'deps') {
    return 'fix';
  }
  return null;
}

const RANK = { fix: 1, feature: 2, breaking: 3 };

/** The largest of the changes; null when none counts. */
export function largest(changes) {
  let top = null;
  for (const change of changes) {
    if (change && (top === null || RANK[change] > RANK[top])) {
      top = change;
    }
  }
  return top;
}

/** `1.4.0` as [1, 4, 0]; null for anything else. */
export function parseVersion(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text ?? '');
  return match ? match.slice(1, 4).map(Number) : null;
}

/** Orders versions, highest first. */
export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
}

/**
 * The version after `version` for `change`. Below 1.0.0 a breaking change is a
 * minor version and anything else a patch; from 1.0.0 breaking is major, a feature minor.
 */
export function nextVersion(version, change) {
  const [major, minor, patch] = parseVersion(version);
  if (change === 'breaking') {
    return major === 0 ? `0.${minor + 1}.0` : `${major + 1}.0.0`;
  }
  if (change === 'feature' && major > 0) {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * What a commit-msg hook says of a message: errors refuse it, warnings only print.
 * `scopes` are the folders' scopes of the staged files, when known.
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkMessage(message, scopes = null) {
  const text = message
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .trim();
  const errors = [];
  const warnings = [];
  const header = text.split('\n')[0] ?? '';
  if (GENERATED.test(header)) {
    return { errors, warnings };
  }
  const parsed = parseMessage(text);
  if (parsed.type === null || !TYPES.includes(parsed.type)) {
    errors.push(
      `The header reads "type(scope): what it does", e.g. "fix(web): keep the board's scroll on reload". Types: ${TYPES.join(', ')}.`,
    );
  }
  const ticket = TICKET.exec(text);
  if (ticket) {
    errors.push(`Leave out ticket ids (${ticket[0]}): say what the change does.`);
  }
  if (parsed.type !== null && /^(the|a|an|this|some|new) /i.test(parsed.headline)) {
    warnings.push(
      `Start the headline with a verb: "add …", "fix …", not "${parsed.headline.split(' ')[0]} …".`,
    );
  }
  if (header.length > 100) {
    warnings.push(`The header is ${header.length} characters; keep it under 100.`);
  }
  if (
    scopes &&
    scopes.length > 0 &&
    parsed.scope !== null &&
    !['deps', 'release'].includes(parsed.scope)
  ) {
    const written = parsed.scope
      .split(',')
      .map((s) => s.trim())
      .sort();
    const touched = [...scopes].sort();
    if (written.join(',') !== touched.join(',')) {
      warnings.push(
        `The scope says (${written.join(',')}); the staged folders are (${touched.join(',')}). Changelogs use the folders.`,
      );
    }
  }
  return { errors, warnings };
}
