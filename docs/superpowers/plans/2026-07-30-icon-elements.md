# Icon Elements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `MarkConfig`, which describes one specific drawing, with `IconDoc`, which describes any drawing — so the icon studio composes icons from controllable elements instead of tuning three hardcoded sticks.

**Architecture:** A document holds named inks, an ordered list of parametric elements, and variants that re-point the palette and apply one uniform scale. A single `renderSvg(doc, variant)` replaces the four hardcoded generators. Old configs migrate on read. The export pipeline consumes a rendered SVG string and is deliberately untouched.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React 19, Vite 8, Vitest, `@tickets/ui`.

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-30-icon-elements-design.md`. Read it before Task 1.
- Grid is 48 units, centre `24,24`. Both stay code constants, not document fields.
- `BARE_REACH = 18` is the bare mark's reach and the migration divisor for chip scale.
- Three primitives only: `stick`, `ring`, `dot`. Do NOT add `arc`, `polygon` or a raw-path type.
- Colour is referenced by ink name everywhere, including a variant's field. No literal hex in an element or a variant.
- A variant's `scale` multiplies lengths AND stroke widths together. Never scale one without the other.
- Ink resolutions are exactly: `theme`, `light`, `dark`, `black`.
- `renderSvg(doc, variant)` takes no theme flag. The variant alone decides.
- Do NOT modify `src/plugin/outputs.ts`, `src/generate/raster.ts`, `src/generate/head.ts` or `src/generate/manifest.ts` beyond the signature changes named in Task 7.
- TypeScript is strict with `noUncheckedIndexedAccess`: never index an array without handling `undefined`, and never use a non-null assertion (`!`). The suite is checked for these.
- Every test must be shown able to fail. After writing a test, break the implementation deliberately, confirm that exact test fails, then restore. State the evidence in the commit or report.
- Commands: `pnpm --filter @tickets/icon-studio test`, `pnpm --filter @tickets/icon-studio typecheck`. Both must pass before any commit.
- Conventional commits scoped to the app: `feat(icon-studio): …`, `refactor(icon-studio): …`.
- Tailwind: no arbitrary `[...]` values. Use `border-1`, never bare `border` — bare `border` compiles but fails `packages/web/ui/src/tokens/vocabulary.test.ts`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/doc.ts` (create) | `IconDoc`, `Element`, `Ink`, `Variant` types; `DEFAULT_DOC`; grid constants |
| `src/doc.test.ts` (create) | Default document matches the locked mark |
| `src/migrate.ts` (create) | `toDoc(unknown): IconDoc` — old `MarkConfig` shape to `IconDoc` |
| `src/migrate.test.ts` (create) | Migration field by field, plus already-migrated passthrough |
| `src/generate/render.ts` (create) | `renderSvg(doc, variant)`, `resolveInk`, `scaleOf`, `outerExtent` |
| `src/generate/render.test.ts` (create) | One test per primitive, ink resolution, ratio invariance |
| `src/generate/svg.ts` (modify) | Reduced to thin wrappers over `renderSvg`, then deleted in Task 7 |
| `src/motion.ts` (modify) | Triples become arrays; formation spreads the spinning subset at `180/N` |
| `src/motion.test.ts` (modify) | Existing invariants re-asserted against arrays; new N-element cases |
| `src/state.ts` (modify) | State holds an `IconDoc`; element add/remove/reorder/update actions |
| `src/controls/element-panel.tsx` (create) | Per-element controls, driven by element type |
| `src/controls/ink-panel.tsx` (create) | Named ink swatches with contrast readouts |
| `src/plugin/write.ts` (modify) | `assertIconDoc` replaces the `MarkConfig` validation |
| `src/studio.tsx` (modify) | Wires the new panels |

---

### Task 1: The document types and the default document

**Files:**
- Create: `packages/web/icon-studio/src/doc.ts`
- Create: `packages/web/icon-studio/src/doc.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `IconDoc`, `Element`, `Stick`, `Ring`, `Dot`, `Ink`, `Variant`, `InkResolution`, `Field`, `DEFAULT_DOC`, `CENTRE`, `GRID`, `BARE_REACH`.

- [ ] **Step 1: Write the failing test**

Create `src/doc.test.ts`:

```ts
import { expect, test } from 'vitest';
import { BARE_REACH, CENTRE, DEFAULT_DOC, GRID } from './doc';

test('the grid is the 48-unit square the mark spec locks', () => {
  expect(GRID).toBe(48);
  expect(CENTRE).toBe(24);
  expect(BARE_REACH).toBe(18);
});

test('the default document is the locked mark: three spinning sticks on three inks', () => {
  expect(Object.keys(DEFAULT_DOC.inks).sort()).toEqual(['field', 'low', 'mid', 'top']);
  expect(DEFAULT_DOC.inks.top).toEqual({ light: '#7167ff', dark: '#6652ff' });
  expect(DEFAULT_DOC.inks.mid).toEqual({ light: '#00bb9a', dark: '#12b898' });
  expect(DEFAULT_DOC.inks.low).toEqual({ light: '#ff298a', dark: '#ff378c' });
  // The chip field is dark in both themes — a coloured field cannot knock out
  // three colours.
  expect(DEFAULT_DOC.inks.field).toEqual({ light: '#1b1830', dark: '#1b1830' });

  expect(DEFAULT_DOC.elements).toEqual([
    { id: 'top', type: 'stick', ink: 'top', spin: true, angle: 62, reach: 18, weight: 6 },
    { id: 'mid', type: 'stick', ink: 'mid', spin: true, angle: 27, reach: 18, weight: 6 },
    { id: 'low', type: 'stick', ink: 'low', spin: true, angle: 160, reach: 18, weight: 6 },
  ]);
});

test('the built-in variants reproduce the four renderings', () => {
  expect(DEFAULT_DOC.variants.favicon).toEqual({ inks: 'theme', scale: 1 });
  expect(DEFAULT_DOC.variants.mono).toEqual({ inks: 'black', scale: 1 });
  expect(DEFAULT_DOC.variants.chip).toEqual({
    inks: 'dark',
    scale: 14 / 18,
    field: { ink: 'field', radius: 11 },
  });
});

