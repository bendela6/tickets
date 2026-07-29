# Layout Primitives and Form Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Stack`, `Row` and a compound `Card` to `@tickets/ui`, then build the form input/registry layer at `@tickets/ui/src/forms/` on top of them, shrinking `apps/web/src/form/registry.tsx` to a thin extension.

**Architecture:** Three layout primitives styled from Instrument tokens, then seven form inputs that are thin adapters over primitives `@tickets/ui` already owns, plus four layouts, a `FieldWrapper` and a `RootWrapper`. `@tickets/ui` gains a runtime dependency on `@tickets/form` (for `defineRegistry`); the inputs themselves import the engine `import type` only.

**Tech Stack:** React 19 · TypeScript · Tailwind v4 (preflight ON) · vitest + @testing-library/react · pnpm workspaces

Spec: `docs/superpowers/specs/2026-07-29-items-core-ui-port-design.md`
Reference source (behaviour only, never markup): `../items-core/packages/web/ui/src/`

## Global Constraints

- **Never copy items-core's markup.** It hardcodes `bg-slate-100 dark:bg-slate-900`, `text-12`, `rounded-4`, `p-20`. Every class in this plan comes from Instrument tokens: `bg-surface-raised`, `bg-gray-1`, `border-gray-6`, `text-gray-11`, `text-gray-12`, `text-ui`, `text-12/17`, `font-sans`, `font-mono`.
- **Spacing uses Tailwind's numbered units**, exposed as an enumerable union (`gap={4}`). Never a named `xs|sm|md|lg|xl` scale — `docs/design/foundation-tokens.md` records spacing as deliberately non-tokenized because Tailwind's 4px scale already is one.
- **No arbitrary `[...]` Tailwind values and no odd fractional steps.** Round scale numbers or named utilities only.
- **Tests assert observable behaviour**, per `verifying-a-component`. **Never assert on a class the component chooses for itself** — no `expect(el.className).toContain('gap-4')`, `'flex-col'`, `'rounded-xl'`, `'font-mono'` or similar. jsdom computes no layout, so spacing and sizing simply go untested here; that is a deliberate ruling, not an oversight, and the gallery demo is where those are checked by eye.
  What tests may assert: rendered children, composition, DOM attributes (`role`, `rows`, `aria-invalid`, `disabled`, `href`), accessible names and roles, callback arguments, and that a **caller-supplied** `className` survives to the DOM (that one is an API contract, not an internal choice).
- Every new component gets a `.demo.tsx` so it appears at `/gallery/:slug/:tab`. `meta` shape: `{ title, group, size }` where `size` is one of `'sm' | 'md' | 'lg' | 'full'`.
- Conventional commits scoped by package: `feat(ui): …`, `refactor(web): …`. One commit per task.
- Run from repo root. Test a single file with:
  `pnpm --filter @tickets/ui test -- src/components/stack/stack.test.tsx`

## File Structure

```
packages/web/ui/src/
  components/
    stack/    stack.tsx  stack.test.tsx  stack.demo.tsx  index.ts     Task 1
    row/      row.tsx    row.test.tsx    row.demo.tsx    index.ts     Task 1
    card/     card.tsx   card.test.tsx   card.demo.tsx   index.ts     Task 2
    index.ts                                             modified: Tasks 1,2
  forms/
    field-wrapper.tsx  field-wrapper.test.tsx                         Task 3
    root-wrapper.tsx                                                  Task 3
    inputs/
      text/           text-input.tsx      text-input.test.tsx         Task 4
      textarea/       textarea-input.tsx  textarea-input.test.tsx     Task 4
      number/         number-input.tsx    number-input.test.tsx       Task 5
      select/         select-input.tsx    select-input.test.tsx       Task 6
      multi-select/   multi-select-input.tsx  …test.tsx               Task 6
      toggle/         toggle-input.tsx    toggle-input.test.tsx       Task 7
      json/           json-input.tsx      json-input.test.tsx         Task 7
    layouts.tsx       layouts.test.tsx                                Task 8
    registry.ts                                                       Task 9
    forms.demo.tsx                                                    Task 9
    index.ts                                                          Task 9
  index.ts                                                modified:  Task 9
packages/web/ui/package.json                              modified:  Task 3
apps/web/src/form/registry.tsx                            modified:  Task 10
```

`forms/` sits beside `components/`, not inside it, because its contents are registry entries consumed by an engine rather than components you drop into JSX. It is exported from the package barrel as its own group.

---

### Task 1: Stack and Row

**Files:**
- Create: `packages/web/ui/src/components/stack/stack.tsx`, `stack.test.tsx`, `stack.demo.tsx`, `index.ts`
- Create: `packages/web/ui/src/components/row/row.tsx`, `row.test.tsx`, `row.demo.tsx`, `index.ts`
- Modify: `packages/web/ui/src/components/index.ts`

**Interfaces:**
- Consumes: `cn` from `../../style`
- Produces: `Stack`, `Row`, and the types `Gap = 0|1|2|3|4|6|8`, `Align = 'start'|'center'|'end'|'stretch'`, `RowAlign = Align | 'baseline'`, `Justify = 'start'|'center'|'end'|'between'`. `Gap` is re-used as `Padding` in Task 2 and by every layout in Task 8.

**Design note for the implementer:** these use plain `Record` lookups rather than `variants()`. `variants()` earns its keep when options are `over()` expansions that must be enumerated into the generated safelist; here every class is a literal string that Tailwind's normal source scan already finds. Plain prop→class Records are established house style — see `ICON_SIZE` in `components/pill/pill.tsx`, `BOX` in `components/input/input.tsx`, `PADDING` in `components/combobox/combobox.tsx`.

- [ ] **Step 1: Write the failing test for Stack**

Create `packages/web/ui/src/components/stack/stack.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stack } from './stack';

// Spacing and direction are NOT tested — jsdom computes no layout, and
// asserting the class Stack picked for itself would just restate the
// implementation. The gap/align lookups are verified by eye in the gallery.
describe('Stack', () => {
  it('renders its children in order', () => {
    render(
      <Stack>
        <span>a</span>
        <span>b</span>
      </Stack>,
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('renders with no children and no props', () => {
    render(<Stack data-testid="s" />);
    expect(screen.getByTestId('s')).toBeEmptyDOMElement();
  });

  // A caller's className surviving is an API contract, not an internal choice.
  it('keeps a caller-supplied className', () => {
    render(<Stack data-testid="s" className="mt-2" />);
    expect(screen.getByTestId('s').className).toContain('mt-2');
  });

  it('forwards unknown props to the underlying div', () => {
    render(<Stack data-testid="s" role="group" aria-label="Filters" />);
    const el = screen.getByTestId('s');
    expect(el).toHaveAttribute('role', 'group');
    expect(el).toHaveAccessibleName('Filters');
  });

  it('accepts every gap and align value the types allow', () => {
    // Type-level coverage: this fails to compile if the unions and the lookup
    // Records disagree. It asserts nothing about the resulting classes.
    for (const gap of [0, 1, 2, 3, 4, 6, 8] as const) {
      const { unmount } = render(<Stack gap={gap} />);
      unmount();
    }
    for (const align of ['start', 'center', 'end', 'stretch'] as const) {
      const { unmount } = render(<Stack align={align} />);
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @tickets/ui test -- src/components/stack/stack.test.tsx`
Expected: FAIL — `Failed to resolve import "./stack"`

- [ ] **Step 3: Implement Stack**

Create `packages/web/ui/src/components/stack/stack.tsx`:

```tsx
import type { HTMLAttributes } from 'react';
import { cn } from '../../style';

/** Tailwind spacing units, enumerated. Deliberately NOT a named xs/sm/md scale:
 *  docs/design/foundation-tokens.md records spacing as non-tokenized because
 *  Tailwind's numbered 4px scale already is one, and a second vocabulary would
 *  give the codebase two ways to say 16px. */
export type Gap = 0 | 1 | 2 | 3 | 4 | 6 | 8;
export type Align = 'start' | 'center' | 'end' | 'stretch';

export const GAP: Record<Gap, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  6: 'gap-6',
  8: 'gap-8',
};

export const ALIGN: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: Gap;
  align?: Align;
};

/** Vertical flex container. Structure only — it takes no `tone` and paints
 *  no surface; wrap it in a Card if you need one. */
export function Stack({ gap = 4, align, className, ...rest }: StackProps) {
  return (
    <div className={cn('flex flex-col', GAP[gap], align && ALIGN[align], className)} {...rest} />
  );
}
```

Create `packages/web/ui/src/components/stack/index.ts`:

```ts
export * from './stack';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @tickets/ui test -- src/components/stack/stack.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 5: Write the failing test for Row**

Create `packages/web/ui/src/components/row/row.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Row } from './row';

