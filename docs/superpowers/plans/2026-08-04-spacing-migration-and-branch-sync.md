# Spacing migration + worktree sync

**Status:** step 3 (spacing on `main`) is DONE — `bc8292f`. Steps 1, 4 and 5
(the migration script and the per-branch sync) remain.

**What actually happened in step 3**, beyond the plan below:

- The prefix list was derived from utility selectors in the built CSS, which
  cannot see anything reaching CSS only through `@apply`. Two things were missed
  and both were caught by Check A, not by review: `prose.css` was never walked at
  all (every `.rt` rule came out four times too tight), and bare `inset` was
  absent from the list. **Any future codemod of this shape must walk `.css` as
  well as `.ts`/`.tsx`.**
- `leading` needed a condition rather than a flat ×4: only values outside the
  old 8..96 ladder were spacing-derived. In practice one site, `leading-4`.
- The leading ladder is now deleted — at 1px the fallback produces what the
  ladder stated, for every integer rather than a fenced range.
- **The ROOT list was assumed, and two consumers were missed.** The codemod ran
  over `ui/src`, `playground/src` and `apps/web/src` — a list from memory. But
  `apps/board` and `packages/web/icon-studio` also `@import
  '@tickets/ui/tokens.css'`, so both inherited `--spacing: 1px` while their
  classes still meant quarter-rems. Everything in them rendered at a quarter
  size and still compiled; it surfaced only because a human looked at the board
  UI. **Derive the roots from who imports the stylesheet**, not from memory:

  ```
  grep -rn "@tickets/ui/tokens.css" --include=*.css .
  grep -rln '"@tickets/ui"' --include=package.json packages apps
  ```

- **The safelist has to be regenerated after the codemod, not before.** It is
  produced by executing the components, so a pre-codemod safelist lists
  `gap-1.5` while the `variants()` configs now emit `gap-6`. Interpolated
  classes are precisely the ones only the safelist can carry, so they render
  unstyled — and nothing fails.
- Final scope: 2,411 rewrites across 243 files, 56 in `prose.css`, and 190 more
  in the two missed consumers.

**A cheap repo-wide audit catches both classes of miss.** After a correct ×4
every value is an integer, because every rung on the old scale was a multiple of
0.25. So *any* surviving fractional spacing class anywhere is a miss:

```
grep -rE '\b(-)?(p|px|py|m|mx|gap|w|h|size|min-w|max-w|top|left|inset)-[0-9]+\.[0-9]+\b' \
  --include=*.ts --include=*.tsx --include=*.css . | grep -v node_modules
```
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

Every change from the 2026-08-04 session is mechanical, so a single script
covers all three branches and `apps/board`:

```
TONE_SCALE -> TONE_RAMP -> TONE_HUE   (renamed twice that day; land on TONE_HUE)
HUE_TONES / HueTone           -> HUES / Hue
ROLE_TONES / RoleTone         -> ROLES / Role
RAMPS                         -> PALETTE, and re-keyed by theme
shadow-raised/overlay/modal   -> shadow-xs/md/lg
animate-ai-spin/pulse         -> animate-spin/pulse
bg-folder / border-folder     -> bg-yellow-8 / border-yellow-8
runtimeStyle({...})           -> plain style objects
tokens/next/*.json            -> tokens/*.json            (import paths)
src/tokens/tokens.css         -> styles/generated/*.css   (raw readers)
src/style/tones/tones.generated.ts -> src/generated/colors.ts
EVERY spacing class            -> x4, in .ts/.tsx AND .css @apply
delete: vocabulary.ts, vocabulary.test.ts, scan-baseline.test.ts,
        *-baseline.json, scan-hardcoded-values.mjs, check-design-tokens.mjs,
        drift()/DriftView and its gallery tabs
```

Idempotent — re-running is a no-op. This turns each branch from a manual hunt
into a mechanical operation.

**The spacing ×4 is the dangerous half.** A missed class does not fail to
compile; it renders at a quarter size. Per branch:

1. derive the roots from the import graph (see the two greps above) — do not
   reuse this list, since a branch may add a consumer
2. run the ×4 over `.ts`, `.tsx` **and** `.css` (`@apply`)
3. regenerate the safelist AFTER, never before
4. run the fractional-class audit — it is one grep and catches both misses that
   happened on `main`
5. run Check A against that branch's own before/after bundle

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

**The migration splits in two, and the halves go on opposite sides of the
merge.** This was learned the hard way on `ui-primitives-treeview`; the order in
the original plan (`merge main -> run migration`) is wrong for spacing.

```
x4 the branch's OWN files  ->  merge main  ->  renames  ->  regenerate safelist
                                                        ->  typecheck + test + build
```

- **`x4` must run BEFORE the merge.** It is only sound on a tree where every
  file speaks one vocabulary, and a stale branch is uniformly pre-migration.
  After merging main the tree is a MIXTURE — main's files already scaled, the
  branch's not, hand-resolved files part each — and no blanket pass can tell the
  halves apart, so main's would silently go to 16×.
- **Scope it to the files the branch actually changed** (`git diff --name-only
  $(git merge-base HEAD main)..HEAD`). Scaling everything is worse than
  useless: for a file the branch never touched the merge already takes main's
  copy, so editing it here only converts a clean take into a conflict. Measured
  on `ui-primitives-treeview` — the unscoped pass raised conflicts from 15 to 33.
- **The renames go AFTER**, and are idempotent by construction: `TONE_SCALE`
  does not exist on main, so rewriting it is a no-op wherever main won.
- The payoff is not fewer conflicts — it was 15 either way. It is that **"take
  ours" becomes a correct resolution**: the branch side arrives already scaled,
  so what is left in each conflict is the genuine design difference with the
  mechanical noise stripped out.

**Free oracle for the x4:** for any file the branch never touched, both sides
started from identical bytes, so applying the same x4 must reproduce main's
version exactly. On `ui-primitives-treeview`, 170 of 257 such files matched
byte-for-byte; the remainder differed only where main did non-spacing work.

**Watch the lockfile.** Merging a branch that ran `pnpm install` collides with
any session holding `pnpm-lock.yaml` dirty. Back the file up, `git checkout --`
it, merge, then restore the backup — verify by md5 that the bytes came back.

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
