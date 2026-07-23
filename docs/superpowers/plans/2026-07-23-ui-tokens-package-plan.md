# @tickets/ui Phase 1 — Tokens Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `@tickets/ui` workspace package holding the design-token pipeline (JSON → generated CSS → lint gates) and shared styling infrastructure (`cn`, `variants`, `runtime-style`, `swatches`), consumed by apps/web and (cn/runtime-style only) apps/eer, with zero visual changes.

**Architecture:** Move, don't rewrite: the existing token JSON + generator + lint scripts relocate into `packages/web/ui` with path updates; web repoints one CSS import and ~85 `cn` imports; eer repoints ~40 `cn` + 11 `runtime-style` imports. New inert tokens are hand-authored in the static `@theme` region (the generator only owns color/shadow marker regions). The hardcoded-value scanner grows a second root (apps/eer) guarded by a committed ratchet baseline.

**Tech stack:** pnpm workspace, TypeScript, Tailwind v4 (`@theme inline`), vitest, zero-dependency Node .mjs scripts.

**Spec:** `docs/superpowers/specs/2026-07-23-ui-tokens-package-design.md`

## Global constraints

- Conventional commits: `feat(ui): …` / `refactor(web): …` / `refactor(eer): …`; one commit per task (Task 8 is six commits, one per token group).
- Repo must be green after every commit: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm build` (plus `--filter @tickets/eer test` once Task 6 touches eer).
- No visual changes: `tokens.css` differs from the old `instrument.css` only by added inert vars.
- Do not edit generated marker regions by hand (`/* tokens:light|dark|theme — generated */`).
- eer's scripts run `verify:tailwind` before test/typecheck — leave `apps/eer/scripts/verify-tailwind.mjs` alone.
- Naming deviations from the spec (approved rationale — Tailwind v4 default collisions): radius tokens are `chip/tile/overlay` (not `xs/sm/xl` — v4 ships `--radius-xs/sm` defaults; overriding would restyle stock `rounded-sm` usage); tracking tokens are `label/caps/mono-label` (not `wide/wider/widest` — same collision).

---

### Task 1: Scaffold `@tickets/ui` + shared `cn` with union font-size groups

**Files:**
- Create: `packages/web/ui/package.json`, `packages/web/ui/tsconfig.json`, `packages/web/ui/vitest.config.ts`
- Create: `packages/web/ui/src/cn.ts`
- Test: `packages/web/ui/src/cn.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: package `@tickets/ui` with export `./cn` → `export function cn(...inputs: ClassValue[]): string`. Registered custom font-size classes: `text-ui, text-meta, text-label, text-3xs, text-2xs`.

- [ ] **Step 1: Create package scaffold**

`packages/web/ui/package.json`:
```json
{
  "name": "@tickets/ui",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    "./cn": "./src/cn.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.6.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "typescript": "^6.0.3",
    "vitest": "^4.1.10"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

`packages/web/ui/tsconfig.json` (same depth as `packages/web/form`, so same extends path):
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "types": ["vitest/globals"],
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

`packages/web/ui/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 2: Write the failing test**

`packages/web/ui/src/cn.test.ts`:
```ts
import { cn } from './cn';

describe('cn', () => {
  it('merges conflicting tailwind classes, last wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('keeps a color class next to every custom font-size token (twMerge trap)', () => {
    // Without registration, tailwind-merge buckets unknown text-* into the
    // text-COLOR group and drops the color. One assertion per custom size:
    for (const size of ['text-ui', 'text-meta', 'text-label', 'text-3xs', 'text-2xs']) {
      expect(cn('text-on-accent', size)).toBe(`text-on-accent ${size}`);
    }
  });

  it('still merges two font sizes to the last one', () => {
    expect(cn('text-ui', 'text-meta')).toBe('text-meta');
    expect(cn('text-3xs', 'text-label')).toBe('text-label');
  });

  it('passes through conditional values like clsx', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});
```

- [ ] **Step 3: Install and verify the test fails**

Run: `pnpm install && pnpm --filter @tickets/ui test`
Expected: FAIL — `Cannot find module './cn'` (or equivalent resolve error).

- [ ] **Step 4: Implement `cn` (union of web's `ui,meta,label` and eer's `3xs,2xs`)**

