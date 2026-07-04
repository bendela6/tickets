# Redesign Phase 1 — Foundation & Core Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tailwind v4 with the Instrument design tokens (light + dark), IBM Plex fonts, a vitest test rig, and the first tier of `src/ui/` primitives (Button, Input, Textarea, Checkbox, Switch, RadioGroup, badge family) plus a dev-only gallery route — without visually changing the existing app.

**Architecture:** New components live in `apps/web/src/ui/` (one component per file, colocated `.test.tsx`). Tokens are plain CSS custom properties that flip under `[data-theme='dark']` (the attribute `apply-theme.ts` already sets), mapped into Tailwind utilities via `@theme inline`. Tailwind is imported **without preflight** so `globals.css`-styled screens don't shift.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), vitest + jsdom + Testing Library, `@fontsource` IBM Plex, clsx + tailwind-merge. No component library — controls are hand-rolled on native elements (headless-internal).

**Design references:** `docs/design/design-system.html` (open in browser), spec `docs/superpowers/specs/2026-07-05-ui-redesign-design.md`.

## Global Constraints

- Repo conventions: braces on every `if`; one helper per file; multi-line object literals; prettier is configured — run it via editor/format on save.
- Nothing may look native: checkbox/switch/radio are custom-drawn (`appearance-none` native inputs — accessible AND styled).
- Light and dark are equal citizens: every component styles both from the start; dark = `[data-theme='dark']` ancestors.
- Existing app must keep rendering identically: do NOT enable Tailwind preflight; do NOT edit `globals.css` in this phase.
- New dependencies below are floors, install latest: `tailwindcss@^4`, `@tailwindcss/vite@^4`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `clsx@^2`, `tailwind-merge@^3`, dev: `vitest@^4`, `jsdom@^27`, `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `@testing-library/user-event@^14`. **Each install goes through the add-package approval flow.**
- All commands run from repo root with `pnpm --filter @tickets/web <script>`.
- Type check after every task: `pnpm --filter @tickets/web typecheck`.

## Instrument token values (source of truth for Task 2)

Light → dark per token:

| Token | Light | Dark |
|---|---|---|
| bg app | `#F7F6F2` | `#1B1A17` |
| surface raised | `#FFFFFF` | `#252320` |
| surface inset | `#ECEAE3` | `#141310` |
| border hairline | `#E0DDD5` | `#343128` |
| border control | `#C9C5BA` | `#4C483D` |
| text primary | `#25231D` | `#EDEBE3` |
| text secondary | `#5D5A50` | `#A6A296` |
| text tertiary | `#918D80` | `#79756A` |
| accent | `#4E46C6` | `#918AEC` |
| accent hover | `#4238B5` | `#A29CF1` |
| accent subtle | `#E9E7FA` | `#2C2A4A` |
| on-accent | `#FFFFFF` | `#16143C` |
| danger | `#C0382E` | `#E26A5F` |
| danger hover | `#A82F26` | `#E9847A` |
| danger subtle | `#F8E7E5` | `#41231F` |
| kind todo | `#6E6A5E` | `#8A8678` |
| kind todo subtle | `#EBEAE3` | `#26251F` |
| kind active | `#2E6FCC` | `#6BA4EE` |
| kind active subtle | `#E4EDF9` | `#1E2A3F` |
| kind blocked | `#C25425` | `#E08B56` |
| kind blocked subtle | `#F8E9DF` | `#392317` |
| kind done | `#2E7D4F` | `#57B383` |
| kind done subtle | `#E2F0E7` | `#1B2E22` |
| kind dropped | `#6B675C` | `#9B968A` |
| shadow sm | `0 1px 2px rgba(28,26,20,.06)` | `0 1px 2px rgba(0,0,0,.4)` |

Option palette (pill: subtle bg / text), light `bg text` then dark `bg text`:

| Name | Light | Dark |
|---|---|---|
| red | `#FAE3E1` `#A03028` | `#46231F` `#F0968D` |
| orange | `#FAE7DA` `#A44E14` | `#45291A` `#EFA36C` |
| yellow | `#F5EBCE` `#8A6A10` | `#3E3316` `#DFC060` |
| green | `#DFF0E2` `#2E7042` | `#1E3626` `#7FCB97` |
| teal | `#D9F0EA` `#176D5C` | `#16342E` `#6CC9B4` |
| cyan | `#DBEEF6` `#14687E` | `#173139` `#74C4DC` |
| blue | `#E0EAF9` `#2A5DAE` | `#1D2C44` `#8BB4EF` |
| indigo | `#E6E6FA` `#4A44B0` | `#26254A` `#A5A0F0` |
| purple | `#F0E3F7` `#7B3FA0` | `#332240` `#C591E8` |
| pink | `#FAE1EC` `#A63368` | `#40222F` `#EE94BC` |
| gray | `#EAE9E4` `#5C594F` | `#2A2924` `#A5A195` |

