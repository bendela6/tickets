# Shared primitives: Pill adoption, Dot, and a generic TreeView

**Date:** 2026-08-01
**Status:** approved, ready for planning

## Goal

Retire five bespoke renderings in `apps/web/src/components/eer` onto `@tickets/ui`,
promote the one primitive the library is missing, and replace two independently-written
tree implementations with one.

The audit that produced this is at
`https://claude.ai/code/artifact/d40ba48d-a5c0-4a91-8e74-d6484c5bff88` — every renderable
part of the eer module drawn at true size.

## Locked decisions

1. **`Pill` gains `size="xs"` and `variant="tint"`**, and `Badge`, `RoleTag`, the
   `FieldRow` badge, `Chip` and `Kbd` all retire onto it. Chosen over adopting `Pill`
   as-is (which moved 9px text to 11px) and over an `xs`-only change.
2. **`Dot` moves to `@tickets/ui`.**
3. **`Stat` stays in eer.** It is specific enough not to earn a place in the library.
4. **The disclosure caret uses `Icon`** (`chevron-down` / `chevron-right`).
5. **A generic tree lands in `@tickets/ui` as a mechanics hook plus a slot shell, and
   BOTH existing trees migrate onto it** — the eer outline and the directory picker.
   Chosen over building a tree for the outline alone.

## Why a tree belongs in the library

Two independent implementations already exist:

| | `apps/web/src/ui/directory-tree.tsx` | `apps/web/src/components/eer/view/outline/group-node.tsx` |
|---|---|---|
| Children | async, lazy, react-query | synchronous, fully materialised |
| Keyboard | arrows, Home/End, typeahead, roving `aria-activedescendant` | **none** |
| ARIA | `role="tree"` / `role="treeitem"` / `aria-expanded` / `aria-selected` | **none** |
| Indent | `paddingLeft: 8 + depth * 16` | nested bordered containers |
| Row content | folder square, root symbol chip, error text, `✓` | colour swatch (a button), count, strikethrough |
| Caret | hand-rolled `clip-path` triangle, `Spinner` while loading | `▾` / `▸` text glyphs |

The directory picker is the demanding one and is where the generic behaviour comes from.
The outline is the simpler consumer and gains keyboard navigation and ARIA it has never
had. Row *content* has nothing in common between them, which is precisely why the shared
piece must be mechanics and structure, not markup.

## Step 1 — `Pill`: `size="xs"` and `variant="tint"`

Both are Pill-only. `Button` gets neither, matching how `text` (Pill) and `ghost`
(Button) already diverge. The existing parity test compares only the three shared
variants (`subtle`, `solid`, `outline`), so it needs no change.

```ts
// packages/web/ui/src/components/pill/pill.tsx
variant: {
  options: {
    // …subtle, solid, outline, text unchanged…
    tint: over(NEUTRAL_SCALE, (tone) => `bg-${tone}-9/15 text-${tone}-11`),
  },
},
size: {
  options: {
    xs: 'h-4 gap-1 px-2 text-9/11 tracking-widest leading-none',
    // …sm, md, lg unchanged…
  },
},
```

**Why `h-4` (16px) and not Badge's current 19px.** Badge is padding-sized — an inline
span at `4px 8px` around 9px text, measuring 19px. Every `Pill` size instead sets a fixed
height (`sm` 18px, `md` 22px, `lg` 28px). Preserving 19px exactly would make `xs` *taller
than `sm`*, which is not a size axis. `h-4` keeps the ladder monotonic at 16 / 18 / 22 /
28 and lands exactly on `RoleTag`'s existing `leading-4` box, so `RoleTag` comes out
pixel-identical and `Badge` tightens by 3px. That 3px is the honest cost of putting these
on a shared scale; it is not removable without an off-scale height.

`PillVariant` becomes `'subtle' | 'solid' | 'outline' | 'text' | 'tint'`.
`PillSize` becomes `'xs' | 'sm' | 'md' | 'lg'`, and `ICON_SIZE` gains `xs: '2xs'`.

### Call sites, exactly

| File | Today | Becomes | Deleted |
|---|---|---|---|
| `view/detail-panel/badge.tsx` | `Badge tone="entity\|group\|subgroup\|edge"` | `<Pill variant="tint" size="xs" tone={BADGE_TONE[tone]} label={…} className="font-mono uppercase" />` | yes — the `Tone` → hue map moves to the two call sites' shared module in eer |
| `view/detail-panel/role-tag.tsx` | `RoleTag role="pk"\|"fk"\|null` | `<Pill variant="tint" size="xs" tone={role === 'pk' ? 'yellow' : 'green'} label={role.toUpperCase()} className="w-7 justify-center font-mono" />`; `null` keeps the 28px spacer | yes |
| `view/diagram/entity-cards/field-row.tsx` | inline `<span className="text-9 … text-yellow-9">` | `<Pill variant="text" size="xs" tone={…} label={…} className="font-mono" />` | inline markup |
| `view/outline/chip.tsx` | `Chip on color onClick` | `<Pill variant="outline" shape="round" size="sm" pressed={on} strikethrough={!on} icon={<Dot color={color} hollow={!on} />} onClick label />` | yes |
| `view/detail-panel/kbd.tsx` | `<kbd>` keycap | `<Pill variant="outline" size="sm" label={…} className="font-mono" />` | yes |

