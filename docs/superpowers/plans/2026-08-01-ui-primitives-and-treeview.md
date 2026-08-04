# Shared Primitives + Generic TreeView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire five bespoke renderings in the eer module onto `@tickets/ui`, promote `Dot` into the library, and replace two independently-written tree implementations with one shared hook plus a slot shell.

**Architecture:** `Pill` gains a Pill-only `tint` variant and an `xs` size so the eer badges keep their colours on a shared scale. `Dot` moves as-is plus a `hollow` flag. A new `useTreeView` hook owns flattening, expansion, roving focus and keyboard navigation but never fetches; `<Tree>`/`<TreeRow>` own ARIA and indentation but render no opinionated content, so the directory picker and the schema outline keep their own row content in slots.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (preflight ON), vitest + @testing-library/react, pnpm + turbo monorepo.

**Spec:** `docs/superpowers/specs/2026-08-01-ui-primitives-and-treeview-design.md`

## Global Constraints

- **Gates after every task, all of them:** `pnpm typecheck` · `pnpm --filter @tickets/web test` · `pnpm --filter @tickets/ui test` · `pnpm verify:tokens`. A task is not done until all four are green. `pnpm build` additionally at Task 13.
- **`pnpm verify:tokens` regenerates `packages/web/ui/src/tokens/safelist.generated.css` and then runs `git diff --exit-code` on it.** Any change to a `variants()` call in `@tickets/ui` changes that file. Run the command, then **commit the regenerated file with your change**, or the gate fails.
- **`packages/web/ui` must stay domain-free.** `packages/web/ui/src/components/domain-free.test.ts` fails the build if a string literal in any component names a ticket-domain concept: `human`, `agent`, `ticket`, `epic`, `sprint`, `assignee`, `reporter`, `backlog`, `todo`, `blocked`, `triage`. The `entity`/`group`/`subgroup`/`edge` and `pk`/`fk` vocabularies stay in `apps/web`.
- **Tailwind class hygiene:** no arbitrary `[...]` values, no odd fractional spacing steps. Use round scale numbers, named utilities, or a real CSS class.
- **Never interpolate a token name into a class string at runtime.** Tailwind only emits a `@theme inline` variable for names it can SEE in scanned source. `` `bg-${hue}-9` `` built at runtime is a custom property nothing guarantees exists, and an undefined one invalidates the whole declaration. Inside `@tickets/ui` the sanctioned way is `over(SCALE, (tone) => …)` inside `variants()`, which enumerates every ramp at module scope.
- **Scope is exactly five call sites.** `Badge`, `RoleTag`, the `FieldRow` pk/fk badge, `Chip` (via `KindFilters`), and `Kbd`. The eer module also contains `Card` (the cardinality chip), `Section`, the `btn` class and the outline's raw filter `<input>`, which are ALSO duplicates of library primitives. **They are deliberately out of scope — do not migrate them.**
- **`Stat` stays in eer.** Do not move it.
- **The directory picker's existing tests are the regression net and must pass UNEDITED.** Three files, 13 tests: `apps/web/src/ui/use-directory-tree.test.ts`, `apps/web/src/ui/directory-tree.test.tsx`, `apps/web/src/components/terminal/directory-picker.test.tsx`. If one genuinely cannot pass, that is a finding to escalate, not a test to edit.
- **Commit per task**, conventional commits scoped by app: `feat(ui): …`, `refactor(web): …`.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `packages/web/ui/src/components/dot/dot.tsx` | The 8px runtime-coloured disc |
| `packages/web/ui/src/components/dot/dot.test.tsx` | |
| `packages/web/ui/src/components/dot/dot.demo.tsx` | Gallery entry (auto-registered by glob) |
| `packages/web/ui/src/components/dot/index.ts` | |
| `packages/web/ui/src/components/tree/use-tree-view.ts` | Tree mechanics: flatten, expand, focus, keyboard. No fetching. |
| `packages/web/ui/src/components/tree/use-tree-view.test.ts` | |
| `packages/web/ui/src/components/tree/tree.tsx` | `<Tree>` + `<TreeRow>`: ARIA and indentation only |
| `packages/web/ui/src/components/tree/tree.test.tsx` | |
| `packages/web/ui/src/components/tree/tree.demo.tsx` | |
| `packages/web/ui/src/components/tree/index.ts` | |
| `apps/web/src/components/eer/view/detail-panel/badge-tone.ts` | eer's `BadgeTone` → `Tone` map, after `badge.tsx` is deleted |

**Modified**

| File | Change |
|---|---|
| `packages/web/ui/src/components/pill/pill.tsx` | `tint` variant, `xs` size |
| `packages/web/ui/src/components/pill/pill.test.tsx` | assertions for both |
| `packages/web/ui/src/components/pill/pill.demo.tsx` | hardcoded variant and size lists |
| `packages/web/ui/src/components/index.ts` | export `dot`, `tree` |
| `packages/web/ui/src/tokens/safelist.generated.css` | regenerated |
| `apps/web/src/components/eer/view/detail-panel/{header,empty-state,entity-detail,rel-row,edge-detail,group-detail}.tsx` | imports |
| `apps/web/src/components/eer/view/diagram/entity-cards/field-row.tsx` | pk/fk badge |
| `apps/web/src/components/eer/view/outline/{kind-filters,group-node,outline}.tsx` | Pill, Dot, Icon, Tree |
| `apps/web/src/ui/use-directory-tree.ts` | keeps directory concerns, defers mechanics |
| `apps/web/src/ui/directory-tree.tsx` | renders `<Tree>`/`<TreeRow>` |

**Deleted**

`view/detail-panel/badge.tsx` · `role-tag.tsx` · `dot.tsx` · `kbd.tsx` · `view/outline/chip.tsx`

---

## Task 1: Pill gains `tint` and `xs`

**Files:**
- Modify: `packages/web/ui/src/components/pill/pill.tsx`
- Modify: `packages/web/ui/src/components/pill/pill.demo.tsx`
- Test: `packages/web/ui/src/components/pill/pill.test.tsx`

**Interfaces:**
- Produces: `PillVariant = 'subtle' | 'solid' | 'outline' | 'text' | 'tint'`; `PillSize = 'xs' | 'sm' | 'md' | 'lg'`. Tasks 3, 4, 6 and 7 consume both.

**Context:** `tint` is the only variant using an opacity modifier (`/15`) inside an enumerated `variants()` call. Step 1 verifies the extractor handles it *before* anything depends on it. If it does not, stop and escalate — do not silently switch to a hand-written class map.

- [ ] **Step 1: Prove the opacity modifier survives enumeration**

Add `tint` to `pill.tsx` only (no size change yet):

```ts
// in pillClass config.variant.options, after `text`:
tint: over(NEUTRAL_SCALE, (tone) => `bg-${tone}-9/15 text-${tone}-11`),
```

and widen the type:

```ts
export type PillVariant = 'subtle' | 'solid' | 'outline' | 'text' | 'tint';
```

Run: `pnpm --filter @tickets/ui tokens:verify`

Expected: it regenerates `safelist.generated.css`, then FAILS on `git diff --exit-code` because that file now contains new `bg-<tone>-9/15` entries. That failure is the proof the modifier enumerated. Inspect the diff:

Run: `git diff packages/web/ui/src/tokens/safelist.generated.css | head -30`

Expected: lines containing `bg-red-9/15`, `bg-blue-9/15`, … for all 11 ramps.

**If the diff contains NO `/15` entries, STOP and escalate** — the variant cannot be enumerated and the spec's approach needs revisiting.

- [ ] **Step 2: Write the failing tests**

Append to `packages/web/ui/src/components/pill/pill.test.tsx`:

```tsx
  it('tint paints the hue at 15% behind the text rung', () => {
    render(<Pill label="Entity" tone="blue" variant="tint" />);
    const el = screen.getByText('Entity');
    expect(el.className).toContain('bg-blue-9/15');
    expect(el.className).toContain('text-blue-11');
  });

  it('xs is the 9px rung and sits below sm on the height ladder', () => {
    // The eer badges are 9px/0.1em; `xs` exists so they keep that on a shared
    // scale. h-4 (16px) keeps the ladder monotonic — 16 / 18 / 22 / 28 — where
    // preserving Badge's padding-sized 19px would have made xs TALLER than sm.
    render(<Pill label="PK" tone="yellow" size="xs" />);
    const el = screen.getByText('PK');
    expect(el.className).toContain('text-9/11');
    expect(el.className).toContain('tracking-widest');
    expect(el.className).toContain('h-4');
    expect(el.className).not.toContain('h-4.5');
  });
```

- [ ] **Step 3: Run them to verify the size test fails**

Run: `pnpm --filter @tickets/ui exec vitest run src/components/pill/pill.test.tsx`

Expected: the `tint` test PASSES (added in step 1); the `xs` test FAILS — `size="xs"` is not assignable and no `h-4` is emitted.

- [ ] **Step 4: Add the `xs` size**

In `pill.tsx`:

```ts
export type PillSize = 'xs' | 'sm' | 'md' | 'lg';
```

```ts
    size: {
      default: 'md',
      options: {
        xs: 'h-4 gap-1 px-2 text-9/11 tracking-widest leading-none',
        sm: 'h-4.5 gap-1 px-1.75 text-11/13 tracking-wider leading-none',
        md: 'h-5.5 gap-1.5 px-2.25 text-12/17 leading-none',
        lg: 'h-7 gap-2 px-3 text-13/19 leading-none',
      },
    },
```

and extend the icon ladder (it is a `Record<PillSize, IconSize>`, so TypeScript will demand the new key):

```ts
const ICON_SIZE: Record<PillSize, IconSize> = { xs: '2xs', sm: '2xs', md: 'xs', lg: 'sm' };
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @tickets/ui exec vitest run src/components/pill/pill.test.tsx`

Expected: PASS, including the pre-existing `paints a shared variant from the same rungs a Button does` — it iterates a fixed list `['subtle','solid','outline']`, so `tint` is outside its scope by design.

- [ ] **Step 6: Update the demo's hardcoded lists**

`pill.demo.tsx` spells its variants and sizes literally, so the new ones are invisible in the gallery until listed:

```tsx
  {
    name: 'Variants',
    render: () => (
      <div className="flex flex-wrap gap-3">
        {(['subtle', 'solid', 'outline', 'text', 'tint'] as const).map((variant) => (
          <Pill key={variant} label={variant} tone="green" variant={variant} />
        ))}
      </div>
    ),
  },
  {
    name: 'Sizes',
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
          <Pill key={size} label={size} tone="blue" size={size} icon="circle" />
        ))}
      </div>
    ),
  },
```

- [ ] **Step 7: Regenerate the safelist and run every gate**

Run: `pnpm --filter @tickets/ui tokens:verify`

Expected: FAILS again on `git diff --exit-code` (the file was regenerated in step 1 but never committed). Stage it, then re-run:

```bash
git add packages/web/ui/src/tokens/safelist.generated.css
pnpm --filter @tickets/ui tokens:verify
```

Expected: all four lines green, ending `ok: 13 color tokens match design-system.html`.

Run: `pnpm typecheck && pnpm --filter @tickets/ui test && pnpm --filter @tickets/web test`

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/web/ui/src/components/pill packages/web/ui/src/tokens/safelist.generated.css
git commit -m "feat(ui): Pill gains an xs size and a tint variant

tint is hue-9 at 15% behind hue-11 ink — the recipe the eer badges use,
which subtle (hue-3) does not match. xs is the 9px rung at h-4, keeping
the height ladder monotonic at 16/18/22/28.

