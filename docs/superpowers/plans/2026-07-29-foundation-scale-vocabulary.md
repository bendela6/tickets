# Foundation Scale Vocabulary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every foundation scale on a vocabulary that names its own value — a four-rung t-shirt radius scale, and integer classes for border, ring, z-index and duration — deleting the role-named tokens that no longer earn their indirection.

**Architecture:** Radius becomes four declared Tailwind theme rungs (`--radius-sm/md/lg/xl` = 4/6/8/12px) with the off-scale rungs cleared to `initial`; every `rounded-[Npx]` in the tree collapses onto them. Border, ring, z-index, duration and breakpoint tokens are **deleted** rather than renamed, because Tailwind's bare-value utilities (`border-1`, `ring-3`, `z-10`, `duration-200`) already state those values natively. Each sweep is gated by a source-scanning vitest that fails while any retired form remains, so the migration ratchets instead of drifting back.

**Tech Stack:** Tailwind v4.3.2 (preflight OFF), React 19, vitest, pnpm + turbo monorepo. Token codegen: `packages/web/ui/scripts/build-tokens.mjs` + `extract-safelist.mjs`.

**Spec:** [docs/superpowers/specs/2026-07-29-foundation-scale-vocabulary-design.md](../specs/2026-07-29-foundation-scale-vocabulary-design.md)

## Global Constraints

- **Scope is `packages/web/ui`, `packages/web/playground`, `apps/web/src` only.** `apps/eer` is explicitly OUT — it declares its own `@theme` with `--radius-lg: 9px`, `--radius-xl: 10px`, `--radius-2xl: 14px` and never imports `tokens.css`. Never edit a file under `apps/eer/`.
- **Never edit between `/* tokens:… */` markers in `packages/web/ui/src/tokens/tokens.css`.** Those regions are spliced by `build-tokens.mjs`. All hand edits go in the static regions.
- **`tones.generated.ts` and `safelist.generated.css` are generated.** Change `scripts/build-tokens.mjs`, then run `pnpm --filter @tickets/ui tokens:build` and commit the regenerated output. Never hand-edit the generated files.
- **Rounding rule for the radius sweep:** nearest rung, ties up. `1, 1.5, 2, 3, 3.5, 4px → rounded-sm` · `5, 6px → rounded-md` · `7, 8, 9px → rounded-lg` · `10, 11, 12px → rounded-xl`.
- **Tailwind facts verified against 4.3.2 — do not re-litigate:** `border-1`/`border-b-1`/`ring-3`/`z-10`/`duration-200` all compile as bare-value utilities. `border-1.5` does NOT compile. Bare `border` and bare `rounded` are static utilities and CANNOT be removed by theming — they are retired by convention and by the scan test only.
- **Conventional commits scoped by app**, one per task: `feat(ui)!:`, `refactor(ui)!:`, `chore(ui):`, `docs(ui):`.
- **Checks that must pass before any commit:** `pnpm --filter @tickets/ui test` and, for tasks touching `apps/web`, `pnpm --filter @tickets/web test`.

### Working alongside another session — read before your first commit

This plan executes on `main` while a **second session is concurrently implementing a different plan** (the items-core UI port) in the same working tree. Two consequences bind every task:

- **Stage files explicitly. Never `git add` a directory.** The commit steps below show directory adds for brevity; replace each with `git add` of the exact files your task changed, checked against `git status --short` first. Staging a directory sweeps the other session's unfinished work into your commit.
- **These paths belong to the other session.** Never stage them unless your own sweep genuinely had to modify one, and say so in your report if it did:
  `packages/web/ui/src/gallery/` (all of it, including untracked `states.tsx`, `state-source.ts`, `state-source.test.ts`) · `packages/web/ui/src/components/button/button.demo.tsx` · `packages/web/ui/src/components/card/card.tsx` · `packages/web/ui/src/foundation/typography/typography.demo.tsx` · `packages/web/ui/src/foundation/elevation/elevation.demo.tsx` · `packages/web/playground/src/page/component-page/component-page.tsx` · `packages/web/playground/src/preview/state-grid/` · `ui.md`
- **The baseline suite is already red, and it is not yours.** `packages/web/ui/src/gallery/collect-demos.test.ts` fails 2 tests with `ReferenceError: defineState is not defined` — the other session's in-flight work. Treat exactly those 2 failures as the expected baseline. Any *other* failure is yours. Prefer targeted runs (`pnpm --filter @tickets/ui test <file>`) over the full suite so the noise stays out of your way.

---

## File Structure

**New file**

- `packages/web/ui/src/tokens/vocabulary.ts` — the retired-form patterns and the source scanner. One responsibility: given a root directory, list every occurrence of a retired class form. Pure and exported so the test can assert on it directly rather than shelling out.
- `packages/web/ui/src/tokens/vocabulary.test.ts` — the ratchet. Asserts zero occurrences per family across the in-scope roots. This is the failing test each sweep task turns green.

**Modified**

| File | Responsibility after the change |
|---|---|
| `packages/web/ui/src/tokens/tokens.css` | Declares `--radius-sm/md/lg/xl` + four `initial`s; no longer declares border/ring/z/duration/breakpoint tokens |
| `packages/web/ui/scripts/build-tokens.mjs` | `emitTones()` emits `border-2` for the outline emphasis |
| `packages/web/ui/src/tokens/next/*.tokens.json` | Records the sanctioned rungs under numeric/t-shirt keys |
| `packages/web/ui/src/foundation/spec.ts` | `drift()` covers only genuinely tokenized families |
| `packages/web/ui/src/foundation/{radius,layout,motion}/*.demo.tsx` | Gallery pages render the rungs as classes |
| `docs/design/{foundation-tokens,token-index}.md` | The written token tables |

---

### Task 1: The vocabulary scanner and its ratchet

Builds the harness every later sweep is tested against. It starts red on purpose — Task 1 commits the scanner with the families that are *already* clean asserted, and each later task adds its family assertion as its own failing test.

**Files:**
- Create: `packages/web/ui/src/tokens/vocabulary.ts`
- Test: `packages/web/ui/src/tokens/vocabulary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `RETIRED: Record<RetiredFamily, RegExp>` and `scanRetired(family: RetiredFamily): string[]`, where `RetiredFamily = 'radius' | 'border' | 'ring' | 'z'`. Each returned entry is `"<repo-relative path>:<line>: <matched text>"`. Later tasks assert `scanRetired('<family>')` is `[]`.

- [ ] **Step 1: Write the scanner**

Create `packages/web/ui/src/tokens/vocabulary.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root, from `packages/web/ui/src/tokens/`. `fileURLToPath` rather than
 *  `import.meta.dirname`, which Vite does not populate in every transform mode. */
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..', '..');

/**
 * The trees that consume `tokens.css`. `apps/eer` is deliberately absent — it
 * declares its own `@theme` with different radius values, so its classes are
 * not this vocabulary's to police.
 */