Radii: control 5px, card 8px, panel 12px, chips pill. Type: UI default 13px, meta 12px, label 11px caps (+6% tracking), form/prose 14px, section 16, ticket title 18, page title 22, display 28. Spacing: 4px grid (Tailwind default). Sizes: compact control 28px, regular 36px, touch 44px, icon button 32px. Focus: 3px accent halo.

---

### Task 1: Test infrastructure

**Files:**
- Modify: `apps/web/package.json` (scripts + devDependencies)
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/test/smoke.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm --filter @tickets/web test` runs vitest; jest-dom matchers (`toBeInTheDocument`, `toBeDisabled`, `toHaveClass`) available in every `*.test.tsx` under `src/`.

- [ ] **Step 1: Install dev dependencies** (add-package approval flow)

```bash
pnpm --filter @tickets/web add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Create vitest config and setup**

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`apps/web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add to `apps/web/package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Write a smoke test**

`apps/web/src/test/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

test('renders into jsdom', () => {
  render(<button>hi</button>);
  expect(screen.getByRole('button', { name: 'hi' })).toBeInTheDocument();
});
```

- [ ] **Step 4: Run it**

Run: `pnpm --filter @tickets/web test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/test pnpm-lock.yaml
git commit -m "test(web): vitest + testing-library rig"
```

---

### Task 2: Tailwind v4 + Instrument tokens + fonts

**Files:**
- Modify: `apps/web/vite.config.ts` (add `@tailwindcss/vite` plugin)
- Create: `apps/web/src/styles/instrument.css`
- Modify: `apps/web/src/main.tsx` (import fonts + `instrument.css` AFTER `globals.css`)

**Interfaces:**
- Consumes: `[data-theme='dark']` attribute set by `src/utils/apply-theme.ts` (already exists).
- Produces: Tailwind utilities for every token, e.g. `bg-app`, `bg-raised`, `bg-inset`, `border-hairline`, `border-control`, `text-ink`, `text-ink-2`, `text-ink-3`, `bg-accent`, `text-on-accent`, `bg-danger`, `bg-kind-active`, `text-kind-done`, `bg-opt-red-subtle`, `text-opt-red`, `rounded-ctrl|card|panel`, `font-sans|mono`, `text-ui|meta|label`, `shadow-sm`, and the `dark:` variant keyed to `[data-theme='dark']`.

- [ ] **Step 1: Install dependencies** (add-package approval flow)

```bash
pnpm --filter @tickets/web add tailwindcss @tailwindcss/vite @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono clsx tailwind-merge
```

- [ ] **Step 2: Wire the vite plugin**

In `apps/web/vite.config.ts` add `tailwindcss()` from `@tailwindcss/vite` to the `plugins` array (keep the react plugin).

- [ ] **Step 3: Create `instrument.css`** — no preflight: import only theme + utilities layers.

