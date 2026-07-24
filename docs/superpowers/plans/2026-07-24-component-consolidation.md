# Component Consolidation (Primitive Tier) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generated tone system + single icon registry in `@tickets/ui`, then nine generic primitives (Pill, Tabs, SegmentedControl, Meter, ScreenState, Spinner, CopyButton, DialogFooter/RailLabel/SectionHeader), replace every duplicated call site in `apps/web`, delete the old components, and retire the `kind-*` color family.

**Architecture:** The token JSON stays the single color source; `build-tokens.mjs` additionally generates `src/tones.generated.ts` (Tone union + literal Tailwind class map — literals because Tailwind cannot scan dynamic class names). A single `icons/registry.tsx` holds every glyph (colorless, shape-named, no baked animation); `IconName = keyof registry`. Primitives consume both. `@tickets/ui` stays 100% domain-free; `apps/web/src/domain/*` holds the app's own status→tone mappings, written once.

**Tech Stack:** React 19, Tailwind v4 (preflight ON), vitest + @testing-library/react, existing zero-dep token scripts. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-07-24-component-consolidation-design.md`. Visual reference: https://claude.ai/code/artifact/1d66b5ba-e9fb-475e-b38d-26650de9f187

## Global Constraints

- **CRITICAL WORKSPACE RULE:** work ONLY in the phase worktree (created from local HEAD; setup = `git worktree add … && pnpm install && pnpm build`). NEVER commit to the main checkout. NEVER run `git reset --hard`, `rm -rf` outside the worktree, or kill the user's dev server on :4620. Worktree web dev server uses port 4670.
- Conventional commits scoped by app: `feat(ui): …`, `refactor(web): …`, `fix(web): …` — one commit per task step group as marked.
- No new npm dependencies anywhere in this phase.
- `@tickets/ui` must stay domain-free: no ticket/session/signal vocabulary in the package. Domain maps live in `apps/web/src/domain/` only.
- Icons: colorless (`currentColor` only), shape-descriptive names, no baked-in animation, `size` is a px number (default 14).
- Tones: `subtle | solid | outline | text` emphases; default `'subtle'`. Semantic tones `primary secondary success warning danger neutral`; hues `red orange yellow green teal cyan blue indigo purple pink gray`.
- Generated files (`src/tokens.css`, `src/tones.generated.ts`) are committed; `tokens:verify` must stay green (build + `git diff --exit-code` + scanners).
- Gates after every task: `pnpm --filter @tickets/ui test`, `pnpm --filter @tickets/web test`, `pnpm typecheck` from repo root. Full battery (`pnpm build`, `pnpm --filter @tickets/ui tokens:verify`) at tasks 6 and 12.
- Every new primitive gets a `.demo.tsx` (meta + states + playground) in `packages/web/ui/src/` — the package demo glob picks it up automatically.

## File Structure

```
packages/web/ui/
├── scripts/build-tokens.mjs          MODIFY: also emit src/tones.generated.ts
├── src/tokens/tones.tokens.json      NEW: semantic tone aliases + hue list
├── src/tones.generated.ts            NEW (generated, committed)
├── src/tones.ts                      NEW: hand-written re-export + helpers
├── src/icons/registry.tsx            NEW: all glyphs
├── src/icons/icon.tsx                NEW: <Icon/>
├── src/pill.tsx                      NEW  (+ .test.tsx, .demo.tsx each)
├── src/tabs.tsx                      NEW
├── src/segmented-control.tsx         NEW
├── src/meter.tsx                     NEW
├── src/screen-state.tsx              NEW
├── src/spinner.tsx                   NEW
├── src/copy-button.tsx               NEW (+ useCopy)
├── src/dialog-footer.tsx             NEW
├── src/rail-label.tsx                NEW
├── src/section-header.tsx            NEW
└── package.json                      MODIFY: exports ./tones ./icon ./pill …

apps/web/src/
├── domain/status.ts                  NEW: statusPill(kind) — absorbs registry/option-color kindColor
├── domain/session-status.ts          NEW: sessionStatus(status, kind?)
├── domain/signal-status.ts           NEW: signalStatus(status) + signalKindIcon(kind)
└── (deletions: ui/status-badge*, ui/type-badge*, ui/option-chip*,
    ui/session-status-pill*, ui/kind-glyph*, components/signals/status-chip*,
    components/signals/kind-glyph*, components/rich-text/toolbar-icons.tsx)
```

---

### Task 1: Tone system — JSON, generator, `tones.generated.ts`

**Files:**
- Create: `packages/web/ui/src/tokens/tones.tokens.json`
- Modify: `packages/web/ui/scripts/build-tokens.mjs`
- Create: `packages/web/ui/src/tones.ts`
- Create (generated): `packages/web/ui/src/tones.generated.ts`
- Modify: `packages/web/ui/package.json` (exports + tokens:verify)
- Test: `packages/web/ui/src/tones.test.ts`

**Interfaces:**
- Consumes: `resolveTokenMaps()` from build-tokens.mjs (existing).
- Produces: `type Tone` (17 names), `type ToneEmphasis = 'subtle' | 'solid' | 'outline' | 'text'`, `const TONE_NAMES: readonly Tone[]`, `const HUE_TONES: readonly [...11 hue names]`, `type HueTone`, `toneClasses(tone: Tone, emphasis?: ToneEmphasis): string` — all exported from `@tickets/ui/tones`. Later tasks import `Tone`, `HueTone`, `toneClasses`.

- [ ] **Step 1: Write the tone-alias JSON**

`packages/web/ui/src/tokens/tones.tokens.json` — hues auto-derive `opt-<hue>` / `opt-<hue>-subtle` / `on-opt-<hue>`; semantic tones name their three token refs explicitly (all must exist in the resolved semantic maps):

```json
{
  "hues": ["red", "orange", "yellow", "green", "teal", "cyan", "blue", "indigo", "purple", "pink", "gray"],
  "semantic": {
    "primary":   { "base": "accent",     "subtle": "accent-subtle", "on": "on-accent" },
    "secondary": { "base": "ink-2",      "subtle": "inset",         "on": "app" },
    "success":   { "base": "opt-green",  "subtle": "opt-green-subtle",  "on": "on-opt-green" },
    "warning":   { "base": "opt-orange", "subtle": "opt-orange-subtle", "on": "on-opt-orange" },
    "danger":    { "base": "danger",     "subtle": "danger-subtle",  "on": "on-danger" },
    "neutral":   { "base": "ink-3",      "subtle": "inset",          "on": "app" }
  }
}
```

Note: `app` is used as the `on` color for ink-based solids (dark text on light ink in light theme resolves correctly in both themes because both flip together).

- [ ] **Step 2: Write the failing test**

`packages/web/ui/src/tones.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HUE_TONES, TONE_NAMES, toneClasses, TONES } from './tones';

const EMPHASES = ['subtle', 'solid', 'outline', 'text'] as const;