const ROOTS = [
  join(REPO_ROOT, 'packages', 'web', 'ui', 'src'),
  join(REPO_ROOT, 'packages', 'web', 'playground', 'src'),
  join(REPO_ROOT, 'apps', 'web', 'src'),
];

/** Generated files restate what their generator emits; scanning them double-counts. */
const SKIP = new Set(['tones.generated.ts', 'safelist.generated.css', 'vocabulary.ts']);

export type RetiredFamily = 'radius' | 'border' | 'ring' | 'z';

/**
 * A retired form per family. Written against class-string contents, so each
 * pattern demands a quote, space, backtick or brace boundary on the left —
 * otherwise `border` matches inside `border-gray-6` and every colour utility
 * in the tree reports as a violation.
 */
export const RETIRED: Record<RetiredFamily, RegExp> = {
  // Arbitrary radii, plus the four rungs cleared to `initial`.
  radius: /(?<![\w-])rounded(-[a-z]{1,2})?-(\[[^\]\n]+\]|xs|2xl|3xl|4xl)(?![\w-])/g,
  // Bare `border` / `border-b` (width utilities with no number), and 1.5px.
  border: /(?<=[\s"'`{])border(-[trblxy])?(?=[\s"'`}])|border(-[trblxy])?-\[1\.5px\]/g,
  ring: /ring-\[3px\]|ring-\(length:--ring-focus\)/g,
  z: /(?<![\w-])z-(3|30)(?![\w-])/g,
};

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP.has(entry.name)) yield full;
  }
}

/** Every occurrence of `family`'s retired forms, as `path:line: text`. */
export function scanRetired(family: RetiredFamily): string[] {
  const hits: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const match of line.matchAll(RETIRED[family])) {
          hits.push(`${relative(REPO_ROOT, file).split(sep).join('/')}:${i + 1}: ${match[0].trim()}`);
        }
      });
    }
  }
  return hits;
}
```

- [ ] **Step 2: Write the test, asserting only what is already true**

Create `packages/web/ui/src/tokens/vocabulary.test.ts`:

```ts
import { RETIRED, scanRetired } from './vocabulary';

describe('RETIRED patterns', () => {
  it('matches an arbitrary radius but not a rung on the scale', () => {
    expect('rounded-[7px]'.match(RETIRED.radius)).toEqual(['rounded-[7px]']);
    expect('rounded-lg'.match(RETIRED.radius)).toBeNull();
  });

  it('matches the off-scale rungs cleared to initial', () => {
    expect('rounded-xs rounded-2xl'.match(RETIRED.radius)).toEqual(['rounded-xs', 'rounded-2xl']);
  });

  it('matches a bare width utility but never a border COLOUR', () => {
    expect(' border '.match(RETIRED.border)).toEqual(['border']);
    expect(' border-b '.match(RETIRED.border)).toEqual(['border-b']);
    expect(' border-gray-6 '.match(RETIRED.border)).toBeNull();
    expect(' border-1 '.match(RETIRED.border)).toBeNull();
  });

  it('matches 1.5px but not an integer width', () => {
    expect('border-[1.5px]'.match(RETIRED.border)).toEqual(['border-[1.5px]']);
    expect(' border-2 '.match(RETIRED.border)).toBeNull();
  });

  it('matches the off-ladder z rungs but not the ladder', () => {
    expect('z-3 z-30'.match(RETIRED.z)).toEqual(['z-3', 'z-30']);
    expect('z-10 z-40 z-50'.match(RETIRED.z)).toBeNull();
  });
});