```css
@layer theme, base, components, utilities;
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);

@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));

:root {
  --ins-app: #f7f6f2;
  --ins-raised: #ffffff;
  --ins-inset: #eceae3;
  --ins-hairline: #e0ddd5;
  --ins-control: #c9c5ba;
  --ins-ink: #25231d;
  --ins-ink-2: #5d5a50;
  --ins-ink-3: #918d80;
  --ins-accent: #4e46c6;
  --ins-accent-hover: #4238b5;
  --ins-accent-subtle: #e9e7fa;
  --ins-on-accent: #ffffff;
  --ins-danger: #c0382e;
  --ins-danger-hover: #a82f26;
  --ins-danger-subtle: #f8e7e5;
  --ins-kind-todo: #6e6a5e;
  --ins-kind-todo-subtle: #ebeae3;
  --ins-kind-active: #2e6fcc;
  --ins-kind-active-subtle: #e4edf9;
  --ins-kind-blocked: #c25425;
  --ins-kind-blocked-subtle: #f8e9df;
  --ins-kind-done: #2e7d4f;
  --ins-kind-done-subtle: #e2f0e7;
  --ins-kind-dropped: #6b675c;
  --ins-kind-dropped-subtle: #ebeae3;
  --ins-shadow-sm: 0 1px 2px rgba(28, 26, 20, 0.06);
  --ins-opt-red: #a03028;
  --ins-opt-red-subtle: #fae3e1;
  --ins-opt-orange: #a44e14;
  --ins-opt-orange-subtle: #fae7da;
  --ins-opt-yellow: #8a6a10;
  --ins-opt-yellow-subtle: #f5ebce;
  --ins-opt-green: #2e7042;
  --ins-opt-green-subtle: #dff0e2;
  --ins-opt-teal: #176d5c;
  --ins-opt-teal-subtle: #d9f0ea;
  --ins-opt-cyan: #14687e;
  --ins-opt-cyan-subtle: #dbeef6;
  --ins-opt-blue: #2a5dae;
  --ins-opt-blue-subtle: #e0eaf9;
  --ins-opt-indigo: #4a44b0;
  --ins-opt-indigo-subtle: #e6e6fa;
  --ins-opt-purple: #7b3fa0;
  --ins-opt-purple-subtle: #f0e3f7;
  --ins-opt-pink: #a63368;
  --ins-opt-pink-subtle: #fae1ec;
  --ins-opt-gray: #5c594f;
  --ins-opt-gray-subtle: #eae9e4;
}

[data-theme='dark'] {
  --ins-app: #1b1a17;
  --ins-raised: #252320;
  --ins-inset: #141310;
  --ins-hairline: #343128;
  --ins-control: #4c483d;
  --ins-ink: #edebe3;
  --ins-ink-2: #a6a296;
  --ins-ink-3: #79756a;
  --ins-accent: #918aec;
  --ins-accent-hover: #a29cf1;
  --ins-accent-subtle: #2c2a4a;
  --ins-on-accent: #16143c;
  --ins-danger: #e26a5f;
  --ins-danger-hover: #e9847a;
  --ins-danger-subtle: #41231f;
  --ins-kind-todo: #8a8678;
  --ins-kind-todo-subtle: #26251f;
  --ins-kind-active: #6ba4ee;
  --ins-kind-active-subtle: #1e2a3f;
  --ins-kind-blocked: #e08b56;
  --ins-kind-blocked-subtle: #392317;
  --ins-kind-done: #57b383;
  --ins-kind-done-subtle: #1b2e22;
  --ins-kind-dropped: #9b968a;
  --ins-kind-dropped-subtle: #26251f;
  --ins-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --ins-opt-red: #f0968d;
  --ins-opt-red-subtle: #46231f;
  --ins-opt-orange: #efa36c;
  --ins-opt-orange-subtle: #45291a;
  --ins-opt-yellow: #dfc060;
  --ins-opt-yellow-subtle: #3e3316;
  --ins-opt-green: #7fcb97;
  --ins-opt-green-subtle: #1e3626;
  --ins-opt-teal: #6cc9b4;
  --ins-opt-teal-subtle: #16342e;
  --ins-opt-cyan: #74c4dc;
  --ins-opt-cyan-subtle: #173139;
  --ins-opt-blue: #8bb4ef;
  --ins-opt-blue-subtle: #1d2c44;
  --ins-opt-indigo: #a5a0f0;
  --ins-opt-indigo-subtle: #26254a;
  --ins-opt-purple: #c591e8;
  --ins-opt-purple-subtle: #332240;
  --ins-opt-pink: #ee94bc;
  --ins-opt-pink-subtle: #40222f;
  --ins-opt-gray: #a5a195;
  --ins-opt-gray-subtle: #2a2924;
}

@theme inline {
  --color-*: initial;
  --color-app: var(--ins-app);
  --color-raised: var(--ins-raised);
  --color-inset: var(--ins-inset);
  --color-hairline: var(--ins-hairline);
  --color-control: var(--ins-control);
  --color-ink: var(--ins-ink);
  --color-ink-2: var(--ins-ink-2);
  --color-ink-3: var(--ins-ink-3);
  --color-accent: var(--ins-accent);
  --color-accent-hover: var(--ins-accent-hover);
  --color-accent-subtle: var(--ins-accent-subtle);
  --color-on-accent: var(--ins-on-accent);
  --color-danger: var(--ins-danger);
  --color-danger-hover: var(--ins-danger-hover);
  --color-danger-subtle: var(--ins-danger-subtle);
  --color-kind-todo: var(--ins-kind-todo);
  --color-kind-todo-subtle: var(--ins-kind-todo-subtle);
  --color-kind-active: var(--ins-kind-active);
  --color-kind-active-subtle: var(--ins-kind-active-subtle);
  --color-kind-blocked: var(--ins-kind-blocked);
  --color-kind-blocked-subtle: var(--ins-kind-blocked-subtle);
  --color-kind-done: var(--ins-kind-done);
  --color-kind-done-subtle: var(--ins-kind-done-subtle);
  --color-kind-dropped: var(--ins-kind-dropped);
  --color-kind-dropped-subtle: var(--ins-kind-dropped-subtle);
  --color-opt-red: var(--ins-opt-red);
  --color-opt-red-subtle: var(--ins-opt-red-subtle);
  --color-opt-orange: var(--ins-opt-orange);
  --color-opt-orange-subtle: var(--ins-opt-orange-subtle);
  --color-opt-yellow: var(--ins-opt-yellow);
  --color-opt-yellow-subtle: var(--ins-opt-yellow-subtle);
  --color-opt-green: var(--ins-opt-green);
  --color-opt-green-subtle: var(--ins-opt-green-subtle);
  --color-opt-teal: var(--ins-opt-teal);
  --color-opt-teal-subtle: var(--ins-opt-teal-subtle);
  --color-opt-cyan: var(--ins-opt-cyan);
  --color-opt-cyan-subtle: var(--ins-opt-cyan-subtle);
  --color-opt-blue: var(--ins-opt-blue);
  --color-opt-blue-subtle: var(--ins-opt-blue-subtle);
  --color-opt-indigo: var(--ins-opt-indigo);
  --color-opt-indigo-subtle: var(--ins-opt-indigo-subtle);
  --color-opt-purple: var(--ins-opt-purple);
  --color-opt-purple-subtle: var(--ins-opt-purple-subtle);
  --color-opt-pink: var(--ins-opt-pink);
  --color-opt-pink-subtle: var(--ins-opt-pink-subtle);
  --color-opt-gray: var(--ins-opt-gray);
  --color-opt-gray-subtle: var(--ins-opt-gray-subtle);
  --shadow-sm: var(--ins-shadow-sm);
  --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --radius-ctrl: 5px;
  --radius-card: 8px;
  --radius-panel: 12px;
  --text-label: 11px;
  --text-label--line-height: 1.2;
  --text-label--letter-spacing: 0.06em;
  --text-meta: 12px;
  --text-meta--line-height: 1.4;
  --text-ui: 13px;
  --text-ui--line-height: 1.45;
}
```