`packages/web/ui/src/cn.ts`:
```ts
import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Both apps define custom font-size tokens (web: text-ui/meta/label; eer:
// text-3xs/2xs). tailwind-merge doesn't know they're font sizes, so by
// default it buckets them into the text-COLOR group and silently drops the
// adjacent color utility — e.g. `text-on-accent text-ui` collapses to just
// `text-ui`. Register the UNION of both apps' sizes so one shared cn serves
// every consumer.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['ui', 'meta', 'label', '3xs', '2xs'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @tickets/ui test`
Expected: PASS (4 tests). Also run `pnpm --filter @tickets/ui typecheck` — clean.

- [ ] **Step 6: Commit**

```bash
git add packages/web/ui
git commit -m "feat(ui): scaffold @tickets/ui package with union cn helper"
```

---

### Task 2: Move `variants` (from web) and `runtime-style` (from eer) into the package

**Files:**
- Create (moved): `packages/web/ui/src/variants.ts`, `packages/web/ui/src/variants.test.ts` (verbatim from `apps/web/src/ui/variants.ts` / `variants.test.ts` — do NOT delete the web originals yet; Task 5 does)
- Create (moved): `packages/web/ui/src/runtime-style.ts` (verbatim from `apps/eer/src/ui/runtime-style.ts` — eer original deleted in Task 6)
- Test: `packages/web/ui/src/runtime-style.test.ts` (new — the eer original had none)
- Modify: `packages/web/ui/package.json` (add exports)