`uppercase` and `font-mono` ride `className` rather than becoming Pill axes: they are
this module's editorial choices, not treatments the library owes every consumer.

**The one technical risk, verified first.** `tint` is the only variant using an opacity
modifier (`/15`) inside an enumerated `variants()` call. `scripts/extract-safelist.mjs`
walks every such call and writes `safelist.generated.css`, which `tokens:verify` then
gates with `git diff --exit-code`. Confirm the modifier survives enumeration and that
the regenerated safelist is committed **before** any call site is migrated. If it does
not survive, `tint` falls back to a hand-written class map and the rest of the spec is
unaffected.

## Step 2 — `Dot` moves to `@tickets/ui`

Moved as-is, plus one boolean. Full folder contract: `dot.tsx`, `dot.test.tsx`,
`dot.demo.tsx`, `index.ts`, and a re-export from `components/index.ts`.

```tsx
export function Dot({ color, hollow, className }: DotProps) { … }
```

`color` is a raw CSS colour, not a tone — that is the whole reason this component
exists. Group hues arrive from a palette and `color-mix()` at runtime, so a token *name*
cannot express them. `hollow` renders a ring instead of a fill, for the outline's
"zone hidden" state, which today fakes it by passing border classes through `className`.

No `tone` prop until a second consumer wants one.

This deletes `view/detail-panel/dot.tsx` and the two inline copies in
`view/outline/chip.tsx` and `view/outline/group-node.tsx`.

## Step 3 — Carets become `Icon`

