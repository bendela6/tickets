# Icon Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only package at `packages/web/icon-studio` (:4660) that tunes the app mark and, on one **Generate** click, writes every favicon and install icon the web app needs.

**Architecture:** Pure functions turn a committed `MarkConfig` into SVG source, a manifest and a head block. A Vite plugin exposes `POST /__icons/generate` and writes files through a frozen name→path allowlist. Only the three PNGs cross the wire (a browser canvas is the only rasteriser); everything else the plugin derives from the config itself, so the trust boundary is three image payloads.

**Tech Stack:** React 19, Vite 8, Vitest 4, `@tailwindcss/vite`, `@tickets/ui`. No new runtime dependencies — the PNG path is `<canvas>`, deliberately avoiding `sharp`/`node-canvas`.

## Global Constraints

- Package name `@tickets/icon-studio`, path `packages/web/icon-studio`, `"private": true`, `"type": "module"`.
- Dev port **4660**, `strictPort: true`. Taken: 4600 api, 4610 prod, 4620 web, 4630 eer, 4640 signals, 4650 playground.
- Mirror `packages/web/playground` exactly: `dev/` is the Vite root, `src/` holds components, `tsconfig.json` extends `../../../tsconfig.base.json`.
- The write endpoint must be unreachable outside a dev server: plugin `apply: 'serve'`, loopback-only remote address.
- The client never sends a path. Names are looked up in a frozen `OUTPUTS` table; unknown names are rejected and nothing is written.
- All mark geometry sits on a 48-unit grid, centre `24,24`. Weight-to-reach ratio is **1/3** everywhere (`bareWeight 6 / reach 18`).
- Locked config values — copy verbatim: light `#7167ff` `#00bb9a` `#ff298a`; dark `#6652ff` `#12b898` `#ff378c`; chip `#1b1830`; angles `62` `27` `160`; `bareWeight 6`; `chipReach 14`; `chipWeight 4.6`.
- Every generated text file ends with a single trailing newline.
- Tests run under Vitest with `globals: true`; test files are `src/**/*.test.ts` / `.test.tsx`.

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` | Package scaffolding, mirroring the playground |
| `dev/index.html`, `dev/main.tsx`, `dev/styles.css` | Vite entry; mounts `<Studio/>` |
| `src/index.ts` | Public exports |
| `src/config.ts` | `MarkConfig`, `DEFAULT_CONFIG`, `PRESETS`, `BARE_REACH`, `RATIO` |
| `src/color.ts` | HSL round trip, `adjust`, `contrast`, `verdict`, `GROUND` |
| `src/generate/svg.ts` | `sticks`, `svgFavicon`, `svgBare`, `svgMono`, `svgChip`, `outerExtent` |
| `src/generate/manifest.ts` | `buildManifest` |
| `src/generate/head.ts` | `buildHeadBlock`, `injectHeadBlock`, marker constants |
| `src/generate/raster.ts` | `dataUri`, `svgToPngBase64` (browser only) |
| `src/plugin/outputs.ts` | `OUTPUTS` allowlist, `resolveOutput` |
| `src/plugin/validate.ts` | `decodePng`, `MAX_BYTES` |
| `src/plugin/write.ts` | `writeIfChanged` (atomic), `runGenerate` (the testable core) |
| `src/plugin/icon-writer.ts` | The Vite plugin: routes, loopback guard |
| `src/api.ts` | Client side: `fetchConfig`, `buildPngs`, `generate` |
| `src/state.ts` | `studioReducer`, `derive` |
| `src/controls/*.tsx` | Palette, adjust, angle, weight control groups |
| `src/output/*.tsx` | File preview grid, Generate button |
| `src/studio.tsx` | Composes controls + output |
| `apps/web/icons.config.json` | Committed config — written by Generate |
| `apps/web/public/*` | Six generated assets — written by Generate |
| `apps/web/index.html` | Head block between markers — written by Generate |

---

### Task 1: Scaffold the package

**Files:**
- Create: `packages/web/icon-studio/package.json`
- Create: `packages/web/icon-studio/tsconfig.json`
- Create: `packages/web/icon-studio/vite.config.ts`
- Create: `packages/web/icon-studio/vitest.config.ts`
- Create: `packages/web/icon-studio/dev/index.html`
- Create: `packages/web/icon-studio/dev/main.tsx`
- Create: `packages/web/icon-studio/dev/styles.css`
- Create: `packages/web/icon-studio/src/index.ts`
- Create: `packages/web/icon-studio/src/studio.tsx`
- Test: `packages/web/icon-studio/src/studio.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `Studio` — a zero-prop React component, default-exported from `src/index.ts` as a named export.

`packages/web/icon-studio/package.json`:

```json
{
  "name": "@tickets/icon-studio",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "sideEffects": false,
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@tickets/ui": "workspace:*"
  },
  "devDependencies": {
    "@fontsource/ibm-plex-mono": "^5.2.7",
    "@fontsource/ibm-plex-sans": "^5.2.8",
    "@tailwindcss/vite": "^4.3.2",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^26.1.1",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "jsdom": "^29.1.1",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "vite": "^8.0.12",
    "vitest": "^4.1.10"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

`packages/web/icon-studio/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "types": ["vitest/globals", "node", "vite/client"],
    "resolveJsonModule": true
  },
  "include": ["src", "dev"]
}
```

`packages/web/icon-studio/vite.config.ts` — the plugin is added in Task 7; this is the starting version:

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'dev',
  plugins: [react(), tailwindcss()],
  server: { port: 4660, strictPort: true },
});
```

`packages/web/icon-studio/vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`packages/web/icon-studio/dev/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>icon studio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

`packages/web/icon-studio/dev/styles.css`:

```css
@import '@tickets/ui/tokens.css';
/* Tailwind must scan the studio's own class literals. */
@source '../src/';
```

`packages/web/icon-studio/dev/main.tsx`:

```tsx
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { Studio } from '../src';

createRoot(document.getElementById('root')!).render(<Studio />);
```

- [ ] **Step 1: Write the failing test**

`packages/web/icon-studio/src/studio.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Studio } from './studio';

test('renders the studio heading', () => {
  render(<Studio />);
  expect(screen.getByRole('heading', { name: 'Icon studio' })).toBeDefined();
});
```

- [ ] **Step 2: Create the scaffolding files above, then run the test to verify it fails**

Create every file listed in this task except `src/studio.tsx` and `src/index.ts`, then install:

```bash
pnpm install
pnpm --filter @tickets/icon-studio test
```

Expected: FAIL — `Failed to resolve import "./studio"`.

- [ ] **Step 3: Write minimal implementation**

`packages/web/icon-studio/src/studio.tsx`:

```tsx
export function Studio() {
  return (
    <div className="min-h-screen bg-gray-1 font-sans text-gray-12">
      <h1 className="p-6 text-24 font-600">Icon studio</h1>
    </div>
  );
}
```

`packages/web/icon-studio/src/index.ts`:

```ts
export { Studio } from './studio';
```

- [ ] **Step 4: Run the test and typecheck**

```bash
pnpm --filter @tickets/icon-studio test
pnpm --filter @tickets/icon-studio typecheck
```

Expected: test PASS, typecheck clean.

- [ ] **Step 5: Confirm the dev server boots on 4660**

```bash
pnpm --filter @tickets/icon-studio dev
```

Expected: Vite reports `http://localhost:4660`. Open it, see the heading, then stop the server.

- [ ] **Step 6: Commit**

```bash
git add packages/web/icon-studio pnpm-lock.yaml
git commit -m "feat(icon-studio): scaffold the package on :4660"
```

---

### Task 2: The config type, defaults and presets

**Files:**
- Create: `packages/web/icon-studio/src/config.ts`
- Test: `packages/web/icon-studio/src/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MarkConfig` (interface), `DEFAULT_CONFIG: MarkConfig`, `PRESETS: Record<PresetName, Palette>`, `PresetName`, `Palette`, `BARE_REACH = 18`, `RATIO = 1/3`, `STICKS: readonly ['top','mid','low']`.

- [ ] **Step 1: Write the failing test**

`packages/web/icon-studio/src/config.test.ts`:

```ts
import { BARE_REACH, DEFAULT_CONFIG, PRESETS, RATIO } from './config';

test('default config matches the locked design values', () => {
  expect(DEFAULT_CONFIG).toEqual({
    light: ['#7167ff', '#00bb9a', '#ff298a'],
    dark: ['#6652ff', '#12b898', '#ff378c'],
    chip: '#1b1830',
    angles: [62, 27, 160],
    bareWeight: 6,
    chipReach: 14,
    chipWeight: 4.6,
  });
});

test('the bare mark holds the 1/3 weight-to-reach ratio', () => {
  expect(DEFAULT_CONFIG.bareWeight / BARE_REACH).toBeCloseTo(RATIO, 5);
});

test('the chip holds the same ratio', () => {
  expect(DEFAULT_CONFIG.chipWeight / DEFAULT_CONFIG.chipReach).toBeCloseTo(RATIO, 2);
});

test('every preset supplies three light, three dark and a chip', () => {
  for (const [name, p] of Object.entries(PRESETS)) {
    expect(p.light, name).toHaveLength(3);
    expect(p.dark, name).toHaveLength(3);
    expect(p.chip, name).toMatch(/^#[0-9a-f]{6}$/);
  }
});

test('the lifted preset only changes the dark violet', () => {
  expect(PRESETS.lifted.light).toEqual(PRESETS.chosen.light);
  expect(PRESETS.lifted.dark[0]).toBe('#8071ff');
  expect(PRESETS.lifted.dark.slice(1)).toEqual(PRESETS.chosen.dark.slice(1));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test src/config.test.ts`
Expected: FAIL — cannot resolve `./config`.

- [ ] **Step 3: Write minimal implementation**

`packages/web/icon-studio/src/config.ts`:

```ts
/** Sticks in paint order: `top` is frontmost and leads the loader. */
export const STICKS = ['top', 'mid', 'low'] as const;
export type Stick = (typeof STICKS)[number];

type Triple = [string, string, string];

export interface MarkConfig {
  /** Hex per stick, in `top, mid, low` order. */
  light: Triple;
  dark: Triple;
  /** Field behind the mark on the chip variants. */
  chip: string;
  /** Degrees per stick, in `top, mid, low` order. */
  angles: [number, number, number];
  /** Stroke width of the bare mark on the 48-unit grid. */
  bareWeight: number;
  /** Arm reach and stroke for the inset chip variants. */
  chipReach: number;
  chipWeight: number;
}

/** Reach of a bare stick: it spans the full diameter, 6..42 on a 48 grid. */
export const BARE_REACH = 18;

/**
 * Weight-to-reach ratio. Any inset variant must hold it or the mark reads
 * bolder than the favicon — the chip at reach 14 therefore uses stroke 4.6.
 */
export const RATIO = 1 / 3;

export const DEFAULT_CONFIG: MarkConfig = {
  light: ['#7167ff', '#00bb9a', '#ff298a'],
  dark: ['#6652ff', '#12b898', '#ff378c'],
  chip: '#1b1830',
  angles: [62, 27, 160],
  bareWeight: 6,
  chipReach: 14,
  chipWeight: 4.6,
};

export interface Palette {
  light: Triple;
  dark: Triple;
  chip: string;
}

export type PresetName = 'chosen' | 'lifted' | 'neon' | 'soft';

export const PRESETS: Record<PresetName, Palette> = {
  chosen: {
    light: ['#7167ff', '#00bb9a', '#ff298a'],
    dark: ['#6652ff', '#12b898', '#ff378c'],
    chip: '#1b1830',
  },
  // Identical to `chosen` except the dark violet is lifted, taking it from
  // 2.42:1 to 3.29:1 on a selected dark tab.
  lifted: {
    light: ['#7167ff', '#00bb9a', '#ff298a'],
    dark: ['#8071ff', '#12b898', '#ff378c'],
    chip: '#1b1830',
  },
  neon: {
    light: ['#7c6cff', '#12d6b8', '#ff4fa3'],
    dark: ['#9182ff', '#22cdb0', '#ff6fae'],
    chip: '#16131f',
  },
  soft: {
    light: ['#5a4ff3', '#0d8a74', '#d92b7a'],
    dark: ['#8a7bff', '#2ec5a8', '#f56aa5'],
    chip: '#1b1830',
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test src/config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/icon-studio/src/config.ts packages/web/icon-studio/src/config.test.ts
git commit -m "feat(icon-studio): MarkConfig with the locked defaults and presets"
```

---

### Task 3: Colour maths

**Files:**
- Create: `packages/web/icon-studio/src/color.ts`
- Test: `packages/web/icon-studio/src/color.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `toHsl(hex): [number, number, number]`, `toHex(h, s, l): string`, `Adjust` (`{ hue: number; sat: number; lit: number }`), `adjust(hex, a): string`, `NEUTRAL: Adjust`, `luminance(hex): number`, `contrast(a, b): number`, `Verdict` (`'ok' | 'min' | 'bad'`), `verdict(ratio): Verdict`, `GROUND: { light: string; dark: string }`.

- [ ] **Step 1: Write the failing test**

`packages/web/icon-studio/src/color.test.ts`:

```ts
import { adjust, contrast, GROUND, NEUTRAL, toHex, toHsl, verdict } from './color';

test('hsl round trip is lossless for the locked palette', () => {
  for (const hex of ['#7167ff', '#00bb9a', '#ff298a', '#6652ff', '#1b1830', '#ffffff', '#000000']) {
    const [h, s, l] = toHsl(hex);
    expect(toHex(h, s, l)).toBe(hex);
  }
});

test('a neutral adjustment returns the input unchanged', () => {
  for (const hex of ['#7167ff', '#00bb9a', '#ff298a']) {
    expect(adjust(hex, NEUTRAL)).toBe(hex);
  }
});

test('raising saturation and lightness moves the colour', () => {
  const out = adjust('#7167ff', { hue: 0, sat: 1.4, lit: 0.05 });
  expect(out).not.toBe('#7167ff');
  const [, s, l] = toHsl(out);
  const [, s0, l0] = toHsl('#7167ff');
  expect(l).toBeGreaterThan(l0);
  expect(s).toBeGreaterThanOrEqual(s0);
});

test('lightness is clamped so a colour never becomes pure black or white', () => {
  expect(adjust('#ffffff', { hue: 0, sat: 1, lit: 0.9 })).not.toBe('#ffffff');
  const [, , l] = toHsl(adjust('#000000', { hue: 0, sat: 1, lit: -0.9 }));
  expect(l).toBeGreaterThan(0);
});

test('contrast matches the measured values from the design', () => {
  expect(contrast('#7167ff', GROUND.light)).toBeCloseTo(4.13, 1);
  expect(contrast('#00bb9a', GROUND.light)).toBeCloseTo(2.45, 1);
  expect(contrast('#6652ff', GROUND.dark)).toBeCloseTo(2.42, 1);
  expect(contrast('#12b898', GROUND.dark)).toBeCloseTo(4.79, 1);
});

test('contrast is symmetric', () => {
  expect(contrast('#7167ff', '#ffffff')).toBeCloseTo(contrast('#ffffff', '#7167ff'), 6);
});