- [ ] **Step 4: Import fonts and stylesheet in `main.tsx`** (after the `globals.css` import)

```ts
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/instrument.css';
```

- [ ] **Step 5: Verify build + no visual change**

Run: `pnpm --filter @tickets/web build` — expected: success.
Run the dev server and eyeball one board screen against main: identical (no preflight was loaded).

- [ ] **Step 6: Commit**

```bash
git add apps/web/vite.config.ts apps/web/src/styles/instrument.css apps/web/src/main.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): tailwind v4 + Instrument tokens + IBM Plex, no preflight"
```

---

### Task 3: `cn` utility

**Files:**
- Create: `apps/web/src/ui/cn.ts`
- Test: `apps/web/src/ui/cn.test.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` — clsx + tailwind-merge; later-listed Tailwind classes win conflicts. Every `src/ui` component uses it to merge `className` props.

- [ ] **Step 1: Failing test**

```ts
import { expect, test } from 'vitest';
import { cn } from './cn';

test('merges conditionals and resolves tailwind conflicts', () => {
  expect(cn('px-2', false && 'hidden', 'px-4')).toBe('px-4');
});
```

- [ ] **Step 2: Run** `pnpm --filter @tickets/web test` — expected FAIL (cannot resolve `./cn`).

- [ ] **Step 3: Implement** `apps/web/src/ui/cn.ts`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Run** — expected PASS.

- [ ] **Step 5: Commit** `git add apps/web/src/ui && git commit -m "feat(web): cn class utility"`

---

### Task 4: Button

**Files:**
- Create: `apps/web/src/ui/button.tsx`
- Test: `apps/web/src/ui/button.test.tsx`

**Interfaces:**
- Consumes: `cn` from Task 3.
- Produces: `<Button variant size loading …nativeProps>`; `variant: 'primary' | 'secondary' | 'ghost' | 'destructive'` (default `secondary`), `size: 'compact' | 'regular' | 'touch' | 'icon'` (default `regular`, heights 28/36/44/32), `loading?: boolean` (spinner + disabled + `aria-busy`). Forwards ref; spreads native button props; `type="button"` by default.

- [ ] **Step 1: Failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Button } from './button';

test('renders and clicks', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Save view</Button>);
  await userEvent.click(screen.getByRole('button', { name: 'Save view' }));
  expect(onClick).toHaveBeenCalledOnce();
});

test('primary variant gets accent classes', () => {
  render(<Button variant="primary">New ticket</Button>);
  expect(screen.getByRole('button')).toHaveClass('bg-accent');
});