describe('scanRetired', () => {
  it('reads the in-scope trees and returns locatable hits', () => {
    // Radius is swept in Tasks 2-3; this pins that the scanner is wired to
    // real files rather than silently walking an empty tree.
    const hits = scanRetired('radius');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toMatch(/^(packages|apps)\/.+:\d+: /);
  });

  it('never reports a file under apps/eer — that app owns its own scale', () => {
    const all = (['radius', 'border', 'ring', 'z'] as const).flatMap(scanRetired);
    expect(all.filter((h) => h.startsWith('apps/eer'))).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @tickets/ui test vocabulary`
Expected: FAIL — `Cannot find module './vocabulary'` before Step 1's file exists; after Step 1, all tests PASS. If any `RETIRED patterns` case fails, the regex is wrong — fix the regex, not the expectation.

**Known false-positive shape:** the `border` pattern matches a bare word between
delimiters, so a TypeScript identifier written `const border = …` (space either
side) reports as a violation. No in-scope file has one today — every occurrence in
`layout.demo.tsx` is `(border)` or `border.name`, and `(`/`.` are outside the
lookahead set. If a later sweep task surfaces a hit on a line that is plainly not a
class string, tighten the lookahead rather than editing the source to suit the
scanner.

- [ ] **Step 4: Run the full package suite**

Run: `pnpm --filter @tickets/ui test`
Expected: PASS, with the new `vocabulary` file included.

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/tokens/vocabulary.ts packages/web/ui/src/tokens/vocabulary.test.ts
git commit -m "test(ui): scanner for retired foundation class forms"
```

---

### Task 2: Declare the radius scale and clear the off-scale rungs

**Files:**
- Modify: `packages/web/ui/src/tokens/tokens.css` (insert before the closing `}` of `@theme inline`, currently line 707)
- Test: `packages/web/ui/src/foundation/spec.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the utilities `rounded-sm` (4px), `rounded-md` (6px), `rounded-lg` (8px), `rounded-xl` (12px). `rounded-xs`, `rounded-2xl`, `rounded-3xl`, `rounded-4xl` stop compiling. Every later task depends on these four existing.

- [ ] **Step 1: Write the failing test**

Append to the `describe` block that already holds `exposes each remaining family at its documented size` in `packages/web/ui/src/foundation/spec.test.ts`:

```ts
describe('the radius scale in the live sheet', () => {
  it('declares exactly the four rungs, at the spec values', () => {
    const rungs = liveTokens(/^radius-(sm|md|lg|xl)$/);
    expect(Object.fromEntries(rungs.map((r) => [r.name, r.value]))).toEqual({
      'radius-sm': '4px',
      'radius-md': '6px',
      'radius-lg': '8px',
      'radius-xl': '12px',
    });
  });

  it('clears the off-scale rungs so they cannot drift back', () => {
    const cleared = liveTokens(/^radius-(xs|2xl|3xl|4xl)$/);
    expect(cleared.map((r) => r.name).sort()).toEqual([
      'radius-2xl',
      'radius-3xl',
      'radius-4xl',
      'radius-xs',
    ]);
    expect(cleared.every((r) => r.value === 'initial')).toBe(true);
  });
});
```

Add `liveTokens` to the existing import from `./spec` at the top of the file if it is not already imported.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui test spec.test`
Expected: FAIL — `expected {} to deeply equal { 'radius-sm': '4px', … }`, because `tokens.css` declares no radius tokens today.

- [ ] **Step 3: Declare the scale**

In `packages/web/ui/src/tokens/tokens.css`, immediately after the `--breakpoint-*` lines and before the closing `}` of `@theme inline` (line 707), insert:

```css
  /* Radius (next/radius.tokens.json). Four rungs, not six: a radius is only
     legible against the box it rounds — 4px on a chip and 12px on a panel read
     as the same softness, while 4 and 5 on the same box read as a mistake.
     The values are Tailwind's own sm/md/lg/xl, so the 166 existing usages of
     those names keep the pixel they already had.

     `initial` on the rest is the enforcement: rounded-xs / 2xl / 3xl / 4xl stop
     compiling, so an off-scale corner is a build-visible mistake rather than a
     silent one. `rounded-full` survives — Tailwind hardcodes it to
     `calc(infinity * 1px)` rather than reading a token, and a pill is not a
     step on the scale. Bare `rounded` is likewise static (0.25rem) and cannot
     be cleared here; `vocabulary.test.ts` is what keeps it out of the tree. */
  --radius-xs: initial;
  --radius-2xl: initial;
  --radius-3xl: initial;
  --radius-4xl: initial;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/ui test spec.test`
Expected: PASS.

- [ ] **Step 5: Verify the token pipeline sees no drift**

Run: `pnpm --filter @tickets/ui tokens:verify`
Expected: PASS. The insertion is outside every `tokens:…` marker region, so a fresh build must reproduce the file byte-for-byte. If it fails with a diff on `tokens.css`, the insertion landed inside a generated region — move it.

- [ ] **Step 6: Commit**

```bash
git add packages/web/ui/src/tokens/tokens.css packages/web/ui/src/foundation/spec.test.ts
git commit -m "feat(ui)!: declare the four-rung radius scale, clear the rest"
```

---

### Task 3: Sweep radius in `@tickets/ui` and `@tickets/playground`

`rounded-xs` now compiles to nothing, so these sites are visibly broken until swept. Do this immediately after Task 2.

**Files:**
- Modify: `packages/web/ui/src/components/button/button.tsx:87-94`
- Modify: `packages/web/ui/src/components/field/field.ts:60-68`
- Modify: `packages/web/ui/src/components/checkbox/checkbox.tsx:51`
- Modify: `packages/web/ui/src/components/tabs/tabs.tsx:40`
- Modify: `packages/web/ui/src/components/date-picker/date-picker.tsx:118`
- Modify: `packages/web/ui/src/components/dialog-footer/dialog-footer.demo.tsx:10,21`
- Modify: `packages/web/ui/src/components/screen-state/screen-state.demo.tsx:20`
- Modify: `packages/web/playground/src/shell/sidebar/sidebar.tsx:137`
- Test: `packages/web/ui/src/tokens/vocabulary.test.ts`, `packages/web/ui/src/components/button/button.test.tsx:33-40`, `packages/web/ui/src/components/field/field.test.tsx:57-61`, `packages/web/ui/src/components/input/input.test.tsx:10,20`

**Interfaces:**
- Consumes: `--radius-sm/md/lg/xl` from Task 2; `scanRetired` from Task 1.
- Produces: `Button` and `Field` size options now read `sm: rounded-md`, `md: rounded-lg`, `lg: rounded-xl`. Task 4 edits the same two `variants()` blocks for border, so expect an adjacent diff.

- [ ] **Step 1: Write the failing scan test**

Add to `packages/web/ui/src/tokens/vocabulary.test.ts`, inside `describe('scanRetired')`:

```ts
it('has no retired radius form left in @tickets/ui or the playground', () => {
  const packagesOnly = scanRetired('radius').filter((h) => h.startsWith('packages/'));
  expect(packagesOnly).toEqual([]);
});
```

Also update the existing `reads the in-scope trees and returns locatable hits` case — after this task its hits come only from `apps/web`, which is still true, so it needs no change. Leave it.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui test vocabulary`
Expected: FAIL, listing roughly 14 hits — `button.tsx`, `field.ts`, `checkbox.tsx`, `tabs.tsx`, `date-picker.tsx`, the two demos, the playground sidebar, and the four test files.

- [ ] **Step 3: Sweep the components**

`button.tsx` — replace the size block and correct the stale comment (`rounded-md` is 6px today; the 5px it names was the retired `--radius-ctrl`):

```ts
    // NOTE: font-size utilities here use arbitrary lengths (text-12/text-13)
    // rather than the semantic `text-13/19`/`text-12/17` tokens on purpose. tailwind-merge
    // does not know those custom named sizes are font-sizes, so it groups them with
    // `text-{color}` utilities and silently drops the color (e.g. text-indigo-contrast).
    // Arbitrary lengths are classified as font-size, so the variant color survives.
    // Radius is per-size: the design's 6 / 8 / 10 px, snapped to the scale's
    // md / lg / xl. Only `lg` moves — 10px was never a rung.
    size: {
      default: 'md',
      options: {
        sm: 'h-7 px-2.5 rounded-md text-12',
        md: 'h-9 px-3.5 rounded-lg text-13',
        lg: 'h-11 px-[18px] rounded-xl text-14',
      },
    },
```

`field.ts` — same three rungs:

```ts
      options: {
        sm: 'h-7 rounded-md',
        md: 'h-9 rounded-lg',
        lg: 'h-11 rounded-xl',
      },
```

Then the single-site replacements:

| File:line | From | To |
|---|---|---|
| `checkbox.tsx:51` | `rounded-[4px]` | `rounded-sm` |
| `tabs.tsx:40` | `rounded-[7px]` | `rounded-lg` |
| `date-picker.tsx:118` | `rounded-[10px]` | `rounded-xl` |
| `dialog-footer.demo.tsx:10,21` | `rounded-[8px]` | `rounded-lg` |
| `screen-state.demo.tsx:20` | `rounded-[8px]` | `rounded-lg` |
| `sidebar.tsx:137` | `rounded-xs` | `rounded-sm` |

Leave `checkbox.tsx`'s `border-[1.5px]` alone — Task 5 owns it.

- [ ] **Step 4: Update the component tests**

`button.test.tsx`: `rounded-[6px]` → `rounded-md` (line 33), `rounded-[8px]` → `rounded-lg` (line 35), `rounded-[10px]` → `rounded-xl` (line 40).
`field.test.tsx`: same three substitutions on lines 57, 59, 61.
`input.test.tsx`: `rounded-[8px]` → `rounded-lg` (line 10), `rounded-[6px]` → `rounded-md` (line 20).

- [ ] **Step 5: Rebuild the safelist**

Run: `pnpm --filter @tickets/ui tokens:build`
Expected: `src/tokens/safelist.generated.css` loses its `rounded-[6px]`, `rounded-[7px]`, `rounded-[8px]` and `rounded-[10px]` entries. Commit the regenerated file.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @tickets/ui test`
Expected: PASS, including the new scan assertion.

- [ ] **Step 7: Commit**

```bash
git add packages/web/ui/src packages/web/playground/src
git commit -m "feat(ui)!: radius on the four-rung scale in @tickets/ui"
```

---

### Task 4: Sweep radius in `apps/web`

The bulk: ~130 sites across 14 distinct arbitrary values.

**Files:**
- Modify: every `.tsx`/`.ts` under `apps/web/src` containing `rounded-[` or `rounded-xs` (~60 files; `git grep -l` enumerates them)
- Test: `packages/web/ui/src/tokens/vocabulary.test.ts`

**Interfaces:**
- Consumes: `--radius-sm/md/lg/xl` from Task 2.
- Produces: no exported API; the deliverable is a clean `scanRetired('radius')`.

- [ ] **Step 1: Write the failing scan test**

In `packages/web/ui/src/tokens/vocabulary.test.ts`, replace the two radius cases from Tasks 1 and 3 with the whole-tree claim:

```ts
it('has no retired radius form anywhere in scope', () => {
  expect(scanRetired('radius')).toEqual([]);
});
```

Delete the now-subsumed `reads the in-scope trees and returns locatable hits` case and the `packagesOnly` case, and replace the scanner-is-wired check with one that cannot go stale as families are swept:

```ts
it('walks real files rather than an empty tree', () => {
  // `border` is not swept until Task 6, so this is a live tree with hits in it.
  expect(scanRetired('border').length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui test vocabulary`
Expected: FAIL, listing ~130 `apps/web/src/...` hits.

- [ ] **Step 3: Apply the mechanical substitutions**

Work file by file from the failing list. Apply the rounding rule exactly:

| From | To |
|---|---|
| `rounded-xs`, `rounded-[1px]`, `rounded-[1.5px]`, `rounded-[2px]`, `rounded-[3px]`, `rounded-[3.5px]`, `rounded-[4px]` | `rounded-sm` |
| `rounded-[5px]`, `rounded-[6px]` | `rounded-md` |
| `rounded-[7px]`, `rounded-[8px]`, `rounded-[9px]` | `rounded-lg` |
| `rounded-[10px]`, `rounded-[11px]`, `rounded-[12px]` | `rounded-xl` |

Side-specific forms follow the same mapping: `rounded-t-[12px]` → `rounded-t-xl`, `rounded-b-[8px]` → `rounded-b-lg`, `rounded-t-[2px]` → `rounded-t-sm`.

- [ ] **Step 4: Make the five hairline judgment calls by hand**

These are **not** mechanical. A 4px radius on a 3px-wide bar is a circle, so each needs a deliberate choice rather than the table above. Open each, look at the element's actual size, and pick:

| File:line | Element | Decision |
|---|---|---|
| `apps/web/src/components/signals/level-dot.tsx:11` | `rounded-[1px]` on a severity dot | `rounded-full` if the element is square and ≤6px, else `rounded-sm` |
| `apps/web/src/components/signals/sparkline.tsx:45` | `rounded-[1px]` on 3px-wide bars | `rounded-full` — a 4px corner on a 3px bar overflows the bar |
| `apps/web/src/components/signals/stack-trace.tsx:153` | `rounded-[1px]` on a frame marker | match `level-dot`'s decision |
| `apps/web/src/components/shell/activity-rail.tsx:22`, `app-shell.tsx:55` | `rounded-[2px]` on a rail indicator | `rounded-sm` if ≥8px on its short axis, else `rounded-full` |
| `apps/web/src/components/terminal/directory-picker.tsx:10`, `apps/web/src/ui/directory-tree.tsx:61` | `rounded-[2px]` on tree rows | `rounded-sm` — these are full-width rows, not marks |

Record the reasoning for any `rounded-full` choice in a short comment at the site, so the next reader does not "fix" it back onto the scale.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @tickets/ui test vocabulary && pnpm --filter @tickets/web test`
Expected: PASS both.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src packages/web/ui/src/tokens/vocabulary.test.ts
git commit -m "feat(ui)!: radius on the four-rung scale across apps/web"
```

---

### Task 5: Collapse 1.5px onto `border-2`

**Files:**
- Modify: `packages/web/ui/scripts/build-tokens.mjs:220`
- Modify: `packages/web/ui/src/components/pill/pill.tsx:42`
- Modify: `packages/web/ui/src/components/tabs/tabs.tsx:37`
- Modify: `packages/web/ui/src/components/copy-button/copy-button.tsx:50`
- Modify: `packages/web/ui/src/components/checkbox/checkbox.tsx:51`
- Modify: the remaining `border-[1.5px]` sites under `apps/web/src` (`git grep -n 'border-\[1\.5px\]'` enumerates them)
- Modify: `packages/web/ui/src/tokens/tokens.css:56-60` (delete `--border-thin`, `--border-thick`)
- Test: `packages/web/ui/src/style/tones/tones.test.ts:36,61,77`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: every tone's `outline` emphasis string now begins `border-2 border-<scale>-<step>`. `tones.generated.ts` regenerates; `TONES` keeps its `Record<Tone, Record<ToneEmphasis, string>>` shape.

**Note:** this is a deliberate deviation from `design-system.html`, which specifies `border:1.5px` in 30 rules. Approved in the spec. Outline Buttons, Pills and Tabs get a visibly thicker edge — that is the intended outcome, not a regression to report.

- [ ] **Step 1: Write the failing test**

In `packages/web/ui/src/style/tones/tones.test.ts`, update the three assertions:

```ts
// line ~36
      'border-2 border-green-7 text-green-11',
// line ~61
      `border-2 border-green-${STEP.border} text-green-${STEP.text}`,
// line ~77 — the shape guard for every emitted class
      /^(bg-[a-z0-9-]+|text-[a-z0-9-]+|border-[a-z0-9-]+|border-2)$/;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui test tones`
Expected: FAIL — received `border-(length:--border-thick) border-green-7 text-green-11`.

- [ ] **Step 3: Change the generator**

In `packages/web/ui/scripts/build-tokens.mjs` line 220, replace `border-(length:--border-thick)` with `border-2`:

```js
        `    outline: 'border-2 border-${scale}-${outline.border} text-${scale}-${outline.text}',\n` +
```

- [ ] **Step 4: Regenerate and check**

Run: `pnpm --filter @tickets/ui tokens:build`
Expected: `src/style/tones/tones.generated.ts` shows `border-2` on all 14 tones; `safelist.generated.css` updates accordingly.

Run: `pnpm --filter @tickets/ui test tones`
Expected: PASS.

- [ ] **Step 5: Sweep the hand-written 1.5px sites**

| File:line | From | To |
|---|---|---|
| `pill.tsx:42` | `border-(length:--border-thick)` | `border-2` |
| `tabs.tsx:37` | `border-b-(length:--border-thick)` | `border-b-2` |
| `copy-button.tsx:50` | `border-(length:--border-thick)` | `border-2` |
| `checkbox.tsx:51` | `border-[1.5px]` | `border-2` |
| each `apps/web/src` hit | `border-[1.5px]` | `border-2` |

- [ ] **Step 6: Delete the tokens**

In `packages/web/ui/src/tokens/tokens.css`, delete `--border-thin: 1px;` and `--border-thick: 1.5px;` and rewrite the comment above them so it describes only what remains:

```css
  /* Structural token, consumed as ring-(length:--ring-focus). Border widths
     are integers now — `border-1` / `border-2` state their own value, so the
     thin/thick names bought nothing but a lookup. */
  --ring-focus: 3px;
```

(Task 7 deletes `--ring-focus` and this comment with it.)

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/web test`
Expected: PASS both.

- [ ] **Step 8: Commit**

```bash
git add packages/web/ui apps/web/src
git commit -m "refactor(ui)!: 1.5px edges collapse onto border-2"
```

---

### Task 6: Retire bare `border`

The largest mechanical sweep — ~273 bare `border` plus ~112 bare `border-b/t/l/r`.

**Files:**
- Modify: every `.tsx`/`.ts` under `packages/web/ui/src`, `packages/web/playground/src`, `apps/web/src` using a bare width utility
- Test: `packages/web/ui/src/tokens/vocabulary.test.ts`

**Interfaces:**
- Consumes: `scanRetired` from Task 1.
- Produces: no exported API.

- [ ] **Step 1: Write the failing scan test**

In `packages/web/ui/src/tokens/vocabulary.test.ts`, replace the `walks real files rather than an empty tree` case (added in Task 4) with:

```ts
it('has no bare border width utility left in scope', () => {
  expect(scanRetired('border')).toEqual([]);
});

it('walks real files rather than an empty tree', () => {
  // `ring` is not swept until Task 7, so this is a live tree with hits in it.
  expect(scanRetired('ring').length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui test vocabulary`
Expected: FAIL with ~385 hits.

- [ ] **Step 3: Sweep**

`border` → `border-1`, `border-b` → `border-b-1`, `border-t` → `border-t-1`, `border-l` → `border-l-1`, `border-r` → `border-r-1`.

Two traps:
- **Only bare forms.** `border-gray-6`, `border-transparent`, `border-dashed`, `border-0`, `border-2` are untouched. `'border border-gray-6'` becomes `'border-1 border-gray-6'` — one substitution, not two.
- **Boundaries matter.** Substitute on the whole word inside a class string. A blind find-replace of `border` corrupts every colour utility in the tree; work from the scanner's `path:line` list.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/ui test vocabulary`
Expected: PASS.

- [ ] **Step 5: Run the full suites and typecheck**

Run: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/web test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Rebuild tokens and confirm no drift**

Run: `pnpm --filter @tickets/ui tokens:verify`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web apps/web/src
git commit -m "refactor(ui)!: border widths as integers, bare border retired"
```

---

### Task 7: `ring-3`, and delete the z / duration / breakpoint tokens

Four families at once because each is a handful of lines with zero or near-zero call sites, and no reviewer would accept one while rejecting another.

**Files:**
- Modify: `packages/web/ui/src/tokens/tokens.css` — delete `--ring-focus` (line ~60), the `--z-sticky/scrim/overlay` block (lines ~61-65), the `--duration-fast/base/slow` lines (~699-701), the `--breakpoint-narrow/wide` lines (~705-706)
- Modify: the 20 `ring-[3px]` sites and 2 `ring-(length:--ring-focus)` sites (`git grep -n 'ring-\[3px\]\|ring-(length:--ring-focus)'`)
- Modify: `packages/web/playground/src/shell/sidebar/sidebar.tsx:112` (`z-30` → `z-40`)
- Test: `packages/web/ui/src/tokens/vocabulary.test.ts`, `packages/web/ui/src/foundation/spec.test.ts:80-82`

**Interfaces:**
- Consumes: `scanRetired` from Task 1.
- Produces: `ring-3` as the focus-ring width everywhere. `liveTokens(/^(border|ring|z|duration|breakpoint)-/)` returns `[]`, which Task 8's `drift()` narrowing depends on.

- [ ] **Step 1: Write the failing tests**

In `packages/web/ui/src/tokens/vocabulary.test.ts`, replace the `walks real files rather than an empty tree` case with the last two family claims:

```ts
it('has no retired ring form left in scope', () => {
  expect(scanRetired('ring')).toEqual([]);
});

it('has no off-ladder z-index left in scope', () => {
  expect(scanRetired('z')).toEqual([]);
});
```

In `packages/web/ui/src/foundation/spec.test.ts`, add:

```ts
describe('the un-tokenized families', () => {
  it('declares no border, ring, z, duration or breakpoint token', () => {
    // Tailwind's bare-value utilities already state these — `border-1` is 1px,
    // `z-10` is 10, `duration-200` is 200ms. A token would be a second place
    // for the value to live, which is the only way it could disagree.
    expect(liveTokens(/^(border|ring|z|duration|breakpoint)-/)).toEqual([]);
  });

  it('keeps the easings, which have no numeric form', () => {
    expect(liveTokens(/^ease-/).map((t) => t.name).sort()).toEqual(['ease-in-out', 'ease-out']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/ui test vocabulary spec.test`
Expected: FAIL — 22 ring hits, 1 z hit, and `liveTokens` returning the 11 tokens still declared.

- [ ] **Step 3: Sweep the call sites**

`ring-[3px]` → `ring-3` at all 20 sites (including `button.test.tsx:48`). `ring-(length:--ring-focus)` → `ring-3` at both sites, one of which is `foundation/layout/layout.demo.tsx:54` — Task 9 rewrites that page, but leave it compiling now. `sidebar.tsx:112`: `z-30` → `z-40` (it is a dialog scrim, which is what rung 40 is for).

- [ ] **Step 4: Delete the tokens**

In `tokens.css`, delete the whole `:root` structural block introduced in Task 5 Step 6 — the comment, `--ring-focus`, and the `--z-*` comment and its three lines — so `:root, [data-theme='light'] {` is followed directly by the `/* tokens:light — generated, do not edit */` marker. Then delete the four `@theme inline` lines:

```css
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 320ms;
  --breakpoint-narrow: 1024px;
  --breakpoint-wide: 1536px;
```

Keep `--ease-out` and `--ease-in-out`, and rewrite the motion comment above them:

```css
  /* Motion (next/motion.tokens.json). Durations are written as numbers at the
     call site — `duration-200` is 200ms, and a token could only restate it.
     The curves stay named: `cubic-bezier(.2, 0, 0, 1)` has no number that
     means anything to a reader. */
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

- [ ] **Step 5: Retire the drift assertion this task invalidates**

`spec.test.ts:140` currently asserts `byFamily.duration?.every((r) => r.status === 'matched')`. Deleting `--duration-*` makes every proposed duration `added` instead, so that line goes red. Delete just this line — Task 8 rewrites the whole block:

```ts
    // (deleted here, restored in narrowed form by Task 8)
    expect(byFamily.duration?.every((r) => r.status === 'matched')).toBe(true);
```

Leave lines 141-142 (`ease`, `animate`) — both families keep their tokens.

`spec.test.ts:78-82` asserts `DURATIONS`/`BORDERS`/`LAYERS`/`BREAKPOINTS` lengths. Those read `next/*.tokens.json`, which Task 8 rekeys — the counts are unchanged by *this* task (3 / 2 / 3 / 2), so those lines still pass. Confirm rather than edit.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/web test`
Expected: PASS. Note `foundation/layout/layout.demo.tsx` still renders a `DriftView` for `border`/`ring`/`z`/`breakpoint`, which now shows every rung as `added`. The suite is green; the page is temporarily wrong until Tasks 8 and 9. That is the intended seam.

- [ ] **Step 7: Verify the pipeline**

Run: `pnpm --filter @tickets/ui tokens:verify`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/web apps/web/src
git commit -m "chore(ui): ring-3, and z/duration/breakpoints go Tailwind-native"
```

---

### Task 8: Rekey the token files and narrow the drift view

**Files:**
- Modify: `packages/web/ui/src/tokens/next/radius.tokens.json`
- Modify: `packages/web/ui/src/tokens/next/layout.tokens.json`
- Modify: `packages/web/ui/src/tokens/next/motion.tokens.json`
- Modify: `packages/web/ui/src/foundation/spec.ts:190-227`
- Test: `packages/web/ui/src/foundation/spec.test.ts:75-83,122-159`

**Interfaces:**
- Consumes: the token-free `tokens.css` from Task 7.
- Produces: `RADII` entries named `radius-sm|md|lg|xl`; `BORDERS` named `border-1|2`; `RINGS` named `ring-3`; `LAYERS` named `z-10|40|50`; `DURATIONS` named `duration-120|200|320`; `BREAKPOINTS` named `breakpoint-sm|md|lg|xl|2xl`. `drift()` returns only the seven tokenized families. Task 9's demos read these names.

- [ ] **Step 1: Write the failing test**

Replace the `drift` describe block's first case in `packages/web/ui/src/foundation/spec.test.ts` and extend the family-size case:

```ts
  it('exposes each remaining family at its documented size', () => {
    expect(RADII.map((r) => r.name)).toEqual(['radius-sm', 'radius-md', 'radius-lg', 'radius-xl']);
    expect(FONT_WEIGHTS.map((w) => w.value)).toEqual(['400', '500', '600']);
    expect(DURATIONS.map((d) => d.name)).toEqual(['duration-120', 'duration-200', 'duration-320']);
    expect(EASINGS).toHaveLength(2);
    expect(BORDERS.map((b) => b.name)).toEqual(['border-1', 'border-2']);
    expect(RINGS.map((r) => r.name)).toEqual(['ring-3']);
    expect(LAYERS.map((l) => l.name)).toEqual(['z-10', 'z-40', 'z-50']);
    expect(BREAKPOINTS.map((b) => b.value)).toEqual(['640px', '768px', '1024px', '1280px', '1536px']);
  });
```

```ts
describe('drift', () => {
  it('covers only the families that are actually tokenized', () => {
    // Border, ring, z, duration and breakpoint are Tailwind-native now: the
    // value lives at the call site and nowhere else. Drift measures the gap
    // between two copies of a value, so a family with one copy has none to
    // measure, and listing it would report every rung as `dropped` forever.
    expect(drift().map((f) => f.family)).toEqual([
      'text',
      'radius',
      'shadow',
      'font',
      'font-weight',
      'ease',
      'animate',
    ]);
  });

  it('pins what the proposal actually costs the live sheet', () => {
    const byFamily = Object.fromEntries(drift().map((f) => [f.family, f.rows]));
    expect(byFamily.text?.filter((r) => r.status === 'added')).toEqual([]);
    // Radius is migrated: the four rungs resolve to Tailwind's own sm/md/lg/xl,
    // which are exactly 4/6/8/12px. Nothing of ours is left to drop.
    expect(byFamily.radius?.filter((r) => r.status !== 'matched')).toEqual([]);
    expect(byFamily.shadow?.filter((r) => r.status !== 'matched')).toEqual([]);
    expect(byFamily.ease?.every((r) => r.status === 'matched')).toBe(true);
    expect(byFamily.animate?.every((r) => r.status === 'matched')).toBe(true);
  });
```

Keep the existing `reports nothing dropped anywhere` and `summarises to counts a page can lead with` cases as they are.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui test spec.test`
Expected: FAIL — `RADII` names are `radius-1..4`, and `drift()` still lists twelve families.

- [ ] **Step 3: Rekey `radius.tokens.json`**

```json
{
  "radius": {
    "sm": { "$type": "dimension", "$value": "4px" },
    "md": { "$type": "dimension", "$value": "6px" },
    "lg": { "$type": "dimension", "$value": "8px" },
    "xl": { "$type": "dimension", "$value": "12px" }
  }
}
```

- [ ] **Step 4: Rekey `layout.tokens.json`**

```json
{
  "border": {
    "1": { "$type": "dimension", "$value": "1px" },
    "2": { "$type": "dimension", "$value": "2px" }
  },
  "ring": {
    "3": { "$type": "dimension", "$value": "3px" }
  },
  "z": {
    "10": { "$type": "number", "$value": "10" },
    "40": { "$type": "number", "$value": "40" },
    "50": { "$type": "number", "$value": "50" }
  },
  "breakpoint": {
    "sm": { "$type": "dimension", "$value": "640px" },
    "md": { "$type": "dimension", "$value": "768px" },
    "lg": { "$type": "dimension", "$value": "1024px" },
    "xl": { "$type": "dimension", "$value": "1280px" },
    "2xl": { "$type": "dimension", "$value": "1536px" }
  }
}
```

- [ ] **Step 5: Rekey the durations in `motion.tokens.json`**

Replace the `duration` group only; leave `ease` and `animate` untouched:

```json
  "duration": {
    "120": { "$type": "duration", "$value": "120ms" },
    "200": { "$type": "duration", "$value": "200ms" },
    "320": { "$type": "duration", "$value": "320ms" }
  },
```

- [ ] **Step 6: Narrow `drift()`**

**Already partly done.** Task 2 narrowed the radius matcher from `/^radius-[a-z]+$/` to `/^radius-(sm|md|lg|xl)$/`, because the four `--radius-*: initial` declarations otherwise read as live tokens with an unmatchable value and reported the scale as drifting from itself. Keep that line as you find it; your job here is the *family list*, not the radius regex.

In `packages/web/ui/src/foundation/spec.ts`, replace the whole `drift()` body (lines ~190-227) with the tokenized families only, and add the exported note the demos render for the rest:

```ts
/**
 * Drift compares two copies of a value — the sheet's and the spec's — so it
 * only means something for families that HAVE two copies. Border, ring, z,
 * duration and breakpoint are Tailwind-native: `border-1` is 1px because the
 * class says so, and `next/layout.tokens.json` records which rungs are
 * sanctioned, not what they resolve to. Listing them here would report every
 * rung as `dropped` in perpetuity.
 */
export function drift(): DriftFamily[] {
  return [
    // `[a-z0-9]`, not `[a-z]`: the sizes are numeric now, and a letters-only
    // pattern made every new rung invisible to drift.
    { family: 'text', rows: driftFor('text', TEXT_SIZES, liveTokens(/^text-[a-z0-9]+$/)) },
    { family: 'radius', rows: driftFor('radius', RADII, liveTokens(/^radius-(sm|md|lg|xl)$/)) },
    {
      family: 'shadow',
      rows: driftFor(
        'shadow',
        SHADOWS.map((s) => ({ name: s.name, value: s.light })),
        liveTokens(/^shadow-[a-z]+$/),
      ),
    },
    { family: 'font', rows: driftFor('font', FONT_FAMILIES, liveTokens(/^font-(sans|mono)$/)) },
    {
      family: 'font-weight',
      rows: driftFor('font-weight', FONT_WEIGHTS, liveTokens(/^font-weight-/)),
      note: 'Tailwind ships font-weight utilities without our declaring them; these name the three the design actually uses.',
    },
    { family: 'ease', rows: driftFor('ease', EASINGS, liveTokens(/^ease-/)) },
    { family: 'animate', rows: driftFor('animate', ANIMATIONS, liveTokens(/^animate-/)) },
  ];
}

/** Families that ship no token, and why — rendered where a drift table would be. */
export const NATIVE_FAMILIES: Record<string, string> = {
  border: 'border-1 / border-2 — the class states the width; a token would be a second copy of it.',
  ring: 'ring-3 — same rule as border.',
  z: 'z-10 / z-40 / z-50 — the class IS the layer number.',
  duration: 'duration-120 / duration-200 / duration-320 — the class IS the millisecond count.',
  breakpoint: "Tailwind's standard sm/md/lg/xl/2xl, unmodified.",
};
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @tickets/ui test spec.test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/web/ui/src/tokens/next packages/web/ui/src/foundation/spec.ts packages/web/ui/src/foundation/spec.test.ts
git commit -m "refactor(ui): token files record the sanctioned rungs, drift narrows to tokenized families"
```

---

### Task 9: The gallery Foundation pages

**Files:**
- Modify: `packages/web/ui/src/foundation/radius/radius.demo.tsx`
- Modify: `packages/web/ui/src/foundation/layout/layout.demo.tsx`
- Modify: `packages/web/ui/src/foundation/motion/motion.demo.tsx`
- Modify: `packages/web/ui/src/foundation/view.tsx` (add `NativeNote`)

**Interfaces:**
- Consumes: `RADII`, `BORDERS`, `RINGS`, `LAYERS`, `BREAKPOINTS`, `DURATIONS`, `NATIVE_FAMILIES` from Task 8; `Sheet`, `SpecRow`, `SpecHeader`, `DriftView` from `view.tsx`.
- Produces: `NativeNote({ family }: { family: string })` exported from `view.tsx`.

**Definition of done — this task starts with a RED suite, and closing it is the point.**
The concurrent items-core-port session added `packages/web/ui/src/gallery/demos.smoke.test.tsx` (in `badaa6f`) after this plan was written. It renders every state of every demo, which turns the Task 8→9 seam from a cosmetic wrongness into two hard test failures:

| Failing test | Throwing lookup | Why |
|---|---|---|
| `radius renders every state` | `radius.demo.tsx` — `RADII.find((r) => r.name === 'radius-1')!.value` | keys are `radius-sm/md/lg/xl` now |
| `layout renders every state` | `layout.demo.tsx` — `RINGS.find((r) => r.name === 'ring-focus')!` | the token is `ring-3` now |

Both are non-null-asserted `.find()` calls, so a missed rename throws rather than rendering wrong. `RADIUS_JOBS`/`LAYER_JOBS`/`BORDER_JOBS` keys and the `radius('radius-1')`-style helper calls must all move to the new names. `pnpm --filter @tickets/ui test demos.smoke` going green is this task's gate, alongside the full suite.

- [ ] **Step 1: Add `NativeNote` to `view.tsx`**

Extend the existing import on line 4 — do not add a second import line from the same module:

```tsx
import { NATIVE_FAMILIES, drift, driftSummary, type DriftStatus } from './spec';
```

Then append, next to the existing `DriftView` export:

```tsx
/** Stands where a drift table would, for a family that ships no token. */
export function NativeNote({ family }: { family: string }) {
  return (
    <Sheet>
      <p className="font-sans text-13/19 text-gray-11">
        <span className="font-mono text-12/17 text-gray-12">{family}</span> is Tailwind-native — no
        token. {NATIVE_FAMILIES[family]}
      </p>
      <p className="mt-2 font-sans text-12/17 text-gray-9">
        There is no drift to measure: the value exists once, at the call site.
      </p>
    </Sheet>
  );
}
```

- [ ] **Step 2: Rekey and re-specimen `radius.demo.tsx`**

Rekey `RADIUS_JOBS`, and — the point of the change — render the rungs as the classes a component would write, rather than as a JS-computed inline style:

```tsx
const RADIUS_JOBS: Record<string, string> = {
  'radius-sm': 'chips, tags, inline marks',
  'radius-md': 'buttons, inputs, controls',
  'radius-lg': 'cards, list rows, popovers',
  'radius-xl': 'panels, dialogs, sheets',
};

/** The rung's utility class. The specimen must demonstrate the class, not a
 *  number that happens to equal it — otherwise the page can be right while the
 *  scale is broken. */
const RADIUS_CLASS: Record<string, string> = {
  'radius-sm': 'rounded-sm',
  'radius-md': 'rounded-md',
  'radius-lg': 'rounded-lg',
  'radius-xl': 'rounded-xl',
};
```

In `Scale`, replace `style={{ borderRadius: radius.value }}` on the in-place specimen with `RADIUS_CLASS[radius.name]` appended to its `className`. Keep the 4×-magnified corner's inline `style={{ borderTopLeftRadius: \`calc(${radius.value} * 4)\` }}` — a deliberate magnification has no class form.

In `InUse`, delete the `radius()` helper and put the class on each specimen: chip `rounded-sm`, control `rounded-md`, card `rounded-lg`, panel `rounded-xl`. Update the four mono labels from `radius-1 · chip` to `rounded-sm · chip`, and so on.

- [ ] **Step 3: Rekey `layout.demo.tsx`**

```tsx
const BORDER_JOBS: Record<string, string> = {
  'border-1': 'dividers, table rules',
  'border-2': 'inputs, cards — edges you act on',
};

const LAYER_JOBS: Record<string, string> = {
  'z-10': 'pinned headers, toolbars',
  'z-40': 'the dim behind a dialog',
  'z-50': 'dialogs, menus, toasts',
};

const BORDER_CLASS: Record<string, string> = { 'border-1': 'border-1', 'border-2': 'border-2' };
```

In `Edges`, replace `style={{ borderStyle: 'solid', borderWidth: border.value }}` with `border-solid` plus `BORDER_CLASS[border.name]` in the `className`. The bare rule specimen below it measures a width rather than drawing a border, so its `style={{ height: border.value }}` stays. Change the focus-ring row's `ring.name` lookup from `'ring-focus'` to `'ring-3'` and its button's `focus-visible:ring-(length:--ring-focus)` to `focus-visible:ring-3`.

All four of this page's families are native now, so the `Drift` state has nothing left to measure. Replace it in the `states` array at the bottom of the file:

```tsx
export const states = [
  { name: 'Borders & focus', render: () => <Edges /> },
  { name: 'Layers', render: () => <Layers /> },
  { name: 'Breakpoints', render: () => <Breakpoints /> },
  {
    name: 'Native',
    render: () => (
      <>
        <NativeNote family="border" />
        <NativeNote family="ring" />
        <NativeNote family="z" />
        <NativeNote family="breakpoint" />
      </>
    ),
  },
];
```

Update the file's imports: drop `DriftView`, add `NativeNote`.

- [ ] **Step 4: Rekey `motion.demo.tsx`**

```tsx
const DURATION_JOBS: Record<string, string> = {
  'duration-120': 'hover, press — feedback',
  'duration-200': 'open, close — transitions',
  'duration-320': 'enter, layout — arrivals',
};
```

Duration is native now but `ease` and `animate` are still tokenized, so this page keeps a drift table and loses one family from it. Append the note to the `Durations` state — where a reader asks the question — and narrow the `Drift` state:

```tsx
export const states = [
  {
    name: 'Durations',
    render: () => (
      <>
        <Durations />
        <NativeNote family="duration" />
      </>
    ),
  },
  { name: 'Easings', render: () => <Easings /> },
  { name: 'Animations', render: () => <Animations /> },
  { name: 'Drift', render: () => <DriftView families={['ease', 'animate']} /> },
];
```

Add `NativeNote` to the file's `view` import, alongside the `DriftView` it keeps.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @tickets/ui test`
Expected: PASS. `collect-demos.test.ts` walks every `*.demo.tsx` and will fail if a `meta` or `states` export was disturbed.

- [ ] **Step 6: Look at the pages**

Start the stack per the `running-the-stack` skill (`docker compose up -d`, then `WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev`) and open `http://localhost:4620/gallery`. Check Foundation → Radius, Layout, Motion: four radius rungs rendering from classes, `border-1`/`border-2` rules, a `ring-3` focus ring that appears on keyboard focus, and the native-family notes where drift tables used to be. Measure a rendered corner against 4/6/8/12 in devtools rather than judging it by eye.

- [ ] **Step 7: Commit**

```bash
git add packages/web/ui/src/foundation
git commit -m "docs(ui): foundation pages render the rungs as classes"
```

---

### Task 10: The written token tables

**Files:**
- Modify: `docs/design/foundation-tokens.md:242-247` (Radius) and its Border/focus, z-index, motion and breakpoint tables
- Modify: `docs/design/token-index.md:194-197` and the same families
- Modify: `.claude/skills/design-system-adapter.md` (knownTraps)

**Interfaces:**
- Consumes: the final vocabulary. Produces: nothing code-facing.

- [ ] **Step 1: Rewrite the Radius section of `foundation-tokens.md`**

```markdown
## Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | Chips, tags, inline marks |
| `--radius-md` | 6px | Buttons, inputs, controls |
| `--radius-lg` | 8px | Cards, list rows, popovers |
| `--radius-xl` | 12px | Panels, dialogs, sheets |

The values are Tailwind's own `sm`/`md`/`lg`/`xl`, so `rounded-md` means what it
has always meant. `--radius-xs/2xl/3xl/4xl: initial` removes the rest, so an
off-scale corner fails to compile. **`rounded-full` is retained** — Tailwind
hardcodes it to `calc(infinity * 1px)` rather than reading a token, and a pill is
not a step on the scale. Bare `rounded` is likewise static (0.25rem) and cannot be
cleared; `vocabulary.test.ts` is what keeps it out of the tree.
```

- [ ] **Step 2: Replace the border/focus table with the native families**

```markdown
## Border, ring, z-index, duration — Tailwind-native

These ship no tokens. The class states the value, so a token would be a second
copy of it — the only way the two could ever disagree.

| Class | Value | Use |
|---|---|---|
| `border-1` | 1px | Dividers, table rules |
| `border-2` | 2px | Inputs, cards, outline controls |
| `ring-3` | 3px | The focus-visible ring, every control |
| `z-10` | 10 | Pinned headers, toolbars |
| `z-40` | 40 | The scrim behind a dialog |
| `z-50` | 50 | Dialogs, menus, toasts |
| `duration-120` | 120ms | Hover, press — feedback |
| `duration-200` | 200ms | Open, close — transitions |
| `duration-320` | 320ms | Enter, layout — arrivals |

Bare `border` and `border-b/t/l/r` are retired: a width utility states its width.
Tailwind cannot un-define them, so `packages/web/ui/src/tokens/vocabulary.test.ts`
is the gate.

Easings stay named — `--ease-out` and `--ease-in-out`. `cubic-bezier(.2, 0, 0, 1)`
has no number that means anything to a reader.

Breakpoints are Tailwind's standard `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 ·
`2xl` 1536. The former `narrow`/`wide` were exact duplicates of `lg` and `2xl`.

`design-system.html` specifies `border:1.5px` in 30 rules; the app uses `border-2`
instead — a deliberate deviation recorded in
`docs/superpowers/specs/2026-07-29-foundation-scale-vocabulary-design.md`.
```

- [ ] **Step 3: Mirror both sections into `token-index.md`**

Same tables, matching that file's existing heading style.

- [ ] **Step 4: Add the trap to the adapter**

Append to `knownTraps` in `.claude/skills/design-system-adapter.md`:

```markdown
5. **Bare `border` and bare `rounded` still compile.** Tailwind defines both as
   static utilities, so `--border-*`/`--radius-*: initial` cannot remove them.
   They are retired by convention; `packages/web/ui/src/tokens/vocabulary.test.ts`
   is the only thing stopping them coming back. A new component that writes
   `border` instead of `border-1` will render correctly and fail the suite.
```

- [ ] **Step 5: Check for stale references**

Run: `git grep -n 'radius-[1-4]\|border-thin\|border-thick\|ring-focus\|z-sticky\|z-scrim\|z-overlay\|duration-fast\|duration-base\|duration-slow\|breakpoint-narrow\|breakpoint-wide' -- docs .claude`
Expected: hits only inside `docs/superpowers/plans/` and `docs/superpowers/specs/`, which are dated historical records and stay as written.

- [ ] **Step 6: Final full verification**

```bash
pnpm --filter @tickets/ui tokens:verify
pnpm --filter @tickets/ui test
pnpm --filter @tickets/web test
pnpm typecheck
pnpm build
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/design .claude/skills/design-system-adapter.md
git commit -m "docs(ui): token tables on the foundation scale vocabulary"
```

---

## Deferred (explicitly not in this plan)

- Extending `scripts/scan-hardcoded-values.mjs` into a real lint gate. `vocabulary.test.ts` covers `.ts`/`.tsx` here; the ~16 literal `border-radius` declarations in `tokens.css`'s hand-written component CSS are untouched and would need migrating first.
- Aligning `apps/eer` to this vocabulary — its own `@theme`, its own pass.
- Re-exporting `design-system.html` from the Claude Design project so the 1.5px → 2px decision lives there too rather than only in the spec.