Both are Pill-only, the way text (Pill) and ghost (Button) already
diverge, so the shared-variant parity test is unaffected."
```

---

## Task 2: `Dot` moves to `@tickets/ui`

**Files:**
- Create: `packages/web/ui/src/components/dot/{dot.tsx,dot.test.tsx,dot.demo.tsx,index.ts}`
- Modify: `packages/web/ui/src/components/index.ts`

**Interfaces:**
- Produces: `Dot({ color?: string; hollow?: boolean; className?: string })`, exported from `@tickets/ui`. Tasks 5 and 6 consume it.

**Context:** `color` is a raw CSS colour, not a `Tone`. That is the entire reason this component exists: eer's group hues arrive from a palette and `color-mix()` at runtime, which no token *name* can express. Do not add a `tone` prop — nothing needs one yet.

- [ ] **Step 1: Write the failing test**

`packages/web/ui/src/components/dot/dot.test.tsx`:

```tsx
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dot } from './dot';

afterEach(cleanup);

describe('Dot', () => {
  it('carries the given colour on a custom property, not a class', () => {
    // A runtime colour CANNOT be a class: Tailwind only emits variables for
    // names it can see in source, so `bg-${hue}-9` built at runtime resolves
    // to nothing and invalidates the declaration.
    const { container } = render(<Dot color="var(--color-blue-9)" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue('--dot-color')).toBe('var(--color-blue-9)');
    expect(el.className).toContain('bg-(--dot-color)');
  });

  it('hollow draws a ring and no fill', () => {
    const { container } = render(<Dot color="var(--color-blue-9)" hollow />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('border-1');
    expect(el.className).not.toContain('bg-(--dot-color)');
    // The colour must not leak through as a fill via the custom property.
    expect(el.style.getPropertyValue('--dot-color')).toBe('');
  });

  it('is decorative, so it is hidden from assistive tech', () => {
    const { container } = render(<Dot color="red" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @tickets/ui exec vitest run src/components/dot/dot.test.tsx`

Expected: FAIL — `Cannot find module './dot'`.

- [ ] **Step 3: Write the component**

`packages/web/ui/src/components/dot/dot.tsx`:

```tsx
import { cn, runtimeStyle } from '../../style';

export interface DotProps {
  /**
   * A raw CSS colour — `var(--color-blue-9)`, a `color-mix()` result, a hex.
   * NOT a tone name: this component exists precisely for colours computed at
   * runtime, which a token name cannot express.
   */
  color?: string;
  /** Ring instead of fill, for an "off" state. */
  hollow?: boolean;
  className?: string;
}

/** An 8px disc. Decorative by construction — whatever it stands for is said
 *  by the text beside it, so it is hidden from assistive tech. */
export function Dot({ color, hollow, className }: DotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        hollow ? 'border-1 border-gray-8' : 'bg-(--dot-color)',
        className,
      )}
      style={hollow ? undefined : runtimeStyle({ '--dot-color': color ?? 'var(--color-gray-9)' })}
    />
  );
}
```

`packages/web/ui/src/components/dot/index.ts`:

```ts
export { Dot, type DotProps } from './dot';
```

Add to `packages/web/ui/src/components/index.ts`, in alphabetical position (after `./dialog-footer`, before `./dropdown`):

```ts
export * from './dot';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @tickets/ui exec vitest run src/components/dot/dot.test.tsx`

Expected: PASS (3 tests).

- [ ] **Step 5: Add the demo**

`packages/web/ui/src/components/dot/dot.demo.tsx`. Demos are auto-registered by `import.meta.glob('../**/*.demo.tsx')` — there is no registry to edit — and `demos.smoke.test.tsx` renders every one, so it must render cleanly.

```tsx
import { Dot } from './dot';

export const meta = { title: 'Dot', group: 'Components', size: 'sm' };

const HUES = ['blue', 'green', 'orange', 'purple', 'teal'] as const;

export const states = [
  {
    name: 'Colours',
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        {HUES.map((h) => (
          <Dot key={h} color={`var(--color-${h}-9)`} />
        ))}
      </div>
    ),
  },
  {
    name: 'Hollow',
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        <Dot color="var(--color-blue-9)" />
        <Dot color="var(--color-blue-9)" hollow />
      </div>
    ),
  },
  {
    name: 'Beside text',
    render: () => (
      <div className="flex items-center gap-2 text-13 text-gray-12">
        <Dot color="var(--color-green-9)" />
        <span>Workspace</span>
      </div>
    ),
  },
];
```

Note the template literal in `HUES.map` is a **demo-only** runtime string. It is safe because every `--color-<hue>-9` variable already exists in `tokens.css` — this is reading a CSS variable, not asking Tailwind to emit a utility class.

- [ ] **Step 6: Run every gate**

Run: `pnpm --filter @tickets/ui test && pnpm typecheck && pnpm --filter @tickets/ui tokens:verify`

Expected: all pass. `tokens:verify` should report `safelist unchanged` — `Dot` adds no `variants()` call.

- [ ] **Step 7: Commit**

```bash
git add packages/web/ui/src/components/dot packages/web/ui/src/components/index.ts
git commit -m "feat(ui): add Dot

An 8px runtime-coloured disc. It takes a raw CSS colour rather than a
tone because that is the whole reason it exists — group hues arrive from
a palette and color-mix() at runtime, which a token name cannot express.

hollow renders a ring for an off state, replacing a border-class hack at
the one call site that needed it."
```

---

## Task 3: `Badge` and `RoleTag` retire onto `Pill`

**Files:**
- Create: `apps/web/src/components/eer/view/detail-panel/badge-tone.ts`
- Delete: `apps/web/src/components/eer/view/detail-panel/badge.tsx`, `role-tag.tsx`
- Modify: `apps/web/src/components/eer/view/detail-panel/header.tsx`, `empty-state.tsx`, `entity-detail.tsx`
- Test: `apps/web/src/components/eer/view/detail-panel/detail-panel.test.tsx`

**Interfaces:**
- Consumes: `Pill` with `variant="tint"`, `size="xs"` (Task 1).
- Produces: `BadgeTone = 'entity' | 'group' | 'subgroup' | 'edge'` and `BADGE_TONE: Record<BadgeTone, Tone>` from `./badge-tone`. `header.tsx` currently imports `type Tone` from `./badge` — that import moves here.

**Context:** `header.tsx` re-exports nothing but does `import { Badge, type Tone } from './badge'`, and `Tone` there is eer's four-value vocabulary, NOT `@tickets/ui`'s `Tone`. Renaming it to `BadgeTone` removes a genuine trap: two different `Tone` types were in play in the same folder.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/components/eer/view/detail-panel/detail-panel.test.tsx`:

```tsx
import { BADGE_TONE } from './badge-tone';

describe('panel badges', () => {
  it('maps each eer badge tone to a library hue', () => {
    expect(BADGE_TONE).toEqual({
      entity: 'blue',
      group: 'indigo',
      subgroup: 'green',
      edge: 'yellow',
    });
  });

  it('renders the overview badge as a tinted Pill at the 9px rung', () => {
    // The colours are what `tint` was added for: hue-9 at 15% behind hue-11.
    // A `subtle` Pill would fill from rung 3 instead and quietly restyle it.
    render(<EmptyState model={null} />);
    const badge = screen.getByText('Overview');
    expect(badge.className).toContain('bg-blue-9/15');
    expect(badge.className).toContain('text-blue-11');
    expect(badge.className).toContain('text-9/11');
  });
});
```

Add the imports this needs at the top of the file if absent: `render`, `screen` from `@testing-library/react` and `EmptyState` from `./empty-state`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer/view/detail-panel/detail-panel.test.tsx`

Expected: FAIL — `Cannot find module './badge-tone'`.

- [ ] **Step 3: Create the tone map**

`apps/web/src/components/eer/view/detail-panel/badge-tone.ts`:

```ts
import type { Tone } from '@tickets/ui';

/**
 * What a panel badge is labelling. This vocabulary stays in apps/web —
 * `packages/web/ui/src/components/domain-free.test.ts` fails the build if a
 * library component names a domain concept, and these four are exactly that.
 *
 * Named `BadgeTone`, not `Tone`, because @tickets/ui exports a `Tone` of its
 * own and this folder previously had both under one name.
 */
export type BadgeTone = 'entity' | 'group' | 'subgroup' | 'edge';

export const BADGE_TONE: Record<BadgeTone, Tone> = {
  entity: 'blue',
  group: 'indigo',
  subgroup: 'green',
  edge: 'yellow',
};
```

- [ ] **Step 4: Rewrite `header.tsx` onto `Pill`**

```tsx
import type { ReactNode } from 'react';

import { Dot, Pill } from '@tickets/ui';
import { BADGE_TONE, type BadgeTone } from './badge-tone';

// Sticky panel header shared by every view (entity/group/edge). Read-only —
// there is no edit affordance here; the editor this once opened is gone.
export function Header({
  tone,
  badge,
  title,
  titleColor,
  sub,
  description,
}: {
  tone: BadgeTone;
  badge: string;
  title: string;
  titleColor?: string;
  sub: ReactNode;
  description?: string | null;
}) {
  return (
    <div className="sticky top-0 z-10 border-b-1 border-gray-6 bg-gray-2 px-4 pb-3 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <Pill
          variant="tint"
          size="xs"
          tone={BADGE_TONE[tone]}
          label={badge}
          className="font-mono uppercase"
        />
        {titleColor && <Dot color={titleColor} />}
      </div>
      <h2 className="font-mono text-16 font-500 leading-tight text-gray-12">{title}</h2>
      <div className="mt-1 text-11 text-gray-11">{sub}</div>
      {description && <p className="mt-2 text-12 leading-relaxed text-gray-11">{description}</p>}
    </div>
  );
}
```

`uppercase` and `font-mono` ride `className` on purpose: they are this module's editorial choices, not treatments the library owes every consumer.

**Note:** this also switches `header.tsx` to the library `Dot`, ahead of Task 5. That is fine — Task 2 already shipped it, and leaving this file importing the local `./dot` for one task would mean editing it twice.

- [ ] **Step 5: Rewrite the `RoleTag` call site in `entity-detail.tsx`**

Delete `role-tag.tsx` and its import. Replace each `<RoleTag role={…} />` with a local helper at the top of `entity-detail.tsx`:

```tsx
// Was role-tag.tsx. The 28px column keeps the field rows' names aligned
// whether or not a row has a badge, so the null case is a spacer, not
// nothing.
function RoleTag({ role }: { role: 'pk' | 'fk' | null }) {
  if (!role) return <span className="inline-block w-7 shrink-0" aria-hidden />;
  return (
    <Pill
      variant="tint"
      size="xs"
      tone={role === 'pk' ? 'yellow' : 'green'}
      label={role.toUpperCase()}
      className="w-7 shrink-0 justify-center font-mono"
    />
  );
}
```

Import `Pill` from `@tickets/ui` in that file.

- [ ] **Step 6: Rewrite the `Badge` call site in `empty-state.tsx`**

Replace `import { Badge } from './badge';` with `import { Pill } from '@tickets/ui';` and the usage:

```tsx
        <Pill variant="tint" size="xs" tone="blue" label="Overview" className="font-mono uppercase" />
```

- [ ] **Step 7: Delete the retired files**

```bash
git rm apps/web/src/components/eer/view/detail-panel/badge.tsx apps/web/src/components/eer/view/detail-panel/role-tag.tsx
```

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer`

Expected: PASS. If a test still queries a deleted component's markup, update the query — these are eer's own tests and are in scope, unlike the directory picker's.

- [ ] **Step 9: Run every gate**

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/ui test && pnpm verify:tokens`

- [ ] **Step 10: Commit**

```bash
git add -A apps/web/src/components/eer/view/detail-panel
git commit -m "refactor(web): panel badges retire onto Pill

Badge and RoleTag were the same recipe written twice — hue-9 at 15%
behind hue-11 ink. Both become Pill variant=tint size=xs, which is what
those axes were added for.

The entity/group/subgroup/edge vocabulary moves to badge-tone.ts and is
renamed BadgeTone: it cannot enter @tickets/ui (domain-free.test.ts), and
this folder previously had TWO different types called Tone."
```

---

## Task 4: The `FieldRow` pk/fk badge retires onto `Pill`

**Files:**
- Modify: `apps/web/src/components/eer/view/diagram/entity-cards/field-row.tsx`
- Test: `apps/web/src/components/eer/view/diagram/entity-cards/entity-cards.test.tsx`

**Interfaces:**
- Consumes: `Pill` with `variant="text"`, `size="xs"` (Task 1).

**Context:** This is the module's THIRD rendering of pk/fk — after `RoleTag`'s pill and the detail panel's — and it is not a pill at all, just coloured text. `Pill variant="text"` paints from rung **11**, where this currently uses rung **9**. That hue shift is expected and accepted; the spec records it. Do not "fix" it back to rung 9 with a `className` override — the point is to stop having a third vocabulary.

- [ ] **Step 1: Write the failing test**

Append to `entity-cards.test.tsx`:

```tsx
  it('draws the pk/fk marks as text Pills on the library rung', () => {
    // Rung 11, not the rung 9 this used to hardcode. Pill's `text` variant
    // paints from the text rung on every scale; matching it is the point of
    // the migration, and the shift is recorded in the spec.
    const { container } = renderCards(twoZoneRaw());
    const pk = screen.getAllByText('PK')[0]!;
    expect(pk.className).toContain('text-yellow-11');
    expect(pk.className).toContain('text-9/11');
    expect(container.querySelectorAll('[data-role="pk"]').length).toBeGreaterThan(0);
  });
```

Use whatever render helper the file already establishes in place of `renderCards`; do not add a second one.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer/view/diagram/entity-cards`

Expected: FAIL — the mark is `text-yellow-9`, not `text-yellow-11`.

- [ ] **Step 3: Replace the inline badge**

In `field-row.tsx`, import `Pill` from `@tickets/ui` and replace the badge block:

```tsx
      {badge && (
        <Pill
          variant="text"
          size="xs"
          tone={badge === 'pk' ? 'yellow' : 'green'}
          label={badge.toUpperCase()}
          className="shrink-0 justify-center font-mono"
        />
      )}
```

Leave the field-name span's `text-yellow-9` for `pk` alone — that is the column name, not the badge, and it is out of scope.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer`

Expected: PASS.

- [ ] **Step 5: Run every gate**

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/ui test && pnpm verify:tokens`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/eer/view/diagram/entity-cards
git commit -m "refactor(web): the canvas pk/fk marks retire onto Pill

The third rendering of pk/fk in one module, and the only one that was
never a pill. Pill variant=text paints from rung 11 where this hardcoded
rung 9 — a deliberate, recorded shift; matching the library's text rung
is the point."
```

---

## Task 5: eer's local `Dot` retires onto the library `Dot`

**Files:**
- Delete: `apps/web/src/components/eer/view/detail-panel/dot.tsx`
- Modify: `apps/web/src/components/eer/view/detail-panel/{edge-detail,group-detail,rel-row}.tsx`, `apps/web/src/components/eer/view/outline/group-node.tsx`

**Interfaces:**
- Consumes: `Dot` from `@tickets/ui` (Task 2).

**Context:** The dot was written three times: the component (4 consumers), and inline in `chip.tsx` and `group-node.tsx`. `header.tsx` was already switched in Task 3. `chip.tsx` is deleted in Task 6. This task closes the remaining four.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/components/eer/view/outline/outline.test.tsx`:

```tsx
  it('draws a hidden zone with a hollow swatch, not a filled one', () => {
    // The swatch doubles as the visibility control, so its OFF state has to be
    // unmistakable. It used to fake a ring by passing border classes through
    // className; `hollow` is the real thing.
    const { container } = renderDiagramSync(twoZoneRaw());
    const swatch = () => screen.getByRole('button', { name: /Zone Two/ })
      .closest('div')!.querySelector('span[aria-hidden]') as HTMLElement;
    expect(swatch().className).toContain('bg-(--group-color)');
    fireEvent.click(screen.getByRole('button', { name: 'Hide Zone Two' }));
    expect(swatch().className).toContain('border-1');
    expect(swatch().className).not.toContain('bg-(--group-color)');
    void container;
  });
```

Use the file's existing `renderDiagram` helper in place of `renderDiagramSync`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer/view/outline/outline.test.tsx`

Expected: FAIL — `group-node.tsx` renders its own span with `bg-(--group-color)` and, when hidden, `border-1 border-gray-8` but with no `--group-color` custom property removed.

- [ ] **Step 3: Swap the four call sites**

In `edge-detail.tsx`, `group-detail.tsx` and `rel-row.tsx`, delete `import { Dot } from './dot';` and add `Dot` to the existing `@tickets/ui` import (or create one). No JSX changes — the props are identical.

In `group-node.tsx`, delete the local `dot` class constant and replace the swatch:

```tsx
  const swatch = <Dot color={color} hollow={hidden} />;
```

Import `Dot` from `@tickets/ui`. Remove the now-unused `runtimeStyle` import if nothing else in the file uses it.

- [ ] **Step 4: Delete the local component**

```bash
git rm apps/web/src/components/eer/view/detail-panel/dot.tsx
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer`

Expected: PASS.

- [ ] **Step 6: Verify no copies remain**

Run: `rg -n "rounded-full" apps/web/src/components/eer --glob '!*.test.*'`

Expected: matches ONLY in `chip.tsx` (deleted in Task 6). Any other hand-rolled 8px disc is a missed call site.

- [ ] **Step 7: Run every gate and commit**

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/ui test && pnpm verify:tokens`

```bash
git add -A apps/web/src/components/eer
git commit -m "refactor(web): eer uses the library Dot

Closes two of the three copies — the local component and group-node's
inline span. The hidden-zone swatch now asks for `hollow` instead of
passing border classes through className to fake a ring."
```

---

## Task 6: `Chip` retires onto `Pill`

**Files:**
- Delete: `apps/web/src/components/eer/view/outline/chip.tsx`
- Modify: `apps/web/src/components/eer/view/outline/kind-filters.tsx`
- Test: `apps/web/src/components/eer/view/outline/outline.test.tsx`

**Interfaces:**
- Consumes: `Pill` (Task 1), `Dot` (Task 2).

**Context:** `Pill` already ships every axis `Chip` hand-rolled — `pressed`, `strikethrough`, `shape="round"`, and an `icon` slot that takes any element. The one visual change: `Pill`'s outline is `border-2` where the chip drew `border-1`. Only reachable on `/schema` when a model declares edge kinds, and the database graph declares none, so it is invisible in the app today.

- [ ] **Step 1: Write the failing test**

Replace the existing `offers the edge-kind filters and toggles one` test in `outline.test.tsx` with:

```tsx
  it('offers the edge-kind filters as Pills and toggles one', async () => {
    await renderDiagram(
      <>
        <UiGrab />
        <Outline />
      </>,
      twoZoneRaw(),
    );
    const nm = screen.getByRole('button', { name: 'Many-to-many' });
    // Pill wires `pressed` to aria-pressed, which the hand-rolled chip never did —
    // the ON/OFF state was previously visual only.
    expect(nm).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(nm);
    expect(uiRef!.hidden.kinds.has('nm')).toBe(true);
    expect(screen.getByRole('button', { name: 'Many-to-many' })).toHaveAttribute('aria-pressed', 'false');
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer/view/outline/outline.test.tsx`

Expected: FAIL — the chip renders no `aria-pressed`.

- [ ] **Step 3: Rewrite `kind-filters.tsx`**

```tsx
// Edge-kind visibility, as pills at the foot of the outline.
//
// These used to sit in the top bar beside the group chips. The top bar is now
// three controls (Lines / Fit / Rearrange) and everything that FILTERS what the
// canvas shows lives here, next to the group toggles it belongs with. A schema
// graph declares no kinds (schemaGraphToModel passes none), so this renders
// nothing on /schema — it exists for models that do.

import { Dot, Pill } from '@tickets/ui';
import { useDiagramActions, useDiagramModel, useDiagramUi } from '../../state/diagram-context';

export function KindFilters() {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const actions = useDiagramActions();

  if (model.kinds.length === 0) return null;

  return (
    <div className="shrink-0 border-t-1 border-gray-6 pt-2">
      <p className="px-1 pb-1.5 text-11 uppercase tracking-wider text-gray-11">Edges</p>
      <div className="flex flex-wrap gap-1">
        {model.kinds.map((k) => {
          const on = !ui.hidden.kinds.has(k.id);
          return (
            <Pill
              key={k.id}
              variant="outline"
              shape="round"
              size="sm"
              tone="neutral"
              pressed={on}
              strikethrough={!on}
              icon={<Dot color={on ? 'var(--color-blue-9)' : undefined} hollow={!on} />}
              label={k.label}
              onClick={() => actions.toggleKind(k.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Delete the chip**

```bash
git rm apps/web/src/components/eer/view/outline/chip.tsx
```

- [ ] **Step 5: Run the tests and every gate**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer`

Expected: PASS.

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/ui test && pnpm verify:tokens`

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/components/eer/view/outline
git commit -m "refactor(web): edge-kind chips retire onto Pill

Pill already shipped every axis the chip hand-rolled — pressed,
strikethrough, shape=round, and an icon slot taking any element, so the
coloured dot goes straight in. The ON/OFF state now reaches assistive
tech via aria-pressed, which the hand-rolled chip never emitted.

Outline borders go 1px -> 2px; only reachable for models that declare
edge kinds, which the database graph does not."
```

---

## Task 7: `Kbd` retires onto `Pill`

**Files:**
- Delete: `apps/web/src/components/eer/view/detail-panel/kbd.tsx`
- Modify: `apps/web/src/components/eer/view/detail-panel/empty-state.tsx`
- Test: `apps/web/src/components/eer/view/detail-panel/detail-panel.test.tsx`

**Interfaces:**
- Consumes: `Pill` with `variant="outline"`, `size="sm"` (Task 1).

**Context — read before starting.** This is the weakest of the five migrations and the spec says so. The keycaps lose three things: the `<kbd>` element (`Pill` renders a `<span>`), their `bg-gray-3` fill, and the heavier `border-b-2` bottom edge that makes a key read as a key. They also shrink from 22.9px to 18px. All of that was accepted deliberately — adding an `as` prop to a core primitive for three shortcut hints on one empty state is the worse trade. **Implement it as specified. If it reads badly on screen, that is a Task 13 finding, not a reason to deviate here.**

`size="sm"` (11px), NOT `xs` — these are 11px today, and `xs` would shrink them twice over.

- [ ] **Step 1: Write the failing test**

Append to `detail-panel.test.tsx`:

```tsx
  it('renders the control hints as outline Pills at 11px', () => {
    render(<EmptyState model={null} />);
    const hint = screen.getByText('middle-drag');
    expect(hint.className).toContain('text-11/13');
    expect(hint.className).toContain('border-2');
    // The <kbd> element is gone — a deliberate, recorded trade.
    expect(hint.tagName).toBe('SPAN');
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer/view/detail-panel/detail-panel.test.tsx`

Expected: FAIL — the element is a `KBD`.

- [ ] **Step 3: Rewrite the call site**

In `empty-state.tsx`, drop `import { Kbd } from './kbd';`, add `Pill` to the `@tickets/ui` import, and replace the hint row:

```tsx
          {rows.map(([k, label], i) => (
            <div key={i} className="flex items-baseline gap-2">
              <Pill variant="outline" size="sm" tone="neutral" label={k} className="font-mono" />
              <span>{label}</span>
            </div>
          ))}
```

- [ ] **Step 4: Delete the component**

```bash
git rm apps/web/src/components/eer/view/detail-panel/kbd.tsx
```

- [ ] **Step 5: Run the tests and every gate**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer`

Expected: PASS.

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/ui test && pnpm verify:tokens`

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/components/eer/view/detail-panel
git commit -m "refactor(web): control hints retire onto Pill

The weakest of the five, and recorded as such: the keycaps lose the <kbd>
element, their fill and the heavier bottom edge that made them read as
keys, and shrink 22.9px -> 18px. Accepted rather than adding an `as` prop
to a core primitive for three hints on one empty state."
```

---

## Task 8: The outline caret becomes an `Icon`

**Files:**
- Modify: `apps/web/src/components/eer/view/outline/group-node.tsx`
- Test: `apps/web/src/components/eer/view/outline/outline.test.tsx`

**Interfaces:**
- Consumes: `Icon` from `@tickets/ui`, names `chevron-down` and `chevron-right` (both already in the registry).

**Context:** `▾` / `▸` are text glyphs. They inherit the text metrics and sit a little high, and they are the last hand-drawn icon in the module.

- [ ] **Step 1: Write the failing test**

Append to `outline.test.tsx`:

```tsx
  it('draws the disclosure caret as an icon, not a text glyph', () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    const caret = screen.getByRole('button', { name: 'Zone One subtree' });
    expect(caret.querySelector('svg')).not.toBeNull();
    expect(caret.textContent).toBe('');
  });
```

Mark the test `async` to match the file's other cases.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer/view/outline/outline.test.tsx`

Expected: FAIL — `textContent` is `▾`.

- [ ] **Step 3: Replace the glyphs**

In `group-node.tsx`, import `Icon` from `@tickets/ui` and replace the caret button's body:

```tsx
            <Icon name={open ? 'chevron-down' : 'chevron-right'} size="xs" />
```

Drop the `text-11` from the button's class list — it was sizing a glyph that is now an SVG.

- [ ] **Step 4: Run the tests and every gate**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer`

Expected: PASS.

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/ui test && pnpm verify:tokens`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/eer/view/outline/group-node.tsx apps/web/src/components/eer/view/outline/outline.test.tsx
git commit -m "refactor(web): the outline caret uses Icon

The last hand-drawn glyph in the module. Text carets inherit the text
metrics and land high; chevron-down/right were already in the registry."
```

---

## Task 9: `useTreeView` — tree mechanics, no fetching

**Files:**
- Create: `packages/web/ui/src/components/tree/use-tree-view.ts`
- Test: `packages/web/ui/src/components/tree/use-tree-view.test.ts`

**Interfaces:**
- Produces, consumed by Tasks 10, 11 and 12:

```ts
export interface TreeNode {
  id: string;
  /** Materialised children. `undefined` means NOT LOADED — the async seam. */
  children?: TreeNode[];
  /** A row that exists only to say something ("— empty —"). Rendered, but
   *  never focusable and skipped by keyboard navigation. */
  inert?: boolean;
}

export interface TreeRowModel {
  id: string;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  focused: boolean;
  inert: boolean;
}

export interface UseTreeViewOptions {
  roots: TreeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Called when expanding a node whose `children` are `undefined`. */
  onExpand?: (id: string) => void;
  /**
   * Render every node expanded, ignoring the collapsed set without discarding
   * it — for a filtered tree, where the caller has already pruned to matches
   * and a collapsed group would hide the very rows the query asked for.
   * Collapsed state is restored when this goes back to false.
   */
  forceExpanded?: boolean;
  /** Prefix for generated row element ids, so two trees on a page never collide. */
  idPrefix: string;
}

export interface UseTreeViewResult {
  rows: TreeRowModel[];
  toggle: (id: string) => void;
  select: (id: string) => void;
  focusId: string | null;
  setFocusId: (id: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  activeDescendant: string | undefined;
  rowElementId: (id: string) => string;
}
```

**Context:** The hook NEVER fetches. `children: undefined` means "not loaded"; the hook calls `onExpand(id)` and the consumer supplies children on a later render. This keeps react-query in the directory picker and gives `@tickets/ui` no data-fetching dependency.

Two behaviours are carried over verbatim from `apps/web/src/ui/use-directory-tree.ts` and must not be "simplified":

1. **`toggle` decides from refs, not from closed-over state, and calls `onExpand` OUTSIDE any state updater.** Updater bodies must stay pure — StrictMode double-invokes them, which would fire `onExpand` twice.
2. **`ArrowLeft` on a collapsed node moves to the nearest PRECEDING row of strictly smaller depth** — not the previous visible row, which is a sibling whenever one exists.

- [ ] **Step 1: Write the failing tests**

`packages/web/ui/src/components/tree/use-tree-view.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTreeView, type TreeNode } from './use-tree-view';

const ROOTS: TreeNode[] = [
  { id: 'a', children: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }] },
  { id: 'b', children: [] },
];

const key = (k: string) => ({ key: k, preventDefault: vi.fn() }) as never;

function setup(opts: Partial<Parameters<typeof useTreeView>[0]> = {}) {
  return renderHook(() => useTreeView({ roots: ROOTS, idPrefix: 't', ...opts }));
}

describe('useTreeView', () => {
  it('starts with only root rows visible', () => {
    const { result } = setup();
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('expanding reveals children at depth + 1', () => {
    const { result } = setup();
    act(() => result.current.toggle('a'));
    expect(result.current.rows.map((r) => [r.id, r.depth])).toEqual([
      ['a', 0], ['a1', 1], ['a2', 1], ['a3', 1], ['b', 0],
    ]);
  });

  it('reports hasChildren for an UNLOADED node so it still gets a caret', () => {
    // `children: undefined` means not loaded, not childless. A tree that hid
    // the caret here could never be expanded to trigger the load.
    const { result } = setup({ roots: [{ id: 'lazy' }] });
    expect(result.current.rows[0]!.hasChildren).toBe(true);
    // …and `children: []` is genuinely childless.
    const empty = setup({ roots: [{ id: 'leaf', children: [] }] });
    expect(empty.result.current.rows[0]!.hasChildren).toBe(false);
  });

  it('calls onExpand exactly once for an unloaded node, and not for a loaded one', () => {
    const onExpand = vi.fn();
    const { result } = setup({ roots: [{ id: 'lazy' }, { id: 'a', children: [{ id: 'a1' }] }], onExpand });
    act(() => result.current.toggle('lazy'));
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onExpand).toHaveBeenCalledWith('lazy');
    act(() => result.current.toggle('a'));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('collapsing does not re-fire onExpand', () => {
    const onExpand = vi.fn();
    const { result } = setup({ roots: [{ id: 'lazy' }], onExpand });
    act(() => result.current.toggle('lazy'));
    act(() => result.current.toggle('lazy'));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('select reports the id and moves focus to it', () => {
    const onSelect = vi.fn();
    const { result } = setup({ onSelect });
    act(() => result.current.select('b'));
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(result.current.focusId).toBe('b');
  });

  it('ArrowDown and ArrowUp walk the visible rows', () => {
    const { result } = setup();
    act(() => result.current.onKeyDown(key('ArrowDown')));
    expect(result.current.focusId).toBe('b');
    act(() => result.current.onKeyDown(key('ArrowUp')));
    expect(result.current.focusId).toBe('a');
  });

  it('ArrowRight expands a collapsed node, then walks into it', () => {
    const { result } = setup();
    act(() => result.current.onKeyDown(key('ArrowRight')));
    expect(result.current.rows.map((r) => r.id)).toContain('a1');
    act(() => result.current.onKeyDown(key('ArrowRight')));
    expect(result.current.focusId).toBe('a1');
  });

  it('ArrowLeft collapses an expanded node', () => {
    const { result } = setup();
    act(() => result.current.toggle('a'));
    act(() => result.current.onKeyDown(key('ArrowLeft')));
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('ArrowLeft from the LAST child moves to the parent, not the previous sibling', () => {
    // The whole point: move(-1) would land on a2. The parent is the nearest
    // preceding row of strictly smaller depth.
    const { result } = setup();
    act(() => result.current.toggle('a'));
    act(() => result.current.setFocusId('a3'));
    act(() => result.current.onKeyDown(key('ArrowLeft')));
    expect(result.current.focusId).toBe('a');
  });

  it('Home and End jump to the ends', () => {
    const { result } = setup();
    act(() => result.current.onKeyDown(key('End')));
    expect(result.current.focusId).toBe('b');
    act(() => result.current.onKeyDown(key('Home')));
    expect(result.current.focusId).toBe('a');
  });

  it('Enter selects the focused row', () => {
    const onSelect = vi.fn();
    const { result } = setup({ onSelect });
    act(() => result.current.onKeyDown(key('ArrowDown')));
    act(() => result.current.onKeyDown(key('Enter')));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('skips inert rows when navigating, but still lists them', () => {
    const roots: TreeNode[] = [{ id: 'a', children: [{ id: 'note', inert: true }] }, { id: 'b' }];
    const { result } = renderHook(() => useTreeView({ roots, idPrefix: 't' }));
    act(() => result.current.toggle('a'));
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'note', 'b']);
    act(() => result.current.onKeyDown(key('ArrowDown')));
    expect(result.current.focusId).toBe('b');
  });

  it('calls preventDefault for a handled key', () => {
    const { result } = setup();
    const e = key('ArrowDown') as unknown as { preventDefault: () => void };
    act(() => result.current.onKeyDown(e as never));
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('namespaces row element ids by prefix so two trees never collide', () => {
    const { result } = setup();
    expect(result.current.rowElementId('a/b')).toBe('t-a%2Fb');
    expect(result.current.activeDescendant).toBe('t-a');
  });

  it('forceExpanded opens everything WITHOUT discarding the collapsed set', () => {
    // The filtered-tree case. It must be non-destructive: turning the filter
    // off has to restore exactly what the user had collapsed, so this cannot
    // be implemented by expanding the set and cannot be a loop of toggle().
    const { result, rerender } = renderHook(
      ({ force }: { force: boolean }) => useTreeView({ roots: ROOTS, idPrefix: 't', forceExpanded: force }),
      { initialProps: { force: false } },
    );
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
    rerender({ force: true });
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'a1', 'a2', 'a3', 'b']);
    rerender({ force: false });
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @tickets/ui exec vitest run src/components/tree/use-tree-view.test.ts`

Expected: FAIL — `Cannot find module './use-tree-view'`.

- [ ] **Step 3: Write the hook**

`packages/web/ui/src/components/tree/use-tree-view.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface TreeNode {
  id: string;
  /** Materialised children. `undefined` means NOT LOADED — the async seam. */
  children?: TreeNode[];
  /** A row that exists only to say something ("— empty —"). Rendered, but
   *  never focusable and skipped by keyboard navigation. */
  inert?: boolean;
}

export interface TreeRowModel {
  id: string;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  focused: boolean;
  inert: boolean;
}

export interface UseTreeViewOptions {
  roots: TreeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Called when expanding a node whose `children` are `undefined`. */
  onExpand?: (id: string) => void;
  /**
   * Render every node expanded, ignoring the collapsed set without discarding
   * it — for a filtered tree, where the caller has already pruned to matches
   * and a collapsed group would hide the very rows the query asked for.
   * Collapsed state is restored when this goes back to false.
   */
  forceExpanded?: boolean;
  /** Prefix for generated row element ids, so two trees on a page never collide. */
  idPrefix: string;
}

export interface UseTreeViewResult {
  rows: TreeRowModel[];
  toggle: (id: string) => void;
  select: (id: string) => void;
  focusId: string | null;
  setFocusId: (id: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  activeDescendant: string | undefined;
  rowElementId: (id: string) => string;
}

/**
 * Tree mechanics: flattening, expansion, roving focus and keyboard navigation.
 *
 * It NEVER fetches. `children: undefined` means "not loaded"; the hook calls
 * `onExpand(id)` and the consumer supplies children on a later render. That is
 * what keeps this library free of any data-fetching dependency while still
 * serving a lazily-loaded tree.
 */
export function useTreeView({
  roots,
  selectedId = null,
  onSelect,
  onExpand,
  forceExpanded = false,
  idPrefix,
}: UseTreeViewOptions): UseTreeViewResult {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [focusId, setFocusId] = useState<string | null>(roots[0]?.id ?? null);

  // Mirrors for reads inside `toggle`, so "expand vs collapse, load vs reuse"
  // is decided from fresh state BEFORE any setState — never from inside an
  // updater body. Updater bodies must stay pure: StrictMode double-invokes
  // them, which would fire `onExpand` twice.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const rootsRef = useRef(roots);
  rootsRef.current = roots;

  // Consumers supply `roots` from a query that starts empty; seed focus once
  // they arrive rather than only at mount. Never clobbers a focus already set.
  useEffect(() => {
    if (focusId == null && roots[0]) setFocusId(roots[0].id);
  }, [focusId, roots]);

  const byId = useMemo(() => {
    const map = new Map<string, TreeNode>();
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        map.set(n.id, n);
        if (n.children) walk(n.children);
      }
    };
    walk(roots);
    return map;
  }, [roots]);

  const rows = useMemo<TreeRowModel[]>(() => {
    const out: TreeRowModel[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        // `forceExpanded` overrides the set without mutating it, so turning a
        // filter off restores exactly what the user had collapsed.
        const isExpanded = forceExpanded || expanded.has(n.id);
        out.push({
          id: n.id,
          depth,
          expanded: isExpanded,
          // `undefined` children mean UNLOADED, so the node still gets a caret —
          // without one it could never be expanded to trigger the load.
          hasChildren: n.children === undefined || n.children.length > 0,
          selected: selectedId === n.id,
          focused: focusId === n.id,
          inert: n.inert === true,
        });
        if (isExpanded && n.children) walk(n.children, depth + 1);
      }
    };
    walk(roots, 0);
    return out;
  }, [roots, expanded, forceExpanded, selectedId, focusId]);

  const navigable = useMemo(() => rows.filter((r) => !r.inert), [rows]);

  const toggle = useCallback(
    (id: string) => {
      const isExpanded = expandedRef.current.has(id);
      const needsLoad = !isExpanded && rootsRef.current.length > 0 && findChildren(rootsRef.current, id) === undefined;
      setExpanded((prev) => {
        const next = new Set(prev);
        if (isExpanded) next.delete(id);
        else next.add(id);
        return next;
      });
      if (needsLoad) onExpand?.(id);
    },
    [onExpand],
  );

  const select = useCallback(
    (id: string) => {
      setFocusId(id);
      onSelect?.(id);
    },
    [onSelect],
  );

  const rowElementId = useCallback((id: string) => `${idPrefix}-${encodeURIComponent(id)}`, [idPrefix]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const i = navigable.findIndex((r) => r.id === focusId);
      const move = (delta: number) => {
        const next = navigable[Math.max(0, Math.min(navigable.length - 1, i + delta))];
        if (next) setFocusId(next.id);
      };
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); move(1); break;
        case 'ArrowUp': e.preventDefault(); move(-1); break;
        case 'Home': e.preventDefault(); if (navigable[0]) setFocusId(navigable[0].id); break;
        case 'End': {
          e.preventDefault();
          const last = navigable.at(-1);
          if (last) setFocusId(last.id);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const row = navigable[i];
          if (row && row.hasChildren && !row.expanded) toggle(row.id);
          else move(1);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const row = navigable[i];
          if (!row) break;
          if (row.expanded) {
            toggle(row.id);
            break;
          }
          // The parent is the nearest PRECEDING row of strictly smaller depth —
          // NOT move(-1), which lands on a sibling whenever one exists. If none
          // is found (already at a root), stay put.
          for (let j = i - 1; j >= 0; j--) {
            const candidate = navigable[j];
            if (candidate && candidate.depth < row.depth) {
              setFocusId(candidate.id);
              break;
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (focusId) select(focusId);
          break;
        }
        default:
          break;
      }
    },
    [navigable, focusId, toggle, select],
  );

  return {
    rows,
    toggle,
    select,
    focusId,
    setFocusId,
    onKeyDown,
    activeDescendant: focusId ? rowElementId(focusId) : undefined,
    rowElementId,
  };
}

/** `undefined` when the node is unloaded, an array when it is loaded. */
function findChildren(nodes: TreeNode[], id: string): TreeNode[] | undefined {
  for (const n of nodes) {
    if (n.id === id) return n.children;
    if (n.children) {
      const hit = findChildren(n.children, id);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}
```

**Note on `findChildren`:** it returns `undefined` both for "node not found" and "node has no loaded children". That is intentional here — an id that is not in the tree cannot be toggled by any real caller, and conflating the two keeps the function a one-liner at the call site. `byId` is available if a later task needs the distinction.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @tickets/ui exec vitest run src/components/tree/use-tree-view.test.ts`

Expected: PASS (15 tests).

- [ ] **Step 5: Prove the tests are real by mutation**

Break `ArrowLeft`'s parent search, replacing the loop with `move(-1)`:

Run: `pnpm --filter @tickets/ui exec vitest run src/components/tree/use-tree-view.test.ts`

Expected: `ArrowLeft from the LAST child moves to the parent, not the previous sibling` FAILS. **Revert the mutation.** If it passes, the test is not a guard and must be fixed before continuing.

- [ ] **Step 6: Run every gate and commit**

Run: `pnpm typecheck && pnpm --filter @tickets/ui test && pnpm --filter @tickets/web test && pnpm verify:tokens`

```bash
git add packages/web/ui/src/components/tree
git commit -m "feat(ui): useTreeView — tree mechanics without fetching

Flattening, expansion, roving focus and keyboard navigation, extracted
from the directory picker, which is the more demanding of the app's two
trees.

children: undefined means NOT LOADED — the hook calls onExpand and the
consumer supplies children later, so the library takes no data-fetching
dependency. toggle decides from refs and calls onExpand outside any state
updater, because StrictMode double-invokes updater bodies."
```

---

## Task 10: `<Tree>` and `<TreeRow>` — ARIA and indentation

**Files:**
- Create: `packages/web/ui/src/components/tree/tree.tsx`, `tree.test.tsx`, `tree.demo.tsx`, `index.ts`
- Modify: `packages/web/ui/src/components/index.ts`

**Interfaces:**
- Consumes: `TreeRowModel`, `UseTreeViewResult` (Task 9).
- Produces, consumed by Tasks 11 and 12:

```ts
interface TreeProps {
  activeDescendant: string | undefined;
  onKeyDown: (e: KeyboardEvent) => void;
  className?: string;
  children: ReactNode;
}

interface TreeRowProps {
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  focused: boolean;
  elementId: string;
  /** Names the caret: "expand <caretLabel>" / "collapse <caretLabel>". */
  caretLabel: string;
  /** Accessible name for the treeitem. Falls back to its text content. */
  label?: string;
  /** Replaces the chevron — the directory picker puts a Spinner here while loading. */
  caret?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onToggle: () => void;
  onSelect: () => void;
  className?: string;
  children: ReactNode;
}
```

**Context — two API details are pinned by tests that must not change.** `apps/web/src/ui/directory-tree.test.tsx` queries `getByRole('button', { name: /expand \/home\/me/i })` and `getByRole('treeitem', { name: /~/ })`. So the caret's accessible name MUST be `expand <caretLabel>` / `collapse <caretLabel>`, and the treeitem MUST accept a caller-supplied `label`. Do not invent different wording.

The caret button and the `leading` slot sit OUTSIDE the `role="treeitem"` element, which is the label button. This is deliberate: the outline's swatch is a separate action (hide this zone), not part of selecting the node, and nesting an interactive control inside a `treeitem` breaks its semantics.

- [ ] **Step 1: Write the failing tests**

`packages/web/ui/src/components/tree/tree.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tree, TreeRow } from './tree';

afterEach(cleanup);

function row(overrides: Partial<Parameters<typeof TreeRow>[0]> = {}) {
  return (
    <TreeRow
      depth={0}
      expanded={false}
      hasChildren
      selected={false}
      focused={false}
      elementId="t-a"
      caretLabel="/home/me"
      onToggle={() => {}}
      onSelect={() => {}}
      {...overrides}
    >
      home
    </TreeRow>
  );
}

describe('Tree', () => {
  it('is a single tab stop that points at the focused row', () => {
    render(
      <Tree activeDescendant="t-a" onKeyDown={() => {}}>
        {row()}
      </Tree>,
    );
    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('tabindex', '0');
    expect(tree).toHaveAttribute('aria-activedescendant', 't-a');
    // Rows must NOT be tab stops — focus roves via activedescendant.
    expect(screen.getByRole('treeitem')).toHaveAttribute('tabindex', '-1');
  });

  it('names the caret so it can be found and operated', () => {
    const onToggle = vi.fn();
    render(<Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ onToggle })}</Tree>);
    fireEvent.click(screen.getByRole('button', { name: /expand \/home\/me/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('says collapse once expanded', () => {
    render(<Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ expanded: true })}</Tree>);
    expect(screen.getByRole('button', { name: /collapse \/home\/me/i })).toBeInTheDocument();
    expect(screen.getByRole('treeitem')).toHaveAttribute('aria-expanded', 'true');
  });

  it('takes a caller-supplied accessible name for the treeitem', () => {
    render(<Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ label: '~ home' })}</Tree>);
    expect(screen.getByRole('treeitem', { name: '~ home' })).toBeInTheDocument();
  });

  it('omits aria-expanded on a leaf and renders no caret button', () => {
    render(<Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ hasChildren: false })}</Tree>);
    expect(screen.getByRole('treeitem')).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByRole('button', { name: /expand/i })).toBeNull();
  });

  it('renders one guide column per depth level', () => {
    const { container } = render(
      <Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ depth: 3 })}</Tree>,
    );
    expect(container.querySelectorAll('[data-tree-guide]')).toHaveLength(3);
  });

  it('accepts a caret override, for a loading spinner', () => {
    render(
      <Tree activeDescendant={undefined} onKeyDown={() => {}}>
        {row({ caret: <span data-testid="spinner" /> })}
      </Tree>,
    );
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('puts leading content OUTSIDE the treeitem, so an action there is its own control', () => {
    render(
      <Tree activeDescendant={undefined} onKeyDown={() => {}}>
        {row({ leading: <button type="button">hide</button> })}
      </Tree>,
    );
    const item = screen.getByRole('treeitem');
    expect(item.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'hide' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @tickets/ui exec vitest run src/components/tree/tree.test.tsx`

Expected: FAIL — `Cannot find module './tree'`.

- [ ] **Step 3: Write the components**

`packages/web/ui/src/components/tree/tree.tsx`:

```tsx
import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '../../style';
import { Icon } from '../icon';

export interface TreeProps {
  activeDescendant: string | undefined;
  onKeyDown: (e: KeyboardEvent) => void;
  className?: string;
  children: ReactNode;
}

/** The tree's single tab stop. Focus roves by `aria-activedescendant`, so no
 *  row is ever a tab stop of its own — tabbing moves past the whole tree. */
export function Tree({ activeDescendant, onKeyDown, className, children }: TreeProps) {
  return (
    <div
      role="tree"
      tabIndex={0}
      aria-activedescendant={activeDescendant}
      onKeyDown={onKeyDown}
      className={cn('outline-none', className)}
    >
      {children}
    </div>
  );
}

export interface TreeRowProps {
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  focused: boolean;
  elementId: string;
  /** Names the caret: "expand <caretLabel>" / "collapse <caretLabel>". */
  caretLabel: string;
  /** Accessible name for the treeitem. Falls back to its text content. */
  label?: string;
  /** Replaces the chevron — a Spinner while children load, for instance. */
  caret?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onToggle: () => void;
  onSelect: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * One row: guide columns, a caret, an optional leading slot, the treeitem
 * itself, and an optional trailing slot.
 *
 * The caret and `leading` sit OUTSIDE the `role="treeitem"` element on purpose.
 * A control in `leading` (a visibility toggle, say) is a separate action from
 * selecting the node, and nesting an interactive element inside a treeitem
 * breaks its semantics.
 */
export function TreeRow({
  depth,
  expanded,
  hasChildren,
  selected,
  focused,
  elementId,
  caretLabel,
  label,
  caret,
  leading,
  trailing,
  onToggle,
  onSelect,
  className,
  children,
}: TreeRowProps) {
  return (
    <div className="flex items-stretch gap-1">
      {Array.from({ length: depth }, (_, i) => (
        <span key={i} data-tree-guide="" aria-hidden className="w-4 flex-none border-l-1 border-gray-6" />
      ))}

      {hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${expanded ? 'collapse' : 'expand'} ${caretLabel}`}
          onClick={onToggle}
          className="grid size-4 flex-none self-center place-items-center rounded-sm text-gray-11 hover:bg-surface-inset hover:text-gray-12"
        >
          {caret ?? <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size="xs" />}
        </button>
      ) : (
        <span aria-hidden className="size-4 flex-none self-center" />
      )}

      {leading}

      <button
        type="button"
        id={elementId}
        tabIndex={-1}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={selected}
        aria-label={label}
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left',
          'hover:bg-surface-inset',
          selected && 'bg-surface-inset',
          focused && 'outline outline-2 -outline-offset-1 outline-indigo-9',
          className,
        )}
      >
        {children}
        {trailing}
      </button>
    </div>
  );
}
```

`packages/web/ui/src/components/tree/index.ts`:

```ts
export { Tree, TreeRow, type TreeProps, type TreeRowProps } from './tree';
export {
  useTreeView,
  type TreeNode,
  type TreeRowModel,
  type UseTreeViewOptions,
  type UseTreeViewResult,
} from './use-tree-view';
```

Add to `packages/web/ui/src/components/index.ts`, after `./toggle`:

```ts
export * from './tree';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @tickets/ui exec vitest run src/components/tree`

Expected: PASS (8 + 15 tests).

- [ ] **Step 5: Add the demo**

`packages/web/ui/src/components/tree/tree.demo.tsx`:

```tsx
import { useTreeView, type TreeNode } from './use-tree-view';
import { Tree, TreeRow } from './tree';

export const meta = { title: 'Tree', group: 'Components', size: 'md', impl: ['tree.tsx', 'use-tree-view.ts'] };

const ROOTS: TreeNode[] = [
  {
    id: 'core',
    children: [{ id: 'projects' }, { id: 'users' }, { id: 'views' }],
  },
  {
    id: 'terminal',
    children: [{ id: 'output' }, { id: 'sessions' }],
  },
];

function Demo() {
  const tree = useTreeView({ roots: ROOTS, idPrefix: 'demo' });
  return (
    <Tree activeDescendant={tree.activeDescendant} onKeyDown={tree.onKeyDown}>
      {tree.rows.map((r) => (
        <TreeRow
          key={r.id}
          depth={r.depth}
          expanded={r.expanded}
          hasChildren={r.hasChildren}
          selected={r.selected}
          focused={r.focused}
          elementId={tree.rowElementId(r.id)}
          caretLabel={r.id}
          onToggle={() => tree.toggle(r.id)}
          onSelect={() => tree.select(r.id)}
        >
          <span className="truncate font-mono text-12">{r.id}</span>
        </TreeRow>
      ))}
    </Tree>
  );
}

export const states = [{ name: 'Default', render: () => <Demo /> }];
```

- [ ] **Step 6: Run every gate and commit**

Run: `pnpm --filter @tickets/ui test && pnpm typecheck && pnpm verify:tokens && pnpm --filter @tickets/web test`

```bash
git add packages/web/ui/src/components/tree packages/web/ui/src/components/index.ts
git commit -m "feat(ui): Tree and TreeRow — ARIA and indentation, no opinions

The shell owns role=tree, the roving activedescendant, the caret, guide
columns and the treeitem. Row CONTENT is entirely the consumer's, through
leading/trailing slots, because the app's two trees share none of it.

The caret and leading slot sit outside the treeitem deliberately: a
control there is a separate action from selecting the node, and nesting
an interactive element inside a treeitem breaks its semantics."
```

---

## Task 11: The directory picker migrates onto `useTreeView`

**Files:**
- Modify: `apps/web/src/ui/use-directory-tree.ts`, `apps/web/src/ui/directory-tree.tsx`
- Tests (MUST PASS UNEDITED): `apps/web/src/ui/use-directory-tree.test.ts`, `apps/web/src/ui/directory-tree.test.tsx`, `apps/web/src/components/terminal/directory-picker.test.tsx`

**Interfaces:**
- Consumes: `useTreeView`, `Tree`, `TreeRow`, `TreeNode` (Tasks 9, 10).
- `useDirectoryTree`'s public return shape must not change: `{ rows, toggle, select, focus, setFocus, onKeyDown }`, where `rows` are `VisibleRow`. Its test asserts against exactly that.

**Context — the hard constraint.** These 13 tests are the regression net for this migration and **must pass without being edited**:

`use-directory-tree.test.ts` — starts with only root rows visible · expanding a node loads and reveals its children · select calls onSelect with the path · ArrowDown then ArrowUp move focus between visible rows · ArrowRight on a collapsed root expands it · ArrowLeft on an expanded node collapses it · ArrowLeft from the last of 3 children moves focus to the parent root, not a sibling · Enter calls onSelect with the focused path · calls preventDefault for a handled key · StrictMode: a single expand fetches the path exactly once

`directory-tree.test.tsx` — renders root rows and reveals children on expand · clicking a folder name selects it · is a single tab stop (roving tabindex)

If one genuinely cannot pass, **stop and escalate**. Do not edit it to fit the new internals — that would delete the only evidence the migration preserved behaviour.

**What `useDirectoryTree` keeps:** react-query loading, `basename`, `WorkdirRoot` symbols and annotations, per-node error state, the `— empty —` note row, and the rule that an errored node drops its cache on collapse so a re-expand retries.

**What it delegates:** flattening, the expanded set, focus, and every key handler.

- [ ] **Step 1: Confirm the net is green before touching anything**

Run: `pnpm --filter @tickets/web exec vitest run src/ui/use-directory-tree.test.ts src/ui/directory-tree.test.tsx src/components/terminal/directory-picker.test.tsx`

Expected: PASS. Record the count — it must be identical at the end.

- [ ] **Step 2: Rewrite `use-directory-tree.ts` over the hook**

Keep `VisibleRow` exactly as it is. Build `TreeNode[]` from the directory state, hand it to `useTreeView`, then zip the hook's rows back into `VisibleRow`s:

```ts
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTreeView, type TreeNode } from '@tickets/ui';

import { workdirDirQuery } from '../api/use-workdir-dirs';
import type { WorkdirDirEntry, WorkdirRoot } from '../api/types';

export interface VisibleRow {
  path: string;
  label: string;
  depth: number;
  isRoot: boolean;
  symbol?: string;
  annotation?: string;
  expanded: boolean;
  loading: boolean;
  error?: string;
  selected: boolean;
  focused: boolean;
  note?: '— empty —';
}

type NodeState = { entries?: WorkdirDirEntry[]; error?: string; loading: boolean };

function basename(p: string): string {
  const parts = p.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) ?? p;
}

export function useDirectoryTree(opts: {
  roots: WorkdirRoot[];
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const { roots, selected, onSelect } = opts;
  const queryClient = useQueryClient();
  const [nodes, setNodes] = useState<Record<string, NodeState>>({});
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const load = useCallback(
    async (path: string) => {
      setNodes((n) => ({ ...n, [path]: { ...n[path], loading: true } }));
      try {
        const listing = await queryClient.fetchQuery(workdirDirQuery(path));
        setNodes((n) => ({ ...n, [path]: { entries: listing.entries, error: listing.error, loading: false } }));
      } catch {
        setNodes((n) => ({ ...n, [path]: { error: 'could not read', loading: false } }));
      }
    },
    [queryClient],
  );

  // An errored node reports NO children, so useTreeView will ask to load again
  // on the next expand — which is the retry rule, expressed as data rather
  // than as a special case in a toggle handler.
  const treeRoots = useMemo<TreeNode[]>(() => {
    const build = (path: string): TreeNode => {
      const state = nodes[path];
      if (state?.error) return { id: path };
      if (!state?.entries) return { id: path };
      if (state.entries.length === 0) return { id: path, children: [{ id: `${path} empty`, inert: true }] };
      return { id: path, children: state.entries.map((e) => build(e.path)) };
    };
    return roots.map((r) => build(r.path));
  }, [roots, nodes]);

  const tree = useTreeView({
    roots: treeRoots,
    selectedId: selected,
    onSelect,
    onExpand: (path) => {
      if (!nodesRef.current[path]?.entries) void load(path);
    },
    idPrefix: 'dtree',
  });

  const rootByPath = useMemo(() => new Map(roots.map((r) => [r.path, r])), [roots]);

  const rows = useMemo<VisibleRow[]>(
    () =>
      tree.rows.map((r) => {
        if (r.inert) {
          return { path: r.id, label: '', depth: r.depth, isRoot: false, expanded: false, loading: false, selected: false, focused: false, note: '— empty —' };
        }
        const root = rootByPath.get(r.id);
        const state = nodes[r.id];
        return {
          path: r.id,
          label: root ? root.symbol : basename(r.id),
          depth: r.depth,
          isRoot: Boolean(root),
          symbol: root?.symbol,
          annotation: root?.annotation,
          expanded: r.expanded,
          loading: Boolean(state?.loading),
          error: state?.error,
          selected: r.selected,
          focused: r.focused,
        };
      }),
    [tree.rows, rootByPath, nodes],
  );

  return {
    rows,
    toggle: tree.toggle,
    select: tree.select,
    focus: tree.focusId,
    setFocus: tree.setFocusId,
    onKeyDown: tree.onKeyDown,
    rowElementId: tree.rowElementId,
    activeDescendant: tree.activeDescendant,
  };
}
```

- [ ] **Step 3: Run the hook's tests**

Run: `pnpm --filter @tickets/web exec vitest run src/ui/use-directory-tree.test.ts`

Expected: PASS, all 10, unedited.

Two are the ones most likely to break and are worth reading the failure of carefully:
- `StrictMode: a single expand fetches the path exactly once` — guards that `onExpand` is called outside a state updater.
- `ArrowLeft from the last of 3 children moves focus to the parent root, not a sibling` — guards the parent search.

- [ ] **Step 4: Rewrite `directory-tree.tsx` over the shell**

```tsx
import type { WorkdirRoot } from '../api/types';
import { Spinner, Tree, TreeRow, cn } from '@tickets/ui';
import { useDirectoryTree, type VisibleRow } from './use-directory-tree';

function Row({
  row,
  elementId,
  onToggle,
  onSelect,
}: {
  row: VisibleRow;
  elementId: string;
  onToggle: () => void;
  onSelect: () => void;
}) {
  if (row.note) {
    return (
      <div className="py-1 pr-2 pl-2 font-mono text-12/17 italic text-gray-9">{row.note}</div>
    );
  }

  return (
    <TreeRow
      depth={row.depth}
      expanded={row.expanded}
      hasChildren
      selected={row.selected}
      focused={row.focused}
      elementId={elementId}
      caretLabel={row.path}
      label={row.isRoot ? `${row.symbol} ${row.annotation ?? ''}`.trim() : row.label}
      caret={row.loading ? <Spinner size="sm" tone="primary" /> : undefined}
      leading={
        row.isRoot ? (
          <span className="self-center shrink-0 rounded-sm border-1 border-gray-7 px-1 font-mono text-11 leading-[15px] text-gray-11">
            {row.symbol}
          </span>
        ) : (
          <span
            aria-hidden
            className={cn(
              'size-3 shrink-0 self-center rounded-sm border-1',
              row.error ? 'border-red-9' : 'border-folder',
              row.expanded && !row.error && 'bg-folder',
            )}
          />
        )
      }
      trailing={
        row.error ? (
          <span className="ml-auto shrink-0 font-mono text-11 text-red-9">{row.error}</span>
        ) : row.selected ? (
          <span className="ml-auto shrink-0 text-indigo-9">✓</span>
        ) : null
      }
      onToggle={onToggle}
      onSelect={onSelect}
      className="font-mono text-12/17"
    >
      <span className="truncate">{row.isRoot ? row.annotation : row.label}</span>
    </TreeRow>
  );
}

export interface DirectoryTreeProps {
  roots: WorkdirRoot[];
  selected: string | null;
  onSelect: (path: string) => void;
}

export function DirectoryTree({ roots, selected, onSelect }: DirectoryTreeProps) {
  const tree = useDirectoryTree({ roots, selected, onSelect });
  return (
    <Tree
      activeDescendant={tree.activeDescendant}
      onKeyDown={tree.onKeyDown}
      className="max-h-62 overflow-y-auto rounded-lg bg-surface-inset p-1"
    >
      {tree.rows.map((row) => (
        <Row
          key={row.path}
          row={row}
          elementId={tree.rowElementId(row.path)}
          onToggle={() => tree.toggle(row.path)}
          onSelect={() => tree.select(row.path)}
        />
      ))}
    </Tree>
  );
}
```

Two deliberate changes while here, both fixing hygiene violations the class rules already forbid: `max-h-[250px]` becomes `max-h-62` (248px, a round scale step) and `text-[10.5px]` on the error becomes `text-11`.

- [ ] **Step 5: Run the whole net**

Run: `pnpm --filter @tickets/web exec vitest run src/ui/use-directory-tree.test.ts src/ui/directory-tree.test.tsx src/components/terminal/directory-picker.test.tsx`

Expected: PASS, same count as step 1, **with none of those three files modified**. Confirm:

Run: `git diff --stat apps/web/src/ui/use-directory-tree.test.ts apps/web/src/ui/directory-tree.test.tsx apps/web/src/components/terminal/directory-picker.test.tsx`

Expected: empty output.

- [ ] **Step 6: Run every gate and commit**

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/ui test && pnpm verify:tokens`

```bash
git add apps/web/src/ui/use-directory-tree.ts apps/web/src/ui/directory-tree.tsx
git commit -m "refactor(web): the directory picker runs on useTreeView

Flattening, the expanded set, focus and every key handler move to the
library. What stays is what is actually about directories: react-query
loading, basenames, root symbols, per-node errors and the empty-note row.

The retry-on-re-expand rule is now expressed as data — an errored node
reports no children, so the hook asks to load again — rather than as a
special case inside a toggle handler.

All 13 existing tests pass unedited; they are the evidence this preserved
behaviour, so they were deliberately not touched."
```

---

## Task 12: The schema outline migrates onto `Tree`

**Files:**
- Create: `apps/web/src/components/eer/view/outline/outline-tree.ts`
- Modify: `apps/web/src/components/eer/view/outline/group-node.tsx`, `outline.tsx`
- Test: `apps/web/src/components/eer/view/outline/outline.test.tsx`

**Interfaces:**
- Consumes: `useTreeView`, `Tree`, `TreeRow`, `TreeNode` (Tasks 9, 10); `Dot` (Task 2); `Pill` (Task 1).
- `buildOutline` and `OutlineNode` are UNCHANGED. This task adds a mapping from `OutlineNode[]` to `TreeNode[]` and nothing else in `build-outline.ts`.

**Context:** `GroupNode` today is recursive and renders its own nesting containers. `useTreeView` flattens, so the recursion goes away and indentation comes from `TreeRow`'s guide columns. The outline gains keyboard navigation it has never had.

Two eer-specific behaviours must survive:
1. **Filtering forces every surviving group open.** `buildOutline` has already pruned to matches, so a collapsed group would hide the rows the query asked for.
2. **Only ZONES get a visibility swatch.** `hiddenIds()` resolves everything through `zoneIdOf`, so a subgroup id in the hidden set is an entry nothing reads.

Row ids must not collide: a group and an entity could share a string. Prefix them — `g:${group.id}` and `e:${entity.id}` — and strip the prefix when dispatching.

- [ ] **Step 1: Write the failing test**

Append to `outline.test.tsx`:

```tsx
  it('is a keyboard-navigable tree', async () => {
    // The outline had NO keyboard support before it moved onto the shared tree.
    await renderDiagram(<Outline />, twoZoneRaw());
    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(tree.getAttribute('aria-activedescendant')).toContain('z2');
  });

  it('keeps the group rows as treeitems', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    expect(screen.getAllByRole('treeitem').length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer/view/outline/outline.test.tsx`

Expected: FAIL — there is no `tree` role.

- [ ] **Step 3: Add the outline → tree mapping**

Create `apps/web/src/components/eer/view/outline/outline-tree.ts`. A new file rather than more weight in `group-node.tsx`: this is pure data mapping with no React in it, and it is what the row renderer and `outline.tsx` both read.

```ts
import type { TreeNode } from '@tickets/ui';
import type { Entity } from '../../engine/model/types';
import { outlineCount, type OutlineNode } from './build-outline';

// Row ids are PREFIXED because a group and a table can share a name — a schema
// with a `core` group and a `core` table would otherwise collapse two rows into
// one id, and the tree keys, focus and selection all go by id.
export const groupRowId = (id: string) => `g:${id}`;
export const entityRowId = (id: string) => `e:${id}`;
export const columnRowId = (entityId: string, column: string) => `c:${entityId}:${column}`;

export type OutlineRowData =
  | { kind: 'group'; node: OutlineNode; count: number }
  | { kind: 'entity'; entity: Entity }
  | { kind: 'column'; entityId: string; column: string };

/** The shape useTreeView walks. Subgroups come before this group's own tables,
 *  matching how the recursive renderer used to order them. */
export function outlineToTreeNodes(nodes: OutlineNode[]): TreeNode[] {
  return nodes.map((n) => ({
    id: groupRowId(n.group.id),
    children: [
      ...outlineToTreeNodes(n.children),
      ...n.entities.map((e) => ({
        id: entityRowId(e.entity.id),
        // Matching columns are child rows; a table with none is a leaf.
        children: e.columns.map((c) => ({ id: columnRowId(e.entity.id, c), children: [] })),
      })),
    ],
  }));
}

/** id → what that row IS, so the renderer never re-walks the outline per row. */
export function indexOutline(
  nodes: OutlineNode[],
  into: Map<string, OutlineRowData> = new Map(),
): Map<string, OutlineRowData> {
  for (const n of nodes) {
    into.set(groupRowId(n.group.id), { kind: 'group', node: n, count: outlineCount(n) });
    indexOutline(n.children, into);
    for (const e of n.entities) {
      into.set(entityRowId(e.entity.id), { kind: 'entity', entity: e.entity });
      for (const c of e.columns) {
        into.set(columnRowId(e.entity.id, c), { kind: 'column', entityId: e.entity.id, column: c });
      }
    }
  }
  return into;
}

/** Dispatches a row click. Split on the FIRST colon only — entity ids are
 *  schema-qualified (`terminal.sessions`) and column ids carry two separators. */
export function parseRowId(rowId: string): { kind: string; rest: string } {
  const at = rowId.indexOf(':');
  return { kind: rowId.slice(0, at), rest: rowId.slice(at + 1) };
}
```

- [ ] **Step 4: Replace `group-node.tsx` with a flat row renderer**

It stops recursing — the hook flattens, so this renders exactly one `TreeRow`.

```tsx
// One outline row. Flat, not recursive: useTreeView flattens the tree and hands
// this whichever row it is drawing, so nesting is TreeRow's guide columns
// rather than a container this component wraps around its own children.

import { Dot, TreeRow, cn, type TreeRowModel } from '@tickets/ui';
import { groupColor } from '../../engine/colors/group-color';
import { zoneIdOf } from '../../engine/groups/zone-id-of';
import { useDiagramActions, useDiagramModel, useDiagramUi } from '../../state/diagram-context';
import type { OutlineRowData } from './outline-tree';

export function OutlineRow({
  row,
  data,
  elementId,
  onToggle,
  onSelect,
}: {
  row: TreeRowModel;
  data: OutlineRowData;
  elementId: string;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const actions = useDiagramActions();

  const common = {
    depth: row.depth,
    expanded: row.expanded,
    hasChildren: row.hasChildren,
    selected: row.selected,
    focused: row.focused,
    elementId,
    onToggle,
    onSelect,
  };

  if (data.kind === 'group') {
    const g = data.node.group;
    // Visibility is a ZONE-level fact: hiddenIds() resolves every entity and
    // box through zoneIdOf, so a subgroup id in the hidden set would be an
    // entry nothing reads. Only zones get the toggle; a subgroup reports its
    // zone's state so a hidden zone's whole subtree reads as off.
    const zone = g.parent == null;
    const hidden = ui.hidden.groups.has(zoneIdOf(model, g.id));
    const color = groupColor(model, g.id, ui.colors);
    const swatch = <Dot color={color} hollow={hidden} />;

    return (
      <TreeRow
        {...common}
        caretLabel={g.label}
        label={`${g.label}, ${data.count} ${data.count === 1 ? 'table' : 'tables'}`}
        leading={
          zone ? (
            <button
              type="button"
              tabIndex={-1}
              aria-pressed={!hidden}
              aria-label={`${hidden ? 'Show' : 'Hide'} ${g.label}`}
              title={hidden ? `Show ${g.label}` : `Hide ${g.label}`}
              onClick={actions.toggleGroup.bind(null, g.id)}
              className="flex h-5 w-4 flex-none items-center justify-center self-center"
            >
              {swatch}
            </button>
          ) : (
            <span className="flex h-5 w-4 flex-none items-center justify-center self-center">{swatch}</span>
          )
        }
        trailing={
          <span className="ml-auto flex-none text-11 tabular-nums text-gray-11">{data.count}</span>
        }
        className={cn('text-12', hidden ? 'text-gray-11 line-through' : 'text-gray-12')}
      >
        <span className="truncate">{g.label}</span>
      </TreeRow>
    );
  }

  if (data.kind === 'entity') {
    const e = data.entity;
    // A hidden zone's tables strike through with it. The click still works —
    // the detail panel is worth reaching either way — but without this the
    // canvas appears not to respond, since there is no card to pan to.
    const hidden = ui.hidden.groups.has(zoneIdOf(model, e.group));
    return (
      <TreeRow
        {...common}
        caretLabel={e.label}
        label={e.label}
        className={cn('font-mono text-12 text-gray-11', hidden && 'line-through')}
      >
        <span className="truncate" title={e.id}>
          {e.label}
        </span>
      </TreeRow>
    );
  }

  const lit =
    ui.fieldHighlight?.entityId === data.entityId && ui.fieldHighlight.field === data.column;
  return (
    <TreeRow
      {...common}
      caretLabel={data.column}
      label={data.column}
      className={cn('font-mono text-11', lit ? 'text-gray-12' : 'text-gray-11')}
    >
      <span className="truncate">{data.column}</span>
    </TreeRow>
  );
}
```

- [ ] **Step 5: Rewrite `outline.tsx` to drive the tree**

The search box, counts line, empty state and `<KindFilters/>` are unchanged. What goes is the local `collapsed` state and the `isOpen`/`onToggle` callbacks — expansion is the hook's now, and the filter-forces-open rule is `forceExpanded` rather than a loop of `toggle()`.

```tsx
import { useCallback, useMemo, useState } from 'react';

import { Tree, cn, useTreeView } from '@tickets/ui';
import type { Selection } from '../../engine/model/types';
import {
  useDiagramActionsOrNull,
  useDiagramModelOrNull,
  useDiagramUiOrNull,
} from '../../state/diagram-context';
import { buildOutline } from './build-outline';
import { KindFilters } from './kind-filters';
import { OutlineRow } from './group-node';
import { entityRowId, groupRowId, indexOutline, outlineToTreeNodes, parseRowId } from './outline-tree';

// The tree highlights whatever the CANVAS has selected too, not only what was
// clicked here — one selection, shown in both places.
function selectedRowId(sel: Selection): string | null {
  if (sel.type === 'group') return groupRowId(sel.id);
  if (sel.type === 'entity') return entityRowId(sel.id);
  return null;
}

export function Outline() {
  const model = useDiagramModelOrNull();
  const ui = useDiagramUiOrNull();
  const actions = useDiagramActionsOrNull();

  const [query, setQuery] = useState('');

  const nodes = useMemo(() => (model ? buildOutline(model, query) : []), [model, query]);
  const treeRoots = useMemo(() => outlineToTreeNodes(nodes), [nodes]);
  const index = useMemo(() => indexOutline(nodes), [nodes]);

  const filtering = query.trim().length > 0;

  const onSelect = useCallback(
    (rowId: string) => {
      if (!actions) return;
      const { kind, rest } = parseRowId(rowId);
      if (kind === 'g') {
        actions.selectGroup(rest);
      } else if (kind === 'e') {
        // Selects AND pans — a name in a list is no use if you then have to
        // find the card yourself.
        actions.focusFromSearch(rest);
      } else {
        // `c:<entityId>:<column>` — entity ids are schema-qualified, so the
        // column is after the LAST colon.
        const at = rest.lastIndexOf(':');
        actions.focusFromSearch(rest.slice(0, at), rest.slice(at + 1));
      }
    },
    [actions],
  );

  const tree = useTreeView({
    roots: treeRoots,
    selectedId: ui ? selectedRowId(ui.panelSelection) : null,
    onSelect,
    // buildOutline has already pruned to matches, so a collapsed group would
    // hide the very rows the query asked for. Non-destructive: clearing the
    // filter restores whatever the user had collapsed.
    forceExpanded: filtering,
    idPrefix: 'outline',
  });

  if (!model || !ui || !actions) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <input
        type="text"
        name="eer-outline-filter"
        value={query}
        placeholder="Filter tables…"
        aria-label="Filter tables"
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'w-full rounded-md border-1 border-gray-6 bg-gray-2 px-2 py-1.5 text-12 text-gray-12',
          'outline-none placeholder:text-gray-9 focus:border-gray-7',
        )}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('');
        }}
      />

      <p className="px-1 text-11 text-gray-11">
        {model.entities.length} tables · {model.relationships.length} relationships
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tree.rows.length === 0 ? (
          <p className="px-1 py-2 text-12 text-gray-11">No tables match.</p>
        ) : (
          <Tree activeDescendant={tree.activeDescendant} onKeyDown={tree.onKeyDown}>
            {tree.rows.map((r) => {
              const data = index.get(r.id);
              if (!data) return null;
              return (
                <OutlineRow
                  key={r.id}
                  row={r}
                  data={data}
                  elementId={tree.rowElementId(r.id)}
                  onToggle={() => tree.toggle(r.id)}
                  onSelect={() => tree.select(r.id)}
                />
              );
            })}
          </Tree>
        )}
      </div>

      <KindFilters />
    </div>
  );
}
```

Note the hooks all run before the `if (!model …) return null` guard, as they did before — React requires an unconditional hook order, and `useTreeView` on an empty `roots` array is harmless.

- [ ] **Step 6: Update the outline's own tests**

These are eer's tests and ARE in scope. Expect to change:
- the caret query — `aria-label` is now `expand <label>` / `collapse <label>`, not `<label> subtree`
- `aria-expanded` now lives on the treeitem, not the caret button
- the nesting assertion — rows are flat siblings with guide columns, not nested containers

Do NOT weaken them: every behaviour they pinned (filter, column search, selection, visibility toggle, strikethrough, counts) must still be asserted.

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @tickets/web exec vitest run src/components/eer`

Expected: PASS.

- [ ] **Step 8: Run every gate and commit**

Run: `pnpm typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/ui test && pnpm verify:tokens`

```bash
git add -A apps/web/src/components/eer/view/outline
git commit -m "refactor(web): the schema outline runs on the shared tree

The recursion and the nesting containers go; indentation comes from
TreeRow's guide columns and the outline gains keyboard navigation, ARIA
roles and a roving focus it never had.

build-outline.ts is untouched — it already produced a tree; this adds a
mapping to TreeNode with prefixed row ids, because a group and a table
can share a name."
```

---

## Task 13: Verification

**Files:** none — this task changes nothing. If it needs a fix, that fix is its own commit.

- [ ] **Step 1: Full gate run from a clean tree**

```bash
pnpm typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/ui test && pnpm --filter @tickets/db test && pnpm verify:tokens && pnpm build
```

Expected: all green.

- [ ] **Step 2: Confirm the scope was respected**

```bash
rg -n "rounded-full" apps/web/src/components/eer --glob '!*.test.*'
ls apps/web/src/components/eer/view/detail-panel/
```

Expected: no hand-rolled 8px disc remains; `badge.tsx`, `role-tag.tsx`, `dot.tsx`, `kbd.tsx` are gone; `stat.tsx`, `card.tsx`, `section.tsx`, `empty.tsx` are STILL THERE (out of scope).

```bash
git diff --stat main -- apps/web/src/ui/use-directory-tree.test.ts apps/web/src/ui/directory-tree.test.tsx apps/web/src/components/terminal/directory-picker.test.tsx
```

Expected: empty.

- [ ] **Step 3: Browser verification**

Start a dev server that does not disturb the user's own stack:

```bash
cd apps/web && WEB_DEV_PORT=4622 API_PROXY_TARGET=http://127.0.0.1:4601 pnpm exec vite --host 127.0.0.1
```

On `http://127.0.0.1:4622/schema`, in BOTH themes (the `◐` button in the rail):

1. Detail panel badges — click a table, a group and an edge. The `ENTITY` / `GROUP` / `EDGE` pills keep their tinted colours and read at 9px.
2. Canvas pk/fk marks — confirm the rung-11 hue is legible against the card in both themes. **This is one of the two flagged changes.**
3. Empty-state control hints — the keycaps are now outline pills. **This is the other flagged change; judge whether they still read as keys.**
4. Outline tree — click into it, then `ArrowDown` / `ArrowUp` / `ArrowRight` / `ArrowLeft` / `Home` / `End` / `Enter`. Confirm the focus ring moves and Enter selects.
5. Outline filter — type `session`; confirm matching groups open. Type `emoji`; confirm the column row appears and clicking it pans the canvas.
6. Group visibility — click a swatch; the zone leaves the canvas, its label and tables strike through, and the swatch reads hollow.
7. Indent guides — confirm the outline still shows its nesting line.

On the new-session dialog (Terminals → New), open the directory picker:

8. Expand a folder; confirm the spinner appears in the caret's place, children arrive, and guide lines now render.
9. Keyboard: `ArrowDown`/`ArrowRight`/`ArrowLeft`/`Enter` behave as before, and Tab moves past the tree rather than into its rows.

- [ ] **Step 4: Report**

Write up what was verified, with the two flagged changes (canvas pk/fk hue, keycaps) called out explicitly and a recommendation on each: keep, or revert to a `className` override. Do not silently change them — the spec accepted both, so reversing one is a decision to surface.

---

## Self-Review

**Spec coverage.** Decision 1 (Pill `xs` + `tint`, five call sites) → Tasks 1, 3, 4, 6, 7. Decision 2 (`Dot` moves) → Tasks 2, 5. Decision 3 (`Stat` stays) → enforced by a Global Constraint and checked in Task 13 step 2. Decision 4 (caret → `Icon`) → Task 8, and `TreeRow` renders the same chevrons for both trees. Decision 5 (generic tree, both consumers migrated) → Tasks 9, 10, 11, 12. Every visual delta in the spec's table is either asserted by a test or listed in Task 13's browser pass.

**Type consistency.** `TreeNode`, `TreeRowModel`, `UseTreeViewOptions`, `UseTreeViewResult` are defined once in Task 9 and referenced with identical field names in Tasks 10, 11 and 12. `TreeRowProps` is defined in Task 10 and consumed unchanged in 11 and 12. `BadgeTone` / `BADGE_TONE` are defined in Task 3 and used only there. `PillVariant` / `PillSize` are widened in Task 1 before any consumer.

**Two failures found and fixed during review, recorded so they are not
reintroduced:**

1. Task 12 originally *sketched* `OutlineRow` and the `outline.tsx` rewrite in
   comments instead of writing them. Both are now spelled out in full, and the
   mapping they share moved to its own `outline-tree.ts`.
2. The filter-forces-open rule was originally an effect looping `tree.toggle()`
   over every row, with `tree` in its dependency array — an infinite render
   loop, since the hook returns a fresh object every render. It is now a
   `forceExpanded` flag on `useTreeView`, which is also non-destructive:
   clearing the filter restores what the user had collapsed, where expanding
   the set would have silently discarded it. Task 9 gained a test for exactly
   that round trip.

**Remaining risk, stated rather than hidden.** Task 12 step 6 says the outline's
own tests must be updated but does not spell out the new assertions, because
which queries break depends on choices the implementer makes in step 4. The
constraint is stated instead: every behaviour those tests pinned — filter,
column search, selection, visibility toggle, strikethrough, counts — must still
be asserted afterwards. A reviewer should check that list against the diff.