test('loading disables and marks busy', () => {
  render(<Button loading>Creating…</Button>);
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
});
```

- [ ] **Step 2: Run** — expected FAIL (cannot resolve `./button`).

- [ ] **Step 3: Implement** `apps/web/src/ui/button.tsx`

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'compact' | 'regular' | 'touch' | 'icon';
  loading?: boolean;
};

const variantClasses = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover border border-transparent',
  secondary: 'bg-raised text-ink border border-control hover:bg-inset',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-inset hover:text-ink',
  destructive: 'bg-transparent text-danger border border-control hover:bg-danger-subtle',
};

const sizeClasses = {
  compact: 'h-7 px-2.5 text-ui',
  regular: 'h-9 px-3.5 text-ui',
  touch: 'h-11 px-4 text-sm',
  icon: 'h-8 w-8 p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'regular', loading = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-ctrl font-sans font-medium',
        'transition-colors select-none active:translate-y-px',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle focus-visible:border-accent',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
});
```

- [ ] **Step 4: Run** — expected PASS. Then `pnpm --filter @tickets/web typecheck`.

- [ ] **Step 5: Commit** `git add apps/web/src/ui && git commit -m "feat(web): Button primitive"`

---

### Task 5: Input, Textarea, FieldLabel + FieldError

**Files:**
- Create: `apps/web/src/ui/input.tsx`
- Create: `apps/web/src/ui/textarea.tsx`
- Create: `apps/web/src/ui/field-label.tsx`
- Create: `apps/web/src/ui/field-error.tsx`
- Test: `apps/web/src/ui/input.test.tsx`

**Interfaces:**
- Consumes: `cn`.
- Produces:
  - `<Input size invalid …nativeProps>` — `size: 'compact' | 'regular'` (28/36px), `invalid?: boolean` (danger border + halo; pair with FieldError).
  - `<Textarea invalid …nativeProps>` — auto min-height 5 lines.
  - `<FieldLabel required htmlFor>` — 11px caps label; `required` renders ` *`.
  - `<FieldError id>` — 12px danger message; consumers point `aria-describedby` at it.

- [ ] **Step 1: Failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FieldError } from './field-error';
import { FieldLabel } from './field-label';
import { Input } from './input';

test('input associates label and error', () => {
  render(
    <>
      <FieldLabel htmlFor="key" required>
        Key
      </FieldLabel>
      <Input id="key" invalid aria-describedby="key-error" />
      <FieldError id="key-error">Key must be kebab-case</FieldError>
    </>,
  );
  const input = screen.getByLabelText('Key *');
  expect(input).toHaveAccessibleDescription('Key must be kebab-case');
  expect(input).toHaveAttribute('aria-invalid', 'true');
});
```

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement**

`apps/web/src/ui/input.tsx`:

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: 'compact' | 'regular';
  invalid?: boolean;
};

export const inputClasses = (invalid: boolean | undefined, className?: string) =>
  cn(
    'w-full rounded-ctrl border bg-raised font-sans text-ui text-ink placeholder:text-ink-3',
    'transition-colors focus:outline-none focus:ring-[3px]',
    invalid
      ? 'border-danger focus:ring-danger-subtle'
      : 'border-control hover:border-ink-3 focus:border-accent focus:ring-accent-subtle',
    'disabled:opacity-50 disabled:bg-inset',
    className,
  );

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'regular', invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses(invalid), size === 'compact' ? 'h-7 px-2' : 'h-9 px-3', className)}
      {...rest}
    />
  );
});
```

`apps/web/src/ui/textarea.tsx`:

```tsx
import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { inputClasses } from './input';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses(invalid), 'min-h-24 px-3 py-2 leading-normal', className)}
      {...rest}
    />
  );
});
```

`apps/web/src/ui/field-label.tsx`:

```tsx
import type { LabelHTMLAttributes } from 'react';
import { cn } from './cn';

type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean };

export function FieldLabel({ required, className, children, ...rest }: FieldLabelProps) {
  return (
    <label
      className={cn('block font-sans text-label font-medium tracking-wider uppercase text-ink-2', className)}
      {...rest}
    >
      {children}
      {required ? <span className="text-danger"> *</span> : null}
    </label>
  );
}
```

`apps/web/src/ui/field-error.tsx`:

```tsx
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function FieldError({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p role="alert" className={cn('mt-1 font-sans text-meta text-danger', className)} {...rest} />;
}
```

- [ ] **Step 4: Run tests + typecheck** — expected PASS.

- [ ] **Step 5: Commit** `git add apps/web/src/ui && git commit -m "feat(web): Input, Textarea, FieldLabel, FieldError"`

---

### Task 6: Checkbox, Switch, RadioGroup

