// Bring a stale branch onto main's 2026-08-04 vocabulary.
//
// Run as:  node migrate-branch.mjs <worktree-root> spacing|renames
//
// TWO PHASES, AND THE ORDER IS NOT A STYLE CHOICE
// ------------------------------------------------
// `spacing` MUST run BEFORE `git merge main`, `renames` AFTER. The reason is
// that the x4 is only correct on a tree where EVERY file speaks the same
// vocabulary. A branch that predates the change is uniformly pre-migration, so
// x4 applies cleanly. The moment main is merged the tree is a MIXTURE — main's
// files already scaled, the branch's not, hand-resolved files part each — and
// no blanket pass can tell the halves apart. Scaling then double-scales main's
// half to 16x, which compiles and renders silently wrong.
//
// The renames have no such hazard: `TONE_SCALE` does not exist on main, so
// rewriting it is a no-op wherever main won. That makes renames idempotent and
// safe to run at any point, which is why they go last.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const [, , ROOT, PHASE] = process.argv;
if (!ROOT || !['spacing', 'renames'].includes(PHASE)) {
  console.error('usage: migrate-branch.mjs <worktree-root> spacing|renames');
  process.exit(2);
}

// Roots are DERIVED, never listed from memory: on main, assuming them is
// exactly how apps/board and icon-studio were missed and shipped quarter-sized.
// Anything that imports the stylesheet inherits --spacing and must be swept.
const CANDIDATES = [
  'apps/web/src',
  'apps/board/src',
  'packages/web/ui/src',
  'packages/web/ui/styles',
  'packages/web/playground/src',
  'packages/web/icon-studio',
  'packages/web/table/src',
  'apps/icon/src',
  'apps/eer/src',
];
const ROOTS = CANDIDATES.map((r) => path.join(ROOT, r)).filter((p) => existsSync(p));

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.vite', '.turbo', 'coverage'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css)$/.test(e.name)) out.push(p);
  }
  return out;
};

const files = ROOTS.flatMap((r) => walk(r));
const changes = [];
const declined = [];
let touched = 0;

// ---------------------------------------------------------------- spacing x4
const PREFIXES = [
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me',
  'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
  'w', 'h', 'size', 'min-w', 'min-h', 'max-w', 'max-h', 'basis',
  'inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end',
  'translate', 'translate-x', 'translate-y', 'indent',
  'scroll-m', 'scroll-mx', 'scroll-my', 'scroll-mt', 'scroll-mr', 'scroll-mb', 'scroll-ml',
  'scroll-p', 'scroll-px', 'scroll-py', 'scroll-pt', 'scroll-pr', 'scroll-pb', 'scroll-pl',
  'leading',
];
const ALT = [...PREFIXES].sort((a, b) => b.length - a.length).join('|');
const SPACING = new RegExp(
  `(^|[\\s"'\`{:(\\[])(-?)(${ALT})-(\\d+(?:\\.\\d+)?)(?=[\\s"'\`}):,;\\]]|$)`,
  'g',
);
// In .css a utility class only ever appears inside @apply; the rest is real CSS
// where `top-4` is not a class and `margin: 4px` must not be touched.
const APPLY = /@apply ([^;]+);/g;

const scale = (text, file) =>
  text.replace(SPACING, (m, lead, sign, prefix, value) => {
    const n = Number(value);
    // The old leading ladder was already px over 8..96; only values outside it
    // fell through to the spacing scale and therefore need scaling.
    if (prefix === 'leading' && n >= 8 && n <= 96) {
      declined.push(`${file}: ${prefix}-${value} (on the old px ladder)`);
      return m;
    }
    const scaled = n * 4;
    if (!Number.isInteger(scaled)) throw new Error(`${file}: ${prefix}-${value} x4 is not an integer`);
    changes.push(`${sign}${prefix}-${value} -> ${sign}${prefix}-${scaled}`);
    return `${lead}${sign}${prefix}-${scaled}`;
  });