**Interfaces:**
- Consumes: package scaffold from Task 1.
- Produces: exports `./variants` (same API as web's file: `variants`, `collectSafelist`) and `./runtime-style` → `runtimeStyle(variables: Partial<Record<`--${string}`, string | number>>): CSSProperties`.

- [ ] **Step 1: Copy `variants.ts` + `variants.test.ts` byte-for-byte**

```bash
cp apps/web/src/ui/variants.ts packages/web/ui/src/variants.ts
cp apps/web/src/ui/variants.test.ts packages/web/ui/src/variants.test.ts
```
(The test imports `from './variants'` — path already correct in the new location.)

- [ ] **Step 2: Copy `runtime-style.ts` and write its failing test**

```bash
cp apps/eer/src/ui/runtime-style.ts packages/web/ui/src/runtime-style.ts
```

`packages/web/ui/src/runtime-style.test.ts`:
```ts
import { runtimeStyle } from './runtime-style';

describe('runtimeStyle', () => {
  it('passes CSS custom properties through as a style object', () => {
    expect(runtimeStyle({ '--sidebar-w': '320px', '--depth': 2 })).toEqual({
      '--sidebar-w': '320px',
      '--depth': 2,
    });
  });
});
```

- [ ] **Step 3: Add exports to `packages/web/ui/package.json`**

```json
  "exports": {
    "./cn": "./src/cn.ts",
    "./variants": "./src/variants.ts",
    "./runtime-style": "./src/runtime-style.ts"
  },
```

- [ ] **Step 4: Run package tests + typecheck**

Run: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/ui typecheck`
Expected: PASS (cn + variants + runtime-style suites).

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui
git commit -m "feat(ui): move variants and runtime-style into @tickets/ui"
```

---

### Task 3: Move the token pipeline + generated CSS; repoint web's CSS import

The pipeline is cohesive (generator writes the CSS; check script imports the generator), so JSON, all three scripts, and the CSS move in ONE commit, together with web's import swap — the repo is only green with all of it.

**Files:**
- Move: `apps/web/src/styles/tokens/*.tokens.json` → `packages/web/ui/src/tokens/`
- Move: `apps/web/src/styles/instrument.css` → `packages/web/ui/src/tokens.css`
- Move: `apps/web/scripts/build-tokens.mjs`, `scan-hardcoded-values.mjs`, `check-design-tokens.mjs` → `packages/web/ui/scripts/`
- Modify: `packages/web/ui/package.json` (tokens.css export + tokens:* scripts), `apps/web/package.json` (dep, remove tokens:* scripts), `apps/web/src/main.tsx:14`, root `package.json:16`
- Delete: `apps/web/scripts/` (now empty), `apps/web/src/styles/` (now empty — verify nothing else lives there first)

**Interfaces:**
- Consumes: package scaffold.
- Produces: `@tickets/ui/tokens.css` export; package scripts `tokens:build`, `tokens:lint`, `tokens:check`, `tokens:verify`; `resolveTokenMaps()` stays exported from `scripts/build-tokens.mjs` (Task 7's swatches test and the check script import it).

- [ ] **Step 1: git-move the files**

```bash
mkdir -p packages/web/ui/scripts
git mv apps/web/src/styles/tokens packages/web/ui/src/tokens
git mv apps/web/src/styles/instrument.css packages/web/ui/src/tokens.css
git mv apps/web/scripts/build-tokens.mjs packages/web/ui/scripts/build-tokens.mjs
git mv apps/web/scripts/scan-hardcoded-values.mjs packages/web/ui/scripts/scan-hardcoded-values.mjs
git mv apps/web/scripts/check-design-tokens.mjs packages/web/ui/scripts/check-design-tokens.mjs
```

- [ ] **Step 2: Fix paths inside `build-tokens.mjs`**

The two path constants near the top become:
```js
const tokensDir = path.join(__dirname, '..', 'src', 'tokens');
const cssFile = path.join(__dirname, '..', 'src', 'tokens.css');
```
Also update the error string mentioning `instrument.css` in `spliceRegion` to say `tokens.css` (two `Marker not found in`/`Duplicate start marker` messages).

- [ ] **Step 3: Fix paths inside `check-design-tokens.mjs`**

The script is now one directory deeper relative to repo root (`packages/web/ui/scripts` vs `apps/web/scripts`):
```js
const repoRoot = path.join(__dirname, '..', '..', '..', '..');
```
(`designHtmlPath` derives from `repoRoot` and needs no change. The `import { resolveTokenMaps } from './build-tokens.mjs'` relative import is unchanged.)

- [ ] **Step 4: Fix paths inside `scan-hardcoded-values.mjs` (still web-only in this task)**

```js
const srcDir = path.join(__dirname, '..', '..', '..', '..', 'apps', 'web', 'src');

const EXCLUDE_RES = [
  /\.test\./,
];
```
(The two `src/styles/tokens/` and `instrument.css` exclusions are dropped — those files no longer live under the scanned root.)

- [ ] **Step 5: Wire package scripts and exports**

In `packages/web/ui/package.json`:
```json
  "exports": {
    "./tokens.css": "./src/tokens.css",
    "./cn": "./src/cn.ts",
    "./variants": "./src/variants.ts",
    "./runtime-style": "./src/runtime-style.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "tokens:build": "node scripts/build-tokens.mjs",
    "tokens:lint": "node scripts/scan-hardcoded-values.mjs",
    "tokens:check": "node scripts/check-design-tokens.mjs",
    "tokens:verify": "node scripts/build-tokens.mjs && git diff --exit-code src/tokens.css && node scripts/scan-hardcoded-values.mjs && node scripts/check-design-tokens.mjs"
  },
```

- [ ] **Step 6: Repoint web**

`apps/web/package.json`: add `"@tickets/ui": "workspace:*"` to dependencies; delete the four `tokens:*` script entries.

`apps/web/src/main.tsx:14`: `import './styles/instrument.css';` → `import '@tickets/ui/tokens.css';`

Root `package.json:16`: `"verify:tokens": "pnpm --filter @tickets/ui tokens:verify"`

Confirm `apps/web/src/styles/` and `apps/web/scripts/` are now empty (`ls` both) and remove the empty dirs. If anything unexpected remains, STOP and report.

- [ ] **Step 7: Verify everything**

```bash
pnpm install
pnpm --filter @tickets/ui tokens:verify   # build → git diff clean → lint → check
pnpm --filter @tickets/web typecheck && pnpm --filter @tickets/web test
pnpm build
```
Expected: all green. `tokens:verify` proves the generator round-trips the moved CSS byte-identically and the design-doc parity check still passes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(ui): move token pipeline and generated CSS into @tickets/ui"
```

---

### Task 4: Scanner multi-root + eer ratchet baseline

**Files:**
- Modify: `packages/web/ui/scripts/scan-hardcoded-values.mjs`
- Create: `packages/web/ui/scripts/eer-baseline.json` (generated in Step 5)
- Test: `packages/web/ui/src/scan-baseline.test.ts`

**Interfaces:**
- Consumes: moved scanner from Task 3.
- Produces: scanner exports `diffAgainstBaseline(violationKeys: string[], baselineKeys: string[]): { fresh: string[]; fixed: string[] }`; CLI flag `--update-baseline`; baseline file format `{ "violations": string[] }` with keys `"<posix-rel-path>::<trimmed-line-text>"` (content-keyed — line numbers drift).

- [ ] **Step 1: Write the failing test**

`packages/web/ui/src/scan-baseline.test.ts`:
```ts
// The scanner is an .mjs script; the pure baseline-diff helper is exported
// for testing. vitest resolves the relative import fine.
// @ts-expect-error — plain .mjs module without type declarations
import { diffAgainstBaseline } from '../scripts/scan-hardcoded-values.mjs';

describe('diffAgainstBaseline', () => {
  const baseline = ['a.css::color: #fff', 'b.tsx::bg-[#123456]'];

  it('flags violations not present in the baseline', () => {
    const { fresh } = diffAgainstBaseline(['a.css::color: #fff', 'c.tsx::#abc'], baseline);
    expect(fresh).toEqual(['c.tsx::#abc']);
  });

  it('reports baseline entries that no longer occur (ratchet progress)', () => {
    const { fixed } = diffAgainstBaseline(['a.css::color: #fff'], baseline);
    expect(fixed).toEqual(['b.tsx::bg-[#123456]']);
  });

  it('is clean when violations exactly match the baseline', () => {
    const { fresh, fixed } = diffAgainstBaseline([...baseline], baseline);
    expect(fresh).toEqual([]);
    expect(fixed).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui test`
Expected: FAIL — `diffAgainstBaseline` is not exported.

- [ ] **Step 3: Implement multi-root scan + baseline in `scan-hardcoded-values.mjs`**

Replace the `srcDir` constant and `main()` with:
```js
const repoRoot = path.join(__dirname, '..', '..', '..', '..');
const ROOTS = [
  { app: 'web', dir: path.join(repoRoot, 'apps', 'web', 'src'), baselined: false },
  { app: 'eer', dir: path.join(repoRoot, 'apps', 'eer', 'src'), baselined: true },
];
const baselineFile = path.join(__dirname, 'eer-baseline.json');

export function diffAgainstBaseline(violationKeys, baselineKeys) {
  const baselineSet = new Set(baselineKeys);
  const currentSet = new Set(violationKeys);
  return {
    fresh: violationKeys.filter((k) => !baselineSet.has(k)),
    fixed: baselineKeys.filter((k) => !currentSet.has(k)),
  };
}

function collectViolations(root) {
  const files = walk(root.dir, []).filter((f) => !isExcluded(path.relative(root.dir, f)));
  if (files.length === 0) {
    console.error(`error: scanned zero files under ${root.dir} — check ROOTS/EXCLUDE_RES/walk()`);
    process.exit(1);
  }
  const violations = [];
  for (const file of files) {
    const relPath = toPosix(path.relative(repoRoot, file));
    for (const hit of scanFile(file)) {
      violations.push({ key: `${relPath}::${hit.text}`, line: `${relPath}:${hit.line}: ${hit.text}` });
    }
  }
  return violations;
}

function main() {
  const updateBaseline = process.argv.includes('--update-baseline');
  let failed = false;

  for (const root of ROOTS) {
    const violations = collectViolations(root);

    if (!root.baselined) {
      for (const v of violations) console.log(v.line);
      if (violations.length > 0) failed = true;
      continue;
    }

    if (updateBaseline) {
      const keys = [...new Set(violations.map((v) => v.key))].sort();
      writeFileSync(baselineFile, JSON.stringify({ violations: keys }, null, 2) + '\n', 'utf8');
      console.log(`baseline updated: ${keys.length} known ${root.app} violations`);
      continue;
    }

    const baseline = JSON.parse(readFileSync(baselineFile, 'utf8')).violations;
    const keys = violations.map((v) => v.key);
    const { fresh, fixed } = diffAgainstBaseline([...new Set(keys)], baseline);
    for (const v of violations) {
      if (fresh.includes(v.key)) console.log(`NEW ${v.line}`);
    }
    if (fresh.length > 0) failed = true;
    console.log(
      `${root.app} ratchet: ${new Set(keys).size} known violations (baseline ${baseline.length}` +
        (fixed.length ? `, ${fixed.length} fixed — run --update-baseline to ratchet down` : '') +
        ')',
    );
  }

  if (failed) process.exit(1);
  console.log('ok: no new style-context hardcoded values');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
```
Also add `writeFileSync` to the existing `node:fs` import. Everything above `lineAt` (walk/stripComments/scan functions) is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/ui test`
Expected: PASS.

- [ ] **Step 5: Generate and inspect the baseline**

Run: `pnpm --filter @tickets/ui exec node scripts/scan-hardcoded-values.mjs --update-baseline`
Expected: `baseline updated: N known eer violations` — N should be roughly eer's `tailwind.css` hex count (~60–80) plus a handful of style-region hits (audit: `diagram.tsx:25` rgb dot-grid). Open the JSON and sanity-check entries are all `apps/eer/...`. Then run the gate itself:

Run: `pnpm --filter @tickets/ui tokens:lint`
Expected: exit 0, `web` clean, `eer ratchet: N known violations (baseline N)`.

- [ ] **Step 6: Commit**

```bash
git add packages/web/ui
git commit -m "feat(ui): scan both apps for hardcoded values with eer ratchet baseline"
```

---

### Task 5: Repoint web's ~85 `cn` imports (+ delete web's cn/variants)

**Files:**
- Modify: every file under `apps/web/src` importing `ui/cn` or `./cn` (85 files) and `./variants`
- Delete: `apps/web/src/ui/cn.ts`, `cn.test.ts`, `apps/web/src/ui/variants.ts`, `variants.test.ts`

**Interfaces:**
- Consumes: `@tickets/ui/cn`, `@tickets/ui/variants` from Tasks 1–2.
- Produces: web has exactly one cn/variants source.

- [ ] **Step 1: Mechanical rewrite**

```bash
cd apps/web/src
grep -rl "ui/cn'" . | xargs sed -i -E "s#from '(\.\./)+ui/cn'#from '@tickets/ui/cn'#g"
# files inside src/ui import their sibling as './cn':
grep -rl "from './cn'" ./ui | xargs sed -i "s#from './cn'#from '@tickets/ui/cn'#g"
grep -rl "from './variants'" ./ui | xargs sed -i "s#from './variants'#from '@tickets/ui/variants'#g" || true
```

- [ ] **Step 2: Delete the originals**

```bash
git rm apps/web/src/ui/cn.ts apps/web/src/ui/cn.test.ts apps/web/src/ui/variants.ts apps/web/src/ui/variants.test.ts
```

- [ ] **Step 3: Verify no stragglers, then full web check**

```bash
grep -rn "ui/cn'\|'./cn'\|'./variants'" apps/web/src ; # expect no output
pnpm --filter @tickets/web typecheck && pnpm --filter @tickets/web test && pnpm build
```
Expected: grep silent; typecheck/tests/build green (the moved cn behaves identically — union is a superset).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(web): import cn and variants from @tickets/ui"
```

---

### Task 6: Switch eer to shared `cn` + `runtime-style`

**Files:**
- Modify: `apps/eer/package.json` (+dep), ~40 files importing `ui/cn`, 11 files importing `runtime-style`
- Delete: `apps/eer/src/ui/cn.ts`, `apps/eer/src/ui/runtime-style.ts` (`color-mix.ts` STAYS)

**Interfaces:**
- Consumes: `@tickets/ui/cn` (union covers eer's `3xs/2xs`), `@tickets/ui/runtime-style`.
- Produces: eer depends on `@tickets/ui`; `apps/eer/src/ui/` contains only `color-mix.ts`.

- [ ] **Step 1: Add dependency**

In `apps/eer/package.json` dependencies: `"@tickets/ui": "workspace:*"`. Run `pnpm install`.

- [ ] **Step 2: Mechanical rewrite**

```bash
cd apps/eer/src
grep -rl "ui/cn'" . | xargs sed -i -E "s#from '(\.\./)+ui/cn'#from '@tickets/ui/cn'#g"
grep -rl "ui/runtime-style'" . | xargs sed -i -E "s#from '(\.\./)+ui/runtime-style'#from '@tickets/ui/runtime-style'#g"
git rm apps/eer/src/ui/cn.ts apps/eer/src/ui/runtime-style.ts
```

- [ ] **Step 3: Verify**

```bash
grep -rn "ui/cn'\|ui/runtime-style'" apps/eer/src ; # expect no output
pnpm --filter @tickets/eer typecheck && pnpm --filter @tickets/eer test
```
Expected: green (eer's `verify:tailwind` pre-step is untouched; cn behavior identical for `3xs/2xs`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(eer): use shared cn and runtime-style from @tickets/ui"
```

---

### Task 7: `swatches` module (token-derived color presets)

**Files:**
- Create: `packages/web/ui/src/swatches.ts`
- Test: `packages/web/ui/src/swatches.test.ts`
- Modify: `packages/web/ui/package.json` (export), `apps/web/src/components/settings/types-tab.tsx:17`, `apps/web/src/components/settings/workflow-tab.tsx:23`

**Interfaces:**
- Consumes: `src/tokens/primitives.tokens.json`, `src/tokens/semantic.light.tokens.json`.
- Produces: `export const SWATCHES: string[]` — same six hexes, same order, as the deleted literals: `['#4E46C6','#2E7D4F','#C25425','#A03028','#2E6FCC','#79756A']` (accent, kind-done, kind-blocked, opt-red, kind-active, ink-3 — light theme).

- [ ] **Step 1: Write the failing test**

`packages/web/ui/src/swatches.test.ts`:
```ts
import { SWATCHES } from './swatches';

describe('SWATCHES', () => {
  it('derives the six color-picker presets from light-theme tokens', () => {
    // Exactly the array previously hardcoded in types-tab.tsx / workflow-tab.tsx —
    // asserted literally so a token rebrand consciously updates this test.
    expect(SWATCHES).toEqual(['#4E46C6', '#2E7D4F', '#C25425', '#A03028', '#2E6FCC', '#79756A']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/web/ui/src/swatches.ts`:
```ts
import primitives from './tokens/primitives.tokens.json';
import semanticLight from './tokens/semantic.light.tokens.json';

// Resolve one semantic token name (e.g. 'accent') to its light-theme hex,
// following one level of `{group.name}` alias into the primitives, mirroring
// scripts/build-tokens.mjs resolveTokenMaps().
function resolveLight(name: string): string {
  for (const entries of Object.values(semanticLight as Record<string, Record<string, { $value: string }>>)) {
    const token = entries[name];
    if (!token) continue;
    const match = /^\{([^}]+)\}$/.exec(token.$value);
    if (!match) return token.$value;
    const [group, primitiveName] = match[1]!.split('.', 2) as [string, string];
    const primitive = (primitives as Record<string, Record<string, { $value: string }>>)[group]?.[primitiveName];
    if (!primitive) throw new Error(`Unresolved alias {${match[1]}} for swatch token "${name}"`);
    return primitive.$value;
  }
  throw new Error(`Unknown swatch token "${name}"`);
}

// Color-picker presets for type/status configuration — previously hardcoded
// hex arrays in settings/types-tab.tsx and settings/workflow-tab.tsx.
export const SWATCHES = ['accent', 'kind-done', 'kind-blocked', 'opt-red', 'kind-active', 'ink-3'].map(
  resolveLight,
);
```

Add export in `packages/web/ui/package.json`: `"./swatches": "./src/swatches.ts"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/ui typecheck`
Expected: PASS. If a hex mismatches, the JSON token names differ from the audit's mapping — inspect `semantic.light.tokens.json` for the actual names and fix the name list, NOT the expected hexes.

- [ ] **Step 5: Repoint the two settings tabs**

In both `types-tab.tsx` and `workflow-tab.tsx`: delete the `const SWATCHES = [...]` line and add `import { SWATCHES } from '@tickets/ui/swatches';` with the other imports.

Run: `pnpm --filter @tickets/web typecheck && pnpm --filter @tickets/web test`
Expected: green (settings tab tests exercise the same values).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): token-derived SWATCHES preset list, used by settings tabs"
```

---

### Task 8: New inert tokens — six commits, one per group

**Files:**
- Modify: `packages/web/ui/src/tokens.css` only — all insertions go in the STATIC part (never between `tokens:*` markers). Type/radius/tracking groups: insert immediately before the closing `}` of the `@theme inline` block. Border/ring/z vars: insert into the static `:root` block immediately before the `/* tokens:light — generated, do not edit */` marker line.

**Interfaces:**
- Consumes: tokens.css from Task 3.
- Produces: utilities `text-nano/micro/body/title/heading/display`, `rounded-chip/tile/overlay`, `tracking-label/caps/mono-label`; CSS vars `--border-hair`, `--ring-focus`, `--z-sticky/--z-scrim/--z-overlay` (consumed later as `border-(length:--border-hair)`, `ring-(length:--ring-focus)`, `z-(--z-sticky)`).

After EVERY commit in this task run the invariant check:
```bash
pnpm --filter @tickets/ui tokens:verify && pnpm --filter @tickets/web test && pnpm build
```
(`tokens:verify` proves the generator still splices only its own regions and the static additions survive a rebuild.)

- [ ] **Step 1: Type scale** — inside `@theme inline`, before its closing `}`:

```css
  /* Extended type scale (audit 2026-07-23) — inert until consumed. Existing
     label/meta/ui (11/12/13px) stay canonical for control chrome. */
  --text-nano: 9px;
  --text-nano--line-height: 1.3;
  --text-micro: 10px;
  --text-micro--line-height: 1.35;
  --text-body: 14px;
  --text-body--line-height: 1.5;
  --text-title: 16px;
  --text-title--line-height: 1.4;
  --text-heading: 20px;
  --text-heading--line-height: 1.3;
  --text-display: 24px;
  --text-display--line-height: 1.25;
```
Commit: `git add -A && git commit -m "feat(ui): extended type scale tokens (nano..display)"`

- [ ] **Step 2: Radii** — same location:

```css
  /* Radius gaps (audit): chip 4 / tile 6 / overlay 10 — names avoid Tailwind's
     default --radius-xs/sm which existing rounded-sm usage relies on. */
  --radius-chip: 4px;
  --radius-tile: 6px;
  --radius-overlay: 10px;
```
Commit: `feat(ui): radius tokens chip/tile/overlay`

- [ ] **Step 3: Tracking** — same location:

```css
  /* Letter-spacing for uppercase labels — names avoid Tailwind defaults
     (tracking-wide etc.). label matches text-label's baked .06em. */
  --tracking-label: 0.06em;
  --tracking-caps: 0.08em;
  --tracking-mono-label: 0.09em;
```
Commit: `feat(ui): tracking tokens label/caps/mono-label`

- [ ] **Step 4: Border + focus ring** — static `:root` block, before the light marker:

```css
  /* Structural tokens (audit): consumed as border-(length:--border-hair) /
     ring-(length:--ring-focus). */
  --border-hair: 1.5px;
  --ring-focus: 3px;
```
Commit: `feat(ui): border-hair and ring-focus tokens`

- [ ] **Step 5: Z-scale** — same `:root` location:

```css
  /* Layering scale: sticky table headers / overlay scrims / floating portals.
     Consumed as z-(--z-sticky) etc. */
  --z-sticky: 10;
  --z-scrim: 40;
  --z-overlay: 50;
```
Commit: `feat(ui): z-index scale tokens`

- [ ] **Step 6: Spec sync** — update `docs/superpowers/specs/2026-07-23-ui-tokens-package-design.md` "New tokens" table with the final names (chip/tile/overlay, label/caps/mono-label) and the deviation rationale.

Commit: `docs(ui): record final token names in P1 spec`

---

### Task 9: Final verification sweep

**Files:** none (verification only; fix-forward anything found).

- [ ] **Step 1: Full monorepo gates**

```bash
pnpm install
pnpm typecheck
pnpm --filter @tickets/ui test
pnpm --filter @tickets/web test
pnpm --filter @tickets/eer test
pnpm --filter @tickets/ui tokens:verify
pnpm build
```
Expected: everything green.

- [ ] **Step 2: Visual spot-check**

Start dev (`pnpm dev`) and check at :4620 in BOTH themes: `/gallery`, one board screen, one signals screen, one eer screen (eer dev if separate). Expected: pixel-identical to before P1 (new tokens are inert).

- [ ] **Step 3: Phase-boundary deploy (per CLAUDE.md)**

```bash
docker compose up -d --build
```
Spot-check :4610 loads.

- [ ] **Step 4: Report**

Summarize: files moved, import counts rewritten, baseline size, new token names. Phase 1 exit criteria from the roadmap are met; Phase 2 (gallery workbench) unblocked.