**Files:**
- Create: `apps/web/src/ui/checkbox.tsx`
- Create: `apps/web/src/ui/switch.tsx`
- Create: `apps/web/src/ui/radio-group.tsx`
- Test: `apps/web/src/ui/checkbox.test.tsx`, `apps/web/src/ui/switch.test.tsx`, `apps/web/src/ui/radio-group.test.tsx`

**Interfaces:**
- Consumes: `cn`.
- Produces (all native inputs, `appearance-none`, fully keyboard/AT accessible):
  - `<Checkbox label indeterminate …nativeProps>` — label wraps input; `indeterminate` via ref.
  - `<Switch label …nativeProps>` — `role="switch"` checkbox in a track with sliding thumb.
  - `<RadioGroup name value onValueChange options={[{value,label,disabled?}]} label>` — fieldset + legend.

- [ ] **Step 1: Failing tests** (one per file; the checkbox one shown, mirror for the others)

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Checkbox } from './checkbox';

test('toggles via label click', async () => {
  const onChange = vi.fn();
  render(<Checkbox label="Show KPI strip" onChange={onChange} />);
  await userEvent.click(screen.getByLabelText('Show KPI strip'));
  expect(onChange).toHaveBeenCalledOnce();
});
```

Switch test asserts `screen.getByRole('switch', { name: 'KPI strip' })` toggles `checked`. RadioGroup test renders `options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]}`, clicks "Compact", asserts `onValueChange` called with `'compact'`.

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement**

`apps/web/src/ui/checkbox.tsx`:

```tsx
import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  indeterminate?: boolean;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate = false, className, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (inner.current) {
      inner.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 font-sans text-ui text-ink', className)}>
      <input
        ref={(node) => {
          inner.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        type="checkbox"
        className={cn(
          'peer size-4 shrink-0 appearance-none rounded-[4px] border border-control bg-raised transition-colors',
          'checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // check glyph drawn with a background SVG so no extra DOM is needed
          "checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22><path d=%22M2.5 6.5l2.5 2.5 4.5-5%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222%22/></svg>')] checked:bg-center checked:bg-no-repeat",
          "indeterminate:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22><path d=%22M3 6h6%22 stroke=%22white%22 stroke-width=%222%22/></svg>')] indeterminate:bg-center indeterminate:bg-no-repeat",
        )}
        {...rest}
      />
      <span className="peer-disabled:opacity-50">{label}</span>
    </label>
  );
});
```

`apps/web/src/ui/switch.tsx`:

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, ...rest },
  ref,
) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 font-sans text-ui text-ink', className)}>
      <span className="relative inline-flex">
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className={cn(
            'peer h-5 w-9 shrink-0 appearance-none rounded-full border border-control bg-inset transition-colors',
            'checked:border-accent checked:bg-accent',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          {...rest}
        />
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute left-0.5 top-1/2 size-4 -translate-y-1/2 rounded-full bg-raised shadow-sm transition-transform',
            'peer-checked:translate-x-4 peer-checked:bg-on-accent',
          )}
        />
      </span>
      <span className="peer-disabled:opacity-50">{label}</span>
    </label>
  );
});
```

`apps/web/src/ui/radio-group.tsx`:

```tsx
import { cn } from './cn';

type RadioOption = { value: string; label: string; disabled?: boolean };

type RadioGroupProps = {
  name: string;
  label: string;
  value: string;
  options: RadioOption[];
  onValueChange: (value: string) => void;
  className?: string;
};

export function RadioGroup({ name, label, value, options, onValueChange, className }: RadioGroupProps) {
  return (
    <fieldset className={cn('flex items-center gap-4 border-0 p-0 m-0', className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="inline-flex cursor-pointer items-center gap-2 font-sans text-ui text-ink"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onValueChange(option.value)}
            className={cn(
              'size-4 shrink-0 appearance-none rounded-full border border-control bg-raised transition-colors',
              'checked:border-[5px] checked:border-accent',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          />
          <span className={cn(option.disabled && 'opacity-50')}>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
```

- [ ] **Step 4: Run tests + typecheck** — expected PASS.

- [ ] **Step 5: Commit** `git add apps/web/src/ui && git commit -m "feat(web): Checkbox, Switch, RadioGroup"`

---

### Task 7: Badge family — StatusBadge, OptionChip, TypeBadge, TicketKey, Avatar

**Files:**
- Create: `apps/web/src/ui/kind-glyph.tsx`
- Create: `apps/web/src/ui/status-badge.tsx`
- Create: `apps/web/src/ui/option-chip.tsx`
- Create: `apps/web/src/ui/type-badge.tsx`
- Create: `apps/web/src/ui/ticket-key.tsx`
- Create: `apps/web/src/ui/avatar.tsx`
- Test: `apps/web/src/ui/status-badge.test.tsx`, `apps/web/src/ui/avatar.test.tsx`