test('verdict bands split at 3 and 4.5', () => {
  expect(verdict(5)).toBe('ok');
  expect(verdict(4.5)).toBe('ok');
  expect(verdict(3.2)).toBe('min');
  expect(verdict(3)).toBe('min');
  expect(verdict(2.9)).toBe('bad');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test src/color.test.ts`
Expected: FAIL — cannot resolve `./color`.

- [ ] **Step 3: Write minimal implementation**

`packages/web/icon-studio/src/color.ts`:

```ts
/**
 * Grounds the mark is judged against. Not the app's own surfaces — a favicon
 * lives in browser chrome, so these are a white tab and a selected dark tab.
 */
export const GROUND = { light: '#ffffff', dark: '#35363a' } as const;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

export function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  const l = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

export function toHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const table: [number, number, number][] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ];
  const seg = table[Math.floor(hue / 60) % 6];
  return '#' + seg.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

/** A non-destructive shift applied over a base colour. */
export interface Adjust {
  /** Degrees added to the hue. */
  hue: number;
  /** Saturation multiplier. */
  sat: number;
  /** Lightness offset, added. */
  lit: number;
}

export const NEUTRAL: Adjust = { hue: 0, sat: 1, lit: 0 };

export function adjust(hex: string, a: Adjust): string {
  const [h, s, l] = toHsl(hex);
  return toHex(h + a.hue, clamp(s * a.sat, 0, 1), clamp(l + a.lit, 0.03, 0.97));
}

const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * `ok` is comfortable at 16px, `min` clears the 3:1 floor for a graphic, `bad`
 * is below it. A brand mark has no WCAG minimum — WCAG 1.4.11 exempts
 * logotypes — so treat `bad` as "hard to find", not as a violation.
 */
export type Verdict = 'ok' | 'min' | 'bad';

export function verdict(ratio: number): Verdict {
  if (ratio >= 4.5) return 'ok';
  if (ratio >= 3) return 'min';
  return 'bad';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test src/color.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/icon-studio/src/color.ts packages/web/icon-studio/src/color.test.ts
git commit -m "feat(icon-studio): colour maths — hsl round trip, adjust, contrast"
```

---

### Task 4: The SVG generators

**Files:**
- Create: `packages/web/icon-studio/src/generate/svg.ts`
- Test: `packages/web/icon-studio/src/generate/svg.test.ts`

**Interfaces:**
- Consumes: `MarkConfig` from `../config`.
- Produces: `svgFavicon(c): string`, `svgBare(c, mode): string`, `svgMono(c): string`, `svgChip(c, opts?): string`, `outerExtent(c): number`, `safeZonePct(c): number`, `SAFE_ZONE_PCT = 80`.

- [ ] **Step 1: Write the failing test**

`packages/web/icon-studio/src/generate/svg.test.ts`:

```ts
import { DEFAULT_CONFIG } from '../config';
import { outerExtent, safeZonePct, svgBare, svgChip, svgFavicon, svgMono } from './svg';

const all = () => ({
  favicon: svgFavicon(DEFAULT_CONFIG),
  bareLight: svgBare(DEFAULT_CONFIG, 'light'),
  bareDark: svgBare(DEFAULT_CONFIG, 'dark'),
  mono: svgMono(DEFAULT_CONFIG),
  chip: svgChip(DEFAULT_CONFIG),
  chipSquare: svgChip(DEFAULT_CONFIG, { rounded: false }),
});

test('every variant is one well-formed svg with exactly three sticks', () => {
  for (const [name, svg] of Object.entries(all())) {
    expect(svg.match(/<svg/g), name).toHaveLength(1);
    expect(svg.match(/<\/svg>/g), name).toHaveLength(1);
    expect(svg.match(/<path/g), name).toHaveLength(3);
    expect(svg, name).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg, name).toContain('viewBox="0 0 48 48"');
  }
});

test('every variant honours the configured angles', () => {
  const config = { ...DEFAULT_CONFIG, angles: [5, 37, 155] as [number, number, number] };
  for (const svg of [svgFavicon(config), svgBare(config, 'light'), svgMono(config), svgChip(config)]) {
    expect(svg).toContain('rotate(5 24 24)');
    expect(svg).toContain('rotate(37 24 24)');
    expect(svg).toContain('rotate(155 24 24)');
  }
});

test('sticks are painted back to front so `top` is on top', () => {
  const svg = svgBare(DEFAULT_CONFIG, 'light');
  const low = svg.indexOf(DEFAULT_CONFIG.light[2]);
  const mid = svg.indexOf(DEFAULT_CONFIG.light[1]);
  const top = svg.indexOf(DEFAULT_CONFIG.light[0]);
  expect(low).toBeLessThan(mid);
  expect(mid).toBeLessThan(top);
});

test('favicon inlines both triads and swaps them by colour scheme', () => {
  const svg = svgFavicon(DEFAULT_CONFIG);
  for (const hex of [...DEFAULT_CONFIG.light, ...DEFAULT_CONFIG.dark]) {
    expect(svg).toContain(hex);
  }
  expect(svg).toContain('prefers-color-scheme:dark');
});

test('bare variants carry only their own triad', () => {
  const light = svgBare(DEFAULT_CONFIG, 'light');
  expect(light).toContain(DEFAULT_CONFIG.light[0]);
  expect(light).not.toContain(DEFAULT_CONFIG.dark[0]);
});

test('mono is a single black colour with no palette hex', () => {
  const svg = svgMono(DEFAULT_CONFIG);
  expect(svg).toContain('#000');
  for (const hex of [...DEFAULT_CONFIG.light, ...DEFAULT_CONFIG.dark]) {
    expect(svg).not.toContain(hex);
  }
});

test('chip fills the field, uses the dark triad and insets the mark', () => {
  const svg = svgChip(DEFAULT_CONFIG);
  expect(svg).toContain(`fill="${DEFAULT_CONFIG.chip}"`);
  expect(svg).toContain(`stroke-width="${DEFAULT_CONFIG.chipWeight}"`);
  expect(svg).toContain(DEFAULT_CONFIG.dark[0]);
  // reach 14 -> the stick spans 24±14
  expect(svg).toContain('M24 10L24 38');
});

test('chip corners: rounded by default, square when asked', () => {
  expect(svgChip(DEFAULT_CONFIG)).toContain('rx="11"');
  expect(svgChip(DEFAULT_CONFIG, { rounded: false })).toContain('rx="0"');
});

test('the chip mark sits inside the android safe circle', () => {
  expect(outerExtent(DEFAULT_CONFIG)).toBeCloseTo(16.3, 1);
  expect(safeZonePct(DEFAULT_CONFIG)).toBeCloseTo(68, 0);
  expect(safeZonePct(DEFAULT_CONFIG)).toBeLessThan(80);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test src/generate/svg.test.ts`
Expected: FAIL — cannot resolve `./svg`.

- [ ] **Step 3: Write minimal implementation**

`packages/web/icon-studio/src/generate/svg.ts`:

```ts
import type { MarkConfig } from '../config';

const CENTRE = 24;

/** Android crops a maskable icon to a circle; content must stay inside 80%. */
export const SAFE_ZONE_PCT = 80;

interface StickOpts {
  angles: [number, number, number];
  reach: number;
  weight: number;
  /** Literal stroke colour per stick, or omit and pass `classes` instead. */
  colours?: [string, string, string];
  /** Class per stick, for the favicon's media-query swap. */
  classes?: [string, string, string];
}

/**
 * Sticks in reverse index order — SVG paints in document order and has no
 * z-index, so appending low, mid, top puts `top` frontmost.
 */
function sticks({ angles, reach, weight, colours, classes }: StickOpts): string {
  let out = '';
  for (let i = 2; i >= 0; i--) {
    const paint = classes ? ` class="${classes[i]}"` : ` stroke="${colours![i]}"`;
    out +=
      `\n    <path d="M${CENTRE} ${CENTRE - reach}L${CENTRE} ${CENTRE + reach}"${paint}` +
      ` stroke-width="${weight}" stroke-linecap="round" fill="none"` +
      ` transform="rotate(${angles[i]} ${CENTRE} ${CENTRE})"/>`;
  }
  return out;
}

const open = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">';

/**
 * Theme-aware bare mark. `currentColor` is no use in a favicon — the file has
 * no inherited colour — so both triads are inlined and swapped by a media
 * query inside the SVG itself.
 */
export function svgFavicon(c: MarkConfig): string {
  const [l1, l2, l3] = c.light;
  const [d1, d2, d3] = c.dark;
  return `${open}
  <style>
    .s1{stroke:${l1}}.s2{stroke:${l2}}.s3{stroke:${l3}}
    @media (prefers-color-scheme:dark){.s1{stroke:${d1}}.s2{stroke:${d2}}.s3{stroke:${d3}}}
  </style>
  <g fill="none">${sticks({
    angles: c.angles,
    reach: 18,
    weight: c.bareWeight,
    classes: ['s1', 's2', 's3'],
  })}
  </g>
</svg>
`;
}

/** Single-theme bare mark, for the rail, lockups and docs. */
export function svgBare(c: MarkConfig, mode: 'light' | 'dark'): string {
  return `${open}
  <g fill="none">${sticks({
    angles: c.angles,
    reach: 18,
    weight: c.bareWeight,
    colours: c[mode],
  })}
  </g>
</svg>
`;
}

/** Safari's pinned tab needs one colour; the browser tints it itself. */
export function svgMono(c: MarkConfig): string {
  return `${open}
  <g fill="none">${sticks({
    angles: c.angles,
    reach: 18,
    weight: c.bareWeight,
    colours: ['#000', '#000', '#000'],
  })}
  </g>
</svg>
`;
}

/**
 * Dark field with the mark on top. A coloured field cannot knock out three
 * colours, and a dark chip lets the mark sit at full strength on any home
 * screen wallpaper — so the field is dark in both themes.
 */
export function svgChip(c: MarkConfig, opts: { rounded?: boolean } = {}): string {
  const rx = opts.rounded === false ? 0 : 11;
  return `${open}
  <rect width="48" height="48" rx="${rx}" fill="${c.chip}"/>
  <g fill="none">${sticks({
    angles: c.angles,
    reach: c.chipReach,
    weight: c.chipWeight,
    colours: c.dark,
  })}
  </g>
</svg>
`;
}

/** How far the chip mark reaches from the centre, including the stroke cap. */
export function outerExtent(c: MarkConfig): number {
  return c.chipReach + c.chipWeight / 2;
}

/** That extent as a percentage of the tile's half-width. */
export function safeZonePct(c: MarkConfig): number {
  return (outerExtent(c) / CENTRE) * 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test src/generate/svg.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/icon-studio/src/generate/
git commit -m "feat(icon-studio): svg generators for favicon, bare, mono and chip"
```

---

### Task 5: Manifest and the marked head block

**Files:**
- Create: `packages/web/icon-studio/src/generate/manifest.ts`
- Create: `packages/web/icon-studio/src/generate/head.ts`
- Test: `packages/web/icon-studio/src/generate/manifest.test.ts`
- Test: `packages/web/icon-studio/src/generate/head.test.ts`

**Interfaces:**
- Consumes: `MarkConfig` from `../config`.
- Produces: `buildManifest(c): string`, `buildHeadBlock(c): string`, `injectHeadBlock(html, block): string`, `HEAD_START: string`, `HEAD_END: string`.

- [ ] **Step 1: Write the failing tests**

`packages/web/icon-studio/src/generate/manifest.test.ts`:

```ts
import { DEFAULT_CONFIG } from '../config';
import { buildManifest } from './manifest';

test('manifest is pretty JSON ending in a newline', () => {
  const out = buildManifest(DEFAULT_CONFIG);
  expect(out.endsWith('\n')).toBe(true);
  expect(() => JSON.parse(out)).not.toThrow();
  expect(out).toContain('\n  "name"');
});

test('manifest declares a standalone app themed to the chip field', () => {
  const m = JSON.parse(buildManifest(DEFAULT_CONFIG));
  expect(m.name).toBe('tickets');
  expect(m.short_name).toBe('tickets');
  expect(m.start_url).toBe('/');
  expect(m.scope).toBe('/');
  expect(m.display).toBe('standalone');
  expect(m.theme_color).toBe(DEFAULT_CONFIG.chip);
  expect(m.background_color).toBe(DEFAULT_CONFIG.chip);
});

test('manifest lists both maskable icons', () => {
  const m = JSON.parse(buildManifest(DEFAULT_CONFIG));
  expect(m.icons).toHaveLength(2);
  expect(m.icons.map((i: { src: string }) => i.src)).toEqual(['/icon-192.png', '/icon-512.png']);
  for (const icon of m.icons) {
    expect(icon.type).toBe('image/png');
    expect(icon.purpose).toBe('maskable any');
  }
});
```

`packages/web/icon-studio/src/generate/head.test.ts`:

```ts
import { DEFAULT_CONFIG } from '../config';
import { buildHeadBlock, HEAD_END, HEAD_START, injectHeadBlock } from './head';

const page = (inner: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />${inner}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

test('the block carries every tag the platforms need', () => {
  const block = buildHeadBlock(DEFAULT_CONFIG);
  for (const needle of [
    'rel="icon" href="/favicon.svg"',
    'rel="mask-icon" href="/icon-mono.svg"',
    'rel="apple-touch-icon" href="/apple-touch-icon.png"',
    'rel="manifest" href="/site.webmanifest"',
    'name="theme-color"',
    'name="apple-mobile-web-app-capable"',
    'name="apple-mobile-web-app-status-bar-style"',
  ]) {
    expect(block).toContain(needle);
  }
  expect(block).toContain(DEFAULT_CONFIG.chip);
  expect(block).toContain(DEFAULT_CONFIG.light[0]);
});

test('the block is wrapped in both markers', () => {
  const block = buildHeadBlock(DEFAULT_CONFIG);
  expect(block.startsWith(HEAD_START)).toBe(true);
  expect(block.trimEnd().endsWith(HEAD_END)).toBe(true);
});

test('inserts before </head> when no markers are present', () => {
  const html = page('');
  const out = injectHeadBlock(html, buildHeadBlock(DEFAULT_CONFIG));
  expect(out).toContain(HEAD_START);
  expect(out.indexOf(HEAD_START)).toBeLessThan(out.indexOf('</head>'));
  expect(out).toContain('<meta charset="UTF-8" />');
});

test('replaces the existing block, leaving everything else alone', () => {
  const first = injectHeadBlock(page(''), buildHeadBlock(DEFAULT_CONFIG));
  const changed = { ...DEFAULT_CONFIG, chip: '#003344' };
  const second = injectHeadBlock(first, buildHeadBlock(changed));
  expect(second.match(new RegExp(HEAD_START, 'g'))).toHaveLength(1);
  expect(second).toContain('#003344');
  expect(second).not.toContain(DEFAULT_CONFIG.chip);
  expect(second).toContain('<div id="root"></div>');
});

test('injecting the same block twice is a no-op', () => {
  const block = buildHeadBlock(DEFAULT_CONFIG);
  const once = injectHeadBlock(page(''), block);
  expect(injectHeadBlock(once, block)).toBe(once);
});

test('throws when there is no </head> to insert before', () => {
  expect(() => injectHeadBlock('<html><body></body></html>', buildHeadBlock(DEFAULT_CONFIG))).toThrow(
    /<\/head>/,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/icon-studio test src/generate/manifest.test.ts src/generate/head.test.ts`
Expected: FAIL — cannot resolve `./manifest` and `./head`.

- [ ] **Step 3: Write minimal implementation**

`packages/web/icon-studio/src/generate/manifest.ts`:

```ts
import type { MarkConfig } from '../config';

/**
 * `purpose: 'maskable any'` covers both cases with one file: Android crops it
 * for the launcher, everything else uses it as-is.
 */
export function buildManifest(c: MarkConfig): string {
  const manifest = {
    name: 'tickets',
    short_name: 'tickets',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: c.chip,
    theme_color: c.chip,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
    ],
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}
```

`packages/web/icon-studio/src/generate/head.ts`:

```ts
import type { MarkConfig } from '../config';

export const HEAD_START = '<!-- icons:start — generated by @tickets/icon-studio, do not edit -->';
export const HEAD_END = '<!-- icons:end -->';

/**
 * The iOS meta tags are not redundant with the manifest: Safari ignores the
 * manifest when launching from the home screen, so standalone display and the
 * status bar style have to be declared here too.
 */
export function buildHeadBlock(c: MarkConfig): string {
  return `${HEAD_START}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="mask-icon" href="/icon-mono.svg" color="${c.light[0]}" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="theme-color" content="${c.chip}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    ${HEAD_END}`;
}

/**
 * Replaces the marked region, or inserts it before `</head>` the first time.
 * index.html is hand-maintained, so nothing outside the markers is touched and
 * re-running with an unchanged config is a no-op.
 */
export function injectHeadBlock(html: string, block: string): string {
  const start = html.indexOf(HEAD_START);
  const end = html.indexOf(HEAD_END);

  if (start !== -1 && end !== -1) {
    return html.slice(0, start) + block + html.slice(end + HEAD_END.length);
  }

  const close = html.indexOf('</head>');
  if (close === -1) {
    throw new Error('cannot inject icon tags: no </head> found in index.html');
  }

  // Keep the closing tag's own indentation by inserting on the line above it.
  const lineStart = html.lastIndexOf('\n', close) + 1;
  const indent = html.slice(lineStart, close);
  return html.slice(0, lineStart) + indent + block + '\n' + html.slice(lineStart);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tickets/icon-studio test src/generate/manifest.test.ts src/generate/head.test.ts`
Expected: PASS (3 + 6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/icon-studio/src/generate/
git commit -m "feat(icon-studio): manifest and idempotent marked head block"
```

---

### Task 6: Output allowlist and PNG validation

**Files:**
- Create: `packages/web/icon-studio/src/plugin/outputs.ts`
- Create: `packages/web/icon-studio/src/plugin/validate.ts`
- Test: `packages/web/icon-studio/src/plugin/outputs.test.ts`
- Test: `packages/web/icon-studio/src/plugin/validate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `OUTPUTS: Readonly<Record<string, string>>`, `PNG_NAMES: readonly string[]`, `resolveOutput(name, repoRoot): string | null`, `MAX_BYTES = 1_048_576`, `decodePng(payload): { ok: true; bytes: Buffer } | { ok: false; reason: string }`.

- [ ] **Step 1: Write the failing tests**

`packages/web/icon-studio/src/plugin/outputs.test.ts`:

```ts
import path from 'node:path';
import { OUTPUTS, PNG_NAMES, resolveOutput } from './outputs';

const ROOT = path.resolve('/repo');

test('every known name resolves inside the repo root', () => {
  for (const name of Object.keys(OUTPUTS)) {
    const abs = resolveOutput(name, ROOT);
    expect(abs, name).not.toBeNull();
    expect(abs!.startsWith(ROOT + path.sep), name).toBe(true);
  }
});

test('the three rasterised names are the only ones the client supplies', () => {
  expect([...PNG_NAMES]).toEqual(['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']);
  for (const name of PNG_NAMES) expect(OUTPUTS).toHaveProperty(name);
});

test('unknown names are refused', () => {
  for (const name of ['evil.png', 'favicon.SVG', '', 'icon-193.png']) {
    expect(resolveOutput(name, ROOT), name).toBeNull();
  }
});

test('traversal attempts are refused because the name is never a path', () => {
  for (const name of ['../../etc/passwd', '..\\..\\windows\\system32', '/etc/passwd', 'a/b.png']) {
    expect(resolveOutput(name, ROOT), name).toBeNull();
  }
});

test('the table covers exactly the six assets plus the config', () => {
  expect(Object.keys(OUTPUTS).sort()).toEqual([
    'apple-touch-icon.png',
    'favicon.svg',
    'icon-192.png',
    'icon-512.png',
    'icon-mono.svg',
    'icons.config.json',
    'site.webmanifest',
  ]);
});
```

`packages/web/icon-studio/src/plugin/validate.test.ts`:

```ts
import { decodePng, MAX_BYTES } from './validate';

// An 8-byte PNG signature followed by nothing else is enough for the check.
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const validPayload = Buffer.concat([PNG_SIG, Buffer.alloc(32)]).toString('base64');

test('accepts a payload carrying the PNG signature', () => {
  const out = decodePng(validPayload);
  expect(out.ok).toBe(true);
  if (out.ok) expect(out.bytes.subarray(0, 8)).toEqual(PNG_SIG);
});

test('strips a data: prefix if the client sent one', () => {
  const out = decodePng(`data:image/png;base64,${validPayload}`);
  expect(out.ok).toBe(true);
});

test('rejects bytes that are not a PNG', () => {
  const out = decodePng(Buffer.from('<svg/>').toString('base64'));
  expect(out).toEqual({ ok: false, reason: 'not a png' });
});

test('rejects a payload that is not valid base64', () => {
  expect(decodePng('!!!not base64!!!').ok).toBe(false);
});

test('rejects anything over the size cap', () => {
  const big = Buffer.concat([PNG_SIG, Buffer.alloc(MAX_BYTES)]).toString('base64');
  expect(decodePng(big)).toEqual({ ok: false, reason: 'too large' });
});

test('rejects an empty payload', () => {
  expect(decodePng('').ok).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/icon-studio test src/plugin/`
Expected: FAIL — cannot resolve `./outputs` and `./validate`.

- [ ] **Step 3: Write minimal implementation**

`packages/web/icon-studio/src/plugin/outputs.ts`:

```ts
import path from 'node:path';

/**
 * The only paths Generate may write, keyed by the name the client uses. The
 * client never sends a path, so traversal is structurally impossible — an
 * unrecognised key is simply refused.
 */
export const OUTPUTS = Object.freeze({
  'favicon.svg': 'apps/web/public/favicon.svg',
  'icon-mono.svg': 'apps/web/public/icon-mono.svg',
  'icon-192.png': 'apps/web/public/icon-192.png',
  'icon-512.png': 'apps/web/public/icon-512.png',
  'apple-touch-icon.png': 'apps/web/public/apple-touch-icon.png',
  'site.webmanifest': 'apps/web/public/site.webmanifest',
  'icons.config.json': 'apps/web/icons.config.json',
} as const);

export type OutputName = keyof typeof OUTPUTS;

/**
 * The names the browser must supply, because a canvas is the only rasteriser.
 * Everything else the plugin derives from the config itself.
 */
export const PNG_NAMES = ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'] as const;

/**
 * Absolute destination for a name, or null if the name is not in the table.
 * The result is re-checked against `repoRoot` even though the table is
 * hardcoded — defence in depth costs one comparison.
 */
export function resolveOutput(name: string, repoRoot: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(OUTPUTS, name)) return null;
  const rel = OUTPUTS[name as OutputName];
  const abs = path.resolve(repoRoot, rel);
  if (!abs.startsWith(path.resolve(repoRoot) + path.sep)) return null;
  return abs;
}
```

`packages/web/icon-studio/src/plugin/validate.ts`:

```ts
/** One megabyte. A 512px icon of three strokes is a few kilobytes. */
export const MAX_BYTES = 1_048_576;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type Decoded = { ok: true; bytes: Buffer } | { ok: false; reason: string };

/**
 * Decodes a base64 PNG payload and proves it is a PNG by its signature rather
 * than by trusting the filename.
 */
export function decodePng(payload: string): Decoded {
  const base64 = payload.replace(/^data:image\/png;base64,/, '');
  if (base64.length === 0) return { ok: false, reason: 'empty payload' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return { ok: false, reason: 'not base64' };

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.byteLength > MAX_BYTES) return { ok: false, reason: 'too large' };
  if (bytes.byteLength < PNG_SIGNATURE.byteLength) return { ok: false, reason: 'not a png' };
  if (!bytes.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)) {
    return { ok: false, reason: 'not a png' };
  }
  return { ok: true, bytes };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tickets/icon-studio test src/plugin/`
Expected: PASS (5 + 6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/icon-studio/src/plugin/
git commit -m "feat(icon-studio): output allowlist and png signature validation"
```

---

### Task 7: The generate core — derive, validate, write atomically

**Files:**
- Create: `packages/web/icon-studio/src/plugin/write.ts`
- Test: `packages/web/icon-studio/src/plugin/write.test.ts`

**Interfaces:**
- Consumes: `MarkConfig`, `svgFavicon`, `svgMono`, `buildManifest`, `buildHeadBlock`, `injectHeadBlock`, `resolveOutput`, `PNG_NAMES`, `decodePng`.
- Produces: `GenerateRequest` (`{ config: MarkConfig; pngs: Record<string, string> }`), `GenerateResult` (`{ path: string; bytes: number; status: 'written' | 'unchanged' | 'rejected'; reason?: string }`), `GenerateResponse` (`{ results: GenerateResult[] }`), `runGenerate(body: unknown, repoRoot: string): Promise<GenerateResponse>`, `writeIfChanged(abs, bytes): Promise<'written' | 'unchanged'>`.

- [ ] **Step 1: Write the failing test**

`packages/web/icon-studio/src/plugin/write.test.ts`:

```ts
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG } from '../config';
import { HEAD_START } from '../generate/head';
import { runGenerate } from './write';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = Buffer.concat([PNG_SIG, Buffer.alloc(16)]).toString('base64');

const INDEX = `<!doctype html>
<html lang="en">
  <head>
    <title>tickets</title>
  </head>
  <body></body>
</html>
`;

async function fakeRepo() {
  const root = await mkdtemp(path.join(tmpdir(), 'icon-studio-'));
  await mkdir(path.join(root, 'apps', 'web'), { recursive: true });
  await writeFile(path.join(root, 'apps', 'web', 'index.html'), INDEX, 'utf8');
  return root;
}

const body = () => ({
  config: DEFAULT_CONFIG,
  pngs: { 'icon-192.png': png, 'icon-512.png': png, 'apple-touch-icon.png': png },
});

test('writes all seven outputs and creates public/', async () => {
  const root = await fakeRepo();
  const { results } = await runGenerate(body(), root);

  expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
  expect(results.map((r) => r.path).sort()).toEqual([
    'apps/web/icons.config.json',
    'apps/web/index.html',
    'apps/web/public/apple-touch-icon.png',
    'apps/web/public/favicon.svg',
    'apps/web/public/icon-192.png',
    'apps/web/public/icon-512.png',
    'apps/web/public/icon-mono.svg',
    'apps/web/public/site.webmanifest',
  ]);
});

test('derives the svgs and manifest from the config rather than the client', async () => {
  const root = await fakeRepo();
  await runGenerate(body(), root);

  const favicon = await readFile(path.join(root, 'apps/web/public/favicon.svg'), 'utf8');
  expect(favicon).toContain(DEFAULT_CONFIG.light[0]);
  expect(favicon).toContain('prefers-color-scheme:dark');

  const manifest = JSON.parse(await readFile(path.join(root, 'apps/web/public/site.webmanifest'), 'utf8'));
  expect(manifest.theme_color).toBe(DEFAULT_CONFIG.chip);
});

test('round-trips the config so the studio reopens on it', async () => {
  const root = await fakeRepo();
  await runGenerate(body(), root);
  const saved = JSON.parse(await readFile(path.join(root, 'apps/web/icons.config.json'), 'utf8'));
  expect(saved).toEqual(DEFAULT_CONFIG);
});

test('injects the head block into index.html without touching the rest', async () => {
  const root = await fakeRepo();
  await runGenerate(body(), root);
  const html = await readFile(path.join(root, 'apps/web/index.html'), 'utf8');
  expect(html).toContain(HEAD_START);
  expect(html).toContain('<title>tickets</title>');
});

test('a second identical run reports everything unchanged', async () => {
  const root = await fakeRepo();
  await runGenerate(body(), root);
  const { results } = await runGenerate(body(), root);
  expect(results.every((r) => r.status === 'unchanged')).toBe(true);
});

test('rejects an unknown png name and writes nothing for it', async () => {
  const root = await fakeRepo();
  const { results } = await runGenerate(
    { config: DEFAULT_CONFIG, pngs: { 'evil.png': png } },
    root,
  );
  const evil = results.find((r) => r.path === 'evil.png');
  expect(evil?.status).toBe('rejected');
  expect(evil?.reason).toMatch(/not an allowed output/);
});

test('rejects a png payload that is not a png', async () => {
  const root = await fakeRepo();
  const { results } = await runGenerate(
    {
      config: DEFAULT_CONFIG,
      pngs: { 'icon-192.png': Buffer.from('<svg/>').toString('base64') },
    },
    root,
  );
  const bad = results.find((r) => r.path.endsWith('icon-192.png'));
  expect(bad?.status).toBe('rejected');
  expect(bad?.reason).toBe('not a png');
});

test('rejects a malformed body without throwing', async () => {
  const root = await fakeRepo();
  await expect(runGenerate({ nope: true }, root)).rejects.toThrow(/config/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test src/plugin/write.test.ts`
Expected: FAIL — cannot resolve `./write`.

- [ ] **Step 3: Write minimal implementation**

`packages/web/icon-studio/src/plugin/write.ts`:

```ts
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MarkConfig } from '../config';
import { buildHeadBlock, injectHeadBlock } from '../generate/head';
import { buildManifest } from '../generate/manifest';
import { svgFavicon, svgMono } from '../generate/svg';
import { PNG_NAMES, resolveOutput } from './outputs';
import { decodePng } from './validate';

export interface GenerateRequest {
  config: MarkConfig;
  /** base64 PNG per name. Only a browser can produce these. */
  pngs: Record<string, string>;
}

export interface GenerateResult {
  /** Repo-relative path, or the offending name when rejected. */
  path: string;
  bytes: number;
  status: 'written' | 'unchanged' | 'rejected';
  reason?: string;
}

export interface GenerateResponse {
  results: GenerateResult[];
}

/**
 * Write only when the bytes differ, so re-running Generate on an unchanged
 * config leaves mtimes alone and shows up as nothing in `git status`. The
 * temp-then-rename keeps a failed write from leaving a truncated icon.
 */
export async function writeIfChanged(abs: string, bytes: Buffer): Promise<'written' | 'unchanged'> {
  try {
    const existing = await readFile(abs);
    if (existing.equals(bytes)) return 'unchanged';
  } catch {
    // Missing file — fall through and write it.
  }
  await mkdir(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp`;
  await writeFile(tmp, bytes);
  await rename(tmp, abs);
  return 'written';
}

function assertRequest(body: unknown): GenerateRequest {
  if (typeof body !== 'object' || body === null) throw new Error('body must be an object');
  const { config, pngs } = body as Partial<GenerateRequest>;
  if (typeof config !== 'object' || config === null) throw new Error('body.config is required');
  for (const key of ['light', 'dark', 'angles'] as const) {
    if (!Array.isArray(config[key]) || config[key].length !== 3) {
      throw new Error(`body.config.${key} must be a triple`);
    }
  }
  if (typeof config.chip !== 'string') throw new Error('body.config.chip must be a string');
  return { config, pngs: pngs ?? {} };
}

export async function runGenerate(body: unknown, repoRoot: string): Promise<GenerateResponse> {
  const { config, pngs } = assertRequest(body);
  const results: GenerateResult[] = [];
  const rel = (abs: string) => path.relative(repoRoot, abs).split(path.sep).join('/');

  // Everything derivable is derived here, not trusted from the client.
  const derived: Record<string, Buffer> = {
    'favicon.svg': Buffer.from(svgFavicon(config), 'utf8'),
    'icon-mono.svg': Buffer.from(svgMono(config), 'utf8'),
    'site.webmanifest': Buffer.from(buildManifest(config), 'utf8'),
    'icons.config.json': Buffer.from(JSON.stringify(config, null, 2) + '\n', 'utf8'),
  };

  for (const [name, bytes] of Object.entries(derived)) {
    const abs = resolveOutput(name, repoRoot)!;
    const status = await writeIfChanged(abs, bytes);
    results.push({ path: rel(abs), bytes: bytes.byteLength, status });
  }

  for (const [name, payload] of Object.entries(pngs)) {
    if (!(PNG_NAMES as readonly string[]).includes(name)) {
      results.push({ path: name, bytes: 0, status: 'rejected', reason: 'not an allowed output' });
      continue;
    }
    const abs = resolveOutput(name, repoRoot);
    if (abs === null) {
      results.push({ path: name, bytes: 0, status: 'rejected', reason: 'not an allowed output' });
      continue;
    }
    const decoded = decodePng(payload);
    if (!decoded.ok) {
      results.push({ path: rel(abs), bytes: 0, status: 'rejected', reason: decoded.reason });
      continue;
    }
    const status = await writeIfChanged(abs, decoded.bytes);
    results.push({ path: rel(abs), bytes: decoded.bytes.byteLength, status });
  }

  // index.html is hand-maintained: merge the marked block, never overwrite.
  const indexPath = path.resolve(repoRoot, 'apps/web/index.html');
  const html = await readFile(indexPath, 'utf8');
  const merged = injectHeadBlock(html, buildHeadBlock(config));
  const bytes = Buffer.from(merged, 'utf8');
  const status = await writeIfChanged(indexPath, bytes);
  results.push({ path: rel(indexPath), bytes: bytes.byteLength, status });

  return { results };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test src/plugin/write.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/icon-studio/src/plugin/write.ts packages/web/icon-studio/src/plugin/write.test.ts
git commit -m "feat(icon-studio): generate core — derive, validate, atomic write"
```

---

### Task 8: The Vite plugin

**Files:**
- Create: `packages/web/icon-studio/src/plugin/icon-writer.ts`
- Modify: `packages/web/icon-studio/vite.config.ts`
- Test: `packages/web/icon-studio/src/plugin/icon-writer.test.ts`

**Interfaces:**
- Consumes: `runGenerate` from `./write`, `DEFAULT_CONFIG` from `../config`.
- Produces: `iconWriter(opts: { repoRoot: string }): Plugin`, `isLoopback(address: string | undefined): boolean`, `readBody(req, limit): Promise<string>`.

- [ ] **Step 1: Write the failing test**

`packages/web/icon-studio/src/plugin/icon-writer.test.ts`:

```ts
import { iconWriter, isLoopback } from './icon-writer';

test('the plugin only exists while serving', () => {
  const plugin = iconWriter({ repoRoot: '/repo' });
  expect(plugin.name).toBe('icon-writer');
  expect(plugin.apply).toBe('serve');
});

test('loopback addresses are allowed', () => {
  for (const addr of ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']) {
    expect(isLoopback(addr), addr).toBe(true);
  }
});

test('anything else is refused, including an absent address', () => {
  for (const addr of ['192.168.1.20', '10.0.0.4', '203.0.113.9', undefined]) {
    expect(isLoopback(addr), String(addr)).toBe(false);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test src/plugin/icon-writer.test.ts`
Expected: FAIL — cannot resolve `./icon-writer`.

- [ ] **Step 3: Write minimal implementation**

`packages/web/icon-studio/src/plugin/icon-writer.ts`:

```ts
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';
import { DEFAULT_CONFIG } from '../config';
import { MAX_BYTES } from './validate';
import { runGenerate } from './write';

/**
 * The dev server may be bound wider than localhost, so the write routes check
 * the peer explicitly rather than relying on the bind address.
 */
export function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'].includes(address);
}

/** Four PNGs plus JSON overhead; generous but bounded. */
const BODY_LIMIT = MAX_BYTES * 6;

export async function readBody(req: IncomingMessage, limit = BODY_LIMIT): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).byteLength;
    if (total > limit) throw new Error('request body too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(body);
}

export function iconWriter({ repoRoot }: { repoRoot: string }): Plugin {
  return {
    name: 'icon-writer',
    // Never part of a build: these routes cannot ship.
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/__icons/config' && url !== '/__icons/generate') return next();

        if (!isLoopback(req.socket.remoteAddress ?? undefined)) {
          send(res, 403, { error: 'icon studio only accepts loopback requests' });
          return;
        }

        try {
          if (url === '/__icons/config') {
            if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
            const file = path.resolve(repoRoot, 'apps/web/icons.config.json');
            try {
              send(res, 200, JSON.parse(await readFile(file, 'utf8')));
            } catch {
              // No config committed yet — hand back the locked defaults.
              send(res, 200, DEFAULT_CONFIG);
            }
            return;
          }

          if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
          const body = JSON.parse(await readBody(req));
          send(res, 200, await runGenerate(body, repoRoot));
        } catch (error) {
          send(res, 400, { error: error instanceof Error ? error.message : 'generate failed' });
        }
      });
    },
  };
}
```

`packages/web/icon-studio/vite.config.ts` — replace the whole file:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { iconWriter } from './src/plugin/icon-writer';

// This file lives at packages/web/icon-studio, so the repo root is three up.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export default defineConfig({
  root: 'dev',
  plugins: [react(), tailwindcss(), iconWriter({ repoRoot })],
  server: { port: 4660, strictPort: true },
});
```

- [ ] **Step 4: Run test and typecheck**

```bash
pnpm --filter @tickets/icon-studio test src/plugin/icon-writer.test.ts
pnpm --filter @tickets/icon-studio typecheck
```

Expected: PASS (3 tests), typecheck clean.

- [ ] **Step 5: Verify the endpoint answers**

Start `pnpm --filter @tickets/icon-studio dev`, then in another shell:

```bash
curl -s http://127.0.0.1:4660/__icons/config
```

Expected: the locked default config as JSON (no `icons.config.json` exists yet). Stop the server.

- [ ] **Step 6: Commit**

```bash
git add packages/web/icon-studio/src/plugin/icon-writer.ts packages/web/icon-studio/src/plugin/icon-writer.test.ts packages/web/icon-studio/vite.config.ts
git commit -m "feat(icon-studio): dev-only vite plugin exposing the generate endpoint"
```

---

### Task 9: Client rasteriser and API

**Files:**
- Create: `packages/web/icon-studio/src/generate/raster.ts`
- Create: `packages/web/icon-studio/src/api.ts`
- Test: `packages/web/icon-studio/src/generate/raster.test.ts`
- Test: `packages/web/icon-studio/src/api.test.ts`

**Interfaces:**
- Consumes: `MarkConfig`, `svgChip`, `GenerateResponse`.
- Produces: `dataUri(svg): string`, `svgToPngBase64(svg, size): Promise<string>`, `RASTER_SIZES: Record<string, number>`, `fetchConfig(): Promise<MarkConfig>`, `buildPngs(c): Promise<Record<string, string>>`, `generate(c): Promise<GenerateResponse>`.

- [ ] **Step 1: Write the failing tests**

`packages/web/icon-studio/src/generate/raster.test.ts`:

```ts
import { DEFAULT_CONFIG } from '../config';
import { svgChip } from './svg';
import { dataUri, RASTER_SIZES } from './raster';

test('encodes svg as a utf-8 data uri', () => {
  const uri = dataUri(svgChip(DEFAULT_CONFIG));
  expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
  expect(uri).not.toContain('<');
  expect(decodeURIComponent(uri.split(',')[1])).toContain('<svg');
});

test('the three rasterised sizes match the platform requirements', () => {
  expect(RASTER_SIZES).toEqual({
    'icon-192.png': 192,
    'icon-512.png': 512,
    'apple-touch-icon.png': 180,
  });
});
```

`packages/web/icon-studio/src/api.test.ts`:

```ts
import { DEFAULT_CONFIG } from './config';
import { fetchConfig } from './api';

test('fetchConfig returns the served config', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => DEFAULT_CONFIG,
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(fetchConfig()).resolves.toEqual(DEFAULT_CONFIG);
  // `json()` forwards its optional init, so the call carries a second
  // `undefined` argument — assert the real call, not a tidier one.
  expect(fetchMock).toHaveBeenCalledWith('/__icons/config', undefined);

  vi.unstubAllGlobals();
});

test('fetchConfig throws when the endpoint is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
  await expect(fetchConfig()).rejects.toThrow(/403/);
  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tickets/icon-studio test src/generate/raster.test.ts src/api.test.ts`
Expected: FAIL — cannot resolve `./raster` and `./api`.

- [ ] **Step 3: Write minimal implementation**

`packages/web/icon-studio/src/generate/raster.ts`:

```ts
/**
 * PNG sizes each platform asks for. 180 is what iOS wants for the home
 * screen; 192 and 512 are the manifest's maskable pair.
 */
export const RASTER_SIZES = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'apple-touch-icon.png': 180,
} as const;

export function dataUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Rasterises through a canvas. Deliberately browser-side: the alternative is a
 * native image dependency on the server, which would break the offline,
 * self-hosted posture the deploy already has. Returns base64 without a prefix.
 */
export function svgToPngBase64(svg: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('no 2d context'));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''));
    };
    img.onerror = () => reject(new Error('could not rasterise the svg'));
    img.src = dataUri(svg);
  });
}
```

`packages/web/icon-studio/src/api.ts`:

```ts
import type { MarkConfig } from './config';
import { RASTER_SIZES, svgToPngBase64 } from './generate/raster';
import { svgChip } from './generate/svg';
import type { GenerateResponse } from './plugin/write';

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

export function fetchConfig(): Promise<MarkConfig> {
  return json<MarkConfig>('/__icons/config');
}

/**
 * The only assets the server cannot derive. apple-touch-icon is square because
 * iOS applies its own mask; the other two keep the rounded field.
 */
export async function buildPngs(config: MarkConfig): Promise<Record<string, string>> {
  const entries = await Promise.all(
    Object.entries(RASTER_SIZES).map(async ([name, size]) => {
      const svg = svgChip(config, { rounded: name !== 'apple-touch-icon.png' });
      return [name, await svgToPngBase64(svg, size)] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function generate(config: MarkConfig): Promise<GenerateResponse> {
  const pngs = await buildPngs(config);
  return json<GenerateResponse>('/__icons/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config, pngs }),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tickets/icon-studio test src/generate/raster.test.ts src/api.test.ts`
Expected: PASS (2 + 2 tests).

Note: `svgToPngBase64` is not unit-tested — jsdom has no canvas implementation. It is exercised by the manual verification in Task 12, and kept deliberately small so there is little to get wrong.

- [ ] **Step 5: Commit**

```bash
git add packages/web/icon-studio/src/generate/raster.ts packages/web/icon-studio/src/generate/raster.test.ts packages/web/icon-studio/src/api.ts packages/web/icon-studio/src/api.test.ts
git commit -m "feat(icon-studio): canvas rasteriser and generate client"
```

---

### Task 10: Studio state

**Files:**
- Create: `packages/web/icon-studio/src/state.ts`
- Test: `packages/web/icon-studio/src/state.test.ts`

**Interfaces:**
- Consumes: `MarkConfig`, `DEFAULT_CONFIG`, `PRESETS`, `PresetName`, `Adjust`, `NEUTRAL`, `adjust`.
- Produces: `StudioState` (`{ base: { light: Triple; dark: Triple }; chip: string; adjLight: Adjust; adjDark: Adjust; angles: [number,number,number]; bareWeight: number; chipReach: number; chipWeight: number }`), `INITIAL_STATE`, `StudioAction`, `studioReducer(state, action): StudioState`, `toConfig(state): MarkConfig`, `fromConfig(config): StudioState`.

- [ ] **Step 1: Write the failing test**

`packages/web/icon-studio/src/state.test.ts`:

```ts
import { DEFAULT_CONFIG, PRESETS } from './config';
import { fromConfig, INITIAL_STATE, studioReducer, toConfig } from './state';

test('the initial state produces the locked config', () => {
  expect(toConfig(INITIAL_STATE)).toEqual(DEFAULT_CONFIG);
});

test('config round-trips through state', () => {
  expect(toConfig(fromConfig(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG);
});

test('setting a base colour changes only that stick', () => {
  const next = studioReducer(INITIAL_STATE, {
    type: 'setBase', mode: 'light', index: 1, hex: '#123456',
  });
  expect(toConfig(next).light).toEqual([DEFAULT_CONFIG.light[0], '#123456', DEFAULT_CONFIG.light[2]]);
  expect(toConfig(next).dark).toEqual(DEFAULT_CONFIG.dark);
});

test('adjustments are non-destructive — resetting restores the base exactly', () => {
  const adjusted = studioReducer(INITIAL_STATE, {
    type: 'setAdjust', mode: 'light', patch: { sat: 1.6, lit: 0.1 },
  });
  expect(toConfig(adjusted).light).not.toEqual(DEFAULT_CONFIG.light);
  const reset = studioReducer(adjusted, { type: 'resetAdjust' });
  expect(toConfig(reset).light).toEqual(DEFAULT_CONFIG.light);
});

test('adjustments never compound across repeated dispatches', () => {
  const once = studioReducer(INITIAL_STATE, { type: 'setAdjust', mode: 'light', patch: { sat: 1.4 } });
  const twice = studioReducer(once, { type: 'setAdjust', mode: 'light', patch: { sat: 1.4 } });
  expect(toConfig(twice).light).toEqual(toConfig(once).light);
});

test('light and dark adjust independently', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'setAdjust', mode: 'dark', patch: { lit: -0.1 } });
  expect(toConfig(next).light).toEqual(DEFAULT_CONFIG.light);
  expect(toConfig(next).dark).not.toEqual(DEFAULT_CONFIG.dark);
});

test('applying a preset replaces the base and clears adjustments', () => {
  const dirty = studioReducer(INITIAL_STATE, { type: 'setAdjust', mode: 'light', patch: { sat: 1.7 } });
  const next = studioReducer(dirty, { type: 'applyPreset', name: 'neon' });
  expect(toConfig(next).light).toEqual(PRESETS.neon.light);
  expect(toConfig(next).chip).toBe(PRESETS.neon.chip);
});

test('setting an angle changes only that stick', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'setAngle', index: 2, degrees: 90 });
  expect(toConfig(next).angles).toEqual([62, 27, 90]);
});

test('matchRatio derives the chip stroke from its reach', () => {
  const wide = studioReducer(INITIAL_STATE, { type: 'setNumber', key: 'chipReach', value: 18 });
  const matched = studioReducer(wide, { type: 'matchRatio' });
  expect(toConfig(matched).chipWeight).toBeCloseTo(6, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test src/state.test.ts`
Expected: FAIL — cannot resolve `./state`.

- [ ] **Step 3: Write minimal implementation**

`packages/web/icon-studio/src/state.ts`:

```ts
import { adjust, NEUTRAL, type Adjust } from './color';
import {
  DEFAULT_CONFIG, PRESETS, RATIO, type MarkConfig, type PresetName,
} from './config';

type Triple = [string, string, string];
type Mode = 'light' | 'dark';
type NumberKey = 'bareWeight' | 'chipReach' | 'chipWeight';

/**
 * `base` is what presets and pickers set; the two `adj` layers sit on top. The
 * derived colours are recomputed from base every time, so dragging a slider can
 * never compound.
 */
export interface StudioState {
  base: { light: Triple; dark: Triple };
  chip: string;
  adjLight: Adjust;
  adjDark: Adjust;
  angles: [number, number, number];
  bareWeight: number;
  chipReach: number;
  chipWeight: number;
}

export const INITIAL_STATE: StudioState = fromConfig(DEFAULT_CONFIG);

export function fromConfig(config: MarkConfig): StudioState {
  return {
    base: { light: [...config.light] as Triple, dark: [...config.dark] as Triple },
    chip: config.chip,
    adjLight: { ...NEUTRAL },
    adjDark: { ...NEUTRAL },
    angles: [...config.angles] as [number, number, number],
    bareWeight: config.bareWeight,
    chipReach: config.chipReach,
    chipWeight: config.chipWeight,
  };
}

export function toConfig(state: StudioState): MarkConfig {
  const apply = (triple: Triple, a: Adjust) => triple.map((hex) => adjust(hex, a)) as Triple;
  return {
    light: apply(state.base.light, state.adjLight),
    dark: apply(state.base.dark, state.adjDark),
    chip: state.chip,
    angles: [...state.angles] as [number, number, number],
    bareWeight: state.bareWeight,
    chipReach: state.chipReach,
    chipWeight: state.chipWeight,
  };
}

export type StudioAction =
  | { type: 'setBase'; mode: Mode; index: number; hex: string }
  | { type: 'setChip'; hex: string }
  | { type: 'setAdjust'; mode: Mode; patch: Partial<Adjust> }
  | { type: 'resetAdjust' }
  | { type: 'applyPreset'; name: PresetName }
  | { type: 'setAngle'; index: number; degrees: number }
  | { type: 'setNumber'; key: NumberKey; value: number }
  | { type: 'matchRatio' }
  | { type: 'loadConfig'; config: MarkConfig };

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'setBase': {
      const triple = [...state.base[action.mode]] as Triple;
      triple[action.index] = action.hex;
      return { ...state, base: { ...state.base, [action.mode]: triple } };
    }
    case 'setChip':
      return { ...state, chip: action.hex };
    case 'setAdjust': {
      const key = action.mode === 'light' ? 'adjLight' : 'adjDark';
      return { ...state, [key]: { ...state[key], ...action.patch } };
    }
    case 'resetAdjust':
      return { ...state, adjLight: { ...NEUTRAL }, adjDark: { ...NEUTRAL } };
    case 'applyPreset': {
      const preset = PRESETS[action.name];
      return {
        ...state,
        base: { light: [...preset.light] as Triple, dark: [...preset.dark] as Triple },
        chip: preset.chip,
        adjLight: { ...NEUTRAL },
        adjDark: { ...NEUTRAL },
      };
    }
    case 'setAngle': {
      const angles = [...state.angles] as [number, number, number];
      angles[action.index] = action.degrees;
      return { ...state, angles };
    }
    case 'setNumber':
      return { ...state, [action.key]: action.value };
    case 'matchRatio':
      // Round to one decimal so the written config stays readable.
      return { ...state, chipWeight: Math.round(state.chipReach * RATIO * 10) / 10 };
    case 'loadConfig':
      return fromConfig(action.config);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/icon-studio test src/state.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/icon-studio/src/state.ts packages/web/icon-studio/src/state.test.ts
git commit -m "feat(icon-studio): studio reducer with non-destructive adjustments"
```

---

### Task 11: The studio screen

**Files:**
- Create: `packages/web/icon-studio/src/controls/swatch-row.tsx`
- Create: `packages/web/icon-studio/src/controls/slider-row.tsx`
- Create: `packages/web/icon-studio/src/controls/controls-panel.tsx`
- Create: `packages/web/icon-studio/src/output/file-grid.tsx`
- Modify: `packages/web/icon-studio/src/studio.tsx`
- Modify: `packages/web/icon-studio/src/index.ts`
- Test: `packages/web/icon-studio/src/studio.test.tsx`

**Interfaces:**
- Consumes: `studioReducer`, `INITIAL_STATE`, `toConfig`, `fetchConfig`, `generate`, `svgFavicon`/`svgBare`/`svgMono`/`svgChip`, `dataUri`, `contrast`, `verdict`, `GROUND`, `safeZonePct`.
- Produces: `Studio` (unchanged export), `SwatchRow`, `SliderRow`, `ControlsPanel`, `FileGrid`.

- [ ] **Step 1: Write the failing test**

Replace `packages/web/icon-studio/src/studio.test.tsx` entirely:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_CONFIG } from './config';
import { Studio } from './studio';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/__icons/config') return { ok: true, json: async () => DEFAULT_CONFIG };
      return { ok: true, json: async () => ({ results: [] }) };
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

test('renders the studio heading', async () => {
  render(<Studio />);
  expect(screen.getByRole('heading', { name: 'Icon studio' })).toBeDefined();
});

test('loads the committed config on mount', async () => {
  render(<Studio />);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/__icons/config'));
});

test('shows a colour picker per stick for both themes', async () => {
  render(<Studio />);
  for (const label of ['light top', 'light mid', 'light low', 'dark top', 'dark mid', 'dark low']) {
    expect(screen.getByLabelText(label), label).toBeDefined();
  }
});

test('shows an angle slider per stick', async () => {
  render(<Studio />);
  for (const label of ['top angle', 'mid angle', 'low angle']) {
    expect(screen.getByLabelText(label), label).toBeDefined();
  }
});

test('lists every file that Generate will write', async () => {
  render(<Studio />);
  for (const name of [
    'favicon.svg', 'icon-mono.svg', 'icon-192.png', 'icon-512.png',
    'apple-touch-icon.png', 'site.webmanifest',
  ]) {
    expect(screen.getByText(name), name).toBeDefined();
  }
});

test('offers a Generate button', async () => {
  render(<Studio />);
  expect(screen.getByRole('button', { name: /generate/i })).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/icon-studio test src/studio.test.tsx`
Expected: FAIL — no colour pickers, no Generate button.

- [ ] **Step 3: Write the control components**

`packages/web/icon-studio/src/controls/swatch-row.tsx`:

```tsx
import { contrast, verdict } from '../color';

const TONE: Record<string, string> = {
  ok: 'text-green-11',
  min: 'text-orange-11',
  bad: 'text-pink-11',
};

export function SwatchRow({
  label, base, derived, ground, onChange,
}: {
  label: string;
  base: string;
  derived: string;
  ground: string;
  onChange: (hex: string) => void;
}) {
  const ratio = contrast(derived, ground);
  return (
    <div className="grid grid-cols-[4.5rem_2.5rem_1.25rem_1fr_auto] items-center gap-2">
      <span className="font-mono text-12 text-gray-11">{label}</span>
      <input
        aria-label={label}
        type="color"
        value={base}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 rounded-md border-1 border-gray-6"
      />
      <span aria-hidden className="size-4 rounded-sm border-1 border-gray-6" style={{ background: derived }} />
      <span className="font-mono text-12 text-gray-12">{derived}</span>
      <span className={`font-mono text-11 ${TONE[verdict(ratio)]}`}>{ratio.toFixed(2)}:1</span>
    </div>
  );
}
```

`packages/web/icon-studio/src/controls/slider-row.tsx`:

```tsx
export function SliderRow({
  label, value, min, max, step = 1, format, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2">
      <span className="font-mono text-12 text-gray-11">{label}</span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-right font-mono text-11 tabular-nums text-gray-12">
        {format ? format(value) : value}
      </span>
    </div>
  );
}
```

`packages/web/icon-studio/src/controls/controls-panel.tsx`:

```tsx
import { Button } from '@tickets/ui';
import { GROUND } from '../color';
import { PRESETS, STICKS, type MarkConfig, type PresetName } from '../config';
import type { StudioAction, StudioState } from '../state';
import { SliderRow } from './slider-row';
import { SwatchRow } from './swatch-row';

const signed = (v: number) => (v === 0 ? '0' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`);

export function ControlsPanel({
  state, config, dispatch,
}: {
  state: StudioState;
  config: MarkConfig;
  dispatch: (action: StudioAction) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {(['light', 'dark'] as const).map((mode) => (
        <section key={mode} className="flex flex-col gap-2">
          <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">{mode} theme</h2>
          {STICKS.map((stick, i) => (
            <SwatchRow
              key={stick}
              label={`${mode} ${stick}`}
              base={state.base[mode][i]}
              derived={config[mode][i]}
              ground={GROUND[mode]}
              onChange={(hex) => dispatch({ type: 'setBase', mode, index: i, hex })}
            />
          ))}
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Chip field</h2>
        <SwatchRow
          label="chip field"
          base={state.chip}
          derived={config.chip}
          ground={config.dark[0]}
          onChange={(hex) => dispatch({ type: 'setChip', hex })}
        />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PRESETS) as PresetName[]).map((name) => (
            <Button key={name} variant="outline" size="sm" onClick={() => dispatch({ type: 'applyPreset', name })}>
              {name}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Vividness &amp; brightness</h2>
        {(['light', 'dark'] as const).map((mode) => (
          <div key={mode} className="flex flex-col gap-2">
            <SliderRow
              label={`${mode} vivid`} min={0.3} max={1.8} step={0.02}
              value={mode === 'light' ? state.adjLight.sat : state.adjDark.sat}
              format={(v) => v.toFixed(2)}
              onChange={(sat) => dispatch({ type: 'setAdjust', mode, patch: { sat } })}
            />
            <SliderRow
              label={`${mode} bright`} min={-0.2} max={0.2} step={0.01}
              value={mode === 'light' ? state.adjLight.lit : state.adjDark.lit}
              format={signed}
              onChange={(lit) => dispatch({ type: 'setAdjust', mode, patch: { lit } })}
            />
          </div>
        ))}
        <SliderRow
          label="hue shift" min={-90} max={90}
          value={state.adjLight.hue}
          format={(v) => `${v}°`}
          onChange={(hue) => {
            dispatch({ type: 'setAdjust', mode: 'light', patch: { hue } });
            dispatch({ type: 'setAdjust', mode: 'dark', patch: { hue } });
          }}
        />
        <div>
          <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'resetAdjust' })}>
            Reset adjustments
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Angles &amp; weight</h2>
        {STICKS.map((stick, i) => (
          <SliderRow
            key={stick}
            label={`${stick} angle`} min={0} max={180}
            value={state.angles[i]}
            format={(v) => `${v}°`}
            onChange={(degrees) => dispatch({ type: 'setAngle', index: i, degrees })}
          />
        ))}
        <SliderRow
          label="bare stroke" min={3} max={8} step={0.25} value={state.bareWeight}
          onChange={(value) => dispatch({ type: 'setNumber', key: 'bareWeight', value })}
        />
        <SliderRow
          label="chip reach" min={9} max={18} step={0.5} value={state.chipReach}
          onChange={(value) => dispatch({ type: 'setNumber', key: 'chipReach', value })}
        />
        <SliderRow
          label="chip stroke" min={2} max={8} step={0.1} value={state.chipWeight}
          onChange={(value) => dispatch({ type: 'setNumber', key: 'chipWeight', value })}
        />
        <div>
          <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'matchRatio' })}>
            Match the favicon ratio
          </Button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Write the output grid**

`packages/web/icon-studio/src/output/file-grid.tsx`:

```tsx
import type { MarkConfig } from '../config';
import { dataUri } from '../generate/raster';
import { safeZonePct, svgBare, svgChip, svgFavicon, svgMono } from '../generate/svg';

interface Row {
  file: string;
  use: string;
  svg: string;
  sizes: number[];
  ground: 'light' | 'dark' | 'checker';
}

function rows(c: MarkConfig): Row[] {
  return [
    { file: 'favicon.svg', use: 'Browser tab. Swaps triad by theme.', svg: svgFavicon(c), sizes: [16, 32, 48], ground: 'checker' },
    { file: 'icon-512.png', use: 'PWA install. Maskable chip.', svg: svgChip(c), sizes: [64, 128], ground: 'checker' },
    { file: 'icon-192.png', use: 'Android home screen. Maskable chip.', svg: svgChip(c), sizes: [48, 96], ground: 'checker' },
    { file: 'apple-touch-icon.png', use: 'iOS home screen. Square — iOS masks it.', svg: svgChip(c, { rounded: false }), sizes: [60, 120], ground: 'checker' },
    { file: 'icon-mono.svg', use: 'Safari pinned tab.', svg: svgMono(c), sizes: [16, 32], ground: 'light' },
    { file: 'site.webmanifest', use: 'Install metadata. Derived from the config.', svg: svgBare(c, 'dark'), sizes: [32], ground: 'dark' },
  ];
}

const BG: Record<Row['ground'], string> = {
  light: 'bg-white',
  dark: 'bg-gray-12',
  checker: 'bg-surface-inset',
};

export function FileGrid({ config }: { config: MarkConfig }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows(config).map((row) => (
        <div key={row.file} className="overflow-hidden rounded-xl border-1 border-gray-6 bg-gray-2">
          <div className="flex flex-col gap-0.5 px-3 pt-3">
            <span className="font-mono text-13 font-600 text-gray-12">{row.file}</span>
            <span className="text-12 text-gray-11">{row.use}</span>
          </div>
          <div className={`mt-3 flex flex-wrap items-end justify-center gap-5 p-4 ${BG[row.ground]}`}>
            {row.sizes.map((size) => (
              <figure key={size} className="m-0 flex flex-col items-center gap-1.5">
                <img src={dataUri(row.svg)} width={size} height={size} alt="" />
                <figcaption className="font-mono text-11 text-gray-11">{size}px</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
      <p className="font-mono text-12 text-gray-11 md:col-span-2">
        chip mark reaches {safeZonePct(config).toFixed(0)}% of the tile
        {safeZonePct(config) > 80 ? ' — outside the maskable safe circle' : ' — inside the maskable safe circle'}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Wire the screen**

`packages/web/icon-studio/src/studio.tsx` — replace entirely:

```tsx
import { useEffect, useMemo, useReducer, useState } from 'react';
import { Button } from '@tickets/ui';
import { fetchConfig, generate } from './api';
import { ControlsPanel } from './controls/controls-panel';
import { FileGrid } from './output/file-grid';
import type { GenerateResult } from './plugin/write';
import { INITIAL_STATE, studioReducer, toConfig } from './state';

export function Studio() {
  const [state, dispatch] = useReducer(studioReducer, INITIAL_STATE);
  const [results, setResults] = useState<GenerateResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = useMemo(() => toConfig(state), [state]);

  // Reopen on whatever is committed, so the studio reflects the shipped icons.
  useEffect(() => {
    fetchConfig()
      .then((loaded) => dispatch({ type: 'loadConfig', config: loaded }))
      .catch(() => setError('Could not read icons.config.json — showing defaults.'));
  }, []);

  async function onGenerate() {
    setBusy(true);
    setError(null);
    try {
      const response = await generate(config);
      setResults(response.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-1 font-sans text-gray-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-24 font-600 tracking-tight">Icon studio</h1>
          <p className="max-w-prose text-13 text-gray-11">
            Tune the mark, then write every favicon and install icon into apps/web. The config is
            the source of truth; the icons are generated from it.
          </p>
        </header>

        {error ? (
          <p role="status" className="rounded-lg border-1 border-pink-6 bg-pink-2 px-3 py-2 text-13 text-pink-11">
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <ControlsPanel state={state} config={config} dispatch={dispatch} />

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Button variant="solid" onClick={onGenerate} loading={busy}>
                Generate all icons
              </Button>
              {results ? (
                <span className="font-mono text-12 text-gray-11">
                  {results.filter((r) => r.status === 'written').length} written ·{' '}
                  {results.filter((r) => r.status === 'unchanged').length} unchanged ·{' '}
                  {results.filter((r) => r.status === 'rejected').length} rejected
                </span>
              ) : null}
            </div>

            {results ? (
              <ul className="flex flex-col gap-1 rounded-lg border-1 border-gray-6 bg-gray-2 p-3">
                {results.map((r) => (
                  <li key={r.path} className="font-mono text-12 text-gray-11">
                    <span className="text-gray-12">{r.status}</span> {r.path}
                    {r.reason ? ` — ${r.reason}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}

            <FileGrid config={config} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

`packages/web/icon-studio/src/index.ts`:

```ts
export { Studio } from './studio';
export { DEFAULT_CONFIG, PRESETS, type MarkConfig } from './config';
```

**Do not re-export `iconWriter` here.** `src/index.ts` is the browser entry —
`dev/main.tsx` imports it — and `icon-writer.ts` pulls in `node:fs/promises`
and `node:path`. `vite.config.ts` already imports the plugin directly from
`./src/plugin/icon-writer`, which is the only consumer it needs.

- [ ] **Step 6: Run the tests and typecheck**

```bash
pnpm --filter @tickets/icon-studio test
pnpm --filter @tickets/icon-studio typecheck
```

Expected: all tests PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/web/icon-studio/src
git commit -m "feat(icon-studio): controls panel, file grid and Generate button"
```

---

### Task 12: Generate the real icons and commit them

**Files:**
- Create: `apps/web/public/favicon.svg`, `icon-mono.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `site.webmanifest`
- Create: `apps/web/icons.config.json`
- Modify: `apps/web/index.html`

**Interfaces:**
- Consumes: the running studio.
- Produces: the committed icon set the web app serves.

- [ ] **Step 1: Run the studio and Generate**

```bash
pnpm --filter @tickets/icon-studio dev
```

Open `http://localhost:4660`, confirm the palette reads `#7167ff` / `#00bb9a` / `#ff298a` on light and angles 62/27/160, then click **Generate all icons**.

Expected: eight rows reported, none `rejected`.

- [ ] **Step 2: Verify what landed**

```bash
git status --short apps/web
ls -la apps/web/public
cat apps/web/icons.config.json
```

Expected: six files in `apps/web/public/`, `icons.config.json` matching the locked values, and `apps/web/index.html` modified.

- [ ] **Step 3: Verify the head block is bounded**

```bash
git diff apps/web/index.html
```

Expected: the diff adds only the marked block between `<!-- icons:start … -->` and `<!-- icons:end -->`; nothing else in the file changed.

- [ ] **Step 4: Verify Generate is idempotent**

Click **Generate all icons** a second time, then:

```bash
git status --short apps/web
```

Expected: the studio reports every row `unchanged`, and `git status` shows no new modifications beyond step 2's.

- [ ] **Step 5: Verify the build copies the icons**

```bash
pnpm --filter @tickets/web build
ls apps/web/dist | grep -E 'favicon|icon-|apple-touch|webmanifest'
```

Expected: all six assets present in `dist/`.

- [ ] **Step 6: Run the repo checks**

```bash
pnpm typecheck
pnpm --filter @tickets/web test
pnpm verify:tokens
```

Expected: all clean. `verify:tokens` scans only `apps/web/src` and `apps/eer/src`, so the studio's hex constants and `apps/web/icons.config.json` are out of its scope.

- [ ] **Step 7: Confirm the tab icon in a browser**

```bash
WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev
```

Open `http://localhost:4620`, confirm the tab shows the mark. Toggle your OS to dark mode and confirm the triad swaps. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add apps/web/public apps/web/icons.config.json apps/web/index.html
git commit -m "feat(web): generated favicon and install icons

Written by @tickets/icon-studio from apps/web/icons.config.json. The config is
the reviewable artefact; the six assets and the marked head block are its
output. Re-running Generate on an unchanged config is a no-op."
```

---

## Self-Review

**Spec coverage.** Package shape and port → Task 1. Config as source of truth → Tasks 2, 7, 12. Browser rasterisation → Task 9. Vite plugin routes → Task 8. Six security checks → dev-only and loopback in Task 8, allowlist and containment in Task 6, type/size in Task 6, atomic write in Task 7. What Generate writes → Task 7, exercised in Task 12. Marked idempotent head block → Task 5. The screen's five control groups → Task 11. Verification section → tests throughout plus Task 12's manual steps.

**Two deliberate deviations from the spec,** both narrowing the attack surface:
1. The spec's `assets` map is replaced by `pngs`. The plugin imports the same pure SVG functions, so `favicon.svg`, `icon-mono.svg`, `site.webmanifest` and `icons.config.json` are derived server-side. Only three PNG payloads cross the wire, and `decodeAsset` collapses to `decodePng`.
2. `index.html` is not an allowlist entry. The client never sends HTML; the plugin reads the file, injects the block it built itself, and writes it back.

**Not covered by automated tests,** and stated rather than hidden: `svgToPngBase64` needs a real canvas, which jsdom lacks. Task 12's steps 1–5 are its verification.

**Type consistency.** `MarkConfig` is defined once in Task 2 and imported everywhere. `GenerateResult`/`GenerateResponse` are defined in Task 7 and consumed by Tasks 9 and 11. `Adjust`/`NEUTRAL` come from Task 3 and are used in Task 10. `PNG_NAMES` (Task 6) and `RASTER_SIZES` (Task 9) both key on the same three filenames — Task 6's test pins the order and Task 9's test pins the sizes, so a divergence fails a test.

**Deferred, per the spec's out-of-scope:** sibling icons for eer and the gallery, the canvas-driven animated favicon in `apps/web`, and any CI regeneration step.