describe('tone system', () => {
  it('has 6 semantic + 11 hue tones, hues last', () => {
    expect(TONE_NAMES).toEqual([
      'primary', 'secondary', 'success', 'warning', 'danger', 'neutral',
      'red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'gray',
    ]);
    expect(HUE_TONES).toEqual([
      'red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'gray',
    ]);
  });

  it('resolves every tone x emphasis to non-empty literal classes', () => {
    for (const tone of TONE_NAMES) {
      for (const emphasis of EMPHASES) {
        const classes = toneClasses(tone, emphasis);
        expect(classes.length).toBeGreaterThan(0);
        expect(classes).not.toContain('${'); // literals only — Tailwind must be able to scan them
        expect(classes).not.toContain('undefined');
      }
    }
  });

  it('defaults to subtle emphasis', () => {
    expect(toneClasses('green')).toBe(toneClasses('green', 'subtle'));
  });

  it('maps hues onto the opt-* families', () => {
    expect(toneClasses('green', 'subtle')).toBe('bg-opt-green-subtle text-opt-green');
    expect(toneClasses('green', 'solid')).toBe('bg-opt-green text-on-opt-green');
    expect(toneClasses('green', 'outline')).toBe(
      'border-(length:--border-hair) border-opt-green text-opt-green',
    );
    expect(toneClasses('green', 'text')).toBe('text-opt-green');
  });

  it('maps semantic aliases onto their declared families', () => {
    expect(toneClasses('primary', 'subtle')).toBe('bg-accent-subtle text-accent');
    expect(toneClasses('primary', 'solid')).toBe('bg-accent text-on-accent');
    expect(toneClasses('secondary', 'subtle')).toBe('bg-inset text-ink-2');
    expect(toneClasses('secondary', 'solid')).toBe('bg-ink-2 text-app');
    expect(toneClasses('danger', 'solid')).toBe('bg-danger text-on-danger');
    expect(toneClasses('neutral', 'text')).toBe('text-ink-3');
  });

  it('every class in the map is one of the four known utility shapes', () => {
    const CLASS_RE =
      /^(bg-[a-z0-9-]+|text-[a-z0-9-]+|border-[a-z0-9-]+|border-\(length:--border-hair\))$/;
    for (const emphases of Object.values(TONES)) {
      for (const classes of Object.values(emphases)) {
        for (const cls of classes.split(' ')) {
          expect(cls).toMatch(CLASS_RE);
        }
      }
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui exec vitest run src/tones.test.ts`
Expected: FAIL — `Cannot find module './tones'`.

- [ ] **Step 4: Extend build-tokens.mjs**

Add to `packages/web/ui/scripts/build-tokens.mjs` (after `emitInstrumentCss`, before `MARKERS`):

```js
const tonesFile = path.join(__dirname, '..', 'src', 'tones.generated.ts');

// Emit src/tones.generated.ts from tones.tokens.json. Class strings are
// LITERALS on purpose: Tailwind's scanner cannot see dynamically-built class
// names, so the full utility text for every tone x emphasis must exist in a
// scanned source file. This file lives under src/, which `@source './'` in
// tokens.css already covers for every consumer.
export function emitTones({ light }) {
  const doc = readJson('tones.tokens.json');
  const entries = [];

  const families = {};
  for (const hue of doc.hues) {
    families[hue] = { base: `opt-${hue}`, subtle: `opt-${hue}-subtle`, on: `on-opt-${hue}` };
  }
  for (const [name, refs] of Object.entries(doc.semantic)) {
    families[name] = refs;
  }
  // Semantic tones first (declaration order), then hues — matches TONE_NAMES.
  const ordered = [...Object.keys(doc.semantic), ...doc.hues];

  for (const name of ordered) {
    const { base, subtle, on } = families[name];
    for (const ref of [base, subtle, on]) {
      if (!(ref in light)) {
        throw new Error(`tones.tokens.json: tone "${name}" references unknown token "${ref}"`);
      }
    }
    entries.push(
      `  '${name}': {\n` +
        `    subtle: 'bg-${subtle} text-${base}',\n` +
        `    solid: 'bg-${base} text-${on}',\n` +
        `    outline: 'border-(length:--border-hair) border-${base} text-${base}',\n` +
        `    text: 'text-${base}',\n` +
        `  },`,
    );
  }

  const names = ordered.map((n) => `'${n}'`).join(', ');
  const hueNames = doc.hues.map((n) => `'${n}'`).join(', ');
  return (
    `// GENERATED by scripts/build-tokens.mjs from src/tokens/tones.tokens.json — do not edit.\n` +
    `// Literal class strings so Tailwind can scan them; see build-tokens.mjs emitTones().\n` +
    `export const TONE_NAMES = [${names}] as const;\n` +
    `export type Tone = (typeof TONE_NAMES)[number];\n` +
    `export const HUE_TONES = [${hueNames}] as const;\n` +
    `export type HueTone = (typeof HUE_TONES)[number];\n` +
    `export type ToneEmphasis = 'subtle' | 'solid' | 'outline' | 'text';\n` +
    `export const TONES: Record<Tone, Record<ToneEmphasis, string>> = {\n` +
    entries.join('\n') +
    `\n};\n`
  );
}
```

And in `build()` (after the CSS splice loop, before the final log):

```js
  writeFileSync(tonesFile, emitTones({ light }), 'utf8');
  console.log(`Updated ${path.relative(process.cwd(), tonesFile)}`);
```

- [ ] **Step 5: Write the hand-authored entry `src/tones.ts`**

```ts
export {
  HUE_TONES,
  TONE_NAMES,
  TONES,
  type HueTone,
  type Tone,
  type ToneEmphasis,
} from './tones.generated';
import { TONES, type Tone, type ToneEmphasis } from './tones.generated';

// The one resolver every component uses. Never build tone classes by hand.
export function toneClasses(tone: Tone, emphasis: ToneEmphasis = 'subtle'): string {
  return TONES[tone][emphasis];
}
```

- [ ] **Step 6: Generate, run tests**

Run: `pnpm --filter @tickets/ui tokens:build` — expect both files logged. Then `pnpm --filter @tickets/ui exec vitest run src/tones.test.ts` — expect PASS.

- [ ] **Step 7: Wire package exports + verify**

In `packages/web/ui/package.json` add to `exports`: `"./tones": "./src/tones.ts"`. Extend the `tokens:verify` script to also diff the generated TS:

```
"tokens:verify": "node scripts/build-tokens.mjs && git diff --exit-code src/tokens.css src/tones.generated.ts && node scripts/scan-hardcoded-values.mjs && node scripts/check-design-tokens.mjs"
```

Run: `pnpm --filter @tickets/ui test` and `pnpm typecheck`. Expected: PASS (tokens.css unchanged by this task — kind-* still present until Task 6).

- [ ] **Step 8: Commit**

```bash
git add packages/web/ui/src/tokens/tones.tokens.json packages/web/ui/scripts/build-tokens.mjs packages/web/ui/src/tones.ts packages/web/ui/src/tones.generated.ts packages/web/ui/src/tones.test.ts packages/web/ui/package.json
git commit -m "feat(ui): generated tone system (Tone union + literal class map)"
```

---

### Task 2: Icon registry + `<Icon />`

**Files:**
- Create: `packages/web/ui/src/icons/registry.tsx`, `packages/web/ui/src/icons/icon.tsx`, `packages/web/ui/src/icons/icon.demo.tsx`
- Modify: `packages/web/ui/package.json` (export `./icon`)
- Test: `packages/web/ui/src/icons/icon.test.tsx`

**Interfaces:**
- Consumes: `toneClasses`, `type Tone` from `../tones`.
- Produces: `type IconName`, `ICON_NAMES: readonly IconName[]`, `Icon({ name, size?, tone?, animate?, label?, className? })` from `@tickets/ui/icon`. Later tasks use `IconName` for `icon` props and render `<Icon>`.

Registry rules (from spec): 16×16 viewBox default (24×24 allowed per entry where paths were authored that way), `currentColor` only, stroke-width 1.5, shape-descriptive names. Seeds: the five KindGlyph shapes (`circle`, `circle-half`, `diamond`, `circle-check`, `circle-dashed`), the session-dot shapes (`circle-dot`, `square`, `dot`, `circle-x`), `arc`, the rich-text toolbar's 11 lucide glyphs (24×24 paths copied verbatim from `apps/web/src/components/rich-text/toolbar-icons.tsx` under names `list, quote, link, plus, chevron-down, chevron-right, circle-info, minus, check, pencil, trash`), and the app-wide set below.

- [ ] **Step 1: Write the failing test**

`packages/web/ui/src/icons/icon.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './icon';
import { ICON_NAMES, registry } from './registry';

describe('Icon', () => {
  it('registry has the required core glyphs', () => {
    for (const name of [
      'circle', 'circle-half', 'circle-dot', 'circle-dashed', 'circle-check', 'circle-x',
      'circle-info', 'diamond', 'square', 'dot', 'arc', 'triangle-alert',
      'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right',
      'arrow-up', 'arrow-down', 'arrow-up-right',
      'plus', 'x', 'check', 'search', 'copy', 'pencil', 'trash', 'filter', 'refresh',
      'grip', 'ellipsis', 'eye', 'minus', 'list', 'quote', 'link',
      'columns', 'rows', 'folder', 'file', 'terminal', 'sliders', 'calendar', 'clock', 'tag', 'user',
    ]) {
      expect(ICON_NAMES, `missing glyph ${name}`).toContain(name);
    }
  });

  it('every glyph is colorless — no hardcoded colors in markup', () => {
    const { container } = render(
      <>{ICON_NAMES.map((name) => <Icon key={name} name={name} />)}</>,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(container.innerHTML).not.toMatch(/(?:fill|stroke)="(?!none|currentColor)[a-z]/);
  });

  it('sizes in px, default 14', () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('14');
    const { container: big } = render(<Icon name="check" size={20} />);
    expect(big.querySelector('svg')!.getAttribute('width')).toBe('20');
  });

  it('is aria-hidden without label, labelled img with one', () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    render(<Icon name="check" label="Done" />);
    expect(screen.getByRole('img', { name: 'Done' })).toBeTruthy();
  });

  it('tone applies the text emphasis class; unset inherits currentColor', () => {
    const { container } = render(<Icon name="check" tone="green" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('text-opt-green');
    const { container: bare } = render(<Icon name="check" />);
    expect(bare.querySelector('svg')!.getAttribute('class') ?? '').not.toContain('text-');
  });

  it('animate is opt-in only', () => {
    const { container } = render(<Icon name="circle-half" animate="spin" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('animate-ai-spin');
    const { container: still } = render(<Icon name="circle-half" />);
    expect(still.querySelector('svg')!.getAttribute('class') ?? '').not.toContain('animate');
  });

  it('registry entries carry their own viewBox', () => {
    expect(registry['circle'].viewBox).toBe('0 0 16 16');
    expect(registry['list'].viewBox).toBe('0 0 24 24');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui exec vitest run src/icons/icon.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the registry**

`packages/web/ui/src/icons/registry.tsx`. Every entry `{ viewBox, node }`; nodes use only `currentColor`. The 16×16 set (strokes 1.5, fill none unless noted) — use these exact drawings (they match the approved preview artifact):

```tsx
import type { ReactNode } from 'react';

type Glyph = { viewBox: string; node: ReactNode };

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const;

// prettier-ignore
export const registry = {
  // ── shapes ──
  'circle':         { viewBox: '0 0 16 16', node: <circle cx="8" cy="8" r="5.5" {...s} /> },
  'circle-half':    { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="5.5" {...s} /><path d="M8 2.5a5.5 5.5 0 0 0 0 11Z" fill="currentColor" /></> },
  'circle-dot':     { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="5.5" {...s} /><circle cx="8" cy="8" r="2" fill="currentColor" /></> },
  'circle-dashed':  { viewBox: '0 0 16 16', node: <circle cx="8" cy="8" r="5.5" {...s} strokeDasharray="3 2.4" /> },
  'circle-check':   { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="5.5" {...s} /><path d="m5.4 8.2 1.8 1.8 3.4-3.8" {...s} /></> },
  'circle-x':       { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="5.5" {...s} /><path d="m6 6 4 4M10 6l-4 4" {...s} /></> },
  'circle-info':    { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="6" {...s} /><path d="M8 7.5v3.5M8 5v.01" {...s} /></> },
  'diamond':        { viewBox: '0 0 16 16', node: <path d="M8 1.8 14.2 8 8 14.2 1.8 8Z" fill="currentColor" /> },
  'square':         { viewBox: '0 0 16 16', node: <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" {...s} /> },
  'dot':            { viewBox: '0 0 16 16', node: <circle cx="8" cy="8" r="3.5" fill="currentColor" /> },
  'arc':            { viewBox: '0 0 16 16', node: <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" {...s} /> },
  'triangle-alert': { viewBox: '0 0 16 16', node: <><path d="M8 2.2 14.8 13.6H1.2Z" {...s} strokeLinejoin="round" /><path d="M8 7v3M8 11.6v.01" {...s} /></> },
  // ── chevrons & arrows ──
  'chevron-up':     { viewBox: '0 0 16 16', node: <path d="m4 10 4-4 4 4" {...s} /> },
  'chevron-down':   { viewBox: '0 0 16 16', node: <path d="m4 6 4 4 4-4" {...s} /> },
  'chevron-left':   { viewBox: '0 0 16 16', node: <path d="m10 4-4 4 4 4" {...s} /> },
  'chevron-right':  { viewBox: '0 0 16 16', node: <path d="m6 4 4 4-4 4" {...s} /> },
  'arrow-up':       { viewBox: '0 0 16 16', node: <path d="M8 13V3M4 7l4-4 4 4" {...s} /> },
  'arrow-down':     { viewBox: '0 0 16 16', node: <path d="M8 3v10M4 9l4 4 4-4" {...s} /> },
  'arrow-up-right': { viewBox: '0 0 16 16', node: <path d="M4.5 11.5 11.5 4.5M5.8 4.5h5.7v5.7" {...s} /> },
  // ── actions ──
  'plus':           { viewBox: '0 0 16 16', node: <path d="M8 3v10M3 8h10" {...s} /> },
  'x':              { viewBox: '0 0 16 16', node: <path d="m4 4 8 8M12 4l-8 8" {...s} /> },
  'check':          { viewBox: '0 0 16 16', node: <path d="m3 8.5 3.5 3.5L13 5" {...s} strokeWidth={1.8} /> },
  'minus':          { viewBox: '0 0 16 16', node: <path d="M3 8h10" {...s} /> },
  'search':         { viewBox: '0 0 16 16', node: <><circle cx="7" cy="7" r="4.5" {...s} /><path d="m10.5 10.5 3.5 3.5" {...s} /></> },
  'copy':           { viewBox: '0 0 16 16', node: <><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" {...s} /><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" {...s} /></> },
  'pencil':         { viewBox: '0 0 16 16', node: <path d="M11.2 2.6a1.6 1.6 0 0 1 2.2 2.2L6 12.2 2.8 13.2l1-3.2Z" {...s} strokeLinejoin="round" /> },
  'trash':          { viewBox: '0 0 16 16', node: <path d="M3 4.5h10M6.3 4.5V3h3.4v1.5M4.5 4.5l.6 9h5.8l.6-9" {...s} /> },
  'filter':         { viewBox: '0 0 16 16', node: <path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" {...s} /> },
  'refresh':        { viewBox: '0 0 16 16', node: <><path d="M13.5 8A5.5 5.5 0 1 1 11.8 4" {...s} /><path d="M13.5 2.5v2.8h-2.8" {...s} /></> },
  'grip':           { viewBox: '0 0 16 16', node: <>{[4, 8, 12].map((y) => [6, 10].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />))}</> },
  'ellipsis':       { viewBox: '0 0 16 16', node: <>{[3.5, 8, 12.5].map((x) => <circle key={x} cx={x} cy="8" r="1.2" fill="currentColor" />)}</> },
  'eye':            { viewBox: '0 0 16 16', node: <><path d="M1.5 8S4 3.8 8 3.8 14.5 8 14.5 8 12 12.2 8 12.2 1.5 8 1.5 8Z" {...s} /><circle cx="8" cy="8" r="2" {...s} /></> },
  // ── objects ──
  'columns':        { viewBox: '0 0 16 16', node: <><rect x="1.5" y="2" width="4" height="12" rx="1" {...s} /><rect x="6.5" y="2" width="4" height="8" rx="1" {...s} /><rect x="11.5" y="2" width="4" height="10" rx="1" {...s} /></> },
  'rows':           { viewBox: '0 0 16 16', node: <path d="M1.5 4h13M1.5 8h13M1.5 12h13" {...s} /> },
  'folder':         { viewBox: '0 0 16 16', node: <path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 2H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" {...s} /> },
  'file':           { viewBox: '0 0 16 16', node: <><path d="M4 2h5l3.5 3.5V14H4Z" {...s} /><path d="M9 2v3.5h3.5" {...s} /></> },
  'terminal':       { viewBox: '0 0 16 16', node: <><rect x="1.5" y="3" width="13" height="10" rx="1.5" {...s} /><path d="m4.5 6.5 2 2-2 2M9 10.5h2.5" {...s} /></> },
  'sliders':        { viewBox: '0 0 16 16', node: <><path d="M3 5h6M12 5h1M3 11h1M7 11h6" {...s} /><circle cx="10" cy="5" r="1.6" {...s} /><circle cx="5" cy="11" r="1.6" {...s} /></> },
  'calendar':       { viewBox: '0 0 16 16', node: <><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" {...s} /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" {...s} /></> },
  'clock':          { viewBox: '0 0 16 16', node: <><circle cx="8" cy="8" r="5.5" {...s} /><path d="M8 5v3.2l2.2 1.3" {...s} /></> },
  'tag':            { viewBox: '0 0 16 16', node: <><path d="M2.5 2.5h5.2L14 8.8 8.8 14 2.5 7.7Z" {...s} strokeLinejoin="round" /><circle cx="5.3" cy="5.3" r="1" fill="currentColor" /></> },
  'user':           { viewBox: '0 0 16 16', node: <><circle cx="8" cy="5.5" r="2.5" {...s} /><path d="M3.2 13.5a4.9 4.9 0 0 1 9.6 0" {...s} /></> },
  // ── rich-text set (24x24 lucide paths, copied VERBATIM from
  //     apps/web/src/components/rich-text/toolbar-icons.tsx during implementation;
  //     stroke-width 2 as authored there) ──
  'list':  { viewBox: '0 0 24 24', node: null /* paste from toolbar-icons IconList */ },
  'quote': { viewBox: '0 0 24 24', node: null /* IconQuote */ },
  'link':  { viewBox: '0 0 24 24', node: null /* IconLink2 */ },
} as const satisfies Record<string, Glyph>;

export type IconName = keyof typeof registry;
export const ICON_NAMES = Object.keys(registry) as IconName[];
```

**Implementation note (not a placeholder in the final code):** the three `node: null` entries above MUST be filled by copying the exact `<path>`/`<line>` children out of `toolbar-icons.tsx` (`IconList`, `IconQuote`, `IconLink2`) — the plan cannot paste them because they are hand-copied lucide path data; open that file and transplant. The remaining 8 toolbar icons (`IconPlus, IconChevronDown, IconChevronRight, IconInfo, IconMinus, IconCheck, IconPencil, IconTrash2`) are ALREADY covered by the 16×16 `plus/chevron-down/chevron-right/circle-info/minus/check/pencil/trash` entries — do NOT duplicate them; their call sites migrate to those names in Task 12's sweep of rich-text toolbar imports.

- [ ] **Step 4: Write `<Icon />`**

`packages/web/ui/src/icons/icon.tsx`:

```tsx
import { cn } from '../cn';
import { toneClasses, type Tone } from '../tones';
import { registry, type IconName } from './registry';

export function Icon({
  name,
  size = 14,
  tone,
  animate,
  label,
  className,
}: {
  name: IconName;
  size?: number;
  tone?: Tone;
  animate?: 'spin' | 'pulse';
  label?: string;
  className?: string;
}) {
  const glyph = registry[name];
  return (
    <svg
      viewBox={glyph.viewBox}
      width={size}
      height={size}
      className={cn(
        'shrink-0',
        tone ? toneClasses(tone, 'text') : undefined,
        animate === 'spin' && 'animate-ai-spin',
        animate === 'pulse' && 'animate-ai-pulse',
        className,
      )}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {glyph.node}
    </svg>
  );
}
export type { IconName };
```

- [ ] **Step 5: Run tests, wire export**

Run: `pnpm --filter @tickets/ui exec vitest run src/icons/icon.test.tsx` — PASS. Add `"./icon": "./src/icons/icon.tsx"` to package exports.

- [ ] **Step 6: Demo + playground**

`packages/web/ui/src/icons/icon.demo.tsx` (follows the existing demo contract — same shape as `swatches.demo.tsx` / other demos):

```tsx
import { definePlayground, select, number } from '../gallery';
import { Icon } from './icon';
import { ICON_NAMES } from './registry';
import { TONE_NAMES } from '../tones';

export const meta = { title: 'Icon', group: 'Foundation', order: 2 };

export const states = [
  {
    name: 'Registry',
    render: () => (
      <div className="flex flex-wrap gap-4">
        {ICON_NAMES.map((name) => (
          <div key={name} className="flex w-20 flex-col items-center gap-1.5 text-ink-2">
            <Icon name={name} size={16} />
            <span className="font-mono text-[10px] text-ink-3">{name}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    name: 'Composed',
    render: () => (
      <div className="flex items-center gap-4">
        <Icon name="circle-half" tone="blue" animate="spin" />
        <Icon name="diamond" tone="orange" animate="pulse" />
        <Icon name="circle-check" tone="green" />
        <Icon name="triangle-alert" tone="warning" size={20} />
      </div>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    name: select(ICON_NAMES, { initial: 'circle-half' }),
    size: number({ initial: 14, min: 10, max: 32 }),
    tone: select(TONE_NAMES, { allowNone: true }),
    animate: select(['spin', 'pulse'] as const, { allowNone: true }),
  },
  render: (v) => <Icon name={v.name} size={v.size} tone={v.tone} animate={v.animate} />,
});
```

(Adjust the control constructor signatures to match `src/gallery/controls.ts` exactly — read it first; `select` options may be an array or options-object form.)

- [ ] **Step 7: Gates + commit**

Run: `pnpm --filter @tickets/ui test && pnpm typecheck`. Then:

```bash
git add packages/web/ui/src/icons packages/web/ui/package.json
git commit -m "feat(ui): icon registry + Icon component (colorless, shape-named, px-sized)"
```

---

### Task 3: Pill

**Files:**
- Create: `packages/web/ui/src/pill.tsx`, `packages/web/ui/src/pill.demo.tsx`
- Modify: `packages/web/ui/package.json` (export `./pill`)
- Test: `packages/web/ui/src/pill.test.tsx`

**Interfaces:**
- Consumes: `toneClasses`, `Tone` from `./tones`; `Icon`, `IconName` from `./icons/icon`.
- Produces: `Pill(props)` — exact props: `label: ReactNode` (required), `tone?: Tone = 'neutral'`, `emphasis?: ToneEmphasis = 'subtle'`, `icon?: IconName | ReactElement`, `shape?: 'md' | 'full' = 'md'`, `trailing?: ReactNode`, `strikethrough?: boolean`, `onClick?: () => void`, `pressed?: boolean`, `className?: string`. Renders `<span>` normally; a real `<button type="button" aria-pressed={pressed}>` when `onClick` is set.

- [ ] **Step 1: Write the failing test**

`packages/web/ui/src/pill.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Icon } from './icons/icon';
import { Pill } from './pill';

describe('Pill', () => {
  it('renders the shared shell with neutral subtle defaults', () => {
    render(<Pill label="Chore" />);
    const el = screen.getByText('Chore');
    const pill = el.closest('span')!;
    for (const cls of ['inline-flex', 'h-5.5', 'items-center', 'gap-1.5', 'rounded-md', 'px-2.25', 'text-meta', 'font-medium']) {
      expect(pill.className).toContain(cls);
    }
    expect(pill.className).toContain('bg-inset');
    expect(pill.className).toContain('text-ink-3');
  });

  it('tone + emphasis resolve through the tone map', () => {
    render(<Pill label="Done" tone="green" />);
    expect(screen.getByText('Done').closest('span')!.className).toContain('bg-opt-green-subtle');
    render(<Pill label="Hot" tone="orange" emphasis="solid" />);
    expect(screen.getByText('Hot').closest('span')!.className).toContain('bg-opt-orange');
  });

  it('icon accepts a name or an element', () => {
    const { container } = render(<Pill label="A" icon="circle" />);
    expect(container.querySelector('svg')).toBeTruthy();
    const { container: el } = render(
      <Pill label="B" icon={<Icon name="circle-half" animate="spin" />} />,
    );
    expect(el.querySelector('svg')!.getAttribute('class')).toContain('animate-ai-spin');
  });

  it('shape full, strikethrough, trailing', () => {
    render(<Pill label="tag" shape="full" trailing={<span>3</span>} strikethrough />);
    const pill = screen.getByText('tag').closest('span')!;
    expect(pill.className).toContain('rounded-full');
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('tag').className).toContain('line-through');
  });

  it('onClick renders a real toggle button', () => {
    const onClick = vi.fn();
    render(<Pill label="Bug" onClick={onClick} pressed />);
    const btn = screen.getByRole('button', { name: 'Bug' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('static pill is not a button', () => {
    render(<Pill label="static" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `pnpm --filter @tickets/ui exec vitest run src/pill.test.tsx`.

- [ ] **Step 3: Implement**

`packages/web/ui/src/pill.tsx`:

```tsx
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './icons/icon';
import { toneClasses, type Tone, type ToneEmphasis } from './tones';

export function Pill({
  label,
  tone = 'neutral',
  emphasis = 'subtle',
  icon,
  shape = 'md',
  trailing,
  strikethrough,
  onClick,
  pressed,
  className,
}: {
  label: ReactNode;
  tone?: Tone;
  emphasis?: ToneEmphasis;
  icon?: IconName | ReactElement;
  shape?: 'md' | 'full';
  trailing?: ReactNode;
  strikethrough?: boolean;
  onClick?: () => void;
  pressed?: boolean;
  className?: string;
}) {
  const classes = cn(
    'inline-flex h-5.5 items-center gap-1.5 px-2.25 font-sans text-meta font-medium',
    shape === 'full' ? 'rounded-full' : 'rounded-md',
    toneClasses(tone, emphasis),
    className,
  );
  const body = (
    <>
      {isValidElement(icon) ? icon : icon ? <Icon name={icon} size={10} /> : null}
      {strikethrough ? <span className="line-through">{label}</span> : label}
      {trailing}
    </>
  );
  if (onClick) {
    return (
      <button type="button" aria-pressed={pressed} onClick={onClick} className={classes}>
        {body}
      </button>
    );
  }
  return <span className={classes}>{body}</span>;
}
```

- [ ] **Step 4: Run to verify PASS**, add `"./pill": "./src/pill.tsx"` export.

- [ ] **Step 5: Demo + playground** — `packages/web/ui/src/pill.demo.tsx`: `meta = { title: 'Pill', group: 'Display' }`; states `Tones` (one pill per hue), `Emphases` (green × 4 emphases), `With icons` (circle/circle-half spin/diamond/circle-check pills), `Toggle` (pressed/unpressed buttons), `Trailing + strikethrough`; playground with controls `label: text`, `tone: select(TONE_NAMES)`, `emphasis: select(['subtle','solid','outline','text'])`, `icon: select(ICON_NAMES, { allowNone: true })`, `shape: select(['md','full'])`, `strikethrough: boolean`.

- [ ] **Step 6: Gates + commit**

```bash
git add packages/web/ui/src/pill.tsx packages/web/ui/src/pill.test.tsx packages/web/ui/src/pill.demo.tsx packages/web/ui/package.json
git commit -m "feat(ui): Pill primitive (tone/emphasis/icon/shape/toggle)"
```

---

### Task 4: Pill migration A — ticket domain (StatusBadge, TypeBadge, OptionChip die)

**Files:**
- Create: `apps/web/src/domain/status.ts` + `apps/web/src/domain/status.test.ts`
- Modify: `apps/web/src/registry/option-color.ts` (re-point `OptionColor` at `HueTone`)
- Modify (call sites — full list in Step 3): `registry/get-cell-content.tsx`, `ui/status-select.tsx`, `components/settings/workflow-tab.tsx`, `components/settings/fields-tab.tsx`, `components/new-item-dialog.tsx`, `components/kanban-view.tsx`, `components/item-detail.tsx`, `components/board/table-view.tsx`, `components/all-items/all-items-screen.tsx`, `components/board/filter-chips.tsx`, `components/all-items/global-filter-chips.tsx`, `ui/combobox.tsx`, `ui/combobox-list.tsx`, `ui/multi-combobox.tsx`, `components/all-items/shared-fields.ts`
- Delete: `apps/web/src/ui/status-badge.{tsx,demo.tsx,test.tsx}`, `apps/web/src/ui/type-badge.{tsx,demo.tsx}`, `apps/web/src/ui/option-chip.{tsx,demo.tsx}`
- Modify: `apps/web/src/ui/demo-coverage.test.ts` (drop deleted names if listed)

**Interfaces:**
- Consumes: `Pill` from `@tickets/ui/pill`; `HueTone`, `Tone` from `@tickets/ui/tones`; `IconName` from `@tickets/ui/icon`; existing `kindColor` logic.
- Produces: `statusPill(kind: StatusKind): { tone: HueTone; icon: IconName; strikethrough?: true }` and `KIND_ICON: Record<StatusKind, IconName>` from `apps/web/src/domain/status.ts`. `OptionColor` becomes `HueTone` (re-exported alias from `registry/option-color.ts`).

- [ ] **Step 1: Write the failing domain test**

`apps/web/src/domain/status.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { statusPill } from './status';

describe('statusPill', () => {
  it('maps each kind to tone + shape-named icon', () => {
    expect(statusPill('todo')).toEqual({ tone: 'gray', icon: 'circle' });
    expect(statusPill('active')).toEqual({ tone: 'blue', icon: 'circle-half' });
    expect(statusPill('blocked')).toEqual({ tone: 'orange', icon: 'diamond' });
    expect(statusPill('done')).toEqual({ tone: 'green', icon: 'circle-check' });
    expect(statusPill('dropped')).toEqual({ tone: 'gray', icon: 'circle-dashed', strikethrough: true });
  });
});
```

- [ ] **Step 2: Run to verify FAIL**, then implement `apps/web/src/domain/status.ts`:

```ts
import type { IconName } from '@tickets/ui/icon';
import type { HueTone } from '@tickets/ui/tones';
import type { StatusKind } from '../api/types';

// The app's ONE ticket-status mapping. Nothing else in apps/web may decide
// what color/icon a status kind gets — spread this into <Pill>/<Icon>.
export const KIND_ICON: Record<StatusKind, IconName> = {
  todo: 'circle',
  active: 'circle-half',
  blocked: 'diamond',
  done: 'circle-check',
  dropped: 'circle-dashed',
};

const KIND_TONE: Record<StatusKind, HueTone> = {
  todo: 'gray',
  active: 'blue',
  blocked: 'orange',
  done: 'green',
  dropped: 'gray',
};

export function statusPill(kind: StatusKind): {
  tone: HueTone;
  icon: IconName;
  strikethrough?: true;
} {
  return kind === 'dropped'
    ? { tone: KIND_TONE[kind], icon: KIND_ICON[kind], strikethrough: true }
    : { tone: KIND_TONE[kind], icon: KIND_ICON[kind] };
}
```

Also in `apps/web/src/registry/option-color.ts`: replace `import type { OptionColor } from '../ui/option-chip';` with `import type { HueTone } from '@tickets/ui/tones';` + `export type OptionColor = HueTone;` (keeps `hexToOptionColor`/`kindColor` compiling; `kindColor`'s switch stays — it now returns `HueTone`).

- [ ] **Step 3: Migrate call sites**

Replacement recipes (apply per file; `label` is whatever the old component received):

| Old | New |
|---|---|
| `<StatusBadge kind={k} label={l} />` | `<Pill {...statusPill(k)} label={l} />` |
| `<StatusBadge kind={k} label={l} className={c} />` | `<Pill {...statusPill(k)} label={l} className={c} />` |
| `<TypeBadge label={l} />` (outline neutral) | `<Pill tone="neutral" emphasis="outline" label={l} />` |
| `<OptionChip color={c} label={l} />` | `<Pill tone={c} shape="full" label={l} />` |
| `<KindGlyph kind={k} />` (in these files only where adjacent to badges) | `<Icon name={KIND_ICON[k]} />` (tone from surrounding text, or `tone={statusPill(k).tone}` where it was colored) |

Files (from the verified inventory — every one must be touched; imports of the deleted modules must reach zero):
`registry/get-cell-content.tsx` (StatusBadge :44, OptionChip :42,:52) · `ui/status-select.tsx` (:75 + its KindGlyph import) · `components/settings/workflow-tab.tsx` (:437,:525,:533 badges; :58 entry pill → `<Pill tone="green" emphasis="outline" shape="full" label="entry" className="font-mono" />`) · `components/settings/fields-tab.tsx` (TypeBadge) · `components/new-item-dialog.tsx` (TypeBadge; `OptionColor` type import → from `../registry/option-color`) · `components/kanban-view.tsx` (TypeBadge, OptionChip :232) · `components/item-detail.tsx` (TypeBadge) · `components/board/table-view.tsx` (TypeBadge) · `components/all-items/all-items-screen.tsx` (TypeBadge) · `components/board/filter-chips.tsx` (OptionChip :58,:69,:81) · `components/all-items/global-filter-chips.tsx` (:56,:66) · `ui/combobox.tsx` (:48) · `ui/combobox-list.tsx` (:154) · `ui/multi-combobox.tsx` (:58) · `components/all-items/shared-fields.ts` (`OptionColor` type import).

- [ ] **Step 4: Delete old components + demos/tests**

```bash
git rm apps/web/src/ui/status-badge.tsx apps/web/src/ui/status-badge.demo.tsx apps/web/src/ui/status-badge.test.tsx \
       apps/web/src/ui/type-badge.tsx apps/web/src/ui/type-badge.demo.tsx \
       apps/web/src/ui/option-chip.tsx apps/web/src/ui/option-chip.demo.tsx
```

Update `apps/web/src/ui/demo-coverage.test.ts` if it enumerates these names. Update `ui/status-select.tsx`'s own rendering to Pill (it displayed the current StatusBadge).

- [ ] **Step 5: Verify zero stragglers**

Run (expect NO matches): `grep -rn "status-badge\|type-badge\|option-chip\|StatusBadge\|TypeBadge\|OptionChip" apps/web/src --include="*.ts*" | grep -v option-color` — the only allowed hits are the `OptionColor` type re-export in `registry/option-color.ts` and comments (update comments that reference deleted files).

- [ ] **Step 6: Gates + commit**

Run: `pnpm --filter @tickets/web test && pnpm typecheck`. Kanban/table/filter tests will need class assertions updated from `bg-kind-*`/OptionChip markup to Pill markup — rewrite assertions, never delete tests.

```bash
git add -A apps/web/src
git commit -m "refactor(web): replace StatusBadge/TypeBadge/OptionChip with Pill + domain/status"
```

---

### Task 5: Pill migration B — sessions, signals, ad-hoc chips

**Files:**
- Create: `apps/web/src/domain/session-status.ts` + `.test.ts`, `apps/web/src/domain/signal-status.ts` + `.test.ts`
- Modify: `components/terminal/terminal-session-screen.tsx`, `components/terminal/session-list.tsx`, `components/agent/ticket-dispatch.tsx`, `components/agent/session-list.tsx`, `components/agent/agent-session-screen.tsx`, `components/agent/agent-profile-screen.tsx`, `components/signals/issue-detail-screen.tsx`, `components/signals/issue-row.tsx`, `components/signals/breadcrumb-list.tsx` (HttpStatusChip), `components/rich-text/suggestions.tsx` (statusDotClass → domain), ad-hoc chip sites from the inventory (board-header prefix chip, item-detail KeyChip/archived, new-item-dialog chips, detail-links direction chip, links-tab value chip + toggle pill, workflow-tab/types-tab/fields-tab toggle pills, message-stream tool chip + model badge, session-screen idle/crashed chips, context-rail value chip, apps-screen/app-detail slugs)
- Delete: `apps/web/src/ui/session-status-pill.{tsx,demo.tsx,test.tsx}`, `apps/web/src/components/signals/status-chip.{tsx,test.tsx}`

**Interfaces:**
- Consumes: `Pill`, `Icon`, `Tone`, `IconName`.
- Produces: `sessionStatus(status: SessionStatus, kind?: SessionKind): { tone: Tone; emphasis?: 'solid'; icon: ReactElement; label: string; className?: string }` (the `SessionStatus` union — 9 values — moves here from the deleted pill); `signalStatus(status: SignalStatus): { tone: Tone; icon: ReactElement; label: string }` with `SignalStatus = 'open' | 'resolved' | 'ignored'`.

- [ ] **Step 1: Write failing tests** — `domain/session-status.test.ts`:

```tsx
import { describe, expect, it } from 'vitest';
import { sessionStatus } from './session-status';

describe('sessionStatus', () => {
  it('running spins blue', () => {
    const s = sessionStatus('running');
    expect(s.tone).toBe('blue');
    expect(s.label).toBe('running');
  });
  it('awaiting_input is solid orange pulse', () => {
    const s = sessionStatus('awaiting_input');
    expect(s.tone).toBe('orange');
    expect(s.emphasis).toBe('solid');
    expect(s.className).toContain('animate-ai-pulse');
    expect(s.label).toBe('awaiting input');
  });
  it('terminal kind overrides labels', () => {
    expect(sessionStatus('starting', 'terminal').label).toBe('Connecting');
    expect(sessionStatus('failed', 'terminal').label).toBe("Couldn't start");
    expect(sessionStatus('live', 'terminal').label).toBe('Live');
  });
  it('exited is neutral square, failed is danger x, idle green ring', () => {
    expect(sessionStatus('exited').tone).toBe('secondary');
    expect(sessionStatus('failed').tone).toBe('danger');
    expect(sessionStatus('idle').tone).toBe('green');
  });
});
```

- [ ] **Step 2: Implement the two domain modules.** `session-status.ts` — port the deleted pill's `PILL` + `TERMINAL_LABELS` tables and dot switch into data (kind-token classes become tones; dots become Icons):

```tsx
import type { ReactElement } from 'react';
import { Icon } from '@tickets/ui/icon';
import type { Tone } from '@tickets/ui/tones';
import type { SessionKind } from '../ui/session-kind-glyph';

export type SessionStatus =
  | 'starting' | 'running' | 'idle' | 'awaiting_input' | 'interrupted'
  | 'exited' | 'failed' | 'live' | 'disconnected';

type Entry = { tone: Tone; emphasis?: 'solid'; icon: ReactElement; label: string; className?: string };

const MAP: Record<SessionStatus, Entry> = {
  starting: { tone: 'gray', icon: <Icon name="circle-half" size={10} animate="spin" />, label: 'starting' },
  running: { tone: 'blue', icon: <Icon name="circle-half" size={10} animate="spin" />, label: 'running' },
  idle: { tone: 'green', icon: <Icon name="circle-dot" size={10} />, label: 'idle' },
  awaiting_input: {
    tone: 'orange', emphasis: 'solid', className: 'font-semibold animate-ai-pulse',
    icon: <Icon name="diamond" size={8} />, label: 'awaiting input',
  },
  interrupted: { tone: 'gray', icon: <Icon name="circle-dashed" size={10} />, label: 'interrupted' },
  exited: { tone: 'secondary', icon: <Icon name="square" size={9} />, label: 'exited' },
  failed: { tone: 'danger', icon: <Icon name="circle-x" size={10} />, label: 'failed' },
  live: { tone: 'blue', icon: <Icon name="dot" size={9} />, label: 'Live' },
  disconnected: { tone: 'gray', icon: <Icon name="circle" size={10} className="opacity-70" />, label: 'Disconnected' },
};

const TERMINAL_LABELS: Partial<Record<SessionStatus, string>> = {
  starting: 'Connecting', live: 'Live', failed: "Couldn't start",
};

export function sessionStatus(status: SessionStatus, kind?: SessionKind): Entry {
  const entry = MAP[status];
  const label = (kind === 'terminal' && TERMINAL_LABELS[status]) || entry.label;
  return { ...entry, label };
}
```

`signal-status.ts` analogous: `open → { tone: 'blue', icon: <Icon name="circle-half" size={10}/>, label: 'Open' }`, `resolved → { tone: 'green', icon: <Icon name="circle-check" size={10}/>, label: 'Resolved' }`, `ignored → { tone: 'gray', icon: <Icon name="circle-dashed" size={10}/>, label: 'Ignored' }` (port exact labels from the deleted `STATUS` map), plus `regressedPill = { tone: 'orange' as const, label: '↺ regressed' }`.

- [ ] **Step 3: Migrate + delete.** Every `<SessionStatusPill status={s} kind={k} exitCode={c} …/>` becomes:

```tsx
const st = sessionStatus(s, k);
<Pill tone={st.tone} emphasis={st.emphasis} icon={st.icon} label={st.label}
      className={st.className}
      trailing={s === 'exited' && c != null
        ? <span className={cn('font-mono', c === 0 ? 'text-opt-green' : 'text-danger')}>{c}</span>
        : undefined} />
```

(6 session files). Signals: `<StatusChip status={s} regressed={r} />` → `<Pill {...pick} label={label} />` + conditional regressed `<Pill tone="orange" label="↺ regressed" />` (2 files). `HttpStatusChip` in breadcrumb-list → `<Pill tone={code < 400 ? 'green' : 'danger'} label={code} className="font-mono" />`. Ad-hoc chip sites: keep the ones that are genuinely mono metadata (`KeyChip`/prefix chips use existing `ItemKey` or stay as-is if not pill-shaped); convert the pill-shaped ones per the inventory table — toggle pills (links-tab :72, workflow-tab :380, types-tab :95, fields-tab :330) become `<Pill onClick pressed shape="full" …/>`; tool chip / model badge / idle gap pill / crashed chip / value chips become `<Pill …/>` with matching tone/emphasis/shape. Where visual parity requires the old exact classes and a Pill variant cannot express it (e.g. dashed border on the idle gap pill), pass `className` overrides (e.g. `className="border-dashed"` on `emphasis="outline"`).

Then `git rm` the two components (+ demo/tests) and fix `ui/demo-coverage.test.ts`.

- [ ] **Step 4: Verify + gates**

`grep -rn "SessionStatusPill\|session-status-pill\|StatusChip" apps/web/src --include="*.ts*"` → zero. Run web tests (rewrite session-list/status assertions against Pill markup), typecheck.

- [ ] **Step 5: Commit** — `refactor(web): sessions/signals/ad-hoc chips onto Pill + domain maps`

---

### Task 6: Retire the `kind-*` color family

**Files:**
- Modify: `packages/web/ui/src/tokens/primitives.tokens.json`, `semantic.light.tokens.json`, `semantic.dark.tokens.json` (delete all `kind-todo|kind-active|kind-blocked|kind-done|kind-dropped` entries incl. `-hover`, `-subtle`, `on-kind-*`)
- Regenerate: `packages/web/ui/src/tokens.css` (kind vars vanish from all three regions)
- Modify: `packages/web/ui/src/tokens.css` hand-authored `@layer components` `.rt [data-callout]` rules: `--color-kind-active(-subtle)` → `--color-opt-blue(-subtle)`, `success` `kind-done` → `opt-green`, `warning` `kind-blocked` → `opt-orange`
- Modify: `packages/web/ui/src/swatches.ts` — `SWATCHES = ['accent', 'opt-green', 'opt-orange', 'opt-red', 'opt-blue', 'ink-3']` + update `swatches.test.ts` expected hexes (resolve from primitives JSON)
- Modify (remaining `kind-*` class users from the inventory, cluster 4, not already migrated): `ui/kind-glyph.demo.tsx` (deleted below), `components/detail-children.tsx`, `components/kanban-view.tsx`(leftovers), `components/home/projects-home.tsx`, `components/board/kpi-strip.tsx`, `components/all-items/all-items-screen.tsx`, `components/terminal/terminal-frame.tsx`, `components/agent/message-stream.tsx`, `components/agent/agent-card.tsx`, `components/agent/agent-editor.tsx`, `components/rich-text/suggestions.tsx`, `components/rich-text/board-suggestions.ts`, `components/signals/{level-dot,breadcrumb-list,stack-trace,session-screen,apps-screen,context-rail,activity-screen,issues-screen,issue-row,new-app-dialog}.tsx`, `components/shell/tasks-panel.tsx`, `components/board/table-view.tsx`, `components/detail-fields.tsx`, `components/detail-links.tsx`, `api/use-project-stats.ts`, `registry/get-cell-content.tsx`
- Delete: `apps/web/src/ui/kind-glyph.tsx`, `kind-glyph.demo.tsx`; `apps/web/src/components/signals/kind-glyph.tsx` + its test (glyphs move to registry names; `SignalKind` map becomes `signalKindIcon` in `domain/signal-status.ts`)

**Interfaces:**
- Consumes: Tone classes (`text-opt-blue` etc.), `Icon`/`KIND_ICON`, `statusPill`.
- Produces: a token JSON with NO kind entries; `signalKindIcon(kind: SignalKind): IconName` added to `domain/signal-status.ts`.

**Class replacement table** (mechanical; apply everywhere):

| Old | New |
|---|---|
| `bg-kind-todo-subtle` / `text-kind-todo` | `bg-opt-gray-subtle` / `text-opt-gray` |
| `bg-kind-active-subtle` / `text-kind-active` / `bg-kind-active` | `bg-opt-blue-subtle` / `text-opt-blue` / `bg-opt-blue` |
| `bg-kind-blocked-subtle` / `text-kind-blocked` / `bg-kind-blocked` / `text-on-kind-blocked` | `bg-opt-orange-subtle` / `text-opt-orange` / `bg-opt-orange` / `text-on-opt-orange` |
| `bg-kind-done-subtle` / `text-kind-done` / `bg-kind-done` | `bg-opt-green-subtle` / `text-opt-green` / `bg-opt-green` |
| `bg-kind-dropped-subtle` / `text-kind-dropped` | `bg-opt-gray-subtle` / `text-opt-gray` |
| `border-kind-*` forms | same-hue `border-opt-*` |

- [ ] **Step 1:** Apply the class table to every file above (prefer `toneClasses`/`statusPill` where the site is status-driven; raw class swap where it's decorative). Migrate `KindGlyph` renders to `<Icon name={KIND_ICON[kind]} tone={statusPill(kind).tone} />` (colored contexts) or `<Icon name={KIND_ICON[kind]} />` (inherit). Signals `KindGlyph` → `<Icon name={signalKindIcon(kind)} />` with `signalKindIcon` mapping event→`dot`, log→`rows`, click→`dot` (or `circle-dot`), navigation→`arrow-up-right`, http→`arrow-up-right`/`link`, error→`triangle-alert`, custom→`tag` — port the *drawings* from the old `KIND` map to the closest registry shapes, adding registry entries if a drawing has no equivalent (shape-named).
- [ ] **Step 2:** Delete kind entries from the three token JSON files; run `pnpm --filter @tickets/ui tokens:build`; confirm `tokens.css` regions no longer contain `kind-`; fix the `.rt [data-callout]` component-layer rules per above.
- [ ] **Step 3:** Update `swatches.ts` + `swatches.test.ts` (new expected hexes: opt-green `#2e7042`-family — read actual values from primitives JSON at implementation time).
- [ ] **Step 4:** Verification greps (expect zero): `grep -rn "kind-todo\|kind-active\|kind-blocked\|kind-done\|kind-dropped" apps/web/src packages/web/ui/src --include="*.ts*" --include="*.css"` (allowed: none; `ui/session-kind-glyph.tsx` keyword `SessionKind` is fine — it's not a color token).
- [ ] **Step 5:** Full battery: `pnpm --filter @tickets/ui tokens:verify && pnpm --filter @tickets/ui test && pnpm --filter @tickets/web test && pnpm typecheck && pnpm build`.
- [ ] **Step 6: Commit** — `feat(ui)!: retire kind-* color family; statuses use hue tones`

---

### Task 7: Tabs

**Files:**
- Create: `packages/web/ui/src/tabs.tsx`, `tabs.demo.tsx`; Test: `tabs.test.tsx`; export `./tabs`
- Modify: `components/item-detail.tsx` (:329), `components/settings/settings-screen.tsx` (:111 rail), `components/settings/fields-tab.tsx` (:319), `components/settings/workflow-tab.tsx` (:369), `components/signals/stack-trace.tsx` (:258), `components/signals/new-app-dialog.tsx` (:169), `components/all-items/all-items-screen.tsx` (:510 view strip), `components/shell/signals-panel.tsx` (:24 nav — value derived from `useMatchRoute`, `onChange` calls `navigate`)

**Interfaces:**
- Consumes: `toneClasses`, `Icon`, `IconName`, `cn`.
- Produces: `Tabs({ variant?, items, value, onChange, className? })` with `items: { value: string; label: ReactNode; icon?: IconName; badge?: ReactNode }[]`, `variant: 'underline' | 'pill' | 'rail' = 'underline'`.

- [ ] **Step 1: Failing test** `packages/web/ui/src/tabs.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './tabs';

const items = [
  { value: 'board', label: 'Board' },
  { value: 'table', label: 'Table', badge: <span>128</span> },
];

describe('Tabs', () => {
  it('renders a real tablist with aria-selected', () => {
    render(<Tabs items={items} value="board" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('false');
  });
  it('fires onChange with the item value', () => {
    const onChange = vi.fn();
    render(<Tabs items={items} value="board" onChange={onChange} />);
    screen.getByRole('tab', { name: /Table/ }).click();
    expect(onChange).toHaveBeenCalledWith('table');
  });
  it('variant classes: underline default, pill track, rail vertical', () => {
    const { container: u } = render(<Tabs items={items} value="board" onChange={() => {}} />);
    expect(u.querySelector('[role="tablist"]')!.className).toContain('border-b');
    const { container: p } = render(<Tabs variant="pill" items={items} value="board" onChange={() => {}} />);
    expect(p.querySelector('[role="tablist"]')!.className).toContain('bg-inset');
    const { container: r } = render(<Tabs variant="rail" items={items} value="board" onChange={() => {}} />);
    expect(r.querySelector('[role="tablist"]')!.className).toContain('flex-col');
  });
  it('renders badges', () => {
    render(<Tabs items={items} value="board" onChange={() => {}} />);
    expect(screen.getByText('128')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement** `packages/web/ui/src/tabs.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './icons/icon';

type Variant = 'underline' | 'pill' | 'rail';

const LIST: Record<Variant, string> = {
  underline: 'flex items-center gap-4.5 border-b-(length:--border-hair) border-hairline',
  pill: 'inline-flex items-center gap-1 rounded-[7px] bg-inset p-0.75',
  rail: 'flex flex-col gap-0.5',
};
const TAB: Record<Variant, { base: string; active: string; inactive: string }> = {
  underline: {
    base: '-mb-px border-b-2 px-0.5 pb-2 pt-1.75 text-ui',
    active: 'border-accent font-medium text-ink',
    inactive: 'border-transparent text-ink-2 hover:text-ink',
  },
  pill: {
    base: 'rounded-ctrl px-3 py-1 text-meta font-medium',
    active: 'bg-raised text-ink shadow-sm',
    inactive: 'text-ink-2 hover:text-ink',
  },
  rail: {
    base: 'rounded-tile px-2.5 py-1.5 text-left text-ui',
    active: 'bg-accent-subtle font-medium text-accent',
    inactive: 'text-ink-2 hover:bg-inset hover:text-ink',
  },
};

export function Tabs({
  variant = 'underline',
  items,
  value,
  onChange,
  className,
}: {
  variant?: Variant;
  items: { value: string; label: ReactNode; icon?: IconName; badge?: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn(LIST[variant], className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5',
              TAB[variant].base,
              active ? TAB[variant].active : TAB[variant].inactive,
            )}
          >
            {item.icon ? <Icon name={item.icon} size={12} /> : null}
            {item.label}
            {item.badge ? <span className="font-mono text-[10px] text-ink-3">{item.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Demo/playground** (`group: 'Display'`; states = one per variant; playground controls variant/count).
- [ ] **Step 4: Migrate the 8 sites.** Each keeps its own state/router wiring; only the markup collapses into `<Tabs>`. `settings-screen` rail → `variant="rail"`; fields/workflow filter tablists → `variant="pill"`; item-detail/stack-trace/new-app-dialog → default underline (match current look; where the old markup was pill-shaped keep pill). `signals-panel` nav: `value` from `useMatchRoute()` result, `onChange={(v) => navigate({ to: ROUTES[v] })}`. `all-items` view strip → underline with per-view labels. Preserve each site's exact tab labels/counts. Where a site's old tabpanel wiring used `aria-controls`/ids, keep the ids on the panels and add `id`/`aria-controls` via `className`-adjacent props ONLY if already present (do not invent new ids).
- [ ] **Step 5: Gates** (web tests: item-detail/settings/stack-trace tab tests re-target `role="tab"`), commit — `feat(ui): Tabs primitive; refactor(web): 8 tab sites onto it` (two commits: ui then web).

---

### Task 8: SegmentedControl

**Files:**
- Create: `packages/web/ui/src/segmented-control.tsx`, `.demo.tsx`; Test: `.test.tsx`; export `./segmented-control`
- Modify: `components/board/board-header.tsx` (:25 `segmentClasses`, :133 density, :184 mode), `components/all-items/all-items-screen.tsx` (:153, :490), `components/signals/issues-toolbar.tsx` (:9), `components/signals/sdk-snippet.tsx` (:40)

**Interfaces:**
- Produces: `SegmentedControl({ options, value, onChange, className? })`, `options: { value: string; label?: ReactNode; icon?: IconName }[]`. Buttons carry `aria-pressed` (matches current sites).

- [ ] **Step 1: Failing test** — renders inset track (`bg-inset` on container), `aria-pressed` on active, `onChange` fires, icon-only option renders svg + accessible name via `label` fallback (`aria-label` = `value` when no label).
- [ ] **Step 2: Implement:**

```tsx
import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './icons/icon';

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label?: ReactNode; icon?: IconName }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-[7px] bg-inset p-0.75', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            aria-label={opt.label == null ? opt.value : undefined}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-ctrl px-2.75 py-1 text-meta font-medium',
              active ? 'bg-raised text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
            )}
          >
            {opt.icon ? <Icon name={opt.icon} size={12} /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3:** Demo/playground; migrate the 4 files (issues-toolbar keeps its counts by passing `label={<>Open <span…>{n}</span></>}`); delete each local `segmentClasses`. Grep gate: `grep -rn segmentClasses apps/web/src` → zero.
- [ ] **Step 4:** Gates + commits (`feat(ui)` + `refactor(web)`).

---

### Task 9: Meter

**Files:**
- Create: `packages/web/ui/src/meter.tsx`, `.demo.tsx`; Test: `.test.tsx`; export `./meter`
- Modify: `components/agent/cost-meter.tsx`, `components/agent/context-meter.tsx`, `components/board/table-view.tsx` (ProgressCell :109-118), `components/detail-children.tsx` (:76-80), `components/home/projects-home.tsx` (:35-36), `components/shell/tasks-panel.tsx` (:106)

**Interfaces:**
- Produces: `Meter({ value, max = 100, tone = 'primary', warnAt, dangerAt, label, trailing, className? })`. Track = `h-1 rounded-full bg-inset overflow-hidden`, fill width `%` via inline style, fill tone switches to `warning`/`danger` at thresholds. `role="meter"` with `aria-valuenow/min/max`.

- [ ] **Step 1: Failing test** — width % computed (`value=34 max=100` → `style.width: '34%'`; clamped to 100), tone switch at `warnAt`/`dangerAt` (fill class contains `bg-opt-orange` / `bg-danger`), `role="meter"` + aria values, label/trailing render.
- [ ] **Step 2: Implement:**

```tsx
import type { ReactNode } from 'react';
import { cn } from './cn';
import { toneClasses, type Tone } from './tones';

export function Meter({
  value,
  max = 100,
  tone = 'primary',
  warnAt,
  dangerAt,
  label,
  trailing,
  className,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  warnAt?: number;
  dangerAt?: number;
  label?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const effective: Tone =
    dangerAt != null && value >= dangerAt ? 'danger'
    : warnAt != null && value >= warnAt ? 'warning'
    : tone;
  // toneClasses(t,'solid') is bg+text; the fill only needs the bg — take the first class.
  const fillBg = toneClasses(effective, 'solid').split(' ')[0];
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label ? <span className="font-mono text-[11px] text-ink-2 tabular-nums">{label}</span> : null}
      <div
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-1 min-w-9 flex-1 overflow-hidden rounded-full bg-inset"
      >
        <div className={cn('h-full rounded-full', fillBg)} style={{ width: `${pct}%` }} />
      </div>
      {trailing ? <span className="font-mono text-[11px] text-ink-2 tabular-nums">{trailing}</span> : null}
    </div>
  );
}
```

- [ ] **Step 3:** Demo/playground (value/max/warnAt/dangerAt/tone controls); migrate the 6 sites — cost-meter/context-meter keep their `$`/`▣` labels and pass `dangerAt` (cost cap / 90%); ProgressCell + detail-children + tasks-panel bars → `<Meter tone="green" …/>` (their fills were `bg-kind-done`, already `opt-green` after Task 6); projects-home two-segment bar → `<Meter tone="green" value={done} max={total} trailing={…} />`. Skeleton width bars (activity-row, issue-row, session-screen) are NOT meters — leave them.
- [ ] **Step 4:** Gates + commits.

---

### Task 10: ScreenState

**Files:**
- Create: `packages/web/ui/src/screen-state.tsx`, `.demo.tsx`; Test: `.test.tsx`; export `./screen-state`
- Modify: `components/signals/issues-screen.tsx` (:245 Retry, :254 empty), `components/signals/apps-screen.tsx` (:252), `components/signals/activity-screen.tsx` (:211, :220), `components/signals/session-screen.tsx` (LoadError :300-316, NotFound :340), `components/signals/app-detail-screen.tsx` (:95), `components/signals/issue-detail-screen.tsx` (:178-201), `components/board/table-view.tsx` (EmptyState :176-195), `components/all-items/all-items-screen.tsx` (:604-609), `components/agent/agent-library-screen.tsx` (:51), `components/settings/fields-tab.tsx` (:316)

**Interfaces:**
- Produces: `ScreenState({ title, icon, tone = 'neutral', body, action, className? })`.

- [ ] **Step 1: Failing test** — title required + rendered; `tone="danger"` puts danger subtle classes on the icon disc; `action` renders; without icon no disc renders.
- [ ] **Step 2: Implement:**

```tsx
import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './icons/icon';
import { toneClasses, type Tone } from './tones';

export function ScreenState({
  title,
  icon,
  tone = 'neutral',
  body,
  action,
  className,
}: {
  title: ReactNode;
  icon?: IconName;
  tone?: Tone;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
      {icon ? (
        <span
          className={cn(
            'flex size-7.5 items-center justify-center rounded-full',
            toneClasses(tone, 'subtle'),
          )}
        >
          <Icon name={icon} size={14} />
        </span>
      ) : null}
      <div className="text-ui font-semibold text-ink">{title}</div>
      {body ? <div className="max-w-90 text-meta text-ink-2">{body}</div> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 3:** Demo/playground; migrate the 10 sites: signals error blocks → `<ScreenState tone="danger" icon="triangle-alert" title="Couldn't load …" body={message} action={<Button variant="secondary" onClick={retry}>Retry</Button>} />` (keep each site's exact copy); empties → `tone="neutral"` with `icon="circle-check"`/`"circle"` per current glyph; table-view's local `EmptyState` component is deleted. Inline one-liners ("No comments yet." etc.) stay as-is.
- [ ] **Step 4:** Gates + commits.

---

### Task 11: Spinner + CopyButton

**Files:**
- Create: `packages/web/ui/src/spinner.tsx`, `.demo.tsx`, `.test.tsx`; `packages/web/ui/src/copy-button.tsx`, `.demo.tsx`, `.test.tsx`; exports `./spinner`, `./copy-button`
- Modify: `packages/web/ui/src/…/button` — NOTE: Button lives in `apps/web/src/ui/button.tsx` (:89 internal spinner) — replace its ring markup with `<Spinner size={12} tone="neutral" className="border-current" …/>` equivalent (see Step 3), `apps/web/src/ui/directory-tree.tsx` (:7), `components/signals/{apps-screen,activity-screen,issues-screen}.tsx` (the `size-2.75` rings), `components/signals/dsn-field.tsx`, `components/signals/sdk-snippet.tsx`, `components/signals/session-screen.tsx` (:186 copy id), `components/item-detail.tsx` (:386 copy link)

**Interfaces:**
- Produces: `Spinner({ size = 14, tone = 'primary', className? })` — renders `<Icon name="arc" animate="spin" tone={tone} />` sized; `useCopy(resetMs = 1500): { copied: boolean; failed: boolean; copy: (text: string) => Promise<void> }`; `CopyButton({ value, label = 'Copy', copiedLabel = 'Copied', resetMs = 1500, className? })`.

- [ ] **Step 1: Failing tests.** Spinner: renders the `arc` glyph with `animate-ai-spin`, size passthrough. useCopy (fake timers): `copy()` calls `navigator.clipboard.writeText`, sets `copied`, resets after 1500ms; rejection sets `failed` then resets — port the assertions style from `signals/dsn-field.test.tsx`. CopyButton: shows label → copiedLabel after click → back after `resetMs`.
- [ ] **Step 2: Implement.**

```tsx
// spinner.tsx
import { cn } from './cn';
import { Icon } from './icons/icon';
import type { Tone } from './tones';

export function Spinner({ size = 14, tone = 'primary', className }: { size?: number; tone?: Tone; className?: string }) {
  return <Icon name="arc" size={size} tone={tone} animate="spin" label="Loading" className={className} />;
}
```

```tsx
// copy-button.tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './icons/icon';

export function useCopy(resetMs = 1500) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), resetMs);
  };
  return { copied: state === 'copied', failed: state === 'failed', copy };
}

export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  resetMs = 1500,
  className,
}: {
  value: string;
  label?: ReactNode;
  copiedLabel?: ReactNode;
  resetMs?: number;
  className?: string;
}) {
  const { copied, failed, copy } = useCopy(resetMs);
  return (
    <button
      type="button"
      onClick={() => void copy(value)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-ctrl border-(length:--border-hair) px-2.5 py-1 font-mono text-[11px]',
        copied ? 'border-opt-green text-opt-green' : failed ? 'border-danger text-danger' : 'border-hairline text-ink-2 hover:bg-inset',
        className,
      )}
    >
      <Icon name={copied ? 'check' : 'copy'} size={11} />
      {copied ? copiedLabel : failed ? 'Failed' : label}
    </button>
  );
}
```

- [ ] **Step 3: Migrate.** Button's internal spinner: keep its exact geometry contract (`size-3` ring) by rendering `<Spinner size={12} tone="neutral" className="text-current" />` — but note Button's test asserts the old ring classes (`button.test.tsx:83`): update the assertion to the new svg. Signals ×3 loading rows and directory-tree → `<Spinner size={11} tone="secondary" />`. dsn-field + sdk-snippet: delete their local `CopyState` machines, render `<CopyButton value={dsn} />` (dsn-field keeps its layout; sdk-snippet keeps the platform SegmentedControl from Task 8). session-screen copy-id + item-detail copy-link → `useCopy` (icon-button call sites keep their own markup, call `copy(...)`). Delete `signals/dsn-field.test.tsx` copy-machine tests only if fully superseded by copy-button tests — otherwise re-point them at CopyButton rendering inside DsnField.
- [ ] **Step 4:** Grep gate: `grep -rn "animate-spin" apps/web/src` → zero (only `animate-ai-spin` inside the package remains). Gates + commits.

---

### Task 12: Small set (DialogFooter, RailLabel, SectionHeader) + final sweep

**Files:**
- Create: `packages/web/ui/src/dialog-footer.tsx`, `rail-label.tsx`, `section-header.tsx` (+ one shared `small-set.demo.tsx` with three state groups, or three demos — follow the one-demo-per-component convention: three `.demo.tsx` files) + tests; exports
- Modify (DialogFooter — all 10 dialogs from the inventory): `new-item-dialog.tsx`, `shell/new-project-dialog.tsx`, `terminal/new-session-dialog.tsx`, `signals/new-app-dialog.tsx`, `signals/rename-app-dialog.tsx`, `signals/delete-app-dialog.tsx`, `signals/clear-signals-dialog.tsx`, `signals/rotate-key-dialog.tsx`, `agent/ticket-dispatch.tsx`, `agent/agent-editor.tsx`
- Modify (RailLabel): `shell/agents-panel.tsx`, `shell/signals-panel.tsx`, `shell/terminals-panel.tsx`, `shell/tasks-panel.tsx`
- Modify (SectionHeader): `detail-fields.tsx`, `detail-children.tsx`, `detail-links.tsx`, `item-detail.tsx` (SECTION_LABEL), `settings/types-tab.tsx`, `settings/links-tab.tsx`, `terminal/new-session-dialog.tsx`, `agent/agent-editor.tsx`, `agent/agent-profile-screen.tsx`
- Modify (rich-text icon sweep): delete `components/rich-text/toolbar-icons.tsx`; its importers switch to `<Icon name="list" size={16}/>` etc. (list/quote/link from registry 24×24 entries; plus/chevron-down/chevron-right/circle-info/minus/check/pencil/trash from the 16×16 set)

**Interfaces:**
- Produces: `DialogFooter({ children, onCancel?, cancelLabel = 'Cancel' })` — right-aligned flex row, top hairline border, Cancel rendered as the app's ghost Button ONLY when `onCancel` given. NOTE: Button lives in `apps/web/src/ui/button.tsx`, which the package cannot import — so DialogFooter takes `cancel?: ReactNode` instead: `DialogFooter({ children, cancel? })` renders `cancel` first then `children`; the standardization is enforced at call sites by always passing `<Button variant="ghost" onClick={close}>Cancel</Button>`. `RailLabel({ children })` — `font-mono text-[10px] uppercase tracking-(--tracking-mono-label) text-ink-3`. `SectionHeader({ title, count?, action? })` — baseline row, `text-label uppercase text-ink-2` title, mono count, right-aligned action.

- [ ] **Step 1:** Failing tests for the three components (render structure; DialogFooter renders cancel node before children; SectionHeader shows count and action).
- [ ] **Step 2:** Implement (each ~15 lines, per interface above), demos, exports.
- [ ] **Step 3:** Migrate the listed sites. Every dialog's Cancel becomes `variant="ghost"` (this intentionally changes `new-session-dialog`, `new-app-dialog` step2, `clear-signals-dialog`, `rotate-key-dialog`, `ticket-dispatch`, `agent-editor` from secondary → ghost).
- [ ] **Step 4: Rich-text icon sweep** — migrate `toolbar-icons.tsx` importers to `<Icon>`; delete the file; checkbox.tsx's two inline svgs → `<Icon name="check" size={10}/>` / `<Icon name="minus" size={10}/>` (verify visual parity in the workbench; if the mask/stroke geometry differs noticeably, keep checkbox's originals and note it).
- [ ] **Step 5: FINAL SWEEP — verification greps, all must return zero:**

```bash
grep -rn "StatusBadge\|TypeBadge\|OptionChip\|SessionStatusPill\|KindGlyph\|toolbar-icons\|segmentClasses\|animate-spin" apps/web/src --include="*.ts*"
grep -rn "kind-todo\|kind-active\|kind-blocked\|kind-done\|kind-dropped" apps/web/src packages/web/ui/src
grep -rln "<svg" apps/web/src   # allowed: NONE (all inline svg now in the registry) — if checkbox kept its svgs per Step 4, allow exactly ui/checkbox.tsx
```

- [ ] **Step 6: Full battery** — `pnpm --filter @tickets/ui tokens:verify && pnpm --filter @tickets/ui test && pnpm --filter @tickets/web test && pnpm --filter @tickets/playground test && pnpm typecheck && pnpm build`.
- [ ] **Step 7: Browser pass** (worktree dev on :4670 + workbench :4650): both themes — tone matrix demo, icon registry demo, Pill demo, board (status pills, view segmented, tabs), all-items, settings (rail tabs, toggle pills, dialogs), sessions list (running spinner pill, awaiting pulse), signals (issues toolbar, error states with Retry, DSN copy). Screenshot-verify the slight status-color shift is acceptable on the board.
- [ ] **Step 8: Commits** — `feat(ui): DialogFooter/RailLabel/SectionHeader`, `refactor(web): dialogs + rails + sections + rich-text icons onto primitives`, final `chore(web): consolidation sweep — zero legacy component references`.

---

## Post-plan notes for the executor

- Read `packages/web/ui/src/gallery/controls.ts` before writing any playground — constructor signatures (options-object forms, `allowNone` overloads) must be matched exactly.
- Demo `group` values in use: `Foundation`, `Form controls`, `Pickers`, `Display`, `Overlays`, `AI session`. Tones demo → Foundation (order 1), Icon → Foundation (order 2), primitives → Display.
- `apps/web/src/ui/demo-coverage.test.ts` enforces web-side demo coverage; deleting a component's demo together with the component keeps it green. New package-side demos are covered by the package demo glob + playground.
- Web tests asserting old markup (`kanban-view.test.tsx`, `status-badge.test.tsx` (deleted with component), `session-status-pill.test.tsx` (deleted), `button.test.tsx:83`, signals tests) must be rewritten against the new primitives — same behavioral coverage, never weakened.
- After merge + deploy: re-push the design project per `syncing-design` (tone matrix + icon registry + new primitives as cards; design-system.html loses the kind-* swatches — `check-design-tokens.mjs`'s `LABEL_TO_TOKEN` does not reference kind tokens, so parity stays green either way).