**Interfaces:**
- Consumes: `cn`. `StatusKind = 'todo' | 'active' | 'blocked' | 'done' | 'dropped'` (exported from `kind-glyph.tsx`; matches the API's status kind strings).
- Produces (visual grammar: statuses = rectangles, options = pills, keys = mono, types = outlined; humans round, agents square):
  - `<KindGlyph kind>` — 10px inline SVG: open circle / half-filled circle / diamond / filled circle + check / dashed circle.
  - `<StatusBadge kind label>` — rectangle badge, kind-subtle bg, kind text, glyph; `dropped` gets `line-through` label.
  - `<OptionChip color label>` — pill; `color: OptionColor` = the 11 palette names; maps to `bg-opt-<c>-subtle text-opt-<c>`.
  - `<TypeBadge label>` — outlined neutral badge.
  - `<TicketKey prefix number muted>` — mono `PREFIX-N`, `muted` for done rows.
  - `<Avatar name kind size>` — initials; `kind: 'human' | 'agent'` (round vs square); `size: 'sm' | 'md'` (20/28px).

- [ ] **Step 1: Failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { StatusBadge } from './status-badge';

test('renders label with kind styling and glyph', () => {
  render(<StatusBadge kind="active" label="In progress" />);
  const badge = screen.getByText('In progress').closest('span');
  expect(badge).toHaveClass('bg-kind-active-subtle');
});

test('dropped statuses get struck labels', () => {
  render(<StatusBadge kind="dropped" label="Won't do" />);
  expect(screen.getByText("Won't do")).toHaveClass('line-through');
});
```

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Avatar } from './avatar';

test('agent avatars are square, humans round', () => {
  const { rerender } = render(<Avatar name="claude-worker" kind="agent" />);
  expect(screen.getByTitle('claude-worker')).toHaveClass('rounded-[4px]');
  rerender(<Avatar name="Mara K." kind="human" />);
  expect(screen.getByTitle('Mara K.')).toHaveClass('rounded-full');
});
```

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement**

`apps/web/src/ui/kind-glyph.tsx`:

```tsx
export type StatusKind = 'todo' | 'active' | 'blocked' | 'done' | 'dropped';

export function KindGlyph({ kind }: { kind: StatusKind }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 shrink-0">
      {kind === 'todo' ? <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" /> : null}
      {kind === 'active' ? (
        <>
          <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 1a4 4 0 0 1 0 8Z" fill="currentColor" />
        </>
      ) : null}
      {kind === 'blocked' ? <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" fill="currentColor" /> : null}
      {kind === 'done' ? (
        <>
          <circle cx="5" cy="5" r="4.5" fill="currentColor" />
          <path d="M3 5.2l1.5 1.6L7.2 3.8" fill="none" stroke="var(--ins-raised)" strokeWidth="1.4" />
        </>
      ) : null}
      {kind === 'dropped' ? (
        <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5" />
      ) : null}
    </svg>
  );
}
```

`apps/web/src/ui/status-badge.tsx`:

```tsx
import { cn } from './cn';
import { KindGlyph, type StatusKind } from './kind-glyph';

const kindClasses: Record<StatusKind, string> = {
  todo: 'bg-kind-todo-subtle text-kind-todo',
  active: 'bg-kind-active-subtle text-kind-active',
  blocked: 'bg-kind-blocked-subtle text-kind-blocked',
  done: 'bg-kind-done-subtle text-kind-done',
  dropped: 'bg-kind-dropped-subtle text-kind-dropped',
};

export function StatusBadge({ kind, label, className }: { kind: StatusKind; label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-ctrl px-2 py-0.5 font-sans text-meta font-medium',
        kindClasses[kind],
        className,
      )}
    >
      <KindGlyph kind={kind} />
      <span className={cn(kind === 'dropped' && 'line-through')}>{label}</span>
    </span>
  );
}
```

`apps/web/src/ui/option-chip.tsx`:

```tsx
import { cn } from './cn';

export type OptionColor =
  | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'cyan'
  | 'blue' | 'indigo' | 'purple' | 'pink' | 'gray';

const colorClasses: Record<OptionColor, string> = {
  red: 'bg-opt-red-subtle text-opt-red',
  orange: 'bg-opt-orange-subtle text-opt-orange',
  yellow: 'bg-opt-yellow-subtle text-opt-yellow',
  green: 'bg-opt-green-subtle text-opt-green',
  teal: 'bg-opt-teal-subtle text-opt-teal',
  cyan: 'bg-opt-cyan-subtle text-opt-cyan',
  blue: 'bg-opt-blue-subtle text-opt-blue',
  indigo: 'bg-opt-indigo-subtle text-opt-indigo',
  purple: 'bg-opt-purple-subtle text-opt-purple',
  pink: 'bg-opt-pink-subtle text-opt-pink',
  gray: 'bg-opt-gray-subtle text-opt-gray',
};

export function OptionChip({ color, label, className }: { color: OptionColor; label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 font-sans text-meta font-medium',
        colorClasses[color],
        className,
      )}
    >
      {label}
    </span>
  );
}
```

`apps/web/src/ui/type-badge.tsx`:

```tsx
import { cn } from './cn';

export function TypeBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-ctrl border border-hairline px-1.5 py-px font-sans text-meta text-ink-2',
        className,
      )}
    >
      {label}
    </span>
  );
}
```

`apps/web/src/ui/ticket-key.tsx`:

```tsx
import { cn } from './cn';

type TicketKeyProps = { prefix: string; number: number; muted?: boolean; className?: string };

export function TicketKey({ prefix, number, muted, className }: TicketKeyProps) {
  return (
    <span className={cn('font-mono text-meta font-medium', muted ? 'text-ink-3' : 'text-ink-2', className)}>
      {prefix}-{number}
    </span>
  );
}
```

`apps/web/src/ui/avatar.tsx`:

```tsx
import { cn } from './cn';

type AvatarProps = { name: string; kind: 'human' | 'agent'; size?: 'sm' | 'md'; className?: string };

function initials(name: string) {
  const parts = name.trim().split(/[\s-]+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({ name, kind, size = 'sm', className }: AvatarProps) {
  return (
    <span
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-inset font-sans font-medium text-ink-2 border border-hairline',
        kind === 'agent' ? 'rounded-[4px]' : 'rounded-full',
        size === 'sm' ? 'size-5 text-[9px]' : 'size-7 text-meta',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
```

- [ ] **Step 4: Run tests + typecheck** — expected PASS.

- [ ] **Step 5: Commit** `git add apps/web/src/ui && git commit -m "feat(web): badge family — status shapes, option chips, type, key, avatar"`

---

### Task 8: Dev gallery route

**Files:**
- Create: `apps/web/src/routes/gallery-route.tsx`
- Modify: `apps/web/src/router.ts` (register `/gallery`)

**Interfaces:**
- Consumes: every component from Tasks 4–7.
- Produces: `/gallery` route rendering all primitives in all variants/states in a `bg-app` page — the visual verification surface for this and later phases (compare against `docs/design/design-system.html` in both themes using the existing header theme toggle).

- [ ] **Step 1: Implement the route**

`apps/web/src/routes/gallery-route.tsx` — a plain component, no data fetching. Render sections mirroring the design sheet: Buttons (all 4 variants × sizes + loading), Inputs (default/invalid+error/disabled/compact + Textarea), Checkbox/Switch/RadioGroup (incl. indeterminate + disabled), StatusBadge (all 5 kinds), OptionChip (all 11 colors), TypeBadge, TicketKey (normal + muted), Avatar (human/agent × sm/md). Each section: `<h2 className="text-ui font-semibold text-ink-2 uppercase tracking-wider">…</h2>` and a flex-wrap row of examples on `bg-raised` cards (`rounded-card border border-hairline p-4`).

Register in `src/router.ts` following the existing route registration pattern (import the component, add a route with path `/gallery` under the root route).

- [ ] **Step 2: Verify visually**

Run the dev server, open `/gallery`, toggle theme via the existing header control. Compare against `docs/design/design-system.html` sections 06–12: colors, radii, focus halos (tab through), hover states, both themes.

- [ ] **Step 3: Typecheck + full test run**

Run: `pnpm --filter @tickets/web typecheck && pnpm --filter @tickets/web test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/gallery-route.tsx apps/web/src/router.ts
git commit -m "feat(web): /gallery dev route for Instrument primitives"
```

---

## Self-review notes

- Spec coverage (phase 1 slice only): tokens both themes ✔, fonts ✔, no native-looking controls ✔ (appearance-none), focus halos ✔, shape-coded kinds ✔, option palette ✔, actor round/square rule ✔, test rig ✔. Combobox/StatusSelect/DatePicker/Markdown/overlays are Phase 2 by design (roadmap).
- Type consistency: `StatusKind` defined once in `kind-glyph.tsx`; `OptionColor` once in `option-chip.tsx`; `inputClasses` exported from `input.tsx` and reused by `textarea.tsx`.
- The gallery task has no test cycle on purpose — it's the visual verification harness itself.