// ------------------------------------------------------------------- renames
const RENAMES = [
  [/\bTONE_SCALE\b/g, 'TONE_HUE'],
  [/\bTONE_RAMP\b/g, 'TONE_HUE'],
  [/\bHUE_TONES\b/g, 'HUES'],
  [/\bROLE_TONES\b/g, 'ROLES'],
  [/\bHueTone\b/g, 'Hue'],
  [/\bRoleTone\b/g, 'Role'],
  [/\bshadow-raised\b/g, 'shadow-xs'],
  [/\bshadow-overlay\b/g, 'shadow-md'],
  [/\bshadow-modal\b/g, 'shadow-lg'],
  [/\banimate-ai-spin\b/g, 'animate-spin'],
  [/\banimate-ai-pulse\b/g, 'animate-pulse'],
  [/\bbg-folder\b/g, 'bg-yellow-8'],
  [/\bborder-folder\b/g, 'border-yellow-8'],
  [/\btext-folder\b/g, 'text-yellow-8'],
];
// `runtimeStyle({...})` is gone; the CSSProperties augmentation means the object
// literal stands on its own. Only the simple single-object call is rewritten —
// anything nested is reported instead of guessed at.
const RUNTIME_CALL = /runtimeStyle\((\{[^{}]*\})\)/g;

const rename = (text, file) => {
  let out = text;
  for (const [re, to] of RENAMES) {
    out = out.replace(re, (m) => {
      changes.push(`${m} -> ${to}`);
      return to;
    });
  }
  out = out.replace(RUNTIME_CALL, (_m, obj) => {
    changes.push('runtimeStyle({...}) -> {...}');
    return obj;
  });
  if (/\bruntimeStyle\b/.test(out)) {
    // Drop it from the import list now that no call site remains.
    if (!/runtimeStyle\(/.test(out)) {
      out = out
        .replace(/,\s*runtimeStyle(?=[,\s}])/g, '')
        .replace(/\bruntimeStyle\s*,\s*/g, '');
      changes.push('drop runtimeStyle import');
    } else {
      declined.push(`${file}: runtimeStyle( call too complex to rewrite`);
    }
  }
  // RAMPS was not merely renamed — PALETTE is re-keyed by theme, so a blind
  // swap would produce code that typechecks against the wrong shape.
  if (/\bRAMPS\b/.test(out)) declined.push(`${file}: RAMPS -> PALETTE needs a hand (re-keyed by theme)`);
  return out;
};

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  let next;
  if (PHASE === 'spacing') {
    next = file.endsWith('.css')
      ? src.replace(APPLY, (_f, classes) => `@apply ${scale(classes, rel)};`)
      : scale(src, rel);
  } else {
    next = rename(src, rel);
  }
  if (next !== src) {
    writeFileSync(file, next, 'utf8');
    touched++;
  }
}

// Self-check: every recorded spacing rewrite must be exactly x4.
if (PHASE === 'spacing') {
  for (const c of changes) {
    const [from, to] = c.split(' -> ');
    const a = Number(from.replace(/^-?[a-z-]+-/, ''));
    const b = Number(to.replace(/^-?[a-z-]+-/, ''));
    if (a * 4 !== b) throw new Error(`bad rewrite: ${c}`);
  }
}

console.log(`[${PHASE}] roots: ${ROOTS.map((r) => path.relative(ROOT, r).split(path.sep).join('/')).join(', ')}`);
console.log(`[${PHASE}] ${changes.length} rewrites across ${touched} files (${files.length} scanned)`);
const by = new Map();
for (const c of changes) by.set(c, (by.get(c) ?? 0) + 1);
[...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  .forEach(([k, n]) => console.log(`   ${String(n).padStart(4)}  ${k}`));
if (declined.length) {
  console.log(`[${PHASE}] declined (review these):`);
  [...new Set(declined)].slice(0, 20).forEach((d) => console.log(`   ${d}`));
}