// Same ruling as Stack: no assertions on classes Row picks for itself.
describe('Row', () => {
  it('renders its children in order', () => {
    render(
      <Row>
        <span>a</span>
        <span>b</span>
      </Row>,
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('keeps a caller-supplied className', () => {
    render(<Row data-testid="r" className="mt-2" />);
    expect(screen.getByTestId('r').className).toContain('mt-2');
  });

  it('forwards unknown props to the underlying div', () => {
    render(<Row data-testid="r" role="group" aria-label="Actions" />);
    expect(screen.getByTestId('r')).toHaveAccessibleName('Actions');
  });

  it('accepts every gap, align and justify value the types allow', () => {
    // Type-level coverage — Row's align domain includes `baseline`, which
    // Stack's does not. Fails to compile if the unions drift from the Records.
    for (const gap of [0, 1, 2, 3, 4, 6, 8] as const) {
      const { unmount } = render(<Row gap={gap} />);
      unmount();
    }
    for (const align of ['start', 'center', 'end', 'stretch', 'baseline'] as const) {
      const { unmount } = render(<Row align={align} />);
      unmount();
    }
    for (const justify of ['start', 'center', 'end', 'between'] as const) {
      const { unmount } = render(<Row justify={justify} />);
      unmount();
    }
  });
});
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `pnpm --filter @tickets/ui test -- src/components/row/row.test.tsx`
Expected: FAIL — `Failed to resolve import "./row"`

- [ ] **Step 7: Implement Row**

Create `packages/web/ui/src/components/row/row.tsx`:

```tsx
import type { HTMLAttributes } from 'react';
import { cn } from '../../style';
import { GAP, type Align, type Gap } from '../stack';

/** Row adds `baseline` to Stack's alignment domain: a label sitting next to a
 *  number wants their text baselines to line up, which a column never needs. */
export type RowAlign = Align | 'baseline';
export type Justify = 'start' | 'center' | 'end' | 'between';

const ROW_ALIGN: Record<RowAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const JUSTIFY: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

type RowProps = HTMLAttributes<HTMLDivElement> & {
  gap?: Gap;
  align?: RowAlign;
  justify?: Justify;
};

/** Horizontal flex container. Unlike Stack it defaults to `align="center"` —
 *  a row of a label, a control and a button is centred in every call site the
 *  ported form layouts have. */
export function Row({ gap = 4, align = 'center', justify, className, ...rest }: RowProps) {
  return (
    <div
      className={cn(
        'flex flex-row',
        GAP[gap],
        ROW_ALIGN[align],
        justify && JUSTIFY[justify],
        className,
      )}
      {...rest}
    />
  );
}
```

Create `packages/web/ui/src/components/row/index.ts`:

```ts
export * from './row';
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter @tickets/ui test -- src/components/row/row.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 9: Add the demos**

Create `packages/web/ui/src/components/stack/stack.demo.tsx`:

```tsx
import { Stack } from './stack';

export const meta = { title: 'Stack', group: 'Components', size: 'sm' };

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md border border-gray-6 bg-gray-1 px-3 py-2 font-sans text-ui text-gray-11">
    {children}
  </div>
);

export const states = [
  {
    name: 'Gaps',
    render: () => (
      <div className="flex gap-8">
        {([0, 2, 4, 8] as const).map((gap) => (
          <Stack key={gap} gap={gap}>
            <Box>gap {gap}</Box>
            <Box>second</Box>
            <Box>third</Box>
          </Stack>
        ))}
      </div>
    ),
  },
  {
    name: 'Align',
    render: () => (
      <div className="flex gap-8">
        {(['start', 'center', 'end', 'stretch'] as const).map((align) => (
          <Stack key={align} align={align} className="w-40 border border-dashed border-gray-6 p-2">
            <Box>{align}</Box>
            <Box>x</Box>
          </Stack>
        ))}
      </div>
    ),
  },
];
```

Create `packages/web/ui/src/components/row/row.demo.tsx`:

```tsx
import { Row } from './row';

export const meta = { title: 'Row', group: 'Components', size: 'sm' };

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md border border-gray-6 bg-gray-1 px-3 py-2 font-sans text-ui text-gray-11">
    {children}
  </div>
);

export const states = [
  {
    name: 'Gaps',
    render: () => (
      <div className="flex flex-col gap-4">
        {([0, 2, 4, 8] as const).map((gap) => (
          <Row key={gap} gap={gap}>
            <Box>gap {gap}</Box>
            <Box>second</Box>
            <Box>third</Box>
          </Row>
        ))}
      </div>
    ),
  },
  {
    name: 'Justify',
    render: () => (
      <div className="flex flex-col gap-4">
        {(['start', 'center', 'end', 'between'] as const).map((justify) => (
          <Row key={justify} justify={justify} className="w-96 border border-dashed border-gray-6 p-2">
            <Box>{justify}</Box>
            <Box>x</Box>
          </Row>
        ))}
      </div>
    ),
  },
  {
    name: 'Baseline align',
    render: () => (
      <Row align="baseline" className="border border-dashed border-gray-6 p-2">
        <span className="font-sans text-32 text-gray-12">42</span>
        <span className="font-sans text-ui text-gray-11">open tickets</span>
      </Row>
    ),
  },
];
```

- [ ] **Step 10: Export from the components barrel**

In `packages/web/ui/src/components/index.ts`, add in alphabetical position:

```ts
export * from './row';
export * from './stack';
```

(`./row` goes after `./relative-date`; `./stack` goes after `./spinner`.)

- [ ] **Step 11: Run the full ui suite and the token gate**

Run: `pnpm --filter @tickets/ui test`
Expected: PASS, no regressions

Run: `pnpm --filter @tickets/ui tokens:verify`
Expected: exit 0 — no generated-file drift, no hardcoded values flagged

- [ ] **Step 12: Commit**

```bash
git add packages/web/ui/src/components/stack packages/web/ui/src/components/row packages/web/ui/src/components/index.ts
git commit -m "feat(ui): Stack and Row layout primitives on Tailwind's numbered spacing"
```

---

### Task 2: Card, CardHeader, CardTitle, CardBody

**Files:**
- Create: `packages/web/ui/src/components/card/card.tsx`, `card.test.tsx`, `card.demo.tsx`, `index.ts`
- Modify: `packages/web/ui/src/components/index.ts`

**Interfaces:**
- Consumes: `cn` from `../../style`; `Gap` from `../stack` (aliased as `Padding`)
- Produces: `Card`, `CardHeader`, `CardTitle`, `CardBody`, `type CardRadius = 'md'|'lg'|'xl'`, `type Padding = Gap`. Task 8's `CardLayout` composes all four.

**Padding rule the implementer must preserve:** `padding` on `Card` defaults to `0`; `CardHeader` and `CardBody` bring their own. A headerless card writes `<Card padding={4}>`; a card with a header leaves `padding` at `0` so the header's bottom rule reaches both edges. This is documented, not enforced.

- [ ] **Step 1: Write the failing test**

Create `packages/web/ui/src/components/card/card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardBody, CardHeader, CardTitle } from './card';