`group-node`'s `▾` / `▸` become `<Icon name="chevron-down" />` / `chevron-right`.
The directory picker's `clip-path` triangle is replaced in step 4, where its
loading state (a `Spinner` in the caret's place) is handled by `TreeRow`'s `caret` slot.

## Step 4 — `useTreeView` + `<Tree>` / `<TreeRow>`

### The hook owns mechanics and never fetches

```ts
export interface TreeNode {
  id: string;
  /** Materialised children. `undefined` means "not loaded yet" — the async seam. */
  children?: TreeNode[];
}

export interface TreeRowModel {
  id: string;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  focused: boolean;
}

export interface UseTreeViewOptions {
  roots: TreeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Called when expanding a node whose `children` are `undefined`. */
  onExpand?: (id: string) => void;
  /** Prefix for generated row element ids, so two trees on one page don't collide. */
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

Consumers normalise their own data into `TreeNode[]` and look their own records back up
by `id`. `children: undefined` is the async seam: the hook calls `onExpand` and the
consumer supplies children on the next render. React Query stays in the directory
picker, where it belongs — the library takes no data-fetching dependency.

Keyboard behaviour is carried over verbatim from `use-directory-tree.ts`, including the
subtlety its comment records: `ArrowLeft` on a collapsed node moves to **the nearest
preceding row of strictly smaller depth**, not the previous visible row, which would
land on a sibling.

### The shell owns ARIA and indentation, nothing else

```tsx
<Tree activeDescendant onKeyDown>        // role="tree", tabIndex=0
  <TreeRow
    depth expanded hasChildren selected focused
    elementId
    caret={…}      // override — the picker puts a Spinner here while loading
    leading={…}    // folder square / root chip · colour swatch (may be interactive)
    trailing={…}   // error text, ✓ · count
    onToggle onSelect
  >
    {label}
  </TreeRow>
</Tree>
```

Row structure follows what `DirectoryTree` already ships: the caret button and the
`leading` slot sit **outside** the `role="treeitem"` element, which is the label button.
This is deliberate — the outline's swatch is a separate action (hide this zone), not
part of selecting the node, and nesting an interactive control inside a `treeitem`
would break its semantics.

Indentation renders as `depth` guide columns of 16px, each drawing a hairline. The
outline keeps a guide line it would otherwise lose to flattening, and the directory
picker gains one.

### Migration

- `apps/web/src/ui/use-directory-tree.ts` keeps directory concerns only: react-query
  loading, `basename`, `WorkdirRoot` symbols and annotations, per-node error state, and
  the errored-node-drops-its-cache-on-collapse rule. It builds `TreeNode[]` and defers
  everything else to `useTreeView`.
- `apps/web/src/ui/directory-tree.tsx` renders `<Tree>`/`<TreeRow>` with its existing
  row content in the slots.
- `apps/web/src/components/eer/view/outline/group-node.tsx` collapses into a row renderer
  over the same shell. `build-outline.ts` is unchanged — it already produces a tree, and
  gains a small mapping to `TreeNode[]`.

## Visual changes, stated plainly

Measured on the running app, not estimated.

| Where | Today | After | Note |
|---|---|---|---|
| `Badge` | 19px tall (padding-sized) | 16px tall (`h-4`) | See above. 3px, and the price of a monotonic size ladder. |
| `RoleTag` | 16px tall (`leading-4`), `w-7` | unchanged | `h-4` lands exactly on it. |
| `Badge`, `RoleTag` colour | 9px / 600 / mono / `0.1em` / `bg hue-9/15` / `text hue-11` | unchanged | This is what `xs` + `tint` buy. |
| `FieldRow` badge | `text-yellow-9`, `tracking-wide` | `text-yellow-11`, `tracking-widest` | `Pill variant="text"` paints from rung 11. A visible hue shift on the canvas card's PK/FK marks. |
| `Chip` → `Pill` | `border-1` | `border-2` | `Pill`'s outline is 2px. Only reachable on `/schema` when a model declares edge kinds — the database graph declares none, so invisible today. |
| `Kbd` → `Pill` | 22.9px tall, 11px, `bg-gray-3`, `border-1` + `border-b-2` | 18px tall (`size="sm"`), 11px, no fill, uniform `border-2` | The weakest of the five. Keycaps shrink, lose their fill and their heavier bottom edge. |
| `Kbd` element | `<kbd>` | `<span>` | Semantics lost; `Pill` renders a span. Accepted rather than adding an `as` prop to a core primitive for three shortcut hints on one empty state. |
| Outline indent | nested bordered containers | `depth` guide columns | Line survives, drawn differently. |
| Directory picker | no indent guides | guide columns | Gained. |
| Outline keyboard | none | arrows, Home/End, typeahead, roving focus | Gained. |

`Kbd` and the `FieldRow` badge are the two worth a second look once they are on screen.
Both are a small revert if they read badly.

## Testing

Every step ends green on the full gate set, not just its own tests.

- **Step 1** — Pill demo covers `xs` and `tint` across tones. A test pins that `tint`
  paints `bg-<tone>-9/15` and `text-<tone>-11`, and that `xs` is 9px. Then
  `pnpm verify:tokens` with the regenerated safelist committed.
- **Step 2** — `Dot` renders the given colour through a custom property, and `hollow`
  draws a ring with no fill.
- **Step 4** — `useTreeView` is tested as a pure hook: flattening at depth, expand and
  collapse, `onExpand` fires exactly once for an unloaded node, and every keyboard case
  including the `ArrowLeft`-finds-the-parent rule. `Tree`/`TreeRow` are tested for ARIA
  wiring. The directory picker's existing tests must pass **unchanged** — they are the
  regression net for the migration, so they are not to be edited to fit the new
  internals. If one genuinely must change, that is a finding to raise, not a fix to make.

Gates for every step: `pnpm typecheck` · `pnpm --filter @tickets/web test` ·
`pnpm --filter @tickets/ui test` · `pnpm verify:tokens` · `pnpm build`.

Browser verification at the end: `/schema` in both themes for the badges, the outline
tree and keyboard navigation; the new-session dialog for the directory picker.

## Out of scope

- `Stat` stays in eer (decision 3).
- `Empty`, `Header`, `RelRow`/`rowClass`, `EmptyState`, `EntityCard`, `FieldRow`,
  `RoutingMenu`, `KindFilters` keep their current homes; only the primitives inside them
  change.
- The `entity` / `group` / `subgroup` / `edge` and `pk` / `fk` vocabularies stay in
  `apps/web` — `packages/web/ui/src/components/domain-free.test.ts` forbids them in the
  library, and that boundary is not being moved.
- No new tokens. Every value used here already exists.

## Types

Defined above and repeated here so this page stands alone.

```ts
// @tickets/ui — new
type PillVariant = 'subtle' | 'solid' | 'outline' | 'text' | 'tint';
type PillSize = 'xs' | 'sm' | 'md' | 'lg';

interface DotProps {
  /** A raw CSS colour — a token name cannot express a runtime `color-mix()`. */
  color?: string;
  /** Ring instead of fill, for an "off" state. */
  hollow?: boolean;
  className?: string;
}

interface TreeNode { id: string; children?: TreeNode[] }

interface TreeRowModel {
  id: string; depth: number; expanded: boolean;
  hasChildren: boolean; selected: boolean; focused: boolean;
}

interface UseTreeViewOptions {
  roots: TreeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onExpand?: (id: string) => void;
  idPrefix: string;
}

interface UseTreeViewResult {
  rows: TreeRowModel[];
  toggle: (id: string) => void;
  select: (id: string) => void;
  focusId: string | null;
  setFocusId: (id: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  activeDescendant: string | undefined;
  rowElementId: (id: string) => string;
}

// existing, referenced above — generated from tones.tokens.json
type Tone =
  | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral'
  | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'cyan'
  | 'blue' | 'indigo' | 'purple' | 'pink' | 'gray';

// eer's own vocabulary, staying in apps/web
type BadgeTone = 'entity' | 'group' | 'subgroup' | 'edge';
const BADGE_TONE: Record<BadgeTone, Tone> = {
  entity: 'blue', group: 'indigo', subgroup: 'green', edge: 'yellow',
};

interface WorkdirRoot { path: string; symbol: string; annotation?: string }
```
