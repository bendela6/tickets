# Spacing migration + worktree sync

**Status:** planned, not started. Blocked on a UI cleanup pass first (see "Before
we start").
**Written:** 2026-08-04, after the token-pipeline restructure landed on `main`
(`f6b07f9`..`8c86bf9`).

## Goal

Set `--spacing: 1px` so every number in a class name means pixels, matching the
vocabulary the type scale (`text-13`) and leading ladder (`leading-19`) already
use. Today `--spacing` is `.25rem`, so `p-4` is 16px — the one place where a
number in a class name is multiplied by four before it reaches the screen.

A side effect worth having: with `--spacing: 1px`, `leading-N` resolves to N px
through Tailwind's own fallback, so the 89-rung generated leading ladder becomes
redundant and can be deleted.

## Scope, measured

- **2,419** spacing-class usages across `packages/web/ui/src`,
  `packages/web/playground/src`, `apps/web/src`.
- **31** utility prefixes actually resolve through `var(--spacing)`. Extracted
  from the built bundle, not from memory:

  ```
  p px py pt pr pb pl  m mx my mt mr mb ml  -mx
  gap gap-x gap-y  w h size  min-w min-h max-w max-h
  top right bottom left  inset-x inset-y  translate-x  leading
  ```

- **86** distinct numeric values, range 0..245, of which 28 are fractional
  (`0.5`, `0.75`, `2.25`, `137.5`, …). **Every one survives ×4 as an integer** —
  verified. `px-2.25` → `px-9`, `min-h-137.5` → `min-h-550`.

### What must NOT be touched

Same-shaped classes on their own scales: `text-N` (our type scale), `z-N`,
`border-N`, `ring-N`, `duration-N`, `opacity-N`, `order-N`, `col-span-N`,
`grid-cols-N`, `basis-N`. Also non-numeric values on spacing prefixes:
`w-full`, `w-1/2`, `h-screen`, `max-w-md`, `top-1/2`, `inset-0`.

## Verification

The invariant: **every utility's resolved pixel value is unchanged.** The built
CSS bundle is the oracle. Two checks, together tight enough to trust.

**Check A — spacing rules map exactly.**
Build before; for every rule containing `var(--spacing)` record
`selector → property:N×4px`. Build after; record `selector → property:M×1px`.
Assert every before-`.X-N` has an after-`.X-{4N}` with identical resolved
pixels, and that nothing is left over on either side.

*Catches a missed usage:* an untouched `p-4` resolves to 4px afterwards instead
of 16px, so its entry will not match.

**Check B — everything else is byte-identical.**
Strip the spacing rules from both bundles and diff the remainder.

*Catches a wrong transform:* `z-10`→`z-40` or `text-13`→`text-52` shows up
immediately.

**Plus:** the codemod asserts `old × 4 === new` per replacement, and prints every
candidate it declined to touch, so near-misses (`w-full`, `max-w-md`, `top-1/2`)
are reviewable rather than silent.

## Worktree risk, measured

Three branches carry unmerged work. All worktrees were clean (0 uncommitted) at
the time of writing.

| branch | commits ahead | files changed | git-visible conflicts | silent breakage |
| --- | --- | --- | --- | --- |
| `icon-editor` | 41 | 116 | 12 | `packages/web/ui/src/components/slider/slider.tsx` |
| `feat/live-schema-introspection` | 54 | 377 | 11 | `apps/web/src/components/eer/view/top-bar/search-box.tsx` |
| `feat/ui-primitives-treeview` | 20 | 41 | 5 | — |

`sp4a-p2-admin` is 0 ahead — already merged, no action.

**The conflicts are not the danger; git flags those.** The danger is the last
column — files those branches changed that merge cleanly and then break:

- `slider.tsx` is a NEW component using `TONE_SCALE`. Nothing to conflict with,
  so it merges clean and fails to compile.
- `search-box.tsx` uses `shadow-modal`. Worse: it still **compiles**. The token
  no longer exists, so the search box silently loses its shadow with no error
  anywhere. This is the class of failure worth designing the process around.

## Steps

### Before we start — UI cleanup pass

Do not begin until the `@tickets/ui` package is clean. Running a 2,419-site
codemod on top of known-loose ends makes any bad outcome much harder to unpick.
See the companion cleanup list.

### 1. One idempotent migration script

Every rename from the 2026-08-04 session is mechanical, so a single script
covers all three branches and `apps/board`:

```
TONE_SCALE                    -> TONE_RAMP
shadow-raised/overlay/modal   -> shadow-xs/md/lg
animate-ai-spin/pulse         -> animate-spin/pulse
bg-folder / border-folder     -> bg-yellow-8 / border-yellow-8
tokens/next/*.json            -> tokens/*.json            (import paths)
src/tokens/tokens.css         -> styles/generated/*.css   (raw readers)
delete: vocabulary.ts, vocabulary.test.ts, scan-baseline.test.ts, *-baseline.json
```

Idempotent — re-running is a no-op. This turns each branch from a manual hunt
into a mechanical operation.

### 2. Spacing on `main` FIRST, before syncing branches

Syncing first means two migrations per branch, so two chances to break each one.
The spacing codemod is the riskiest step and should land on `main` where only
verified changes exist; branches then take one combined migration. They are
already 20–54 commits behind, and a little more staleness costs less than a
second migration.

### 3. Apply spacing to `main`

`--spacing: 1px` as a token (`tokens/spacing.tokens.json` →
`styles/generated/spacing.css`, matching the per-type layout), then the ×4
codemod, then Checks A and B. Delete the leading ladder once green.

### 4. Per branch, in its own worktree

Shortest first — `ui-primitives-treeview` (20), then `icon-editor` (41), then
`live-schema-introspection` (54) — so the process is proven on the small one.

```
merge main -> run migration -> typecheck + test + build -> commit as one labelled commit
```

### 5. Per-branch UI check

The same before/after bundle comparison works inside each worktree, and is what
catches the silent class: a `shadow-modal` that resolves to nothing shows up as
a missing declaration.

## Needs a human

- The **concurrent session** has `packages/web/ui/src/components/prose/`,
  `status-dot/`, `src/tokens/custom-properties.ts` and `apps/board/` in flight.
  `apps/board` is a whole new app that will need the migration too. Tell them
  before starting.
- The authors of `slider.tsx` and `search-box.tsx` should be told directly —
  those are the two the tooling cannot catch for them.

## Rejected alternatives

- **Leave `--spacing` at `.25rem` and fix leading another way.** A functional
  `@utility leading-*` compiles in Tailwind 4.3.2, but the `/N` modifier in
  `text-13/19` resolves against the `@theme` namespace, not against utilities —
  measured. A custom utility never enters that lookup, so `text-13/7` would keep
  falling through to spacing.
- **Sync branches before the spacing change.** Doubles the migration burden per
  branch for no gain; see step 2.