test('the motion block carries the spec values', () => {
  expect(DEFAULT_DOC.motion).toEqual({
    speed: 120,
    restSpread: 8,
    ramp: 0.9,
    restPose: 'logo',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test -- doc`
Expected: FAIL — `Failed to resolve import "./doc"`.

- [ ] **Step 3: Write the implementation**

Create `src/doc.ts`:

```ts
/**
 * What an icon *is*, as data. `MarkConfig` described one specific drawing —
 * three sticks — so nothing else could ever be drawn. A document holds named
 * inks, an ordered list of elements, and variants that re-point the palette and
 * scale the whole drawing.
 */

/** The square every measurement is expressed against. */
export const GRID = 48;
export const CENTRE = GRID / 2;

/** Reach of a bare stick: it spans the full diameter, 6..42 on a 48 grid. */
export const BARE_REACH = 18;

/** Weight-to-reach ratio the bare mark holds, and every scaled variant inherits. */
export const RATIO = 1 / 3;

/** A colour with a value per theme. */
export interface Ink {
  light: string;
  dark: string;
}

interface ElementBase {
  /** Stable across edits; React keys and per-element controls hang off it. */
  id: string;
  /** Name of an entry in `IconDoc.inks`. */
  ink: string;
  /** Takes part in the running formation. */
  spin?: boolean;
}

/** A full diameter through the centre, rotated. */
export interface Stick extends ElementBase {
  type: 'stick';
  /** Degrees. */
  angle: number;
  /** Half-length, in grid units. */
  reach: number;
  /** Stroke width, in grid units. */
  weight: number;
}

/** A concentric stroked circle. */
export interface Ring extends ElementBase {
  type: 'ring';
  radius: number;
  weight: number;
}

/** A filled circle at an arbitrary point on the grid. */
export interface Dot extends ElementBase {
  type: 'dot';
  /** `[x, y]` in grid units. */
  at: [number, number];
  radius: number;
}

export type Element = Stick | Ring | Dot;
export type ElementType = Element['type'];

export const ELEMENT_TYPES: readonly ElementType[] = ['stick', 'ring', 'dot'];

/** How a variant resolves every ink. */
export type InkResolution = 'theme' | 'light' | 'dark' | 'black';

export const INK_RESOLUTIONS: readonly InkResolution[] = ['theme', 'light', 'dark', 'black'];

/** The plate a variant draws its elements on. */
export interface Field {
  /** Name of an entry in `IconDoc.inks`, like any other colour. */
  ink: string;
  /** Corner radius in grid units; 0 is square. */
  radius: number;
}

export interface Variant {
  inks: InkResolution;
  /** Multiplies every element's lengths and stroke widths together. */
  scale: number;
  field?: Field;
}

/** Unchanged from the mark spec. */
export interface MotionConfig {
  speed: number;
  restSpread: number;
  ramp: number;
  restPose: 'logo' | 'fan';
}

export interface IconDoc {
  inks: Record<string, Ink>;
  /** Painted in order, back to front. */
  elements: Element[];
  variants: Record<string, Variant>;
  motion: MotionConfig;
}

/**
 * The locked mark, expressed as a document. Element ids match the stick names
 * the mark spec uses, so a reader can line this up against it.
 */
export const DEFAULT_DOC: IconDoc = {
  inks: {
    top: { light: '#7167ff', dark: '#6652ff' },
    mid: { light: '#00bb9a', dark: '#12b898' },
    low: { light: '#ff298a', dark: '#ff378c' },
    field: { light: '#1b1830', dark: '#1b1830' },
  },
  elements: [
    { id: 'top', type: 'stick', ink: 'top', spin: true, angle: 62, reach: BARE_REACH, weight: 6 },
    { id: 'mid', type: 'stick', ink: 'mid', spin: true, angle: 27, reach: BARE_REACH, weight: 6 },
    { id: 'low', type: 'stick', ink: 'low', spin: true, angle: 160, reach: BARE_REACH, weight: 6 },
  ],
  variants: {
    favicon: { inks: 'theme', scale: 1 },
    mono: { inks: 'black', scale: 1 },
    chip: { inks: 'dark', scale: 14 / BARE_REACH, field: { ink: 'field', radius: 11 } },
  },
  motion: { speed: 120, restSpread: 8, ramp: 0.9, restPose: 'logo' },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test -- doc`
Expected: PASS, 4 tests.

- [ ] **Step 5: Prove the tests can fail**

Change `angle: 62` to `angle: 63` in `DEFAULT_DOC`. Re-run. Expected: the "locked mark" test fails. Restore it.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter @tickets/icon-studio typecheck
git add packages/web/icon-studio/src/doc.ts packages/web/icon-studio/src/doc.test.ts
git commit -m "feat(icon-studio): IconDoc — the drawing as data"
```

---

### Task 2: Migration from the old config shape

**Files:**
- Create: `packages/web/icon-studio/src/migrate.ts`
- Create: `packages/web/icon-studio/src/migrate.test.ts`

**Interfaces:**
- Consumes: `IconDoc`, `DEFAULT_DOC`, `BARE_REACH` from `./doc`.
- Produces: `toDoc(value: unknown): IconDoc`.

**Context:** `apps/web/icons.config.json` holds the old shape — `light`, `dark`, `chip`, `angles`, `bareWeight`, `chipReach`, `chipWeight`, `motion`. It must keep opening. `chipWeight` is dropped, because scale derives it.

- [ ] **Step 1: Write the failing test**

Create `src/migrate.test.ts`:

```ts
import { expect, test } from 'vitest';
import { BARE_REACH, DEFAULT_DOC } from './doc';
import { toDoc } from './migrate';

const OLD = {
  light: ['#7167ff', '#00bb9a', '#ff298a'],
  dark: ['#6652ff', '#12b898', '#ff378c'],
  chip: '#1b1830',
  angles: [62, 27, 160],
  bareWeight: 6,
  chipReach: 14,
  chipWeight: 4.6,
  motion: { speed: 120, restSpread: 8, ramp: 0.9, restPose: 'logo' },
};

test('the locked old config migrates to the default document', () => {
  expect(toDoc(OLD)).toEqual(DEFAULT_DOC);
});

test('angles and weight become one stick element each, in painted order', () => {
  const doc = toDoc({ ...OLD, angles: [10, 55, 100], bareWeight: 8 });

  expect(doc.elements.map((e) => e.type)).toEqual(['stick', 'stick', 'stick']);
  expect(doc.elements.map((e) => (e.type === 'stick' ? e.angle : null))).toEqual([10, 55, 100]);
  expect(doc.elements.map((e) => (e.type === 'stick' ? e.weight : null))).toEqual([8, 8, 8]);
  expect(doc.elements.every((e) => e.spin === true)).toBe(true);
});

test('chip reach becomes a scale, and chipWeight is dropped', () => {
  const doc = toDoc({ ...OLD, chipReach: 18, bareWeight: 8, chipWeight: 8 });

  expect(doc.variants.chip?.scale).toBeCloseTo(18 / BARE_REACH, 10);
  expect(JSON.stringify(doc)).not.toContain('chipWeight');
});

test('the chip colour becomes an ink, dark in both themes', () => {
  const doc = toDoc({ ...OLD, chip: '#123456' });
  expect(doc.inks.field).toEqual({ light: '#123456', dark: '#123456' });
  expect(doc.variants.chip?.field).toEqual({ ink: 'field', radius: 11 });
});

test('a document that is already migrated passes through untouched', () => {
  expect(toDoc(DEFAULT_DOC)).toEqual(DEFAULT_DOC);
});

test('anything unrecognisable falls back to the default document', () => {
  // A hand-broken file must not produce a half-built document that then renders
  // as an empty icon.
  expect(toDoc(null)).toEqual(DEFAULT_DOC);
  expect(toDoc({ nonsense: true })).toEqual(DEFAULT_DOC);
  expect(toDoc({ ...OLD, angles: [1, 2] })).toEqual(DEFAULT_DOC);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test -- migrate`
Expected: FAIL — `Failed to resolve import "./migrate"`.

- [ ] **Step 3: Write the implementation**

Create `src/migrate.ts`:

```ts
import {
  BARE_REACH, DEFAULT_DOC, type Element, type IconDoc, type Ink, type MotionConfig,
} from './doc';

/**
 * Reads whatever is in `icons.config.json` and returns a document.
 *
 * Forgiving on read, strict on write — the same posture the motion block uses.
 * A file predating elements still opens, and the studio writes the new shape on
 * the next Generate. Anything it cannot make sense of falls back to the default
 * document whole, rather than producing a half-built one that would render as an
 * empty icon and then be written back over the real file.
 */

const STICK_IDS = ['top', 'mid', 'low'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function triple(value: unknown): [unknown, unknown, unknown] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [a, b, c] = value;
  return [a, b, c];
}

function hexTriple(value: unknown): [string, string, string] | null {
  const parts = triple(value);
  if (!parts) return null;
  if (!parts.every((p) => typeof p === 'string')) return null;
  const [a, b, c] = parts as [string, string, string];
  return [a, b, c];
}

function numberTriple(value: unknown): [number, number, number] | null {
  const parts = triple(value);
  if (!parts) return null;
  if (!parts.every((p) => typeof p === 'number' && Number.isFinite(p))) return null;
  const [a, b, c] = parts as [number, number, number];
  return [a, b, c];
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function motionOf(value: unknown): MotionConfig {
  if (!isRecord(value)) return { ...DEFAULT_DOC.motion };
  const { speed, restSpread, ramp, restPose } = value;
  return {
    speed: positive(speed) ?? DEFAULT_DOC.motion.speed,
    restSpread:
      typeof restSpread === 'number' && Number.isFinite(restSpread) && restSpread >= 0
        ? restSpread
        : DEFAULT_DOC.motion.restSpread,
    ramp:
      typeof ramp === 'number' && Number.isFinite(ramp) && ramp >= 0
        ? ramp
        : DEFAULT_DOC.motion.ramp,
    restPose: restPose === 'fan' ? 'fan' : 'logo',
  };
}

/** Already a document? Recognised by the two fields the old shape never had. */
function isDoc(value: unknown): value is IconDoc {
  return isRecord(value) && Array.isArray(value.elements) && isRecord(value.inks);
}

export function toDoc(value: unknown): IconDoc {
  if (isDoc(value)) return value;
  if (!isRecord(value)) return structuredClone(DEFAULT_DOC);

  const light = hexTriple(value.light);
  const dark = hexTriple(value.dark);
  const angles = numberTriple(value.angles);
  const weight = positive(value.bareWeight);
  const chipReach = positive(value.chipReach);
  const chip = typeof value.chip === 'string' ? value.chip : null;

  if (!light || !dark || !angles || weight === null || chipReach === null || !chip) {
    return structuredClone(DEFAULT_DOC);
  }

  const inks: Record<string, Ink> = {
    field: { light: chip, dark: chip },
  };
  STICK_IDS.forEach((id, i) => {
    inks[id] = { light: light[i] ?? '#000000', dark: dark[i] ?? '#000000' };
  });

  const elements: Element[] = STICK_IDS.map((id, i) => ({
    id,
    type: 'stick',
    ink: id,
    spin: true,
    angle: angles[i] ?? 0,
    reach: BARE_REACH,
    weight,
  }));

  return {
    inks,
    elements,
    variants: {
      favicon: { inks: 'theme', scale: 1 },
      mono: { inks: 'black', scale: 1 },
      // chipWeight is deliberately not read: one scale derives it, which is what
      // stops the ratio drifting.
      chip: { inks: 'dark', scale: chipReach / BARE_REACH, field: { ink: 'field', radius: 11 } },
    },
    motion: motionOf(value.motion),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test -- migrate`
Expected: PASS, 6 tests.

- [ ] **Step 5: Prove the tests can fail**

Change `scale: chipReach / BARE_REACH` to `scale: 1`. Re-run. Expected: "chip reach becomes a scale" fails. Restore.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter @tickets/icon-studio typecheck
git add packages/web/icon-studio/src/migrate.ts packages/web/icon-studio/src/migrate.test.ts
git commit -m "feat(icon-studio): migrate old configs to IconDoc on read"
```

---

### Task 3: The renderer

**Files:**
- Create: `packages/web/icon-studio/src/generate/render.ts`
- Create: `packages/web/icon-studio/src/generate/render.test.ts`

**Interfaces:**
- Consumes: `IconDoc`, `Element`, `Variant`, `InkResolution`, `CENTRE`, `GRID` from `../doc`.
- Produces: `renderSvg(doc: IconDoc, variant: string): string`, `resolveInk(doc, name, resolution): { light: string; dark: string }`, `outerExtent(doc, variant): number`, `safeZonePct(doc, variant): number`.

**Context:** This replaces `svgFavicon`, `svgBare`, `svgMono` and `svgChip`. The favicon's theme swap is a `<style>` block with `prefers-color-scheme`, exactly as `generate/svg.ts` writes it today — read that file first and match its output format character for character, because Task 7's gate depends on it.

- [ ] **Step 1: Write the failing test**

Create `src/generate/render.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { BARE_REACH, DEFAULT_DOC, type IconDoc } from '../doc';
import { outerExtent, renderSvg, safeZonePct } from './render';

function docWith(elements: IconDoc['elements']): IconDoc {
  return { ...DEFAULT_DOC, elements };
}

describe('primitives', () => {
  test('a stick is a full diameter, rotated about the centre', () => {
    const svg = renderSvg(
      docWith([{ id: 'a', type: 'stick', ink: 'top', angle: 62, reach: 18, weight: 6 }]),
      'mono',
    );
    expect(svg).toContain('d="M24 6L24 42"');
    expect(svg).toContain('stroke-width="6"');
    expect(svg).toContain('transform="rotate(62 24 24)"');
    expect(svg).toContain('stroke-linecap="round"');
  });

  test('a ring is one concentric circle, stroked and unfilled', () => {
    const svg = renderSvg(
      docWith([{ id: 'a', type: 'ring', ink: 'top', radius: 15, weight: 3 }]),
      'mono',
    );
    expect(svg).toContain('<circle cx="24" cy="24" r="15"');
    expect(svg).toContain('stroke-width="3"');
    expect(svg).toContain('fill="none"');
    expect(svg.match(/<circle/g)).toHaveLength(1);
  });

  test('a dot is one filled circle at its own point', () => {
    const svg = renderSvg(
      docWith([{ id: 'a', type: 'dot', ink: 'top', at: [10, 38], radius: 4 }]),
      'mono',
    );
    expect(svg).toContain('<circle cx="10" cy="38" r="4"');
    expect(svg).toContain('fill="#000"');
    expect(svg).not.toContain('stroke-width');
  });

  test('elements are painted in document order, back to front', () => {
    const svg = renderSvg(
      docWith([
        { id: 'back', type: 'ring', ink: 'low', radius: 15, weight: 3 },
        { id: 'front', type: 'dot', ink: 'top', at: [24, 24], radius: 4 },
      ]),
      'light' in DEFAULT_DOC.variants ? 'light' : 'mono',
    );
    expect(svg.indexOf('r="15"')).toBeLessThan(svg.indexOf('r="4"'));
  });
});

describe('ink resolution', () => {
  test('mono resolves every ink to black', () => {
    const svg = renderSvg(DEFAULT_DOC, 'mono');
    expect(svg).toContain('#000');
    expect(svg).not.toContain('#7167ff');
    expect(svg).not.toContain('#6652ff');
  });

  test('chip resolves every ink to its dark value and draws the field', () => {
    const svg = renderSvg(DEFAULT_DOC, 'chip');
    expect(svg).toContain('#6652ff');
    expect(svg).not.toContain('#7167ff');
    expect(svg).toContain('<rect width="48" height="48" rx="11" fill="#1b1830"/>');
  });

  test('theme emits both sets, swapped by a media query', () => {
    const svg = renderSvg(DEFAULT_DOC, 'favicon');
    expect(svg).toContain('#7167ff');
    expect(svg).toContain('#6652ff');
    expect(svg).toContain('@media (prefers-color-scheme:dark)');
  });

  test('an element naming a missing ink renders black rather than crashing', () => {
    const svg = renderSvg(
      docWith([{ id: 'a', type: 'stick', ink: 'nope', angle: 0, reach: 18, weight: 6 }]),
      'mono',
    );
    expect(svg).toContain('#000');
  });
});

describe('scale', () => {
  test('scale multiplies reach and weight together, holding the ratio', () => {
    const doc: IconDoc = {
      ...DEFAULT_DOC,
      variants: { half: { inks: 'dark', scale: 0.5 } },
    };
    const svg = renderSvg(doc, 'half');
    // reach 18 -> 9, so the stick runs 24-9 .. 24+9; weight 6 -> 3.
    expect(svg).toContain('d="M24 15L24 33"');
    expect(svg).toContain('stroke-width="3"');
  });

  test('the weight-to-reach ratio is invariant under any scale', () => {
    for (const scale of [0.25, 0.5, 14 / 18, 1, 1.5]) {
      const doc: IconDoc = { ...DEFAULT_DOC, variants: { v: { inks: 'dark', scale } } };
      const svg = renderSvg(doc, 'v');
      const reach = Number(/M24 (\d+(?:\.\d+)?)L/.exec(svg)?.[1] ?? NaN);
      const weight = Number(/stroke-width="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? NaN);
      // The stick starts at CENTRE - reach.
      expect(weight / (24 - reach)).toBeCloseTo(6 / BARE_REACH, 10);
    }
  });

  test('the maskable safe zone follows from the scale', () => {
    // Outer extent is reach plus half the stroke cap.
    expect(outerExtent(DEFAULT_DOC, 'chip')).toBeCloseTo((18 + 3) * (14 / 18), 6);
    expect(safeZonePct(DEFAULT_DOC, 'chip')).toBeCloseTo(
      ((18 + 3) * (14 / 18) * 100) / 24,
      6,
    );
  });
});

test('an unknown variant name throws rather than rendering something arbitrary', () => {
  expect(() => renderSvg(DEFAULT_DOC, 'nope')).toThrow(/nope/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test -- render`
Expected: FAIL — `Failed to resolve import "./render"`.

- [ ] **Step 3: Write the implementation**

Create `src/generate/render.ts`:

```ts
import { CENTRE, GRID, type Element, type IconDoc, type InkResolution } from '../doc';

/**
 * One renderer for every variant. `svgFavicon`, `svgBare`, `svgMono` and
 * `svgChip` were four functions drawing the same three sticks differently;
 * with the drawing in the document, they collapse to this.
 *
 * Output format is matched character for character to the generators it
 * replaces, because the committed assets must come out byte-identical.
 */

const BLACK = '#000';

/** A pair of resolved colours. Both are equal for every resolution but `theme`. */
export interface Resolved {
  light: string;
  dark: string;
}

export function resolveInk(doc: IconDoc, name: string, resolution: InkResolution): Resolved {
  if (resolution === 'black') return { light: BLACK, dark: BLACK };
  // A missing ink renders black rather than throwing: a half-edited document
  // should still draw something you can see and fix.
  const ink = doc.inks[name] ?? { light: BLACK, dark: BLACK };
  switch (resolution) {
    case 'light':
      return { light: ink.light, dark: ink.light };
    case 'dark':
      return { light: ink.dark, dark: ink.dark };
    case 'theme':
      return { light: ink.light, dark: ink.dark };
  }
}

/** Trims trailing zeros so `4.6670000000000003` never reaches a committed file. */
function num(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

function paintOf(element: Element, className: string | null, colour: string): string {
  return className === null ? ` ${element.type === 'dot' ? 'fill' : 'stroke'}="${colour}"` : ` class="${className}"`;
}

function drawElement(element: Element, scale: number, paint: string): string {
  switch (element.type) {
    case 'stick': {
      const reach = element.reach * scale;
      return (
        `\n    <path d="M${num(CENTRE)} ${num(CENTRE - reach)}L${num(CENTRE)} ${num(CENTRE + reach)}"${paint}` +
        ` stroke-width="${num(element.weight * scale)}" stroke-linecap="round" fill="none"` +
        ` transform="rotate(${num(element.angle)} ${num(CENTRE)} ${num(CENTRE)})"/>`
      );
    }
    case 'ring':
      return (
        `\n    <circle cx="${num(CENTRE)}" cy="${num(CENTRE)}" r="${num(element.radius * scale)}"${paint}` +
        ` stroke-width="${num(element.weight * scale)}" fill="none"/>`
      );
    case 'dot': {
      const [x, y] = element.at;
      // Scale about the centre so a dot keeps its place in the drawing.
      const cx = CENTRE + (x - CENTRE) * scale;
      const cy = CENTRE + (y - CENTRE) * scale;
      return `\n    <circle cx="${num(cx)}" cy="${num(cy)}" r="${num(element.radius * scale)}"${paint}/>`;
    }
  }
}

export function renderSvg(doc: IconDoc, variantName: string): string {
  const variant = doc.variants[variantName];
  if (!variant) throw new Error(`unknown variant "${variantName}"`);
  const { scale, inks: resolution, field } = variant;

  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" width="${GRID}" height="${GRID}">`;
  const plate = field
    ? `\n  <rect width="${GRID}" height="${GRID}" rx="${num(field.radius)}" fill="${
        resolveInk(doc, field.ink, resolution === 'theme' ? 'dark' : resolution).light
      }"/>`
    : '';

  if (resolution === 'theme') {
    // A favicon has no inherited colour, so both sets are inlined and swapped
    // by a media query inside the file itself.
    const rules = doc.elements
      .map((element, i) => {
        const { light } = resolveInk(doc, element.ink, 'light');
        return `.e${i}{${element.type === 'dot' ? 'fill' : 'stroke'}:${light}}`;
      })
      .join('');
    const darkRules = doc.elements
      .map((element, i) => {
        const { dark } = resolveInk(doc, element.ink, 'theme');
        return `.e${i}{${element.type === 'dot' ? 'fill' : 'stroke'}:${dark}}`;
      })
      .join('');
    const body = doc.elements
      .map((element, i) => drawElement(element, scale, paintOf(element, `e${i}`, '')))
      .join('');
    return `${open}${plate}
  <style>
    ${rules}
    @media (prefers-color-scheme:dark){${darkRules}}
  </style>
  <g fill="none">${body}
  </g>
</svg>
`;
  }

  const body = doc.elements
    .map((element) =>
      drawElement(element, scale, paintOf(element, null, resolveInk(doc, element.ink, resolution).light)),
    )
    .join('');
  return `${open}${plate}
  <g fill="none">${body}
  </g>
</svg>
`;
}

/** How far the drawing reaches from the centre, including any stroke cap. */
export function outerExtent(doc: IconDoc, variantName: string): number {
  const variant = doc.variants[variantName];
  if (!variant) throw new Error(`unknown variant "${variantName}"`);
  const reaches = doc.elements.map((element) => {
    switch (element.type) {
      case 'stick':
        return element.reach + element.weight / 2;
      case 'ring':
        return element.radius + element.weight / 2;
      case 'dot': {
        const [x, y] = element.at;
        return Math.hypot(x - CENTRE, y - CENTRE) + element.radius;
      }
    }
  });
  return Math.max(0, ...reaches) * variant.scale;
}

/** That extent as a percentage of the tile's half-width. Android crops at 80. */
export function safeZonePct(doc: IconDoc, variantName: string): number {
  return (outerExtent(doc, variantName) / CENTRE) * 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test -- render`
Expected: PASS, 11 tests.

- [ ] **Step 5: Prove the tests can fail**

Change `element.weight * scale` to `element.weight` in the `stick` branch. Re-run. Expected: "scale multiplies reach and weight together" and "ratio is invariant" both fail. Restore.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter @tickets/icon-studio typecheck
git add packages/web/icon-studio/src/generate/render.ts packages/web/icon-studio/src/generate/render.test.ts
git commit -m "feat(icon-studio): one renderer over elements, replacing four generators"
```

---

### Task 4: Motion over N spinning elements

**Files:**
- Modify: `packages/web/icon-studio/src/motion.ts`
- Modify: `packages/web/icon-studio/src/motion.test.ts`

**Interfaces:**
- Consumes: `IconDoc`, `Element` from `./doc`.
- Produces: `statePose(doc, state): number[]`, `planMove(doc, from, to): Move`, `spinningIndexes(doc): number[]`, `formationGap(count): number`. `Formation` becomes `{ pose: number[]; spinning: boolean }`; `Move.pose` returns `number[]`.

**Context:** `motion.ts` is written against exactly three sticks — `Triple`, `lags()`, `relativeTravel()`, `rampsFor()`, `planMove()`. Read it fully first. Every invariant it currently holds must survive: simultaneous starts, painted order is speed order, exact landings, and the coast before slowing. Non-spinning elements hold their pose through every move.

- [ ] **Step 1: Write the failing test**

Add to `src/motion.test.ts`:

```ts
import { DEFAULT_DOC, type IconDoc } from './doc';
import { formationGap, planMove, spinningIndexes, statePose } from './motion';

function docWithSpinners(count: number): IconDoc {
  return {
    ...DEFAULT_DOC,
    elements: Array.from({ length: count }, (_, i) => ({
      id: `s${i}`,
      type: 'stick' as const,
      ink: 'top',
      spin: true,
      angle: i * 20,
      reach: 18,
      weight: 6,
    })),
  };
}

test('the formation gap is 180/N, which is 60 for the three-stick mark', () => {
  expect(formationGap(3)).toBeCloseTo(60, 10);
  expect(formationGap(2)).toBeCloseTo(90, 10);
  expect(formationGap(5)).toBeCloseTo(36, 10);
});

test.each([2, 3, 5])('%i spinning elements land exactly 180/N apart', (count) => {
  const doc = docWithSpinners(count);
  const move = planMove(doc, { pose: statePose(doc, 'default'), spinning: false }, 'running');
  const landed = move.pose(move.duration);
  const gap = formationGap(count);

  for (let i = 1; i < count; i++) {
    const separation = (((landed[i - 1] ?? 0) - (landed[i] ?? 0)) % 180 + 180) % 180;
    expect(separation).toBeCloseTo(gap, 6);
  }
});

test('elements that do not spin hold their pose through every move', () => {
  const doc: IconDoc = {
    ...DEFAULT_DOC,
    elements: [
      { id: 'ring', type: 'ring', ink: 'top', radius: 15, weight: 3 },
      ...DEFAULT_DOC.elements,
    ],
  };
  expect(spinningIndexes(doc)).toEqual([1, 2, 3]);

  const move = planMove(doc, { pose: statePose(doc, 'default'), spinning: false }, 'running');
  const start = statePose(doc, 'default');
  const landed = move.pose(move.duration);
  expect(landed[0]).toBeCloseTo(start[0] ?? 0, 10);
});

test('a document with nothing spinning plans a move that changes nothing', () => {
  const doc: IconDoc = {
    ...DEFAULT_DOC,
    elements: DEFAULT_DOC.elements.map((e) => ({ ...e, spin: false })),
  };
  const from = { pose: statePose(doc, 'default'), spinning: false };
  const move = planMove(doc, from, 'running');
  expect(move.pose(move.duration)).toEqual(from.pose);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test -- motion`
Expected: FAIL — `formationGap` and `spinningIndexes` are not exported.

- [ ] **Step 3: Write the implementation**

In `src/motion.ts`, make these changes:

1. Delete the `Triple` type and `triple()` helper. Every pose is `number[]`.
2. Change `Formation` to `{ pose: number[]; spinning: boolean }` and `Move.pose` to `(t: number) => number[]`.
3. Add, near the top:

```ts
/**
 * Degrees between neighbouring sticks in the running formation. A stick is a
 * full diameter and so 180°-symmetric, which is why the circle to divide is 180
 * and not 360 — three sticks land 60° apart, the value the mark spec locks.
 */
export function formationGap(count: number): number {
  return count > 0 ? 180 / count : 0;
}

/** Indexes of the elements taking part in the formation, in painted order. */
export function spinningIndexes(doc: IconDoc): number[] {
  const out: number[] = [];
  doc.elements.forEach((element, i) => {
    if (element.spin) out.push(i);
  });
  return out;
}
```

4. `statePose(doc, state)` returns one angle per element. Non-spinning elements always take their own element angle (a `ring` or `dot` has no angle, so use 0). For spinning elements: `default` uses the element's own angle; `resting` fans them from the first spinner by `restSpread`; `running` spreads them by `formationGap(count)`.

```ts
function angleOf(element: Element): number {
  return element.type === 'stick' ? element.angle : 0;
}

export function statePose(doc: IconDoc, state: MarkState): number[] {
  const spinners = spinningIndexes(doc);
  const pose = doc.elements.map(angleOf);
  const leadIndex = spinners[0];
  if (leadIndex === undefined) return pose;
  const lead = pose[leadIndex] ?? 0;
  const gap = state === 'resting' ? doc.motion.restSpread : formationGap(spinners.length);

  if (state === 'default') return pose;
  spinners.forEach((index, order) => {
    pose[index] = lead - gap * order;
  });
  return pose;
}
```

5. `lags`, `relativeTravel` and `rampsFor` operate on the spinning subset only, indexed by their order within that subset, and return arrays of that length. `planMove` writes the resulting angles back into a full-length pose, leaving non-spinning entries at their incoming value.

6. In the running branch, the wanted lags become `spinners.map((_, order) => formationGap(spinners.length) * order)`.

7. Guard the empty case: if `spinners.length === 0`, return a move with `duration: 0`, `spinning: false` and `pose: () => [...from.pose]`.

Keep every comment explaining *why* — the half-turn lift that orders the sticks, the direction reversal between accelerating and decelerating, and the coast before slowing.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test -- motion`
Expected: PASS. Every pre-existing motion test must still pass unchanged in meaning — if one now needs different numbers, stop and check you have not altered behaviour for three spinning sticks.

- [ ] **Step 5: Prove the tests can fail**

Change `formationGap` to `return 360 / count`. Re-run. Expected: the 180/N test and the landing tests fail. Restore.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter @tickets/icon-studio typecheck
git add packages/web/icon-studio/src/motion.ts packages/web/icon-studio/src/motion.test.ts
git commit -m "refactor(icon-studio): motion spreads the spinning subset at 180/N"
```

---

### Task 5: State and reducer over a document

**Files:**
- Modify: `packages/web/icon-studio/src/state.ts`
- Modify: `packages/web/icon-studio/src/state.test.ts`

**Interfaces:**
- Consumes: `IconDoc`, `Element`, `ElementType`, `DEFAULT_DOC` from `./doc`; `toDoc` from `./migrate`.
- Produces: `StudioState` holding `doc: IconDoc`; actions `addElement`, `removeElement`, `moveElement`, `updateElement`, `setInk`, `setVariant`, `setMotion`, `resetMotion`, `loadDoc`. `toDoc(state): IconDoc` is replaced by `state.doc`.

- [ ] **Step 1: Write the failing test**

Replace the body of `src/state.test.ts` with tests for the new shape:

```ts
import { expect, test } from 'vitest';
import { DEFAULT_DOC } from './doc';
import { INITIAL_STATE, studioReducer } from './state';

test('the initial state is the default document', () => {
  expect(INITIAL_STATE.doc).toEqual(DEFAULT_DOC);
});

test('adding an element appends it with a unique id', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'addElement', elementType: 'ring' });
  const ids = next.doc.elements.map((e) => e.id);

  expect(next.doc.elements).toHaveLength(4);
  expect(next.doc.elements[3]?.type).toBe('ring');
  expect(new Set(ids).size).toBe(ids.length);
});

test('adding two elements of the same type still gives distinct ids', () => {
  const once = studioReducer(INITIAL_STATE, { type: 'addElement', elementType: 'dot' });
  const twice = studioReducer(once, { type: 'addElement', elementType: 'dot' });
  const ids = twice.doc.elements.map((e) => e.id);

  expect(new Set(ids).size).toBe(ids.length);
});

test('removing an element leaves the others in order', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'removeElement', id: 'mid' });
  expect(next.doc.elements.map((e) => e.id)).toEqual(['top', 'low']);
});

test('moving an element changes paint order', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'moveElement', id: 'top', to: 0 });
  expect(next.doc.elements.map((e) => e.id)).toEqual(['top', 'mid', 'low'].sort(() => 0));
});

test('updating an element patches only that element', () => {
  const next = studioReducer(INITIAL_STATE, {
    type: 'updateElement',
    id: 'mid',
    patch: { angle: 99 },
  });
  const mid = next.doc.elements.find((e) => e.id === 'mid');
  const top = next.doc.elements.find((e) => e.id === 'top');

  expect(mid?.type === 'stick' && mid.angle).toBe(99);
  expect(top?.type === 'stick' && top.angle).toBe(62);
});

test('setting an ink changes it everywhere it is used', () => {
  const next = studioReducer(INITIAL_STATE, {
    type: 'setInk',
    name: 'top',
    patch: { light: '#123456' },
  });
  expect(next.doc.inks.top).toEqual({ light: '#123456', dark: '#6652ff' });
});

test('setting a variant scale leaves the other variants alone', () => {
  const next = studioReducer(INITIAL_STATE, {
    type: 'setVariant',
    name: 'chip',
    patch: { scale: 0.5 },
  });
  expect(next.doc.variants.chip?.scale).toBe(0.5);
  expect(next.doc.variants.favicon?.scale).toBe(1);
});

test('loadDoc replaces the document wholesale', () => {
  const dirty = studioReducer(INITIAL_STATE, { type: 'removeElement', id: 'mid' });
  const next = studioReducer(dirty, { type: 'loadDoc', doc: DEFAULT_DOC });
  expect(next.doc).toEqual(DEFAULT_DOC);
});
```

Fix the `moveElement` expectation to the real intent — moving `top` to index 0 is a no-op, so instead assert moving `low` to 0:

```ts
test('moving an element changes paint order', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'moveElement', id: 'low', to: 0 });
  expect(next.doc.elements.map((e) => e.id)).toEqual(['low', 'top', 'mid']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test -- state`
Expected: FAIL — `INITIAL_STATE.doc` is undefined.

- [ ] **Step 3: Write the implementation**

Rewrite `src/state.ts`:

```ts
import {
  BARE_REACH, DEFAULT_DOC, type Element, type ElementType, type IconDoc, type Ink,
  type MotionConfig, type Variant,
} from './doc';

export interface StudioState {
  doc: IconDoc;
}

export const INITIAL_STATE: StudioState = { doc: structuredClone(DEFAULT_DOC) };

/** A new element of each type, placed so it is visible the moment it is added. */
function blankElement(type: ElementType, id: string): Element {
  switch (type) {
    case 'stick':
      return { id, type, ink: 'top', spin: true, angle: 0, reach: BARE_REACH, weight: 6 };
    case 'ring':
      return { id, type, ink: 'top', radius: 15, weight: 3 };
    case 'dot':
      return { id, type, ink: 'top', at: [24, 24], radius: 4 };
  }
}

/** Ids must stay unique: React keys and per-element controls hang off them. */
function freshId(doc: IconDoc, type: ElementType): string {
  const taken = new Set(doc.elements.map((e) => e.id));
  for (let n = 1; ; n++) {
    const id = `${type}-${n}`;
    if (!taken.has(id)) return id;
  }
}

export type StudioAction =
  | { type: 'addElement'; elementType: ElementType }
  | { type: 'removeElement'; id: string }
  | { type: 'moveElement'; id: string; to: number }
  | { type: 'updateElement'; id: string; patch: Partial<Omit<Element, 'id' | 'type'>> }
  | { type: 'setInk'; name: string; patch: Partial<Ink> }
  | { type: 'setVariant'; name: string; patch: Partial<Variant> }
  | { type: 'setMotion'; patch: Partial<MotionConfig> }
  | { type: 'resetMotion' }
  | { type: 'loadDoc'; doc: IconDoc };

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  const { doc } = state;
  switch (action.type) {
    case 'addElement': {
      const element = blankElement(action.elementType, freshId(doc, action.elementType));
      return { doc: { ...doc, elements: [...doc.elements, element] } };
    }
    case 'removeElement':
      return { doc: { ...doc, elements: doc.elements.filter((e) => e.id !== action.id) } };
    case 'moveElement': {
      const from = doc.elements.findIndex((e) => e.id === action.id);
      if (from === -1) return state;
      const elements = [...doc.elements];
      const [moved] = elements.splice(from, 1);
      if (!moved) return state;
      const to = Math.max(0, Math.min(action.to, elements.length));
      elements.splice(to, 0, moved);
      return { doc: { ...doc, elements } };
    }
    case 'updateElement':
      return {
        doc: {
          ...doc,
          elements: doc.elements.map((e) =>
            e.id === action.id ? ({ ...e, ...action.patch } as Element) : e,
          ),
        },
      };
    case 'setInk': {
      const existing = doc.inks[action.name];
      if (!existing) return state;
      return { doc: { ...doc, inks: { ...doc.inks, [action.name]: { ...existing, ...action.patch } } } };
    }
    case 'setVariant': {
      const existing = doc.variants[action.name];
      if (!existing) return state;
      return {
        doc: { ...doc, variants: { ...doc.variants, [action.name]: { ...existing, ...action.patch } } },
      };
    }
    case 'setMotion':
      return { doc: { ...doc, motion: { ...doc.motion, ...action.patch } } };
    case 'resetMotion':
      return { doc: { ...doc, motion: { ...DEFAULT_DOC.motion } } };
    case 'loadDoc':
      return { doc: action.doc };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test -- state`
Expected: PASS, 9 tests.

- [ ] **Step 5: Prove the tests can fail**

Change `freshId` to always return `` `${type}-1` ``. Re-run. Expected: "adding two elements of the same type" fails. Restore.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter @tickets/icon-studio typecheck
git add packages/web/icon-studio/src/state.ts packages/web/icon-studio/src/state.test.ts
git commit -m "feat(icon-studio): reducer over a document, with element actions"
```

---

### Task 6: Server-side validation of a document

**Files:**
- Modify: `packages/web/icon-studio/src/plugin/write.ts`
- Modify: `packages/web/icon-studio/src/plugin/write.test.ts`

**Interfaces:**
- Consumes: `IconDoc`, `Element`, `INK_RESOLUTIONS`, `ELEMENT_TYPES` from `../doc`.
- Produces: `assertIconDoc(value: unknown, field: string): IconDoc`, used by `assertRequest`.

**Context:** `runGenerate` writes the validated document straight back over `icons.config.json`, so a missing or malformed field must be a loud rejection, never a silent default — the same reasoning that made the motion block required. Values are interpolated unescaped into SVG attributes, so every colour must be anchored 6-digit hex.

- [ ] **Step 1: Write the failing test**

Add to `src/plugin/write.test.ts`:

```ts
import { DEFAULT_DOC } from '../doc';

const docBody = () => ({
  config: DEFAULT_DOC,
  pngs: { 'icon-192.png': png, 'icon-512.png': png, 'apple-touch-icon.png': png },
});

test('writes every output from a document', async () => {
  const root = await fakeRepo();
  const { results } = await runGenerate(docBody(), root);
  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
});

test.each([
  ['no elements array', { ...DEFAULT_DOC, elements: undefined }, 'body.config.elements must be an array'],
  ['an unknown element type', { ...DEFAULT_DOC, elements: [{ id: 'a', type: 'blob', ink: 'top' }] },
    'body.config.elements[0].type must be one of stick, ring, dot'],
  ['an element naming no ink', { ...DEFAULT_DOC, elements: [{ id: 'a', type: 'ring', radius: 5, weight: 1 }] },
    'body.config.elements[0].ink must be a string'],
  ['a bad ink colour', { ...DEFAULT_DOC, inks: { top: { light: 'red', dark: '#000000' } } },
    'body.config.inks.top.light must be a 6-digit hex color'],
  ['an unknown ink resolution', { ...DEFAULT_DOC, variants: { v: { inks: 'sepia', scale: 1 } } },
    'body.config.variants.v.inks must be one of theme, light, dark, black'],
  ['a zero scale', { ...DEFAULT_DOC, variants: { v: { inks: 'dark', scale: 0 } } },
    'body.config.variants.v.scale must be a finite number greater than zero'],
])('rejects a document with %s, and writes nothing', async (_label, config, message) => {
  const root = await fakeRepo();
  await expect(runGenerate({ ...docBody(), config }, root)).rejects.toThrow(message);
  await expect(stat(path.join(root, 'apps', 'web', 'public'))).rejects.toThrow();
});

test('accepts a document with zero elements', async () => {
  // An empty icon is a legitimate starting point, not an error.
  const root = await fakeRepo();
  const config = { ...DEFAULT_DOC, elements: [] };
  const { results } = await runGenerate({ ...docBody(), config }, root);
  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
});
```

Delete the old `MarkConfig`-shaped tests in this file: the ones asserting `body.config.light`, `body.config.angles`, `body.config.bareWeight`, `chipReach` and `chipWeight`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test -- write`
Expected: FAIL — the document is rejected because `assertRequest` still demands `light`.

- [ ] **Step 3: Write the implementation**

In `src/plugin/write.ts`, replace the `MarkConfig` validation with:

```ts
function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  return value;
}

function assertInk(value: unknown, field: string): Ink {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  return {
    light: assertHexColor(value.light, `${field}.light`),
    dark: assertHexColor(value.dark, `${field}.dark`),
  };
}

function assertElement(value: unknown, field: string): Element {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  const id = assertString(value.id, `${field}.id`);
  const ink = assertString(value.ink, `${field}.ink`);
  const spin = value.spin === true ? true : undefined;
  const type = value.type;
  if (type !== 'stick' && type !== 'ring' && type !== 'dot') {
    throw new Error(`${field}.type must be one of ${ELEMENT_TYPES.join(', ')}`);
  }
  switch (type) {
    case 'stick':
      return {
        id, ink, spin, type,
        angle: assertFiniteNumber(value.angle, `${field}.angle`),
        reach: assertPositiveWeight(value.reach, `${field}.reach`),
        weight: assertPositiveWeight(value.weight, `${field}.weight`),
      };
    case 'ring':
      return {
        id, ink, spin, type,
        radius: assertPositiveWeight(value.radius, `${field}.radius`),
        weight: assertPositiveWeight(value.weight, `${field}.weight`),
      };
    case 'dot': {
      const at = value.at;
      if (!Array.isArray(at) || at.length !== 2) throw new Error(`${field}.at must be a pair`);
      return {
        id, ink, spin, type,
        at: [assertFiniteNumber(at[0], `${field}.at[0]`), assertFiniteNumber(at[1], `${field}.at[1]`)],
        radius: assertPositiveWeight(value.radius, `${field}.radius`),
      };
    }
  }
}

function assertVariant(value: unknown, field: string): Variant {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  const resolution = value.inks;
  if (
    resolution !== 'theme' && resolution !== 'light' &&
    resolution !== 'dark' && resolution !== 'black'
  ) {
    throw new Error(`${field}.inks must be one of ${INK_RESOLUTIONS.join(', ')}`);
  }
  const variant: Variant = {
    inks: resolution,
    scale: assertPositiveWeight(value.scale, `${field}.scale`),
  };
  if (value.field !== undefined) {
    if (!isRecord(value.field)) throw new Error(`${field}.field must be an object`);
    variant.field = {
      ink: assertString(value.field.ink, `${field}.field.ink`),
      radius: assertNonNegative(value.field.radius, `${field}.field.radius`),
    };
  }
  return variant;
}

function assertIconDoc(value: unknown, field: string): IconDoc {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  if (!isRecord(value.inks)) throw new Error(`${field}.inks must be an object`);
  if (!Array.isArray(value.elements)) throw new Error(`${field}.elements must be an array`);
  if (!isRecord(value.variants)) throw new Error(`${field}.variants must be an object`);

  const inks: Record<string, Ink> = {};
  for (const [name, ink] of Object.entries(value.inks)) {
    inks[name] = assertInk(ink, `${field}.inks.${name}`);
  }
  const variants: Record<string, Variant> = {};
  for (const [name, variant] of Object.entries(value.variants)) {
    variants[name] = assertVariant(variant, `${field}.variants.${name}`);
  }
  return {
    inks,
    elements: value.elements.map((e, i) => assertElement(e, `${field}.elements[${i}]`)),
    variants,
    motion: assertMotion(value.motion, `${field}.motion`),
  };
}
```

Add a local `isRecord` if one is not already present, and have `assertRequest` call `assertIconDoc(config, 'body.config')`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test -- write`
Expected: PASS.

- [ ] **Step 5: Prove the tests can fail**

Delete the `type !== 'stick' && …` guard. Re-run. Expected: the "unknown element type" case fails. Restore.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter @tickets/icon-studio typecheck
git add packages/web/icon-studio/src/plugin/write.ts packages/web/icon-studio/src/plugin/write.test.ts
git commit -m "feat(icon-studio): validate a document server-side"
```

---

### Task 7: Cut the generators over and hold the byte-identical gate

**Files:**
- Delete: `packages/web/icon-studio/src/generate/svg.ts`, `packages/web/icon-studio/src/generate/svg.test.ts`
- Modify: `packages/web/icon-studio/src/plugin/write.ts` (imports), `packages/web/icon-studio/src/generate/manifest.ts`, `packages/web/icon-studio/src/generate/head.ts`, `packages/web/icon-studio/src/output/file-grid.tsx`, `packages/web/icon-studio/src/output/motion-preview.tsx`, `packages/web/icon-studio/src/api.ts`
- Create: `packages/web/icon-studio/src/generate/gate.test.ts`

**Interfaces:**
- Consumes: `renderSvg` from `./render`; `toDoc` from `../migrate`.
- Produces: nothing new. Every `svgFavicon(config)` becomes `renderSvg(doc, 'favicon')`, `svgMono(config)` becomes `renderSvg(doc, 'mono')`, and `svgChip(config)` becomes `renderSvg(doc, 'chip')`. `svgChip(config, { rounded: false })` becomes a variant lookup of `apple` — add it to `DEFAULT_DOC.variants` and to the migration as `{ inks: 'dark', scale, field: { ink: 'field', radius: 0 } }`.

**Context:** This is the acceptance gate for the whole plan.

- [ ] **Step 1: Write the failing test**

Create `src/generate/gate.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { toDoc } from '../migrate';
import { renderSvg } from './render';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), 'utf8');

/**
 * The acceptance gate for the element model: migrating the committed config and
 * re-rendering must reproduce the committed assets byte for byte. Looking at
 * the icons cannot prove the pivot changed nothing; this can.
 */
test('the committed favicon re-renders byte-identically from its config', () => {
  const doc = toDoc(JSON.parse(read('apps/web/icons.config.json')));
  expect(renderSvg(doc, 'favicon')).toBe(read('apps/web/public/favicon.svg'));
});

test('the committed mono icon re-renders byte-identically from its config', () => {
  const doc = toDoc(JSON.parse(read('apps/web/icons.config.json')));
  expect(renderSvg(doc, 'mono')).toBe(read('apps/web/public/icon-mono.svg'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test -- gate`
Expected: FAIL, with a character-level diff. Read it carefully — every difference is a formatting mismatch between `render.ts` and the old `svg.ts`.

- [ ] **Step 3: Make the renderer match**

Adjust `renderSvg`'s whitespace, attribute order and number formatting until both tests pass. Do not adjust the committed files. Note that the old generators emit the generated-by comment on `favicon.svg` and `icon-mono.svg` only — add it to `renderSvg` for those two variants, matching the exact text including the em dash:

```
<!-- generated by @tickets/icon-studio — do not edit -->
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test -- gate`
Expected: PASS, 2 tests.

- [ ] **Step 5: Cut every caller over and delete the old generators**

Replace the `svg*` imports in `write.ts`, `file-grid.tsx`, `motion-preview.tsx` and `api.ts` with `renderSvg`. Delete `generate/svg.ts` and `generate/svg.test.ts`. Any test in `svg.test.ts` asserting behaviour not covered by `render.test.ts` must be moved there first, not dropped.

- [ ] **Step 6: Run the whole suite**

Run: `pnpm --filter @tickets/icon-studio test` and `pnpm --filter @tickets/icon-studio typecheck`
Expected: both pass, with no reference to `svgFavicon`, `svgBare`, `svgMono` or `svgChip` remaining:

```bash
grep -rn "svgFavicon\|svgBare\|svgMono\|svgChip" packages/web/icon-studio/src
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add -A packages/web/icon-studio
git commit -m "refactor(icon-studio)!: render every variant from the document"
```

---

### Task 8: The element and ink panels

**Files:**
- Create: `packages/web/icon-studio/src/controls/element-panel.tsx`
- Create: `packages/web/icon-studio/src/controls/ink-panel.tsx`
- Create: `packages/web/icon-studio/src/controls/element-panel.test.tsx`
- Modify: `packages/web/icon-studio/src/controls/controls-panel.tsx`, `packages/web/icon-studio/src/studio.tsx`

**Interfaces:**
- Consumes: `StudioState`, `StudioAction` from `../state`; `SliderRow` from `./slider-row`; `SwatchRow` from `./swatch-row`; `ELEMENT_TYPES` from `../doc`.
- Produces: `<ElementPanel doc dispatch />`, `<InkPanel doc dispatch />`.

**Context:** `controls-panel.tsx` currently hardcodes rows for the three sticks and the two triads. Those sections are replaced by these two panels. Keep the vividness/brightness and motion sections as they are.

- [ ] **Step 1: Write the failing test**

Create `src/controls/element-panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { DEFAULT_DOC } from '../doc';
import { ElementPanel } from './element-panel';

test('lists one row per element, in paint order', () => {
  render(<ElementPanel doc={DEFAULT_DOC} dispatch={vi.fn()} />);
  const rows = screen.getAllByRole('group');
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent('top');
  expect(rows[2]).toHaveTextContent('low');
});

test('adding an element of a chosen type dispatches once', async () => {
  const dispatch = vi.fn();
  render(<ElementPanel doc={DEFAULT_DOC} dispatch={dispatch} />);

  await userEvent.click(screen.getByRole('button', { name: /add ring/i }));
  expect(dispatch).toHaveBeenCalledWith({ type: 'addElement', elementType: 'ring' });
});

test('removing an element dispatches with that element id', async () => {
  const dispatch = vi.fn();
  render(<ElementPanel doc={DEFAULT_DOC} dispatch={dispatch} />);

  await userEvent.click(screen.getByRole('button', { name: /remove mid/i }));
  expect(dispatch).toHaveBeenCalledWith({ type: 'removeElement', id: 'mid' });
});

test('a stick shows angle, reach and weight; a ring does not show angle', () => {
  const doc = {
    ...DEFAULT_DOC,
    elements: [{ id: 'r', type: 'ring' as const, ink: 'top', radius: 15, weight: 3 }],
  };
  render(<ElementPanel doc={doc} dispatch={vi.fn()} />);

  expect(screen.getByLabelText(/r radius/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/r angle/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test -- element-panel`
Expected: FAIL — `Failed to resolve import "./element-panel"`.

- [ ] **Step 3: Write the implementation**

Create `src/controls/element-panel.tsx`. Render a `<section role="group">` per element carrying its id, a remove button labelled `remove <id>`, a spin toggle, an ink selector listing `Object.keys(doc.inks)`, and one `SliderRow` per numeric parameter of that element's type — sliders labelled `<id> angle`, `<id> reach`, `<id> weight`, `<id> radius`. Below the list, one add button per entry in `ELEMENT_TYPES`, labelled `add <type>`.

Switch on `element.type` to choose the sliders; do not try to derive them generically, because each type's ranges differ:

```tsx
{element.type === 'stick' ? (
  <>
    <SliderRow label={`${element.id} angle`} min={0} max={180}
      value={element.angle}
      onChange={(angle) => dispatch({ type: 'updateElement', id: element.id, patch: { angle } })} />
    <SliderRow label={`${element.id} reach`} min={2} max={24} step={0.5}
      value={element.reach}
      onChange={(reach) => dispatch({ type: 'updateElement', id: element.id, patch: { reach } })} />
    <SliderRow label={`${element.id} weight`} min={0.5} max={12} step={0.25}
      value={element.weight}
      onChange={(weight) => dispatch({ type: 'updateElement', id: element.id, patch: { weight } })} />
  </>
) : null}
```

Create `src/controls/ink-panel.tsx` rendering one `SwatchRow` pair per named ink — light and dark — dispatching `setInk`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test -- element-panel`
Expected: PASS, 4 tests.

- [ ] **Step 5: Prove the tests can fail**

Remove the `remove <id>` button's label suffix so it reads just `remove`. Re-run. Expected: the remove test fails. Restore.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter @tickets/icon-studio typecheck
git add packages/web/icon-studio/src/controls packages/web/icon-studio/src/studio.tsx
git commit -m "feat(icon-studio): per-element and per-ink controls"
```

---

### Task 9: Run the studio and confirm the gate end to end

**Files:**
- Modify: `packages/web/icon-studio/src/studio.tsx` (only if wiring gaps remain)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Run every gate**

```bash
pnpm --filter @tickets/icon-studio test
pnpm --filter @tickets/icon-studio typecheck
pnpm typecheck
pnpm --filter @tickets/web test
pnpm --filter @tickets/ui tokens:verify
```

Expected: all pass.

- [ ] **Step 2: Confirm no non-null assertions crept in**

```bash
grep -rnE '[]A-Za-z0-9_)]![.[(]' packages/web/icon-studio/src | grep -v '!=='
```

Expected: no output. (The `]` must come first inside the bracket expression, or the class closes early and the search silently matches nothing.)

- [ ] **Step 3: Start the studio and drive it**

```bash
pnpm --filter @tickets/icon-studio dev
```

Open `http://localhost:4660` — `localhost`, never `127.0.0.1`, because Vite binds IPv6 only and the IP form is refused on Windows.

Confirm by hand: the mark renders as before; adding a ring shows it immediately; removing an element updates every preview; the loader still animates and lands on the asterisk.

- [ ] **Step 4: Press Generate and confirm the gate**

Expected: **`0 written · 8 unchanged · 0 rejected`** for the committed config. Any `written` among the SVGs or the manifest means the migration or the renderer changed the drawing — stop and diff the file before going further. The three PNGs may report `written`, because canvas encoding is browser-dependent; that is expected and is why they are committed.

- [ ] **Step 5: Commit any wiring fixes**

```bash
git add -A packages/web/icon-studio
git commit -m "feat(icon-studio): wire the document through the studio"
```

---

## Self-Review

**Spec coverage.** Document model → Task 1. Primitives → Tasks 1, 3, 8. Inks → Tasks 1, 3, 8. Variants and scale invariance → Tasks 1, 3. Rendering → Tasks 3, 7. Motion → Task 4. Migration → Task 2. Acceptance gate → Tasks 7, 9. Verification list → distributed across every task, each with a mutation step. Out-of-scope items appear in no task, as intended.

**Placeholders.** None: every step carries the code or the exact command it needs.

**Type consistency.** `IconDoc`, `Element`, `Ink`, `Variant`, `InkResolution`, `Field`, `MotionConfig` are defined once in Task 1 and referenced unchanged afterwards. `toDoc` (Task 2), `renderSvg`/`outerExtent`/`safeZonePct` (Task 3), `formationGap`/`spinningIndexes`/`statePose`/`planMove` (Task 4), the `StudioAction` union (Task 5) and `assertIconDoc` (Task 6) all keep the signatures their **Interfaces** blocks declare.

**Known gap, deliberately left.** `DEFAULT_DOC.variants` gains an `apple` entry in Task 7 rather than Task 1, because the need for it only becomes visible when `svgChip(config, { rounded: false })` is cut over. Task 7 names it explicitly.