// Surface, radius, padding and the hover affordance are NOT asserted — those
// are classes Card picks for itself, and jsdom cannot observe their effect.
// The gallery demo is where they are checked.
describe('Card', () => {
  it('renders its children', () => {
    render(<Card>body</Card>);
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('composes a header, a title and a body', () => {
    render(
      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardBody>content</CardBody>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  // The heading level is a real accessibility contract, not a style choice.
  it('renders the title as a level-3 heading', () => {
    render(<CardTitle>Filters</CardTitle>);
    expect(screen.getByRole('heading', { level: 3, name: 'Filters' })).toBeInTheDocument();
  });

  it('keeps a caller-supplied className on each part', () => {
    render(
      <Card data-testid="c" className="mt-2">
        <CardHeader data-testid="h" className="mt-3">h</CardHeader>
        <CardBody data-testid="b" className="mt-4">b</CardBody>
      </Card>,
    );
    expect(screen.getByTestId('c').className).toContain('mt-2');
    expect(screen.getByTestId('h').className).toContain('mt-3');
    expect(screen.getByTestId('b').className).toContain('mt-4');
  });

  it('forwards unknown props to the underlying div', () => {
    render(<Card data-testid="c" role="region" aria-label="Summary" />);
    expect(screen.getByTestId('c')).toHaveAccessibleName('Summary');
  });

  it('accepts every radius, padding and interactive value the types allow', () => {
    // Type-level coverage only; asserts nothing about the resulting classes.
    for (const radius of ['md', 'lg', 'xl'] as const) {
      const { unmount } = render(<Card radius={radius} />);
      unmount();
    }
    for (const padding of [0, 1, 2, 3, 4, 6, 8] as const) {
      const { unmount } = render(<Card padding={padding} />);
      unmount();
      const body = render(<CardBody padding={padding} />);
      body.unmount();
    }
    const { unmount } = render(<Card interactive />);
    unmount();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @tickets/ui test -- src/components/card/card.test.tsx`
Expected: FAIL — `Failed to resolve import "./card"`

- [ ] **Step 3: Implement the Card family**

Create `packages/web/ui/src/components/card/card.tsx`:

```tsx
import type { HTMLAttributes } from 'react';
import { cn } from '../../style';
import type { Gap } from '../stack';

export type CardRadius = 'md' | 'lg' | 'xl';
/** Card padding reuses Stack's gap domain, so there is one spacing vocabulary
 *  in the package rather than two. */
export type Padding = Gap;

const RADIUS: Record<CardRadius, string> = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
};

export const PAD: Record<Padding, string> = {
  0: 'p-0',
  1: 'p-1',
  2: 'p-2',
  3: 'p-3',
  4: 'p-4',
  6: 'p-6',
  8: 'p-8',
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  radius?: CardRadius;
  padding?: Padding;
  /** Adds the hover border-lift and pointer cursor for a card that is a link
   *  or a button. Does not make it focusable — wrap it or use `role`. */
  interactive?: boolean;
};

/**
 * The raised surface every panel in the app rebuilds by hand today.
 *
 * `padding` defaults to 0 because a Card containing a CardHeader must have
 * none: the header's bottom rule has to reach both edges, which it cannot do
 * from inside the parent's padding box. A headerless card sets `padding`
 * itself. Setting `padding` AND using CardHeader is the one combination that
 * misrenders, and it is a documented rule rather than a runtime guard —
 * enforcing it would cost a context provider to save a sentence of docs.
 *
 * `overflow-hidden` is load-bearing: without it a CardHeader's rule and any
 * full-bleed child square off the rounded corners.
 */
export function Card({
  radius = 'xl',
  padding = 0,
  interactive,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden border border-gray-6 bg-surface-raised',
        RADIUS[radius],
        PAD[padding],
        interactive && 'cursor-pointer hover:border-gray-7',
        className,
      )}
      {...rest}
    />
  );
}

/** Header band with the dividing rule. Carries its own padding — see Card. */
export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-gray-6 px-4 py-3', className)} {...rest} />;
}

/** The header's heading. Rendered as an h3 so a card inside a page section
 *  lands at a sensible depth; override with `as` at the call site if not. */
export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-sans text-ui font-semibold text-gray-12', className)} {...rest} />;
}

type CardBodyProps = HTMLAttributes<HTMLDivElement> & { padding?: Padding };

/** Content region below the header. Defaults to `padding={4}` because that is
 *  what the surfaces being replaced use most. */
export function CardBody({ padding = 4, className, ...rest }: CardBodyProps) {
  return <div className={cn(PAD[padding], className)} {...rest} />;
}
```

Create `packages/web/ui/src/components/card/index.ts`:

```ts
export * from './card';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @tickets/ui test -- src/components/card/card.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 5: Add the demo**

Create `packages/web/ui/src/components/card/card.demo.tsx`:

```tsx
import { Card, CardBody, CardHeader, CardTitle } from './card';
import { Stack } from '../stack';

export const meta = { title: 'Card', group: 'Components', size: 'md' };

export const states = [
  {
    name: 'Headerless',
    render: () => (
      <Card padding={4} className="w-80">
        <span className="font-sans text-ui text-gray-11">
          A card with no header sets its own padding.
        </span>
      </Card>
    ),
  },
  {
    name: 'With header',
    render: () => (
      <Card className="w-80">
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardBody>
          <span className="font-sans text-ui text-gray-11">
            Padding stays 0 on the Card so the rule bleeds edge to edge.
          </span>
        </CardBody>
      </Card>
    ),
  },
  {
    name: 'Radii',
    render: () => (
      <Stack gap={3}>
        {(['md', 'lg', 'xl'] as const).map((radius) => (
          <Card key={radius} radius={radius} padding={3} className="w-80">
            <span className="font-sans text-ui text-gray-11">radius {radius}</span>
          </Card>
        ))}
      </Stack>
    ),
  },
  {
    name: 'Interactive',
    render: () => (
      <Card interactive padding={4} className="w-80">
        <span className="font-sans text-ui text-gray-11">Hover me — the border lifts.</span>
      </Card>
    ),
  },
];
```

- [ ] **Step 6: Export from the components barrel**

In `packages/web/ui/src/components/index.ts`, add after `./button`:

```ts
export * from './card';
```

- [ ] **Step 7: Run the full ui suite and the token gate**

Run: `pnpm --filter @tickets/ui test`
Expected: PASS

Run: `pnpm --filter @tickets/ui tokens:verify`
Expected: exit 0

- [ ] **Step 8: Commit**

```bash
git add packages/web/ui/src/components/card packages/web/ui/src/components/index.ts
git commit -m "feat(ui): compound Card with header, title and body"
```

---

### Task 3: Wire the form engine in, plus FieldWrapper and RootWrapper

**Files:**
- Modify: `packages/web/ui/package.json`
- Create: `packages/web/ui/src/forms/field-wrapper.tsx`, `field-wrapper.test.tsx`
- Create: `packages/web/ui/src/forms/root-wrapper.tsx`

**Interfaces:**
- Consumes: `FieldWrapperProps`, `RootWrapperProps` from `@tickets/form`; `FieldLabel`, `FieldError`, `Stack` from Tasks 1 and the existing package
- Produces: `FieldWrapper`, `RootWrapper` — both registered in Task 9

**Exact engine types** (from `packages/web/form/src/types/registry.ts` — do not guess these, `label` is a `string` not a `ReactNode` and `required` is not optional):

```ts
interface FieldWrapperProps {
  name: string;
  label?: string;
  description?: string;
  required: boolean;
  error?: string;
  touched: boolean;
  loading: boolean;
  configError?: Error;
  children: ReactNode;
}

interface RootWrapperProps { children: ReactNode }
```

- [ ] **Step 1: Add the dependency**

In `packages/web/ui/package.json`, add to `dependencies` (keeping the block alphabetical):

```json
    "@tickets/form": "workspace:*",
```

**Every import of `@tickets/form` in this package is `import type`** — the registry-assembling `defineRegistry` call lives in apps/web, not here (see Task 9). It stays a real dependency rather than a devDependency because `@tickets/ui` publishes TypeScript source (`"exports": { ".": "./src/index.ts" }`), so consumers compile these files and must be able to resolve the types. Being type-only, it adds nothing to any runtime bundle.

Run: `pnpm install`
Expected: resolves the workspace link, no lockfile surprises

- [ ] **Step 2: Write the failing test**

Create `packages/web/ui/src/forms/field-wrapper.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldWrapper } from './field-wrapper';

const base = { name: 'title', required: false, touched: false, loading: false };

describe('FieldWrapper', () => {
  it('labels the control it wraps', () => {
    render(
      <FieldWrapper {...base} label="Title">
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  it('marks a required field', () => {
    render(
      <FieldWrapper {...base} label="Title" required>
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows the description when there is no error', () => {
    render(
      <FieldWrapper {...base} label="Title" description="Keep it short">
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByText('Keep it short')).toBeInTheDocument();
  });

  it('replaces the description with the error once one exists', () => {
    render(
      <FieldWrapper {...base} label="Title" description="Keep it short" error="Required" touched>
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.queryByText('Keep it short')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  // The error element stays mounted and only its opacity changes, so a message
  // appearing does not push the rest of the form down.
  it('keeps the error line in the tree but invisible until the field is touched', () => {
    const { rerender } = render(
      <FieldWrapper {...base} label="Title" error="Required">
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByRole('alert', { hidden: true }).className).toContain('opacity-0');
    rerender(
      <FieldWrapper {...base} label="Title" error="Required" touched>
        <input id="title" />
      </FieldWrapper>,
    );
    expect(screen.getByRole('alert').className).toContain('opacity-100');
  });

  it('renders without a label', () => {
    render(<FieldWrapper {...base}><input aria-label="bare" /></FieldWrapper>);
    expect(screen.getByLabelText('bare')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `pnpm --filter @tickets/ui test -- src/forms/field-wrapper.test.tsx`
Expected: FAIL — `Failed to resolve import "./field-wrapper"`

- [ ] **Step 4: Implement both wrappers**

Create `packages/web/ui/src/forms/field-wrapper.tsx`:

```tsx
import type { FieldWrapperProps } from '@tickets/form';
import { cn } from '../style';
import { FieldError } from '../components/field-error';
import { FieldLabel } from '../components/field-label';
import { Stack } from '../components/stack';

/**
 * The registry's `field` slot: caption, control, then either the description
 * or the error.
 *
 * The error paragraph stays mounted whenever `error` is set and only its
 * opacity flips on `touched`. Unmounting it instead would make every field
 * change height the moment validation fires, so a form that fails on submit
 * would jump under the user's cursor.
 */
export function FieldWrapper({
  name,
  label,
  description,
  required,
  error,
  touched,
  children,
}: FieldWrapperProps) {
  return (
    <Stack gap={1}>
      {label ? (
        <FieldLabel htmlFor={name} required={required}>
          {label}
        </FieldLabel>
      ) : null}
      {children}
      {description && !error ? (
        <p className="font-sans text-12/17 text-gray-11">{description}</p>
      ) : null}
      {error ? (
        <FieldError className={cn(touched ? 'opacity-100' : 'opacity-0')}>{error}</FieldError>
      ) : null}
    </Stack>
  );
}
```

Create `packages/web/ui/src/forms/root-wrapper.tsx`:

```tsx
import type { RootWrapperProps } from '@tickets/form';
import { Stack } from '../components/stack';

/** The registry's `root` slot — the spacing between top-level fields. */
export function RootWrapper({ children }: RootWrapperProps) {
  return <Stack gap={4}>{children}</Stack>;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @tickets/ui test -- src/forms/field-wrapper.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 6: Typecheck the package**

Run: `pnpm --filter @tickets/ui typecheck`
Expected: exit 0 — confirms `@tickets/form`'s types resolve from inside `@tickets/ui`

- [ ] **Step 7: Commit**

```bash
git add packages/web/ui/package.json packages/web/ui/src/forms pnpm-lock.yaml
git commit -m "feat(ui): FieldWrapper and RootWrapper, wiring @tickets/form into the package"
```

---

### Task 4: text and textarea inputs

**Files:**
- Create: `packages/web/ui/src/forms/inputs/text/text-input.tsx`, `text-input.test.tsx`
- Create: `packages/web/ui/src/forms/inputs/textarea/textarea-input.tsx`, `textarea-input.test.tsx`

**Interfaces:**
- Consumes: `InputProps` (type-only) from `@tickets/form`; `Input`, `Textarea` from `../../../components/...`
- Produces: `TextInput`, `TextInputConfig`, `TextareaInput`, `TextareaInputConfig` — registered in Task 9 under keys `text` and `textarea`, both with `defaultValue: ''`

**Engine contract** every input in Tasks 4–7 implements (verbatim from `packages/web/form/src/types/registry.ts`):

```ts
interface InputProps<TConfigResolved, TValue> {
  name: string;
  value: TValue;
  onChange: (next: TValue) => void;
  onBlur: () => void;
  config: TConfigResolved;
  error?: string;
  disabled?: boolean;
  loading: boolean;
  configError?: Error;
}
```

`tone={p.error ? 'danger' : undefined}` is the house idiom for painting the invalid state — `fieldState()` in `components/field/field.ts` turns `'danger'` into `invalid: true`, which sets `aria-invalid` and repaints the border.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/ui/src/forms/inputs/text/text-input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextInput } from './text-input';

const base = { name: 'title', loading: false, onBlur: vi.fn(), config: {} };

describe('TextInput', () => {
  it('reports what the user types', async () => {
    const onChange = vi.fn();
    render(<TextInput {...base} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'hi');
    expect(onChange).toHaveBeenLastCalledWith('hi');
  });

  it('renders an undefined value as an empty controlled input', () => {
    render(<TextInput {...base} value={undefined as unknown as string} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('fires onBlur so the engine can mark the field touched', async () => {
    const onBlur = vi.fn();
    render(<TextInput {...base} onBlur={onBlur} value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalled();
  });

  it('marks itself invalid when the engine passes an error', () => {
    render(<TextInput {...base} value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders the prefix slot when configured', () => {
    render(<TextInput {...base} config={{ prefix: 'https://' }} value="" onChange={vi.fn()} />);
    expect(screen.getByText('https://')).toBeInTheDocument();
  });

  it('passes the placeholder through', () => {
    render(<TextInput {...base} config={{ placeholder: 'Ticket title' }} value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Ticket title')).toBeInTheDocument();
  });

  it('is disabled when the engine says so', () => {
    render(<TextInput {...base} value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
```

Create `packages/web/ui/src/forms/inputs/textarea/textarea-input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextareaInput } from './textarea-input';

const base = { name: 'body', loading: false, onBlur: vi.fn(), config: {} };

describe('TextareaInput', () => {
  it('reports what the user types', async () => {
    const onChange = vi.fn();
    render(<TextareaInput {...base} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'ab');
    expect(onChange).toHaveBeenLastCalledWith('ab');
  });

  it('defaults to four rows and honours an override', () => {
    const { rerender } = render(<TextareaInput {...base} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4');
    rerender(<TextareaInput {...base} config={{ rows: 10 }} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '10');
  });

  it('marks itself invalid when the engine passes an error', () => {
    render(<TextareaInput {...base} value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is disabled when the engine says so', () => {
    render(<TextareaInput {...base} value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm --filter @tickets/ui test -- src/forms/inputs`
Expected: FAIL — both files fail to resolve their imports

- [ ] **Step 3: Implement both inputs**

Create `packages/web/ui/src/forms/inputs/text/text-input.tsx`:

```tsx
import type { InputProps } from '@tickets/form';
import { cn } from '../../../style';
import { Input } from '../../../components/input';

export type TextInputConfig = {
  placeholder?: string;
  mono?: boolean;
  /** Static leading affix, e.g. a fixed URL scheme. Not editable. */
  prefix?: string;
};

export function TextInput(p: InputProps<TextInputConfig, string>) {
  return (
    <div className="flex items-stretch gap-2">
      {p.config.prefix ? (
        <span className="inline-flex items-center rounded-md border border-gray-6 bg-gray-1 px-3 font-sans text-ui text-gray-11">
          {p.config.prefix}
        </span>
      ) : null}
      <Input
        id={p.name}
        name={p.name}
        type="text"
        // The engine can hand back undefined before a default lands; an
        // undefined `value` would flip the input to uncontrolled mid-life.
        value={p.value ?? ''}
        placeholder={p.config.placeholder}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
        className={cn(p.config.mono && 'font-mono')}
      />
    </div>
  );
}
```

Create `packages/web/ui/src/forms/inputs/textarea/textarea-input.tsx`:

```tsx
import type { InputProps } from '@tickets/form';
import { Textarea } from '../../../components/textarea';

export type TextareaInputConfig = {
  rows?: number;
  placeholder?: string;
};

export function TextareaInput(p: InputProps<TextareaInputConfig, string>) {
  return (
    <Textarea
      id={p.name}
      name={p.name}
      rows={p.config.rows ?? 4}
      value={p.value ?? ''}
      placeholder={p.config.placeholder}
      disabled={p.disabled}
      tone={p.error ? 'danger' : undefined}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    />
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @tickets/ui test -- src/forms/inputs`
Expected: PASS, 11 tests

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/forms/inputs/text packages/web/ui/src/forms/inputs/textarea
git commit -m "feat(ui): text and textarea form inputs"
```

---

### Task 5: number input

**Files:**
- Create: `packages/web/ui/src/forms/inputs/number/number-input.tsx`, `number-input.test.tsx`

**Interfaces:**
- Consumes: `InputProps` (type-only); `NumberInput` from `../../../components/number-input`
- Produces: `NumberFormInput`, `NumberInputConfig` — registered in Task 9 under key `number` with `defaultValue: null`

**Two API facts that will bite if ignored.** `components/number-input` has this exact signature:

```ts
type NumberInputProps = {
  value: number | null;                       // null, NOT undefined
  onChange: (value: number | null) => void;
  min?: number; max?: number; step?: number;
  size?: FieldSize; tone?: Tone;
  disabled?: boolean; placeholder?: string; className?: string;
};
```

1. Its value channel is `number | null`, so the registry's `defaultValue` for this key is `null` and the form's value type is `number | null`.
2. **It has no `onBlur` prop.** Wrap it in a `<div onBlur={p.onBlur}>` — React's synthetic `onBlur` bubbles, so a blur on the inner `<input>` reaches the wrapper. Do not add an `onBlur` prop to the shared primitive for this.

The exported component is named `NumberFormInput`, not `NumberInput`, so it does not collide with the primitive it wraps.

- [ ] **Step 1: Write the failing test**

Create `packages/web/ui/src/forms/inputs/number/number-input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NumberFormInput } from './number-input';

const base = { name: 'estimate', loading: false, onBlur: vi.fn(), config: {} };

describe('NumberFormInput', () => {
  it('reports the number the user types', async () => {
    const onChange = vi.fn();
    render(<NumberFormInput {...base} value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole('spinbutton'), '7');
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it('clamps a value above max down to max', async () => {
    const onChange = vi.fn();
    render(<NumberFormInput {...base} config={{ max: 10 }} value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole('spinbutton'), '99');
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('clamps a value below min up to min', async () => {
    const onChange = vi.fn();
    render(<NumberFormInput {...base} config={{ min: 5 }} value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole('spinbutton'), '1');
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('reports null when the field is cleared rather than coercing to zero', async () => {
    const onChange = vi.fn();
    render(<NumberFormInput {...base} value={3} onChange={onChange} />);
    await userEvent.clear(screen.getByRole('spinbutton'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('fires onBlur through the wrapper so the engine marks it touched', async () => {
    const onBlur = vi.fn();
    render(<NumberFormInput {...base} onBlur={onBlur} value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('spinbutton'));
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalled();
  });

  it('renders the suffix when configured', () => {
    render(<NumberFormInput {...base} config={{ suffix: 'hours' }} value={null} onChange={vi.fn()} />);
    expect(screen.getByText('hours')).toBeInTheDocument();
  });

  it('is disabled when the engine says so', () => {
    render(<NumberFormInput {...base} value={null} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @tickets/ui test -- src/forms/inputs/number`
Expected: FAIL — `Failed to resolve import "./number-input"`

- [ ] **Step 3: Implement it**

Create `packages/web/ui/src/forms/inputs/number/number-input.tsx`:

```tsx
import type { InputProps } from '@tickets/form';
import { NumberInput } from '../../../components/number-input';

export type NumberInputConfig = {
  min?: number;
  max?: number;
  step?: number;
  /** Trailing unit label, e.g. `hours`. Static text, not part of the value. */
  suffix?: string;
};

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

/**
 * Named `NumberFormInput` so it does not shadow the `NumberInput` primitive it
 * wraps.
 *
 * The primitive exposes no `onBlur`, so the wrapper div carries it — React's
 * synthetic blur bubbles, unlike the native event. Clamping happens here
 * rather than in the primitive because `min`/`max` arrive as authored form
 * config, and the primitive is also used outside forms where the caller owns
 * that policy.
 */
export function NumberFormInput(p: InputProps<NumberInputConfig, number | null>) {
  return (
    <div onBlur={p.onBlur} className="flex items-center gap-2">
      <NumberInput
        value={p.value ?? null}
        min={p.config.min}
        max={p.config.max}
        step={p.config.step}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next === null ? null : clamp(next, p.config.min, p.config.max))}
      />
      {p.config.suffix ? (
        <span className="font-sans text-ui text-gray-11">{p.config.suffix}</span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @tickets/ui test -- src/forms/inputs/number`
Expected: PASS, 7 tests

If the clamp tests fail because the primitive already clamps on its own before calling `onChange`, keep the clamp here anyway — it is what makes this adapter correct independent of the primitive's internals — and adjust the test's expected call count, not the expected value.

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/forms/inputs/number
git commit -m "feat(ui): number form input with config-driven clamping"
```

---

### Task 6: select and multi-select inputs

**Files:**
- Create: `packages/web/ui/src/forms/inputs/select/select-input.tsx`, `select-input.test.tsx`
- Create: `packages/web/ui/src/forms/inputs/multi-select/multi-select-input.tsx`, `multi-select-input.test.tsx`

**Interfaces:**
- Consumes: `InputProps` (type-only); `Combobox`, `MultiCombobox` from the components barrel; `ComboOption` from `../../../components/combobox-list`
- Produces: `SelectInput`, `SelectInputConfig`, `MultiSelectInput`, `MultiSelectInputConfig` — registered in Task 9 under `select` (`defaultValue: null`) and `multi-select` (`defaultValue: []`)

**Deliberate divergence from items-core — read before implementing.** items-core's `SelectInput` takes `loadOptions` and `searchable`. Neither is ported:

- **`loadOptions` is unnecessary here.** `@tickets/form` resolves async config itself: `useResolvedConfig` in `runtime/walk-tree.tsx` turns an `AsyncResolver` in the authored config into a resolved value plus a `loading` flag, which arrives as `InputProps.loading`. So an author writes `options: { fn: …, dependsOn: […] }` and this adapter only ever sees a resolved `ComboOption[]`. A second async mechanism inside the input would duplicate the engine's.
- **`searchable` is not supported** — `components/combobox` has no search affordance. Do not add one in this task; if a form needs it, that is a change to the `Combobox` primitive, on its own.

Exact primitive signatures:

```ts
type ComboOption = { value: string; label: string; color?: HueTone; disabled?: boolean };

// Combobox
{ options: ComboOption[]; value: string | null; onChange: (value: string | null) => void;
  placeholder?: string; size?: FieldSize; tone?: Tone; disabled?: boolean; className?: string }

// MultiCombobox
{ options: ComboOption[]; value: string[]; onChange: (value: string[]) => void;
  placeholder?: string; size?: FieldSize; tone?: Tone; disabled?: boolean;
  maxChips?: number; className?: string }
```

Neither has `onBlur` or `name`. Same wrapper-div technique as Task 5.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/ui/src/forms/inputs/select/select-input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectInput } from './select-input';

const OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
];
const base = { name: 'priority', loading: false, onBlur: vi.fn(), config: { options: OPTIONS } };

describe('SelectInput', () => {
  it('shows the selected option', () => {
    render(<SelectInput {...base} value="high" onChange={vi.fn()} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('reports the option the user picks', async () => {
    const onChange = vi.fn();
    render(<SelectInput {...base} value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('Low'));
    expect(onChange).toHaveBeenCalledWith('low');
  });

  it('tolerates config whose options have not resolved yet', () => {
    render(<SelectInput {...base} config={{}} value={null} onChange={vi.fn()} loading />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled while the engine resolves async config', () => {
    render(<SelectInput {...base} value={null} onChange={vi.fn()} loading />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when the engine says so', () => {
    render(<SelectInput {...base} value={null} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

Create `packages/web/ui/src/forms/inputs/multi-select/multi-select-input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MultiSelectInput } from './multi-select-input';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
const base = { name: 'labels', loading: false, onBlur: vi.fn(), config: { options: OPTIONS } };

describe('MultiSelectInput', () => {
  it('shows every selected option', () => {
    render(<MultiSelectInput {...base} value={['a', 'b']} onChange={vi.fn()} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('adds the option the user picks to the existing selection', async () => {
    const onChange = vi.fn();
    render(<MultiSelectInput {...base} value={['a']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('treats an unset value as an empty selection', () => {
    render(
      <MultiSelectInput {...base} value={undefined as unknown as string[]} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is disabled while the engine resolves async config', () => {
    render(<MultiSelectInput {...base} value={[]} onChange={vi.fn()} loading />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm --filter @tickets/ui test -- src/forms/inputs/select src/forms/inputs/multi-select`
Expected: FAIL — imports unresolved

- [ ] **Step 3: Implement both**

Create `packages/web/ui/src/forms/inputs/select/select-input.tsx`:

```tsx
import type { InputProps } from '@tickets/form';
import type { ComboOption } from '../../../components/combobox-list';
import { Combobox } from '../../../components/combobox';

export type SelectInputConfig = {
  /** Resolved options. An author may declare this as an AsyncResolver in the
   *  form config; the engine resolves it and flips `loading` while it does, so
   *  this adapter only ever sees a settled array. */
  options?: ComboOption[];
  placeholder?: string;
};

export function SelectInput(p: InputProps<SelectInputConfig, string | null>) {
  return (
    <div onBlur={p.onBlur}>
      <Combobox
        options={p.config.options ?? []}
        value={p.value ?? null}
        placeholder={p.config.placeholder}
        // Disabled while async options are in flight, or the trigger would open
        // onto an empty list and read as "no options" rather than "not yet".
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={p.onChange}
      />
    </div>
  );
}
```

Create `packages/web/ui/src/forms/inputs/multi-select/multi-select-input.tsx`:

```tsx
import type { InputProps } from '@tickets/form';
import type { ComboOption } from '../../../components/combobox-list';
import { MultiCombobox } from '../../../components/multi-combobox';

export type MultiSelectInputConfig = {
  /** Resolved options — see SelectInputConfig. */
  options?: ComboOption[];
  placeholder?: string;
  maxChips?: number;
};

export function MultiSelectInput(p: InputProps<MultiSelectInputConfig, string[]>) {
  return (
    <div onBlur={p.onBlur}>
      <MultiCombobox
        options={p.config.options ?? []}
        value={p.value ?? []}
        placeholder={p.config.placeholder}
        maxChips={p.config.maxChips}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={p.onChange}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @tickets/ui test -- src/forms/inputs/select src/forms/inputs/multi-select`
Expected: PASS, 9 tests

If a click-to-open assertion fails because the popover needs the jsdom stubs, check `src/test/setup.ts` — it already installs the radix overlay stubs the other overlay tests rely on. Do not add stubs inside the test file.

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/forms/inputs/select packages/web/ui/src/forms/inputs/multi-select
git commit -m "feat(ui): select and multi-select form inputs over the combobox primitives"
```

---

### Task 7: toggle and json inputs

**Files:**
- Create: `packages/web/ui/src/forms/inputs/toggle/toggle-input.tsx`, `toggle-input.test.tsx`
- Create: `packages/web/ui/src/forms/inputs/json/json-input.tsx`, `json-input.test.tsx`

**Interfaces:**
- Consumes: `InputProps` (type-only); `Switch`, `Textarea`, `FieldError` from the components
- Produces: `ToggleInput`, `ToggleInputConfig`, `JsonInput`, `JsonInputConfig` — registered in Task 9 under `toggle` (`defaultValue: false`) and `json` (`defaultValue: ''`)

**Switch's signature differs from items-core's.** It is a native checkbox underneath, not a radix `onCheckedChange` control, and its `label` is **required**:

```ts
type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  label: string;              // required, renders as visible inline text
  size?: ToggleSize;
  tone?: Tone;
};
```

So the adapter uses `checked` + `onChange`, and takes an optional `label` from config for the inline text beside the switch. `FieldWrapper` already renders the field caption above, so this inline label is a second, optional piece of copy — default it to `''`.

`toggle` calls `onBlur()` right after `onChange`: a switch is toggled and never blurred in the ordinary way, so without this the engine would never mark the field touched and its validation would never surface.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/ui/src/forms/inputs/toggle/toggle-input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToggleInput } from './toggle-input';

const base = { name: 'notify', loading: false, onBlur: vi.fn(), config: {} };

describe('ToggleInput', () => {
  it('reflects the current value', () => {
    render(<ToggleInput {...base} value onChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('reports the flipped value', async () => {
    const onChange = vi.fn();
    render(<ToggleInput {...base} value={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  // A switch is toggled, not blurred — without this the engine never marks the
  // field touched and its validation message never appears.
  it('marks the field touched on toggle', async () => {
    const onBlur = vi.fn();
    render(<ToggleInput {...base} onBlur={onBlur} value={false} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onBlur).toHaveBeenCalled();
  });

  it('renders the inline label when configured', () => {
    render(<ToggleInput {...base} config={{ label: 'Email me' }} value={false} onChange={vi.fn()} />);
    expect(screen.getByText('Email me')).toBeInTheDocument();
  });

  it('is disabled when the engine says so', () => {
    render(<ToggleInput {...base} value={false} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
```

Create `packages/web/ui/src/forms/inputs/json/json-input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JsonInput } from './json-input';

const base = { name: 'payload', loading: false, onBlur: vi.fn(), config: {} };

describe('JsonInput', () => {
  it('reports the raw text, valid or not', async () => {
    const onChange = vi.fn();
    render(<JsonInput {...base} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), '{');
    expect(onChange).toHaveBeenLastCalledWith('{');
  });

  it('complains about unparseable JSON', () => {
    render(<JsonInput {...base} value="{ nope" onChange={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toMatch(/^Invalid JSON:/);
  });

  it('accepts valid JSON without complaint', () => {
    render(<JsonInput {...base} value='{"a":1}' onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('treats empty and whitespace-only as unset rather than invalid', () => {
    const { rerender } = render(<JsonInput {...base} value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<JsonInput {...base} value="   " onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // The parse error must track external resets, not just typing.
  it('clears the complaint when the value is replaced with valid JSON', () => {
    const { rerender } = render(<JsonInput {...base} value="{ nope" onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<JsonInput {...base} value="[]" onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('defaults to twelve rows and honours an override', () => {
    const { rerender } = render(<JsonInput {...base} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '12');
    rerender(<JsonInput {...base} config={{ rows: 4 }} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4');
  });

  it('turns off spellcheck, which would underline every JSON key', () => {
    render(<JsonInput {...base} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('spellcheck', 'false');
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `pnpm --filter @tickets/ui test -- src/forms/inputs/toggle src/forms/inputs/json`
Expected: FAIL — imports unresolved

- [ ] **Step 3: Implement both**

Create `packages/web/ui/src/forms/inputs/toggle/toggle-input.tsx`:

```tsx
import type { InputProps } from '@tickets/form';
import { Switch } from '../../../components/switch';

export type ToggleInputConfig = {
  /** Inline copy beside the switch. The field's caption is rendered above by
   *  FieldWrapper, so this is a second, optional piece of text. */
  label?: string;
};

export function ToggleInput(p: InputProps<ToggleInputConfig, boolean>) {
  return (
    <Switch
      id={p.name}
      name={p.name}
      label={p.config.label ?? ''}
      checked={Boolean(p.value)}
      disabled={p.disabled}
      onChange={(e) => {
        p.onChange(e.target.checked);
        // A switch is toggled, never blurred, so touch it here or the engine
        // will never surface this field's validation.
        p.onBlur();
      }}
    />
  );
}
```

Create `packages/web/ui/src/forms/inputs/json/json-input.tsx`:

```tsx
import type { InputProps } from '@tickets/form';
import { FieldError } from '../../../components/field-error';
import { Textarea } from '../../../components/textarea';
import { Stack } from '../../../components/stack';

export type JsonInputConfig = {
  rows?: number;
  placeholder?: string;
};

/** Parse result for the current text. Empty and whitespace-only count as unset
 *  — an author clearing the field is not authoring bad JSON. */
function parseError(value: string | undefined): string | null {
  if (!value || value.trim() === '') return null;
  try {
    JSON.parse(value);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * The value channel is the raw text, not the parsed object, so a half-typed
 * document survives a re-render and the author can fix it in place.
 *
 * The parse runs during render rather than in an effect: it is a pure function
 * of the current value, so an effect would only add a frame where the message
 * disagrees with the text on screen — including after an external reset.
 */
export function JsonInput(p: InputProps<JsonInputConfig, string>) {
  const error = parseError(p.value);
  return (
    <Stack gap={1}>
      <Textarea
        id={p.name}
        name={p.name}
        rows={p.config.rows ?? 12}
        spellCheck={false}
        value={p.value ?? ''}
        placeholder={p.config.placeholder}
        disabled={p.disabled}
        tone={error || p.error ? 'danger' : undefined}
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
        className="font-mono"
      />
      {error ? <FieldError>Invalid JSON: {error}</FieldError> : null}
    </Stack>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @tickets/ui test -- src/forms/inputs/toggle src/forms/inputs/json`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/forms/inputs/toggle packages/web/ui/src/forms/inputs/json
git commit -m "feat(ui): toggle and json form inputs"
```

---

### Task 8: form layouts

**Files:**
- Create: `packages/web/ui/src/forms/layouts.tsx`, `layouts.test.tsx`

**Interfaces:**
- Consumes: `LayoutComponentProps` (type-only) from `@tickets/form`; `Card`, `CardHeader`, `CardTitle`, `CardBody` (Task 2); `Stack`, `Row` (Task 1)
- Produces: `CardLayout`, `GroupLayout`, `RowLayout`, `ColumnLayout` — registered in Task 9 under `card`, `group`, `row`, `column`

**Engine type:**

```ts
interface LayoutComponentProps<TProps> { props: TProps; children: ReactNode }
```

- [ ] **Step 1: Write the failing test**

Create `packages/web/ui/src/forms/layouts.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardLayout, ColumnLayout, GroupLayout, RowLayout } from './layouts';

describe('form layouts', () => {
  it('CardLayout renders its title and children inside a card', () => {
    render(
      <CardLayout props={{ title: 'Details' }}>
        <span>field</span>
      </CardLayout>,
    );
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByText('field')).toBeInTheDocument();
  });

  it('CardLayout renders a description under the title', () => {
    render(
      <CardLayout props={{ title: 'Details', description: 'Who and when' }}>
        <span>field</span>
      </CardLayout>,
    );
    expect(screen.getByText('Who and when')).toBeInTheDocument();
  });

  it('CardLayout omits the header entirely when given no title or description', () => {
    render(<CardLayout props={{}}><span>field</span></CardLayout>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('field')).toBeInTheDocument();
  });

  it('GroupLayout renders its title and children', () => {
    render(
      <GroupLayout props={{ title: 'Advanced' }}>
        <span>field</span>
      </GroupLayout>,
    );
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('field')).toBeInTheDocument();
  });

  it('GroupLayout omits its header when given neither title nor description', () => {
    render(<GroupLayout props={{}}><span>field</span></GroupLayout>);
    expect(screen.getByText('field')).toBeInTheDocument();
  });

  it('RowLayout renders its children', () => {
    render(<RowLayout props={{}}><span>a</span><span>b</span></RowLayout>);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('ColumnLayout renders its children', () => {
    render(<ColumnLayout props={{}}><span>a</span><span>b</span></ColumnLayout>);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @tickets/ui test -- src/forms/layouts.test.tsx`
Expected: FAIL — `Failed to resolve import "./layouts"`

- [ ] **Step 3: Implement the layouts**

Create `packages/web/ui/src/forms/layouts.tsx`:

```tsx
import type { LayoutComponentProps } from '@tickets/form';
import { Card, CardBody, CardHeader, CardTitle } from '../components/card';
import { Row } from '../components/row';
import { Stack } from '../components/stack';

type TitledProps = { title?: string; description?: string };
type BareProps = Record<string, never>;

/** A titled panel. Card keeps `padding` at its 0 default so CardHeader's rule
 *  bleeds to both edges; CardBody supplies the content padding. */
export function CardLayout({ props, children }: LayoutComponentProps<TitledProps>) {
  const hasHeader = Boolean(props.title || props.description);
  return (
    <Card>
      {hasHeader ? (
        <CardHeader>
          <Stack gap={1}>
            {props.title ? <CardTitle>{props.title}</CardTitle> : null}
            {props.description ? (
              <span className="font-sans text-12/17 text-gray-11">{props.description}</span>
            ) : null}
          </Stack>
        </CardHeader>
      ) : null}
      <CardBody>
        <Stack gap={4}>{children}</Stack>
      </CardBody>
    </Card>
  );
}

/** A subdivision inside a panel: a rule, a caption, then the fields. Lighter
 *  than CardLayout — it draws no surface of its own. */
export function GroupLayout({ props, children }: LayoutComponentProps<TitledProps>) {
  const hasHeader = Boolean(props.title || props.description);
  return (
    <Stack gap={2}>
      {hasHeader ? (
        <Stack gap={1} className="border-t border-gray-6 pt-3">
          {props.title ? (
            <span className="font-sans text-ui font-semibold text-gray-12">{props.title}</span>
          ) : null}
          {props.description ? (
            <span className="font-sans text-12/17 text-gray-11">{props.description}</span>
          ) : null}
        </Stack>
      ) : null}
      <Stack gap={4}>{children}</Stack>
    </Stack>
  );
}

/** Fields side by side. `align="start"` so a field with an error message does
 *  not drag its neighbours' controls downward as the message appears. */
export function RowLayout({ children }: LayoutComponentProps<BareProps>) {
  return (
    <Row gap={4} align="start">
      {children}
    </Row>
  );
}

/** Fields stacked. Same spacing as RootWrapper, so a nested column is
 *  indistinguishable from the top level — which is the point. */
export function ColumnLayout({ children }: LayoutComponentProps<BareProps>) {
  return <Stack gap={4}>{children}</Stack>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @tickets/ui test -- src/forms/layouts.test.tsx`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/forms/layouts.tsx packages/web/ui/src/forms/layouts.test.tsx
git commit -m "feat(ui): card, group, row and column form layouts"
```

---

### Task 9: registry, barrel and demo

**Files:**
- Create: `packages/web/ui/src/forms/registry.ts`, `index.ts`, `forms.demo.tsx`
- Modify: `packages/web/ui/src/index.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–8
- Produces: `baseInputs`, `baseLayouts`, and re-exports of `FieldWrapper`, `RootWrapper` and every input/layout — consumed by Task 10

**Default values, one per key.** These must match each adapter's value channel exactly or the engine seeds a field with the wrong type: `text` `''` · `textarea` `''` · `number` `null` · `select` `null` · `multi-select` `[]` · `toggle` `false` · `json` `''`.

**Ship the maps, NOT an assembled registry.** An earlier draft exported a ready-made `formRegistry` built with `defineRegistry`. It is cut: apps/web needs a `directory` input and so assembles its own from these maps in Task 10, which left the packaged one with no consumer and a second copy of the wiring to keep in sync. **`@tickets/ui` therefore makes no `defineRegistry` call and imports nothing from `@tickets/form` at runtime** — every remaining engine import in this package is `import type`. Do not reintroduce it.

- [ ] **Step 1: Write the failing test**

Create `packages/web/ui/src/forms/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { baseInputs, baseLayouts } from './registry';

describe('form registry maps', () => {
  it('registers every input the package ships', () => {
    expect(Object.keys(baseInputs).sort()).toEqual(
      ['json', 'multi-select', 'number', 'select', 'text', 'textarea', 'toggle'],
    );
  });

  it('registers every layout the package ships', () => {
    expect(Object.keys(baseLayouts).sort()).toEqual(['card', 'column', 'group', 'row']);
  });

  // A default whose type disagrees with its adapter's value channel seeds the
  // field wrong and only surfaces at runtime, so pin them here.
  it('seeds each input with a default matching its value channel', () => {
    expect(baseInputs.text.defaultValue).toBe('');
    expect(baseInputs.textarea.defaultValue).toBe('');
    expect(baseInputs.json.defaultValue).toBe('');
    expect(baseInputs.number.defaultValue).toBeNull();
    expect(baseInputs.select.defaultValue).toBeNull();
    expect(baseInputs['multi-select'].defaultValue).toEqual([]);
    expect(baseInputs.toggle.defaultValue).toBe(false);
  });

  it('gives every input a component', () => {
    for (const [key, def] of Object.entries(baseInputs)) {
      expect(def.Component, key).toBeTypeOf('function');
    }
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm --filter @tickets/ui test -- src/forms/registry.test.ts`
Expected: FAIL — `Failed to resolve import "./registry"`

- [ ] **Step 3: Implement the registry**

Create `packages/web/ui/src/forms/registry.ts`:

```ts
import { JsonInput } from './inputs/json/json-input';
import { MultiSelectInput } from './inputs/multi-select/multi-select-input';
import { NumberFormInput } from './inputs/number/number-input';
import { SelectInput } from './inputs/select/select-input';
import { TextInput } from './inputs/text/text-input';
import { TextareaInput } from './inputs/textarea/textarea-input';
import { ToggleInput } from './inputs/toggle/toggle-input';
import { CardLayout, ColumnLayout, GroupLayout, RowLayout } from './layouts';

/** The standard input set. Apps spread this and add their own — see
 *  apps/web/src/form/registry.tsx, which adds `directory`. Each defaultValue
 *  matches its adapter's value channel; a mismatch seeds the field wrong. */
export const baseInputs = {
  text: { Component: TextInput, defaultValue: '' },
  textarea: { Component: TextareaInput, defaultValue: '' },
  number: { Component: NumberFormInput, defaultValue: null },
  select: { Component: SelectInput, defaultValue: null },
  'multi-select': { Component: MultiSelectInput, defaultValue: [] as string[] },
  toggle: { Component: ToggleInput, defaultValue: false },
  json: { Component: JsonInput, defaultValue: '' },
};

export const baseLayouts = {
  card: { Component: CardLayout },
  group: { Component: GroupLayout },
  row: { Component: RowLayout },
  column: { Component: ColumnLayout },
};
```

There is deliberately no `defineRegistry` call here — see the note above. The
app assembles the registry, because only the app knows about `directory`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @tickets/ui test -- src/forms/registry.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Add the forms barrel and export it from the package**

Create `packages/web/ui/src/forms/index.ts`:

```ts
export * from './field-wrapper';
export * from './root-wrapper';
export * from './layouts';
export * from './registry';
export * from './inputs/text/text-input';
export * from './inputs/textarea/textarea-input';
export * from './inputs/number/number-input';
export * from './inputs/select/select-input';
export * from './inputs/multi-select/multi-select-input';
export * from './inputs/toggle/toggle-input';
export * from './inputs/json/json-input';
```

In `packages/web/ui/src/index.ts`, add after the `./components` line:

```ts
export * from './forms';
```

- [ ] **Step 6: Add a demo covering the whole set**

Create `packages/web/ui/src/forms/forms.demo.tsx`:

```tsx
import { useState } from 'react';
import { FieldWrapper } from './field-wrapper';
import { JsonInput } from './inputs/json/json-input';
import { MultiSelectInput } from './inputs/multi-select/multi-select-input';
import { NumberFormInput } from './inputs/number/number-input';
import { SelectInput } from './inputs/select/select-input';
import { TextInput } from './inputs/text/text-input';
import { TextareaInput } from './inputs/textarea/textarea-input';
import { ToggleInput } from './inputs/toggle/toggle-input';
import { CardLayout, GroupLayout } from './layouts';
import { Stack } from '../components/stack';

export const meta = { title: 'Form inputs', group: 'Forms', size: 'md' };

const OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const noop = () => {};
const shared = { loading: false, onBlur: noop, disabled: false };

function Demo() {
  const [text, setText] = useState('');
  const [num, setNum] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [on, setOn] = useState(false);
  const [json, setJson] = useState('{ "a": 1 }');
  return (
    <CardLayout props={{ title: 'New ticket', description: 'Every registered input' }}>
      <FieldWrapper name="title" label="Title" required touched={false} loading={false}>
        <TextInput {...shared} name="title" config={{ placeholder: 'Short summary' }} value={text} onChange={setText} />
      </FieldWrapper>
      <FieldWrapper name="body" label="Description" required={false} touched={false} loading={false}>
        <TextareaInput {...shared} name="body" config={{ rows: 3 }} value="" onChange={noop} />
      </FieldWrapper>
      <FieldWrapper name="estimate" label="Estimate" required={false} touched={false} loading={false}
        description="Rounded to whole hours">
        <NumberFormInput {...shared} name="estimate" config={{ min: 0, max: 40, suffix: 'hours' }} value={num} onChange={setNum} />
      </FieldWrapper>
      <FieldWrapper name="priority" label="Priority" required={false} touched={false} loading={false}>
        <SelectInput {...shared} name="priority" config={{ options: OPTIONS }} value={sel} onChange={setSel} />
      </FieldWrapper>
      <FieldWrapper name="labels" label="Labels" required={false} touched={false} loading={false}>
        <MultiSelectInput {...shared} name="labels" config={{ options: OPTIONS }} value={multi} onChange={setMulti} />
      </FieldWrapper>
      <FieldWrapper name="notify" label="Notify" required={false} touched={false} loading={false}>
        <ToggleInput {...shared} name="notify" config={{ label: 'Email me on change' }} value={on} onChange={setOn} />
      </FieldWrapper>
      <GroupLayout props={{ title: 'Advanced' }}>
        <FieldWrapper name="payload" label="Payload" required={false} touched={false} loading={false}>
          <JsonInput {...shared} name="payload" config={{ rows: 4 }} value={json} onChange={setJson} />
        </FieldWrapper>
      </GroupLayout>
    </CardLayout>
  );
}

export const states = [
  { name: 'All inputs', render: () => <Demo /> },
  {
    name: 'Error and description',
    render: () => (
      <Stack gap={4} className="w-96">
        <FieldWrapper name="a" label="With description" required={false} touched={false} loading={false}
          description="Shown until an error replaces it">
          <TextInput {...shared} name="a" config={{}} value="" onChange={noop} />
        </FieldWrapper>
        <FieldWrapper name="b" label="Touched with error" required touched loading={false} error="Required">
          <TextInput {...shared} name="b" config={{}} value="" onChange={noop} error="Required" />
        </FieldWrapper>
      </Stack>
    ),
  },
  {
    name: 'Invalid JSON',
    render: () => (
      <div className="w-96">
        <JsonInput {...shared} name="j" config={{ rows: 4 }} value="{ nope" onChange={noop} />
      </div>
    ),
  },
];
```

- [ ] **Step 7: Run the whole package, typecheck, and the token gate**

Run: `pnpm --filter @tickets/ui test`
Expected: PASS, no regressions

Run: `pnpm --filter @tickets/ui typecheck`
Expected: exit 0

Run: `pnpm --filter @tickets/ui tokens:verify`
Expected: exit 0

- [ ] **Step 8: Commit**

```bash
git add packages/web/ui/src/forms packages/web/ui/src/index.ts
git commit -m "feat(ui): form registry, barrel and gallery demo"
```

---

### Task 10: shrink the apps/web registry

**Files:**
- Modify: `apps/web/src/form/registry.tsx`
- Verify: `apps/web/src/form/registry.test.tsx`, `apps/web/src/components/terminal/new-session-dialog.tsx`

**Interfaces:**
- Consumes: `baseInputs`, `baseLayouts`, `FieldWrapper`, `RootWrapper` from `@tickets/ui`
- Produces: `formRegistry`, `AppFormRegistry` — unchanged names, so `new-session-dialog.tsx` needs no edit

`DirectoryPicker` stays in `apps/web/src/components/terminal/` — it imports terminal components and calls `/api/workdir-roots`, and moving it into `@tickets/ui` would break `components/domain-free.test.ts`.

- [ ] **Step 1: Read the current file and its test**

Run: `cat apps/web/src/form/registry.tsx apps/web/src/form/registry.test.tsx`

Note what the existing test asserts. It must keep passing unchanged — if it asserts the inline field wrapper's markup, that assertion is now covered by `field-wrapper.test.tsx` in the package and the app-side one should be deleted rather than rewritten. Anything else stays.

- [ ] **Step 2: Rewrite the registry**

Replace the whole of `apps/web/src/form/registry.tsx` with:

```tsx
import { defineRegistry, type InputProps } from '@tickets/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@tickets/ui';

import { DirectoryPicker } from '../components/terminal/directory-picker';

/** The one input the shared package cannot own: DirectoryPicker reaches into
 *  the terminal components and calls /api/workdir-roots, and @tickets/ui is
 *  domain-free by test. */
function DirectoryInput(p: InputProps<Record<string, never>, string>) {
  return (
    <DirectoryPicker
      value={p.value ?? ''}
      onChange={(next) => {
        p.onChange(next);
        p.onBlur();
      }}
    />
  );
}

export const formRegistry = defineRegistry({
  inputs: { ...baseInputs, directory: { Component: DirectoryInput, defaultValue: '' } },
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

export type AppFormRegistry = typeof formRegistry;
```

- [ ] **Step 3: Run the app's form tests**

Run: `pnpm --filter @tickets/web test -- src/form`
Expected: PASS

- [ ] **Step 4: Run the new-session-dialog tests**

Run: `pnpm --filter @tickets/web test -- src/components/terminal`
Expected: PASS — the dialog's registry keys are unchanged, so it should not need edits

- [ ] **Step 5: Run the full checks**

Run: `pnpm typecheck`
Expected: exit 0

Run: `pnpm --filter @tickets/web test`
Expected: PASS

Run: `pnpm build`
Expected: exit 0

- [ ] **Step 6: Verify in the running app**

Start the stack per the `running-the-stack` skill, open the new-session dialog, and confirm the directory picker and text field both still work. The registry now also carries six inputs nothing renders yet — that is expected.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/form/registry.tsx apps/web/src/form/registry.test.tsx
git commit -m "refactor(web): build the app form registry from @tickets/ui's base maps"
```

---

## Self-Review

**Spec coverage.** Every clause of the spec's Card, Stack/Row and form sections maps to a task: layout primitives → Tasks 1–2; `src/forms/` tree → Tasks 3–9; the apps/web registry → Task 10. The spec's table sections (`@tickets/table`, the ui adapter, all-items) are deliberately out of this plan and belong to Plan 2.

**Three corrections to the spec, found while checking the real primitive signatures.** The spec should be treated as superseded on these points:

1. **`select`/`multi-select` drop `loadOptions` and `searchable`.** The engine already resolves async config (`useResolvedConfig` → `loading`), so `loadOptions` would duplicate it; `Combobox` has no search affordance, so `searchable` has nothing to switch on.
2. **`number`'s value channel is `number | null`, not `number | undefined`**, because that is what the `NumberInput` primitive exposes. Its registry default is `null`. `select`'s is `null` for the same reason.
3. **`Switch` takes native `checked`/`onChange` and a required `label`**, not radix's `onCheckedChange`. The `toggle` config gained an optional `label` for the inline copy.

**Placeholder scan.** No TBD/TODO, no "add error handling", no "similar to Task N". Every code step carries the actual code. The one conditional instruction — Task 5 Step 4's note about the primitive possibly clamping already — states exactly what to change and what not to.

**Type consistency.** `Gap` is defined in Task 1 and reused as `Padding` in Task 2 and by every layout in Task 8. `NumberFormInput` is named consistently in Tasks 5 and 9 (deliberately not `NumberInput`, which is the primitive). `baseInputs`/`baseLayouts` are produced in Task 9 and consumed in Task 10 under those exact names. The `InputProps`/`FieldWrapperProps`/`LayoutComponentProps` shapes are reproduced verbatim from `packages/web/form/src/types/registry.ts`, not from memory.
