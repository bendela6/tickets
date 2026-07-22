# Rich Text Editor & Content System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the markdown write/preview editor and hand-rolled renderer with a Tiptap-based WYSIWYG rich text system across descriptions, comments, and rich-text fields, per `docs/superpowers/specs/2026-07-22-rich-text-editor-design.md`.

**Architecture:** A new `@tickets/richtext` workspace package owns the document schema (a feature registry of Tiptap extensions + markdown conversion rules + toolbar descriptors) and Node-safe converters (`markdownToDoc`, `docToMarkdown`, `docToText`). Docs are stored as serialized Tiptap JSON in the existing text columns, detected by shape, with legacy markdown converted lazily. The web app gets `RichTextEditor`/`RichTextView` components; the API gets a Postgres-backed attachments store; the MCP converts markdown⇄doc at its boundary with an optional `format: 'rich'` passthrough.

**Tech Stack:** Tiptap v3 (`@tiptap/react`, `@tiptap/core`, extensions), Fastify v5, Drizzle + Postgres, React 19 + TanStack Query, vitest + testing-library. **No markdown-it / prosemirror-markdown**: converters are hand-rolled ports of the existing `render-markdown.ts` parser (same proven subset), emitting/consuming Tiptap `JSONContent` directly — zero DOM needed, works in Node.

## Global Constraints

- Package naming `@tickets/*`, `"private": true`, `"type": "module"`, **no build step** — `"exports": { ".": "./src/index.ts" }` (model: `packages/db/package.json`).
- Test runner is vitest everywhere; web tests use jsdom + `@testing-library/react` with setup `apps/web/src/test/setup.ts`.
- Conventional commits scoped by package/app: `feat(richtext): …`, `feat(api): …`, `feat(web): …`, `feat(mcp): …`, `feat(db): …`. One commit per task minimum; commit after each green test cycle.
- `@tickets/richtext` must be **Node-safe**: no `document`/`window` at import time or inside converters (Tiptap extension *definitions* are Node-safe; only mounting an editor needs a DOM).
- API mutations normally use the command envelope (`commandId` + `actorId` via `parseEnvelope`/`runCommand`). Attachments deliberately bypass it (blob store, not a domain command) — raw-body routes.
- The stored-doc sentinel is exactly the string prefix `{"type":"doc"` — used by `isRichDoc` and nothing else; never write a second detection rule.
- Tiptap installs were approved in brainstorming (add-package comparison, 2026-07-22). Any dependency **outside** the `@tiptap/*` family still requires the add-package skill gate.
- Tailwind preflight is ON; style with Instrument tokens (ink/ink-2/ink-3, hairline, raised, accent, text-meta/text-ui, rounded-[10px]).
- After every task: `pnpm typecheck` must pass.
- Visual design gate: the Claude Design pass for the editor (prompt at `docs/design/prompts/rich-text-editor.md`) had **not** landed when this plan was written. Tasks 8–10 build to a baseline Instrument look; when the design is pulled via DesignSync, re-verify Task 8's visuals against it (tracked in Task 13).

---

### Task 1: Scaffold `@tickets/richtext` — detection + plain-text helpers

**Files:**
- Create: `packages/richtext/package.json`
- Create: `packages/richtext/tsconfig.json`
- Create: `packages/richtext/vitest.config.ts`
- Create: `packages/richtext/src/index.ts`
- Create: `packages/richtext/src/detect.ts`
- Create: `packages/richtext/src/doc-to-text.ts`
- Test: `packages/richtext/src/detect.test.ts`, `packages/richtext/src/doc-to-text.test.ts`

**Interfaces:**
- Consumes: nothing (leaf package; no tiptap dependency yet — these helpers operate on plain JSON).
- Produces:
  - `type DocNode = { type: string; attrs?: Record<string, unknown>; content?: DocNode[]; marks?: { type: string; attrs?: Record<string, unknown> }[]; text?: string }`
  - `isRichDoc(text: string): boolean` — true iff `text` starts with `{"type":"doc"` and parses as JSON.
  - `parseDoc(text: string): DocNode | null` — parsed doc or null (invalid JSON / wrong shape).
  - `docToText(doc: DocNode): string` — plain-text extraction (blocks joined by `\n`, inline text concatenated).
  - `isDocEmpty(doc: DocNode): boolean` — true when the doc has no text and no atom nodes (image/mention/ticketRef).

- [ ] **Step 1: Scaffold the package**

`packages/richtext/package.json`:
```json
{
  "name": "@tickets/richtext",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```
(If the repo does not use pnpm catalogs, copy the exact `typescript`/`vitest` versions from `packages/db/package.json` instead.)

`packages/richtext/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src"]
}
```

`packages/richtext/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
```

Run: `pnpm install` (links the new workspace package).

- [ ] **Step 2: Write failing tests for detect + doc-to-text**

`packages/richtext/src/detect.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isDocEmpty, isRichDoc, parseDoc } from './detect';

const doc = (content: object[]) => JSON.stringify({ type: 'doc', content });
const para = (text?: string) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });

describe('isRichDoc', () => {
  it('accepts a serialized doc', () => {
    expect(isRichDoc(doc([para('hi')]))).toBe(true);
  });
  it('rejects markdown, empty string, and doc-prefixed garbage', () => {
    expect(isRichDoc('# heading\n\ntext')).toBe(false);
    expect(isRichDoc('')).toBe(false);
    expect(isRichDoc('{"type":"doc" oops')).toBe(false);
  });
});

describe('parseDoc', () => {
  it('parses a valid doc and rejects non-docs', () => {
    expect(parseDoc(doc([para('hi')]))?.type).toBe('doc');
    expect(parseDoc('# md')).toBeNull();
    expect(parseDoc('{"type":"paragraph"}')).toBeNull();
  });
});

describe('isDocEmpty', () => {
  it('empty paragraph doc is empty; text or atoms are not', () => {
    expect(isDocEmpty({ type: 'doc', content: [para()] })).toBe(true);
    expect(isDocEmpty({ type: 'doc', content: [para('x')] })).toBe(false);
    expect(
      isDocEmpty({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: '/a' } }] }] }),
    ).toBe(false);
  });
});
```

`packages/richtext/src/doc-to-text.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { docToText } from './doc-to-text';

describe('docToText', () => {
  it('joins blocks with newlines and concatenates inline text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold' },
            { type: 'ticketRef', attrs: { id: 'TIX-1', label: 'TIX-1' } },
          ],
        },
      ],
    };
    expect(docToText(doc)).toBe('Title\nbold TIX-1');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @tickets/richtext test`
Expected: FAIL — cannot resolve `./detect` / `./doc-to-text`.

- [ ] **Step 4: Implement**

`packages/richtext/src/detect.ts`:
```ts
export type DocMark = { type: string; attrs?: Record<string, unknown> };
export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
};

const SENTINEL = '{"type":"doc"';
const ATOMS = new Set(['image', 'mention', 'ticketRef']);

export function isRichDoc(text: string): boolean {
  return parseDoc(text) !== null;
}

export function parseDoc(text: string): DocNode | null {
  if (!text.startsWith(SENTINEL)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && (parsed as DocNode).type === 'doc') {
      return parsed as DocNode;
    }
  } catch {
    // fall through
  }
  return null;
}

export function isDocEmpty(doc: DocNode): boolean {
  const walk = (node: DocNode): boolean => {
    if (node.text !== undefined && node.text.trim().length > 0) {
      return false;
    }
    if (ATOMS.has(node.type)) {
      return false;
    }
    return (node.content ?? []).every(walk);
  };
  return (doc.content ?? []).every(walk);
}
```

`packages/richtext/src/doc-to-text.ts`:
```ts
import type { DocNode } from './detect';

// Atom nodes contribute their visible label so search/excerpts still match.
function inlineText(node: DocNode): string {
  if (node.text !== undefined) {
    return node.text;
  }
  if (node.type === 'mention' || node.type === 'ticketRef') {
    return String(node.attrs?.['label'] ?? '');
  }
  return (node.content ?? []).map(inlineText).join('');
}

const BLOCKS = new Set([
  'paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock',
  'callout', 'detailsSummary', 'detailsContent', 'tableRow',
]);

export function docToText(doc: DocNode): string {
  const lines: string[] = [];
  const walk = (node: DocNode) => {
    if (BLOCKS.has(node.type) && (node.content ?? []).every((child) => child.text !== undefined || !BLOCKS.has(child.type))) {
      const text = inlineText(node).trim();
      if (text.length > 0) {
        lines.push(text);
      }
      return;
    }
    for (const child of node.content ?? []) {
      walk(child);
    }
  };
  walk(doc);
  return lines.join('\n');
}
```

Note the test expects `'bold TIX-1'` — inline atoms are separated from adjacent text by a single space. Adjust `inlineText` accordingly: join text runs and atom labels with `' '` only between a text run and an atom (implement by mapping children to strings and joining non-empty parts with `' '` when either side is an atom; simplest correct version: collect parts, then `parts.join(' ')` where parts are per-child non-empty strings — do that and make the test's paragraph produce `bold TIX-1`).

`packages/richtext/src/index.ts`:
```ts
export { isRichDoc, parseDoc, isDocEmpty } from './detect';
export type { DocNode, DocMark } from './detect';
export { docToText } from './doc-to-text';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tickets/richtext test` → PASS. Then `pnpm typecheck`.

- [ ] **Step 6: Commit**

```bash
git add packages/richtext
git commit -m "feat(richtext): scaffold package with doc detection and plain-text extraction"
```

---

### Task 2: Tiptap deps + feature registry + `buildExtensions`

**Files:**
- Modify: `packages/richtext/package.json` (add tiptap deps)
- Create: `packages/richtext/src/features.ts`
- Create: `packages/richtext/src/registry.ts`
- Create: `packages/richtext/src/build-extensions.ts`
- Test: `packages/richtext/src/build-extensions.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `type Feature = 'marks' | 'link' | 'headings' | 'lists' | 'taskList' | 'blockquote' | 'codeBlock' | 'table' | 'details' | 'callout' | 'align' | 'image' | 'mentions' | 'divider'`
  - `const PRESETS: { full: Feature[]; compact: Feature[] }` — full = all features; compact = `['marks','link','lists','taskList','codeBlock','mentions','image']`.
  - `type ToolbarControl = { id: string; group: 'marks' | 'blocks' | 'insert' }` — data-only descriptors; the web maps `id` → icon + editor command.
  - `type FeatureEntry = { extensions: (features: Set<Feature>) => AnyExtension[]; toolbar: ToolbarControl[] }` (markdown hooks are added in Tasks 4–5).
  - `buildExtensions(features: Feature[]): AnyExtension[]` — assembles StarterKit config + per-feature extensions. Always includes the base schema (doc/paragraph/text/hardBreak/history).
  - `toolbarControls(features: Feature[]): ToolbarControl[]` — ordered controls for the given features.

- [ ] **Step 1: Verify Tiptap v3 package names, then install**

The `@tiptap/*` family was approved in brainstorming. Verify exact package layout before installing (v3 consolidated some extensions into StarterKit):
```bash
npm view @tiptap/starter-kit version
npm view @tiptap/extension-task-list version
npm view @tiptap/extension-task-item version
npm view @tiptap/extension-details version
npm view @tiptap/extension-table version
npm view @tiptap/extension-image version
npm view @tiptap/extension-mention version
npm view @tiptap/extension-text-style version
npm view @tiptap/extension-text-align version
npm view @tiptap/extension-highlight version
```
Then check what StarterKit already bundles (v3 includes Link and Underline; if so do NOT install them separately):
```bash
npm view @tiptap/starter-kit dependencies
```
Install into the richtext package (add any of underline/link/color as separate packages ONLY if absent from the StarterKit/text-style dependency lists):
```bash
pnpm --filter @tickets/richtext add @tiptap/core @tiptap/pm @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-details @tiptap/extension-table @tiptap/extension-image @tiptap/extension-mention @tiptap/extension-text-style @tiptap/extension-text-align @tiptap/extension-highlight
```

- [ ] **Step 2: Write the failing test**

`packages/richtext/src/build-extensions.test.ts`:
```ts
import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { buildExtensions, toolbarControls } from './build-extensions';
import { PRESETS } from './features';

describe('buildExtensions', () => {
  it('full preset yields a schema containing every feature node', () => {
    const schema = getSchema(buildExtensions(PRESETS.full));
    for (const node of ['heading', 'bulletList', 'taskList', 'taskItem', 'codeBlock', 'table', 'details', 'image']) {
      expect(schema.nodes[node], node).toBeDefined();
    }
    expect(schema.marks['highlight']).toBeDefined();
  });

  it('compact preset omits headings, details, table, align', () => {
    const schema = getSchema(buildExtensions(PRESETS.compact));
    expect(schema.nodes['heading']).toBeUndefined();
    expect(schema.nodes['details']).toBeUndefined();
    expect(schema.nodes['table']).toBeUndefined();
    expect(schema.nodes['taskList']).toBeDefined();
  });

  it('toolbar controls follow the feature list', () => {
    const full = toolbarControls(PRESETS.full).map((c) => c.id);
    const compact = toolbarControls(PRESETS.compact).map((c) => c.id);
    expect(full).toContain('heading');
    expect(compact).not.toContain('heading');
    expect(compact).toContain('bold');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @tickets/richtext test` → FAIL (modules missing).

- [ ] **Step 4: Implement features + registry + builder**

`packages/richtext/src/features.ts`:
```ts
export type Feature =
  | 'marks' | 'link' | 'headings' | 'lists' | 'taskList' | 'blockquote'
  | 'codeBlock' | 'table' | 'details' | 'callout' | 'align' | 'image'
  | 'mentions' | 'divider';

export const ALL_FEATURES: Feature[] = [
  'marks', 'link', 'headings', 'lists', 'taskList', 'blockquote',
  'codeBlock', 'table', 'details', 'callout', 'align', 'image',
  'mentions', 'divider',
];

export const PRESETS: { full: Feature[]; compact: Feature[] } = {
  full: ALL_FEATURES,
  compact: ['marks', 'link', 'lists', 'taskList', 'codeBlock', 'mentions', 'image'],
};
```

`packages/richtext/src/registry.ts` — the extensibility seam. Each feature is one entry; adding a future custom node means adding one entry here (plus its markdown rules in Tasks 4–5 dispatch tables):
```ts
import type { AnyExtension } from '@tiptap/core';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import type { Feature } from './features';

export type ToolbarControl = { id: string; group: 'marks' | 'blocks' | 'insert' };

export type FeatureEntry = {
  // StarterKit-covered features return []; standalone extensions return instances.
  extensions: () => AnyExtension[];
  toolbar: ToolbarControl[];
};

export const REGISTRY: Record<Feature, FeatureEntry> = {
  marks: {
    extensions: () => [TextStyle, Highlight.configure({ multicolor: true })],
    toolbar: [
      { id: 'bold', group: 'marks' }, { id: 'italic', group: 'marks' },
      { id: 'underline', group: 'marks' }, { id: 'strike', group: 'marks' },
      { id: 'code', group: 'marks' }, { id: 'highlight', group: 'marks' },
      { id: 'color', group: 'marks' },
    ],
  },
  link: { extensions: () => [], toolbar: [{ id: 'link', group: 'marks' }] },
  headings: { extensions: () => [], toolbar: [{ id: 'heading', group: 'blocks' }] },
  lists: {
    extensions: () => [],
    toolbar: [{ id: 'bulletList', group: 'blocks' }, { id: 'orderedList', group: 'blocks' }],
  },
  taskList: {
    extensions: () => [TaskList, TaskItem.configure({ nested: true })],
    toolbar: [{ id: 'taskList', group: 'blocks' }],
  },
  blockquote: { extensions: () => [], toolbar: [{ id: 'blockquote', group: 'blocks' }] },
  codeBlock: { extensions: () => [], toolbar: [{ id: 'codeBlock', group: 'blocks' }] },
  table: {
    extensions: () => [Table, TableRow, TableHeader, TableCell],
    toolbar: [{ id: 'table', group: 'blocks' }],
  },
  details: {
    extensions: () => [Details, DetailsSummary, DetailsContent],
    toolbar: [{ id: 'details', group: 'blocks' }],
  },
  callout: { extensions: () => [], toolbar: [{ id: 'callout', group: 'blocks' }] }, // node added in Task 3
  align: {
    extensions: () => [TextAlign.configure({ types: ['heading', 'paragraph'] })],
    toolbar: [{ id: 'align', group: 'blocks' }],
  },
  image: { extensions: () => [Image], toolbar: [{ id: 'image', group: 'insert' }] },
  mentions: { extensions: () => [], toolbar: [] }, // configured per-surface in Task 3
  divider: { extensions: () => [], toolbar: [{ id: 'horizontalRule', group: 'blocks' }] },
};
```

`packages/richtext/src/build-extensions.ts`:
```ts
import type { AnyExtension } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import type { Feature } from './features';
import { REGISTRY, type ToolbarControl } from './registry';

export function buildExtensions(features: Feature[]): AnyExtension[] {
  const on = new Set(features);
  const starterKit = StarterKit.configure({
    heading: on.has('headings') ? { levels: [1, 2, 3] } : false,
    bulletList: on.has('lists') ? undefined : false,
    orderedList: on.has('lists') ? undefined : false,
    listItem: on.has('lists') || on.has('taskList') ? undefined : false,
    blockquote: on.has('blockquote') ? undefined : false,
    codeBlock: on.has('codeBlock') ? undefined : false,
    horizontalRule: on.has('divider') ? undefined : false,
    bold: on.has('marks') ? undefined : false,
    italic: on.has('marks') ? undefined : false,
    strike: on.has('marks') ? undefined : false,
    code: on.has('marks') ? undefined : false,
    underline: on.has('marks') ? undefined : false,
    link: on.has('link') ? { openOnClick: false } : false,
  });
  const extra = features.flatMap((feature) => REGISTRY[feature].extensions());
  return [starterKit, ...extra];
}

export function toolbarControls(features: Feature[]): ToolbarControl[] {
  return features.flatMap((feature) => REGISTRY[feature].toolbar);
}
```
(If StarterKit v3's option keys differ — e.g. no `underline`/`link` keys — install `@tiptap/extension-underline` / keep Link separate and move them into the `marks`/`link` registry entries instead. The test is the arbiter: schema must contain the right nodes/marks per preset.)

Export from `src/index.ts`:
```ts
export { buildExtensions, toolbarControls } from './build-extensions';
export { PRESETS, ALL_FEATURES } from './features';
export type { Feature } from './features';
export { REGISTRY } from './registry';
export type { FeatureEntry, ToolbarControl } from './registry';
```

- [ ] **Step 5: Run tests** → PASS; `pnpm typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/richtext
git commit -m "feat(richtext): feature registry, presets, and buildExtensions over tiptap v3"
```

---

### Task 3: Custom nodes — Callout, TicketRef, user Mention

**Files:**
- Create: `packages/richtext/src/nodes/callout.ts`
- Create: `packages/richtext/src/nodes/refs.ts`
- Modify: `packages/richtext/src/registry.ts` (wire callout + mentions entries)
- Test: `packages/richtext/src/nodes/nodes.test.ts`

**Interfaces:**
- Consumes: `REGISTRY`, `buildExtensions` from Task 2.
- Produces:
  - `Callout` — block node, name `'callout'`, `content: 'paragraph+'`, attrs `{ kind: 'info' | 'warning' | 'success' | 'danger' }` (default `'info'`), rendered as `<div data-callout="<kind>">`.
  - `TicketRef` — `Mention.extend({ name: 'ticketRef' })`, attrs `{ id: string | null, label: string }` (label is the display key, e.g. `TIX-123`), suggestion char `'#'`, rendered as `<span data-ticket-ref="<label>">#<label></span>`.
  - `UserMention` — the stock Mention (name `'mention'`), suggestion char `'@'`, rendered as `<span data-mention="<label>">@<label></span>`.
  - `type SuggestionHooks = { mention?: Partial<SuggestionOptions>; ticketRef?: Partial<SuggestionOptions> }` and `buildExtensions(features, hooks?: SuggestionHooks)` — the web passes suggestion item sources/renderers; converters pass none.

- [ ] **Step 1: Write the failing test**

`packages/richtext/src/nodes/nodes.test.ts`:
```ts
import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { buildExtensions } from '../build-extensions';
import { PRESETS } from '../features';

describe('custom nodes', () => {
  const schema = getSchema(buildExtensions(PRESETS.full));

  it('callout is a block with kind attr', () => {
    const callout = schema.nodes['callout'];
    expect(callout).toBeDefined();
    expect(callout!.spec.attrs).toHaveProperty('kind');
  });

  it('ticketRef and mention are inline atoms with label attr', () => {
    for (const name of ['ticketRef', 'mention']) {
      const node = schema.nodes[name];
      expect(node, name).toBeDefined();
      expect(node!.spec.inline).toBe(true);
      expect(node!.spec.attrs).toHaveProperty('label');
    }
  });
});
```

- [ ] **Step 2: Run to verify failure** → `callout` undefined.

- [ ] **Step 3: Implement the nodes**

`packages/richtext/src/nodes/callout.ts`:
```ts
import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutKind = 'info' | 'warning' | 'success' | 'danger';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  addAttributes() {
    return { kind: { default: 'info' as CalloutKind, parseHTML: (el) => el.getAttribute('data-callout') } };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': node.attrs['kind'] }), 0];
  },
  addCommands() {
    return {
      toggleCallout:
        (kind: CalloutKind = 'info') =>
        ({ commands, editor }) =>
          editor.isActive('callout')
            ? commands.lift('callout')
            : commands.wrapIn('callout', { kind }),
    };
  },
});
```
(Declare the command in a `declare module '@tiptap/core'` block per Tiptap's command-typing pattern.)

`packages/richtext/src/nodes/refs.ts`:
```ts
import { Mention } from '@tiptap/extension-mention';
import type { SuggestionOptions } from '@tiptap/suggestion';

export type SuggestionHooks = {
  mention?: Partial<SuggestionOptions>;
  ticketRef?: Partial<SuggestionOptions>;
};

export function userMention(hook?: Partial<SuggestionOptions>) {
  return Mention.configure({
    renderHTML: ({ node }) => ['span', { 'data-mention': node.attrs['label'] }, `@${node.attrs['label']}`],
    suggestion: { char: '@', ...hook },
  });
}

export const TicketRefBase = Mention.extend({ name: 'ticketRef' });

export function ticketRef(hook?: Partial<SuggestionOptions>) {
  return TicketRefBase.configure({
    renderHTML: ({ node }) => ['span', { 'data-ticket-ref': node.attrs['label'] }, `#${node.attrs['label']}`],
    suggestion: { char: '#', ...hook },
  });
}
```
(`@tiptap/suggestion` ships as a dependency of the Mention extension in v3; if `pnpm` refuses the deep import, add `@tiptap/suggestion` to the richtext package explicitly — still the approved family.)

Wire into `registry.ts`: `callout.extensions: () => [Callout]`; change `buildExtensions(features, hooks?: SuggestionHooks)` so `mentions.extensions` becomes `() => [userMention(hooks?.mention), ticketRef(hooks?.ticketRef)]` (pass `hooks` through `REGISTRY` by making `extensions` receive them: `extensions: (hooks?: SuggestionHooks) => AnyExtension[]`). Export `Callout`, `userMention`, `ticketRef`, `SuggestionHooks`, `CalloutKind` from `src/index.ts`.

- [ ] **Step 4: Run tests** → PASS; typecheck → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/richtext
git commit -m "feat(richtext): callout, ticket-ref, and user-mention nodes"
```

---

### Task 4: `markdownToDoc`

**Files:**
- Create: `packages/richtext/src/markdown-to-doc.ts`
- Create: `packages/richtext/src/inline-parse.ts`
- Test: `packages/richtext/src/markdown-to-doc.test.ts`

**Interfaces:**
- Consumes: `DocNode` from Task 1.
- Produces:
  - `markdownToDoc(md: string): DocNode` — never throws; unknown syntax becomes plain paragraphs. Covers the legacy `render-markdown.ts` subset (h1–h3, `-`/`*` and `1.` lists, GFM tables, ``` fences, `**bold**`, `` `code` ``, `[text](url)` links) plus `_italic_`, `~~strike~~`, `- [ ]`/`- [x]` task lists, `![alt](url)` images, `#TIX-123` ticket refs, `@name` mentions.
  - `toDisplayDoc(text: string): DocNode` — `parseDoc(text) ?? markdownToDoc(text)`; the single entry point every consumer uses to display stored content.
  - `parseInline(text: string): DocNode[]` (from `inline-parse.ts`) — tokenizes one line into text/atom nodes with marks.

- [ ] **Step 1: Write the failing test**

`packages/richtext/src/markdown-to-doc.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { markdownToDoc, toDisplayDoc } from './markdown-to-doc';

describe('markdownToDoc', () => {
  it('parses headings, paragraphs, and inline marks', () => {
    const doc = markdownToDoc('## Title\n\nSome **bold** and `code` and [a link](https://x.dev).');
    expect(doc.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    const inline = doc.content?.[1]?.content ?? [];
    expect(inline.some((n) => n.marks?.some((m) => m.type === 'bold'))).toBe(true);
    expect(inline.some((n) => n.marks?.some((m) => m.type === 'code'))).toBe(true);
    expect(inline.some((n) => n.marks?.some((m) => m.type === 'link'))).toBe(true);
  });

  it('parses bullet, ordered, and task lists', () => {
    const doc = markdownToDoc('- a\n- [x] done\n- [ ] open\n\n1. one');
    const types = (doc.content ?? []).map((n) => n.type);
    expect(types).toContain('bulletList');
    expect(types).toContain('taskList');
    expect(types).toContain('orderedList');
    const task = doc.content!.find((n) => n.type === 'taskList')!.content![0]!;
    expect(task).toMatchObject({ type: 'taskItem', attrs: { checked: true } });
  });

  it('parses fences, tables, and images', () => {
    const doc = markdownToDoc('```\ncode here\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n![alt](/api/attachments/3)');
    const types = (doc.content ?? []).map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(['codeBlock', 'table']));
    expect(JSON.stringify(doc)).toContain('"src":"/api/attachments/3"');
  });

  it('parses ticket refs and mentions as atoms', () => {
    const doc = markdownToDoc('See #TIX-123 and ask @beka.');
    const inline = doc.content![0]!.content!;
    expect(inline.some((n) => n.type === 'ticketRef' && n.attrs?.['label'] === 'TIX-123')).toBe(true);
    expect(inline.some((n) => n.type === 'mention' && n.attrs?.['label'] === 'beka')).toBe(true);
  });

  it('never throws on garbage and legacy heading IDs survive as text', () => {
    expect(() => markdownToDoc('|||\n``` \n **')).not.toThrow();
    const doc = markdownToDoc('# TASK-42: old ticket');
    expect(doc.content?.[0]?.content?.[0]?.text).toContain('TASK-42');
  });
});

describe('toDisplayDoc', () => {
  it('passes docs through and converts markdown', () => {
    const stored = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] });
    expect(toDisplayDoc(stored).content?.[0]?.content?.[0]?.text).toBe('hi');
    expect(toDisplayDoc('# md').content?.[0]?.type).toBe('heading');
  });
});
```
Note the last test: `# TASK-42: old ticket` must yield a heading whose text keeps `TASK-42` — but `#TASK-42` mid-line (no space) is a ticketRef. The heading regex (`^#{1,3}\s`) runs at line level before inline ref parsing, and the ref regex requires `#` immediately followed by the key (no preceding `#` consumed) — mirror the legacy parser's ordering.

- [ ] **Step 2: Run to verify failure** → modules missing.

- [ ] **Step 3: Implement**

`packages/richtext/src/inline-parse.ts` — ordered tokenizer (first match wins, earliest index wins). Port of legacy `inline()` extended with italic/strike/image/refs:
```ts
import type { DocMark, DocNode } from './detect';

type Rule = { pattern: RegExp; toNode: (match: RegExpMatchArray) => DocNode | DocNode[] };

const text = (value: string, marks?: DocMark[]): DocNode =>
  marks && marks.length > 0 ? { type: 'text', text: value, marks } : { type: 'text', text: value };

const RULES: Rule[] = [
  { pattern: /`([^`]+)`/, toNode: (m) => text(m[1]!, [{ type: 'code' }]) },
  { pattern: /!\[([^\]]*)\]\(([^)]+)\)/, toNode: (m) => ({ type: 'image', attrs: { src: m[2]!, alt: m[1] ?? '' } }) },
  { pattern: /\[([^\]]+)\]\(([^)]+)\)/, toNode: (m) => text(m[1]!, [{ type: 'link', attrs: { href: m[2]! } }]) },
  { pattern: /\*\*([^*]+)\*\*/, toNode: (m) => text(m[1]!, [{ type: 'bold' }]) },
  { pattern: /~~([^~]+)~~/, toNode: (m) => text(m[1]!, [{ type: 'strike' }]) },
  { pattern: /(?<![\w*])_([^_]+)_(?!\w)/, toNode: (m) => text(m[1]!, [{ type: 'italic' }]) },
  { pattern: /(?<![\w#])#([A-Z][A-Z0-9]*-\d+)/, toNode: (m) => ({ type: 'ticketRef', attrs: { id: null, label: m[1]! } }) },
  { pattern: /(?<!\w)@([A-Za-z][\w.-]*)/, toNode: (m) => ({ type: 'mention', attrs: { id: null, label: m[1]! } }) },
];

export function parseInline(source: string): DocNode[] {
  if (source.length === 0) {
    return [];
  }
  let best: { index: number; length: number; nodes: DocNode[] } | null = null;
  for (const rule of RULES) {
    const match = source.match(rule.pattern);
    if (match?.index !== undefined && (best === null || match.index < best.index)) {
      const produced = rule.toNode(match);
      best = { index: match.index, length: match[0].length, nodes: Array.isArray(produced) ? produced : [produced] };
    }
  }
  if (best === null) {
    return [text(source)];
  }
  return [
    ...(best.index > 0 ? [text(source.slice(0, best.index))] : []),
    ...best.nodes,
    ...parseInline(source.slice(best.index + best.length)),
  ];
}
```

`packages/richtext/src/markdown-to-doc.ts` — line-based block parser, a direct port of `apps/web/src/lib/render-markdown.ts`'s control flow emitting `DocNode`s instead of HTML strings. Structure (implement fully — same branch order as the legacy renderer: fence → table → heading → task item → unordered → ordered → paragraph):
```ts
import { parseDoc, type DocNode } from './detect';
import { parseInline } from './inline-parse';

const para = (content: DocNode[]): DocNode => ({ type: 'paragraph', content });

export function markdownToDoc(md: string): DocNode {
  const lines = md.split(/\r?\n/);
  const blocks: DocNode[] = [];
  let list: DocNode | null = null;      // current bulletList/orderedList/taskList
  let table: DocNode | null = null;     // current table
  let fence: string[] | null = null;    // lines inside ``` fence

  const closeList = () => { if (list) { blocks.push(list); list = null; } };
  const closeTable = () => { if (table) { blocks.push(table); table = null; } };

  for (const raw of lines) {
    if (raw.startsWith('```')) {
      closeList(); closeTable();
      if (fence) {
        blocks.push({ type: 'codeBlock', content: fence.length ? [{ type: 'text', text: fence.join('\n') }] : [] });
        fence = null;
      } else {
        fence = [];
      }
      continue;
    }
    if (fence) { fence.push(raw); continue; }
    const line = raw.trimEnd();

    const tableRow = line.match(/^\|(.+)\|$/);
    if (tableRow) {
      const cells = tableRow[1]!.split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{3,}:?$/.test(c))) { continue; }
      const cellType = table === null ? 'tableHeader' : 'tableCell';
      const row: DocNode = {
        type: 'tableRow',
        content: cells.map((c) => ({ type: cellType, content: [para(parseInline(c))] })),
      };
      if (table === null) { closeList(); table = { type: 'table', content: [row] }; }
      else { table.content!.push(row); }
      continue;
    }
    closeTable();

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      blocks.push({ type: 'heading', attrs: { level: heading[1]!.length }, content: parseInline(heading[2]!) });
      continue;
    }

    const task = line.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (task) {
      if (list?.type !== 'taskList') { closeList(); list = { type: 'taskList', content: [] }; }
      list.content!.push({ type: 'taskItem', attrs: { checked: task[1]!.toLowerCase() === 'x' }, content: [para(parseInline(task[2]!))] });
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.*)$/);
    if (unordered) {
      if (list?.type !== 'bulletList') { closeList(); list = { type: 'bulletList', content: [] }; }
      list.content!.push({ type: 'listItem', content: [para(parseInline(unordered[1]!))] });
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      if (list?.type !== 'orderedList') { closeList(); list = { type: 'orderedList', content: [] }; }
      list.content!.push({ type: 'listItem', content: [para(parseInline(ordered[1]!))] });
      continue;
    }

    closeList();
    if (line.length > 0) { blocks.push(para(parseInline(line))); }
  }
  closeList(); closeTable();
  if (fence) { blocks.push({ type: 'codeBlock', content: (fence as string[]).length ? [{ type: 'text', text: (fence as string[]).join('\n') }] : [] }); }
  return { type: 'doc', content: blocks.length > 0 ? blocks : [para([])] };
}

export function toDisplayDoc(text: string): DocNode {
  return parseDoc(text) ?? markdownToDoc(text);
}
```

Export both from `src/index.ts`.

- [ ] **Step 4: Run tests** → PASS; typecheck → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/richtext
git commit -m "feat(richtext): markdownToDoc converter covering the legacy renderer subset plus rich atoms"
```

---

### Task 5: `docToMarkdown` + degradation + round-trip

**Files:**
- Create: `packages/richtext/src/doc-to-markdown.ts`
- Test: `packages/richtext/src/doc-to-markdown.test.ts`, `packages/richtext/src/round-trip.test.ts`

**Interfaces:**
- Consumes: `DocNode`, `markdownToDoc`.
- Produces: `docToMarkdown(doc: DocNode): string`. Degradations (spec table): callout → `> **<Kind>:** …` blockquote; details → `**<summary>**` paragraph + content; ticketRef → `#LABEL`; mention → `@label`; underline/highlight/color/align → dropped; taskItem → `- [ ]` / `- [x]`; image → `![alt](src)`; table → GFM pipes. The serializer is a dispatch table `Record<string, (node, ctx) => string>` — a future custom node adds one entry.

- [ ] **Step 1: Write the failing tests**

`packages/richtext/src/doc-to-markdown.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { docToMarkdown } from './doc-to-markdown';

const textNode = (t: string, marks?: object[]) => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const para = (...content: object[]) => ({ type: 'paragraph', content });
const doc = (...content: object[]) => ({ type: 'doc', content }) as never;

describe('docToMarkdown', () => {
  it('serializes marks, links, refs', () => {
    const md = docToMarkdown(doc(para(
      textNode('b', [{ type: 'bold' }]),
      textNode(' plain '),
      textNode('x', [{ type: 'link', attrs: { href: 'https://x.dev' } }]),
      { type: 'ticketRef', attrs: { label: 'TIX-9' } },
    )));
    expect(md).toBe('**b** plain [x](https://x.dev)#TIX-9');
  });

  it('degrades callout and details; drops styling marks', () => {
    const md = docToMarkdown(doc(
      { type: 'callout', attrs: { kind: 'warning' }, content: [para(textNode('careful'))] },
      { type: 'details', content: [
        { type: 'detailsSummary', content: [textNode('More')] },
        { type: 'detailsContent', content: [para(textNode('hidden'))] },
      ] },
      para(textNode('plain', [{ type: 'highlight' }, { type: 'underline' }])),
    ));
    expect(md).toContain('> **Warning:** careful');
    expect(md).toContain('**More**');
    expect(md).toContain('hidden');
    expect(md).toContain('plain');
    expect(md).not.toContain('==');
  });

  it('serializes task lists and tables', () => {
    const md = docToMarkdown(doc(
      { type: 'taskList', content: [
        { type: 'taskItem', attrs: { checked: true }, content: [para(textNode('done'))] },
      ] },
      { type: 'table', content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [para(textNode('h'))] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [para(textNode('v'))] }] },
      ] },
    ));
    expect(md).toContain('- [x] done');
    expect(md).toContain('| h |');
    expect(md).toContain('| --- |');
    expect(md).toContain('| v |');
  });
});
```

`packages/richtext/src/round-trip.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { docToMarkdown } from './doc-to-markdown';
import { markdownToDoc } from './markdown-to-doc';

const SAMPLES = [
  '# Title\n\nA **bold** `code` [link](https://x.dev).',
  '- one\n- two\n\n1. first\n2. second',
  '- [ ] open\n- [x] done',
  '| a | b |\n| --- | --- |\n| 1 | 2 |',
  '```\nconst x = 1;\n```',
  'See #TIX-123 and @beka.',
  '![shot](/api/attachments/7)',
];

describe('markdown round-trip is idempotent after one pass', () => {
  for (const sample of SAMPLES) {
    it(JSON.stringify(sample.slice(0, 30)), () => {
      const once = docToMarkdown(markdownToDoc(sample));
      const twice = docToMarkdown(markdownToDoc(once));
      expect(twice).toBe(once);
    });
  }
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement `doc-to-markdown.ts`**

Dispatch-table walker. Inline serialization wraps text in mark delimiters (`bold`→`**`, `italic`→`_`, `strike`→`~~`, `code`→`` ` ``, `link`→`[text](href)`); unknown marks render bare text. Block table:
```ts
import type { DocNode } from './detect';

const KIND_LABEL: Record<string, string> = { info: 'Info', warning: 'Warning', success: 'Success', danger: 'Danger' };

function inline(nodes: DocNode[] | undefined): string {
  return (nodes ?? []).map((node) => {
    if (node.type === 'ticketRef') { return `#${String(node.attrs?.['label'] ?? '')}`; }
    if (node.type === 'mention') { return `@${String(node.attrs?.['label'] ?? '')}`; }
    if (node.type === 'image') { return `![${String(node.attrs?.['alt'] ?? '')}](${String(node.attrs?.['src'] ?? '')})`; }
    if (node.type === 'hardBreak') { return '\n'; }
    let out = node.text ?? '';
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') { out = `**${out}**`; }
      else if (mark.type === 'italic') { out = `_${out}_`; }
      else if (mark.type === 'strike') { out = `~~${out}~~`; }
      else if (mark.type === 'code') { out = `\`${out}\``; }
      else if (mark.type === 'link') { out = `[${out}](${String(mark.attrs?.['href'] ?? '')})`; }
      // underline / highlight / textStyle(color) / textAlign: dropped
    }
    return out;
  }).join('');
}

type Serializer = (node: DocNode) => string;
const paragraphText = (node: DocNode): string => (node.content ?? []).map((c) => inline(c.content)).join('\n');

const BLOCK_SERIALIZERS: Record<string, Serializer> = {
  paragraph: (n) => inline(n.content),
  heading: (n) => `${'#'.repeat(Number(n.attrs?.['level'] ?? 1))} ${inline(n.content)}`,
  codeBlock: (n) => '```\n' + (n.content?.[0]?.text ?? '') + '\n```',
  blockquote: (n) => serializeBlocks(n.content).split('\n').map((l) => `> ${l}`).join('\n'),
  callout: (n) => `> **${KIND_LABEL[String(n.attrs?.['kind'] ?? 'info')] ?? 'Info'}:** ${paragraphText(n)}`,
  details: (n) => {
    const summary = n.content?.find((c) => c.type === 'detailsSummary');
    const body = n.content?.find((c) => c.type === 'detailsContent');
    return [`**${inline(summary?.content)}**`, serializeBlocks(body?.content)].filter(Boolean).join('\n\n');
  },
  bulletList: (n) => (n.content ?? []).map((li) => `- ${paragraphText(li)}`).join('\n'),
  orderedList: (n) => (n.content ?? []).map((li, i) => `${i + 1}. ${paragraphText(li)}`).join('\n'),
  taskList: (n) => (n.content ?? []).map((ti) => `- [${ti.attrs?.['checked'] === true ? 'x' : ' '}] ${paragraphText(ti)}`).join('\n'),
  horizontalRule: () => '---',
  table: (n) => {
    const rows = n.content ?? [];
    const line = (row: DocNode) => `| ${(row.content ?? []).map((cell) => paragraphText(cell)).join(' | ')} |`;
    const [head, ...rest] = rows;
    if (!head) { return ''; }
    const divider = `| ${(head.content ?? []).map(() => '---').join(' | ')} |`;
    return [line(head), divider, ...rest.map(line)].join('\n');
  },
};

export function serializeBlocks(nodes: DocNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => (BLOCK_SERIALIZERS[node.type] ?? paragraphText)(node))
    .filter((s) => s.length > 0)
    .join('\n\n');
}

export function docToMarkdown(doc: DocNode): string {
  return serializeBlocks(doc.content);
}
```
Fix the first test's expectation while implementing if spacing differs — the *test defines* the contract (`#TIX-9` directly after the link with no space is what the doc contains). Export `docToMarkdown` from `src/index.ts`.

- [ ] **Step 4: Run both test files** → PASS. Run the whole package: `pnpm --filter @tickets/richtext test` → PASS. Typecheck → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/richtext
git commit -m "feat(richtext): docToMarkdown with graceful degradation and round-trip guarantee"
```

---

### Task 6: `attachments` table (`@tickets/db`)

**Files:**
- Create: `packages/db/src/schema/attachments.ts`
- Modify: `packages/db/src/schema/index.ts` (export)
- Modify: `packages/db/src/schema/registry.ts` (add to `allTables`)
- Modify: `apps/eer/models/items-platform.json` (add `attachments` entity — the model-conformance test forces this)
- Create: migration via `pnpm --filter @tickets/db db:generate`

**Interfaces:**
- Consumes: `recordsSchema` from `packages/db/src/schema/schemas.ts`.
- Produces: `attachments` table in the `records` pg schema: `id serial PK`, `filename text notnull`, `mime text notnull`, `size integer notnull`, `data bytea notnull`, `created_at timestamptz notnull default now()`. Exported as `attachments` from `@tickets/db`.

- [ ] **Step 1: Write the schema**

`packages/db/src/schema/attachments.ts`:
```ts
import { customType, integer, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { recordsSchema } from './schemas';

// Drizzle has no built-in bytea; store/retrieve Buffers.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// Editor image uploads. No item FK on purpose: a doc (description, comment,
// rich field) references an attachment by URL, and docs move between items.
export const attachments = recordsSchema.table('attachments', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
```

Add `export { attachments } from './attachments';` to `packages/db/src/schema/index.ts` and add `attachments` to the `allTables` array in `packages/db/src/schema/registry.ts`.

- [ ] **Step 2: Run the conformance test to see the expected failure**

Run: `pnpm --filter @tickets/db test`
Expected: FAIL — model-conformance test reports `attachments` missing from the EER model.

- [ ] **Step 3: Add the entity to `apps/eer/models/items-platform.json`**

Follow the exact JSON shape of an existing small entity in that file (e.g. `comment_reactions`): add an `attachments` entity with attributes `id`, `filename`, `mime`, `size`, `data`, `created_at`, no relationships. Re-run `pnpm --filter @tickets/db test` → PASS.

- [ ] **Step 4: Generate + apply the migration**

```bash
pnpm --filter @tickets/db db:generate   # emits packages/db/drizzle/000N_*.sql
pnpm --filter @tickets/db db:migrate    # applies to the dev DB (POSTGRES_DATABASE=tickets_dev)
```
Inspect the generated SQL: it must contain only `CREATE TABLE "records"."attachments"` — if anything else appears, stop and reconcile before applying.

- [ ] **Step 5: Commit**

```bash
git add packages/db apps/eer/models/items-platform.json
git commit -m "feat(db): attachments table for rich-text image uploads"
```

---

### Task 7: Attachments API routes

**Files:**
- Create: `apps/api/src/routes/attachments.routes.ts`
- Modify: `apps/api/src/app.ts` (register + content-type parsers)
- Test: `apps/api/src/routes/attachments.routes.test.ts` (follow the existing api test style — check how `apps/api/src/agent/driver.test.ts` or a routes test builds the app/db; if routes tests use a test DB helper, reuse it)

**Interfaces:**
- Consumes: `attachments` from `@tickets/db`; `HttpError` from `apps/api/src/errors.ts`.
- Produces:
  - `POST /api/attachments` — body is the raw image bytes, `content-type` one of `image/png|image/jpeg|image/gif|image/webp`, optional `x-filename` header (URI-encoded; default `image.<ext>`), 10 MB limit → `201 { id: number, url: string }` where `url = /api/attachments/<id>`.
  - `GET /api/attachments/:id` → bytes with stored `content-type` and `cache-control: public, max-age=31536000, immutable`; unknown id → 404 `{ error: 'attachment not found' }`.
  - Deliberately **no command envelope** (blob store, not a domain mutation).

- [ ] **Step 1: Write the failing test**

`apps/api/src/routes/attachments.routes.test.ts` (adapt app/db bootstrapping to the repo's existing api-test helper — the assertions are the contract):
```ts
import { describe, expect, it } from 'vitest';
// import the same test-app helper other route tests use, e.g.:
// const app = await buildTestApp();

describe('attachments routes', () => {
  it('uploads an image and serves it back', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic
    const upload = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { 'content-type': 'image/png', 'x-filename': encodeURIComponent('shot.png') },
      payload: bytes,
    });
    expect(upload.statusCode).toBe(201);
    const { id, url } = upload.json() as { id: number; url: string };
    expect(url).toBe(`/api/attachments/${id}`);

    const download = await app.inject({ method: 'GET', url });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('image/png');
    expect(download.headers['cache-control']).toContain('immutable');
    expect(download.rawPayload.equals(bytes)).toBe(true);
  });

  it('rejects non-image content types and 404s unknown ids', async () => {
    const bad = await app.inject({
      method: 'POST', url: '/api/attachments',
      headers: { 'content-type': 'application/pdf' }, payload: Buffer.from('x'),
    });
    expect(bad.statusCode).toBe(415);
    const missing = await app.inject({ method: 'GET', url: '/api/attachments/999999' });
    expect(missing.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure** → 404 on POST (route absent).

- [ ] **Step 3: Implement**

`apps/api/src/routes/attachments.routes.ts`:
```ts
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { attachments } from '@tickets/db';
import { HttpError } from '../errors';
import { parseId } from '../utils/parse-id';

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

export function registerAttachmentsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.post('/api/attachments', { bodyLimit: MAX_BYTES }, async (request, reply) => {
    const mime = (request.headers['content-type'] ?? '').split(';')[0]!.trim();
    if (!IMAGE_MIMES.has(mime)) {
      throw new HttpError(415, `unsupported attachment type: ${mime || '(none)'}`);
    }
    const data = request.body as Buffer;
    if (!Buffer.isBuffer(data) || data.length === 0) {
      throw new HttpError(400, 'empty attachment body');
    }
    const filenameHeader = request.headers['x-filename'];
    const filename = typeof filenameHeader === 'string' && filenameHeader.length > 0
      ? decodeURIComponent(filenameHeader)
      : `image.${mime.split('/')[1]}`;
    const [row] = await db
      .insert(attachments)
      .values({ filename, mime, size: data.length, data })
      .returning({ id: attachments.id });
    reply.status(201).send({ id: row!.id, url: `/api/attachments/${row!.id}` });
  });

  app.get('/api/attachments/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
    if (!row) {
      throw new HttpError(404, 'attachment not found');
    }
    reply
      .header('content-type', row.mime)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .send(row.data);
  });
}
```
(Use the same `Db` type import the other route files use.)

In `apps/api/src/app.ts`: add a raw-buffer content-type parser once, near app construction, and register the routes alongside the others:
```ts
app.addContentTypeParser(
  ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  { parseAs: 'buffer' },
  (_request, body, done) => done(null, body),
);
// …
registerAttachmentsRoutes(app, context);
```

- [ ] **Step 4: Run tests** → PASS (`pnpm --filter @tickets/api test`). Typecheck → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): attachment upload/download routes backed by postgres"
```

---

### Task 8: Web `RichTextEditor` + `RichTextView` + toolbar

**Files:**
- Modify: `apps/web/package.json` (add `@tickets/richtext` workspace dep + `@tiptap/react`)
- Create: `apps/web/src/components/rich-text/rich-text-editor.tsx`
- Create: `apps/web/src/components/rich-text/rich-text-view.tsx`
- Create: `apps/web/src/components/rich-text/toolbar.tsx`
- Modify: `apps/web/src/styles/instrument.css` (add `.rt` content styles next to the existing `.md` block — do not remove `.md` yet)
- Test: `apps/web/src/components/rich-text/rich-text-editor.test.tsx`

**Interfaces:**
- Consumes: `PRESETS`, `buildExtensions`, `toolbarControls`, `toDisplayDoc`, `isDocEmpty`, `SuggestionHooks` from `@tickets/richtext`; `cn` from `../../ui/cn`.
- Produces:
  - `RichTextEditor({ value, disabled, placeholder, onSave, features = 'full', suggestions }: { value: string; disabled?: boolean; placeholder?: string; onSave: (next: string) => void; features?: 'full' | 'compact' | Feature[]; suggestions?: RichTextSuggestions })` — **same save contract as `MarkdownEditor`**: commits on blur only when changed; emits `JSON.stringify(editor.getJSON())`, or `''` when `isDocEmpty` (so call sites' `next.length > 0 ? next : null` keeps working). Accepts markdown or serialized doc as `value` via `toDisplayDoc`.
  - `RichTextView({ value, className }: { value: string; className?: string })` — read-only render of markdown-or-doc using the **full** preset (superset rendering rule).
  - `type RichTextSuggestions = { users?: () => { id: number; label: string }[]; tickets?: (query: string) => { id: number | null; label: string }[] }` (wired fully in Task 9; this task threads the prop through).

- [ ] **Step 1: Add deps**

```bash
pnpm --filter @tickets/web add @tiptap/react
```
and add `"@tickets/richtext": "workspace:*"` to `apps/web/package.json` dependencies, then `pnpm install`.

- [ ] **Step 2: Write the failing test**

`apps/web/src/components/rich-text/rich-text-editor.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './rich-text-editor';
import { RichTextView } from './rich-text-view';

const storedDoc = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'from doc' }] }],
});

describe('RichTextEditor', () => {
  it('renders legacy markdown content', () => {
    render(<RichTextEditor value={'# Legacy\n\nbody'} onSave={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Legacy');
  });

  it('renders stored doc JSON and saves doc JSON on blur when changed', () => {
    const onSave = vi.fn();
    render(<RichTextEditor value={storedDoc} onSave={onSave} />);
    expect(screen.getByText('from doc')).toBeInTheDocument();
    const surface = document.querySelector('[contenteditable="true"]')!;
    fireEvent.blur(surface);
    expect(onSave).not.toHaveBeenCalled(); // unchanged → no save
  });

  it('compact features hide heading control; full shows it', () => {
    const { rerender } = render(<RichTextEditor value="" onSave={vi.fn()} features="full" />);
    expect(screen.getByRole('button', { name: /heading/i })).toBeInTheDocument();
    rerender(<RichTextEditor value="" onSave={vi.fn()} features="compact" />);
    expect(screen.queryByRole('button', { name: /heading/i })).not.toBeInTheDocument();
  });

  it('disabled editor is not editable', () => {
    render(<RichTextEditor value="" onSave={vi.fn()} disabled />);
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
  });
});

describe('RichTextView', () => {
  it('renders a doc with a callout even though views never edit', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'callout', attrs: { kind: 'warning' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'careful' }] }] }],
    });
    render(<RichTextView value={doc} />);
    expect(screen.getByText('careful')).toBeInTheDocument();
    expect(document.querySelector('[data-callout="warning"]')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify failure** → modules missing.

- [ ] **Step 4: Implement**

`rich-text-editor.tsx` core (toolbar in its own file; suggestion wiring lands in Task 9):
```tsx
import { EditorContent, useEditor } from '@tiptap/react';
import { useMemo } from 'react';
import {
  buildExtensions, isDocEmpty, PRESETS, toDisplayDoc, toolbarControls,
  type Feature, type SuggestionHooks,
} from '@tickets/richtext';
import { cn } from '../../ui/cn';
import { Toolbar } from './toolbar';
import { buildSuggestionHooks, type RichTextSuggestions } from './suggestions'; // Task 9; stub returns {}

type RichTextEditorProps = {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onSave: (next: string) => void;
  features?: 'full' | 'compact' | Feature[];
  suggestions?: RichTextSuggestions;
};

function resolveFeatures(features: RichTextEditorProps['features']): Feature[] {
  if (Array.isArray(features)) { return features; }
  return PRESETS[features ?? 'full'];
}

export function RichTextEditor({ value, disabled, placeholder, onSave, features, suggestions }: RichTextEditorProps) {
  const featureList = resolveFeatures(features);
  const extensions = useMemo(
    () => buildExtensions(featureList, buildSuggestionHooks(suggestions)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feature list + suggestion identity are stable per surface
    [],
  );
  const editor = useEditor({
    extensions,
    content: toDisplayDoc(value),
    editable: disabled !== true,
    onBlur: ({ editor: instance }) => {
      const doc = instance.getJSON();
      const next = isDocEmpty(doc as never) ? '' : JSON.stringify(doc);
      if (next !== value) {
        onSave(next);
      }
    },
  });
  return (
    <div className={cn('overflow-hidden rounded-[10px] border bg-raised', editor?.isFocused ? 'border-control' : 'border-hairline')}>
      <Toolbar editor={editor} controls={toolbarControls(featureList)} disabled={disabled} />
      <EditorContent editor={editor} className="rt block min-h-27.5 w-full p-3 font-sans text-ui leading-[1.6] text-ink outline-none" data-placeholder={placeholder} />
    </div>
  );
}
```
Spec error-handling rule: when `value` starts with the doc sentinel but `parseDoc` returns null (corrupt stored doc), `toDisplayDoc` already falls back to plain-paragraph rendering — additionally report it once via the web's signals client (same import the API-error path uses in `apps/web/src/api/client.ts`) so corruption is visible.

Save-comparison subtlety: `value` may be markdown while `next` is doc JSON — an *unchanged* markdown value must not fire `onSave` on blur. Track the initial serialized doc: `const initial = useMemo(() => JSON.stringify(toDisplayDoc(value)), [])` and compare `JSON.stringify(doc) !== initial` instead of `next !== value` (emit `next` as above when it differs). This keeps "no edit → no save" true for both stored formats.

`rich-text-view.tsx`:
```tsx
import { EditorContent, useEditor } from '@tiptap/react';
import { buildExtensions, PRESETS, toDisplayDoc } from '@tickets/richtext';
import { cn } from '../../ui/cn';

// Superset rendering rule: views always load the FULL schema so any stored
// doc renders, regardless of the editing surface's feature config.
export function RichTextView({ value, className }: { value: string; className?: string }) {
  const editor = useEditor({
    extensions: buildExtensions(PRESETS.full),
    content: toDisplayDoc(value),
    editable: false,
  });
  return <EditorContent editor={editor} className={cn('rt', className)} />;
}
```

`toolbar.tsx` — renders control groups from descriptors; every button `type="button"`, `aria-label` = control id, active state via `editor.isActive(...)`, actions via a `Record<string, (editor: Editor) => void>` map (`bold` → `chain().focus().toggleBold().run()`, `heading` → cycle level 1→2→3→paragraph, `callout` → `toggleCallout()`, `image` → click-through to Task 10's uploader, etc.). Group separator: hairline divider between `marks` / `blocks` / `insert` groups. Styling matches the old editor chrome: `px-1.5` bar, `border-b border-hairline`, glyphs in `text-ink-2 hover:text-ink`, active `text-ink bg-accent-subtle`.

`.rt` styles in `instrument.css`: copy the `.md` block's type rules (headings scale, lists, code, tables) as the baseline, add: `[data-callout]` variants (info/warning/success/danger tinted left-border panels), `[data-ticket-ref]`/`[data-mention]` chips (mono, accent-subtle bg, rounded), task-list checkboxes, `details > summary` affordance, selected-node outline, `[data-placeholder]` empty-state. **Baseline only — refine against the Claude Design pull (Task 13).**

- [ ] **Step 5: Run tests** → `pnpm --filter @tickets/web test` PASS (existing markdown-editor tests must still pass — legacy stays until Task 11). Typecheck → PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web packages/richtext
git commit -m "feat(web): RichTextEditor and RichTextView over @tickets/richtext"
```

---

### Task 9: Suggestion popovers (@ users, # tickets) + chips

**Files:**
- Create: `apps/web/src/components/rich-text/suggestions.tsx`
- Modify: `apps/web/src/components/rich-text/rich-text-view.tsx` (chip click → open ticket)
- Test: `apps/web/src/components/rich-text/suggestions.test.tsx`

**Interfaces:**
- Consumes: `SuggestionHooks` from `@tickets/richtext`; Tiptap suggestion callbacks (`items`, `render`, `command`).
- Produces:
  - `type RichTextSuggestions = { users?: () => { id: number; label: string }[]; tickets?: (query: string) => { id: number | null; label: string; title?: string }[] }`
  - `buildSuggestionHooks(s?: RichTextSuggestions): SuggestionHooks` — maps the sources into Mention suggestion configs; when a source is absent that trigger simply never opens.
  - `SuggestionList` — the popover: fixed-position div at the suggestion `clientRect`, rows navigable with ArrowUp/ArrowDown/Enter (the standard Tiptap `render()` keyboard protocol), Instrument styling (raised bg, hairline border, selected row accent-subtle). **No tippy.js** — position from `props.clientRect` with `position: fixed`.
  - `RichTextView` chip behavior: container `onClick` walks `event.target` for `[data-ticket-ref]`; when found calls an optional `onOpenTicket?: (label: string) => void` prop.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/rich-text/suggestions.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './rich-text-editor';

const suggestions = {
  users: () => [{ id: 1, label: 'beka' }, { id: 2, label: 'agent-smith' }],
  tickets: (q: string) => [{ id: 42, label: 'TIX-42', title: 'Fix the thing' }].filter((t) => t.label.includes(q.toUpperCase())),
};

describe('suggestion popovers', () => {
  it('typing @ opens the user list and Enter inserts a mention chip', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} suggestions={suggestions} />);
    const surface = document.querySelector('[contenteditable="true"]')!;
    await user.click(surface);
    await user.keyboard('@be');
    expect(await screen.findByText('beka')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(document.querySelector('[data-mention="beka"]')).not.toBeNull();
  });

  it('typing # opens ticket search and inserts a ticket-ref chip', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} suggestions={suggestions} />);
    await user.click(document.querySelector('[contenteditable="true"]')!);
    await user.keyboard('#42');
    expect(await screen.findByText(/TIX-42/)).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(document.querySelector('[data-ticket-ref="TIX-42"]')).not.toBeNull();
  });
});
```
(jsdom has no layout; `clientRect` may be null — `SuggestionList` must render even with a null rect, defaulting to `left:0/top:0`, which is what lets these tests pass.)

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement `suggestions.tsx`**

Standard Tiptap ReactRenderer-free pattern: `render()` returns handlers that mount a `SuggestionList` into React state owned by a module-level event target — simplest robust version: use Tiptap's `ReactRenderer` from `@tiptap/react` (no extra dep):
```tsx
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionHooks } from '@tickets/richtext';
// SuggestionList: forwardRef component with { items, command } props exposing
// onKeyDown via useImperativeHandle (ArrowUp/Down moves selection, Enter picks).
// buildSuggestionHooks wires: items({query}) → source(query) (users filtered by
// label.includes(query.toLowerCase())), render() → ReactRenderer(SuggestionList),
// command → chain().focus().insertContentAt(range, { type, attrs: {id, label} }).run()
```
Implement fully: `SuggestionList` rows show `@label` / `#label — title`; selected row `bg-accent-subtle text-ink`; popover `fixed z-50 min-w-45 rounded-[10px] border border-hairline bg-raised p-1 shadow-md` positioned from `clientRect?.()`. Mention command inserts `{ type: 'mention', attrs: { id, label } }`; ticket command inserts `{ type: 'ticketRef', attrs: { id, label } }` (Mention's default `command` already does insert+space — reuse it, only override `items` and `render`, and pass attrs from the picked item).

Update Task 8's `rich-text-editor.tsx` to import the real `buildSuggestionHooks` (replacing the stub). Add `onOpenTicket` click-walking to `rich-text-view.tsx`.

- [ ] **Step 4: Run tests** → PASS. Typecheck → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): mention and ticket-ref suggestion popovers with inline chips"
```

---

### Task 10: Image upload (paste / drop / toolbar)

**Files:**
- Create: `apps/web/src/components/rich-text/image-upload.ts`
- Modify: `apps/web/src/components/rich-text/rich-text-editor.tsx` (wire `handlePaste`/`handleDrop` editorProps + toolbar `image` action)
- Test: `apps/web/src/components/rich-text/image-upload.test.ts`

**Interfaces:**
- Consumes: `POST /api/attachments` (Task 7).
- Produces:
  - `uploadImage(file: File): Promise<{ id: number; url: string }>` — `fetch('/api/attachments', { method: 'POST', headers: { 'content-type': file.type, 'x-filename': encodeURIComponent(file.name) }, body: file })`; non-2xx → throws `Error(message from { error })`.
  - Editor behavior: pasted/dropped image files upload then insert `{ type: 'image', attrs: { src: url, alt: filename } }` at the drop/caret position; toolbar `image` control opens a hidden `<input type="file" accept="image/*">`. While uploading, insert nothing (no dangling placeholder — spec error-handling rule); on failure show an inline error line under the editor (same pattern as `detail-comments.tsx`'s `createComment.isError` line).

- [ ] **Step 1: Write the failing test**

`image-upload.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadImage } from './image-upload';

afterEach(() => vi.restoreAllMocks());

describe('uploadImage', () => {
  it('posts raw bytes with mime + filename headers and returns the url', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 7, url: '/api/attachments/7' }), { status: 201 }),
    );
    const file = new File([new Uint8Array([1, 2])], 'shot.png', { type: 'image/png' });
    const result = await uploadImage(file);
    expect(result).toEqual({ id: 7, url: '/api/attachments/7' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/attachments');
    expect((init!.headers as Record<string, string>)['content-type']).toBe('image/png');
    expect((init!.headers as Record<string, string>)['x-filename']).toBe('shot.png');
  });

  it('throws the API error message on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'unsupported attachment type' }), { status: 415 }),
    );
    const file = new File([new Uint8Array([1])], 'x.pdf', { type: 'application/pdf' });
    await expect(uploadImage(file)).rejects.toThrow('unsupported attachment type');
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

`image-upload.ts`:
```ts
export async function uploadImage(file: File): Promise<{ id: number; url: string }> {
  const response = await fetch('/api/attachments', {
    method: 'POST',
    headers: { 'content-type': file.type, 'x-filename': encodeURIComponent(file.name) },
    body: file,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `upload failed (${response.status})`);
  }
  return (await response.json()) as { id: number; url: string };
}
```

Wire into the editor via `editorProps`:
```ts
editorProps: {
  handlePaste: (_view, event) => insertImagesFromFiles(event.clipboardData?.files),
  handleDrop: (_view, event) => insertImagesFromFiles(event.dataTransfer?.files),
},
```
where `insertImagesFromFiles` filters `file.type.startsWith('image/')`, returns `false` when none (so default paste/drop proceeds), otherwise kicks off `uploadImage(file).then((r) => editor.chain().focus().setImage({ src: r.url, alt: file.name }).run()).catch(setUploadError)` and returns `true`. Add `uploadError` state + the inline `text-danger` error line. Toolbar `image` action triggers the hidden file input calling the same path.

- [ ] **Step 4: Run tests** → PASS. Typecheck → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): editor image upload via paste, drop, and toolbar"
```

---

### Task 11: Swap the three call sites + delete legacy

**Files:**
- Modify: `apps/web/src/components/item-detail.tsx:255-263` (description → `RichTextEditor` `features="full"`, pass `suggestions` from `indexes`)
- Modify: `apps/web/src/components/detail-comments.tsx` (comment bodies → `RichTextView`; composer → `RichTextEditor` `features="compact"`)
- Modify: `apps/web/src/registry/field-widget.tsx:56-62` (`config.format === 'markdown' || config.format === 'rich'` → `RichTextEditor`, features from `config.features` array when present else `'full'`)
- Modify: `packages/db/src/seed/software-scheme.ts:66` (`format: 'markdown'` → `format: 'rich'`)
- Delete: `apps/web/src/components/markdown-editor.tsx`, `apps/web/src/components/markdown-editor.test.tsx`, `apps/web/src/lib/render-markdown.ts`
- Modify: `apps/web/src/styles/instrument.css` (delete the `.md` block)
- Test: update `apps/web/src/components/item-drawer.test.tsx`, `new-item-dialog.test.tsx` and any test asserting on markdown-editor DOM (write/preview tabs) to the new editor's DOM

**Interfaces:**
- Consumes: `RichTextEditor`, `RichTextView` (Tasks 8–10); `BoardIndexes` (`indexes.userById`, board items for ticket search).
- Produces: no `MarkdownEditor`/`renderMarkdown` references anywhere (`grep` must return zero hits outside git history).

- [ ] **Step 1: Build the shared suggestions source**

Create `apps/web/src/components/rich-text/board-suggestions.ts`:
```ts
import type { BoardIndexes } from '../../utils/index-board';
import type { RichTextSuggestions } from './suggestions';

export function boardSuggestions(indexes: BoardIndexes): RichTextSuggestions {
  return {
    users: () => [...indexes.userById.values()].map((u) => ({ id: u.id, label: u.name })),
    tickets: (query) => {
      const q = query.toLowerCase();
      return [...indexes.itemByNumber.values()]
        .map((item) => ({ id: item.id, label: `${indexes.projectPrefix}-${item.number}`, title: String(item.values['title'] ?? '') }))
        .filter((t) => t.label.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
        .slice(0, 8);
    },
  };
}
```
(Adapt the exact `BoardIndexes` member names — `itemByNumber` / `projectPrefix` — to what `index-board.ts` actually exposes; read it first. If there is no by-number map, derive from the items array it indexes.)

- [ ] **Step 2: Swap `item-detail.tsx`**

```tsx
<RichTextEditor
  value={typeof item.values[descriptionField.key] === 'string' ? (item.values[descriptionField.key] as string) : ''}
  disabled={userId === null || patch.isPending}
  features="full"
  suggestions={boardSuggestions(indexes)}
  onSave={(next) => saveValues({ [descriptionField.key]: next.length > 0 ? next : null })}
/>
```
(`item-detail.tsx` must have `indexes` in scope — it already receives `BoardIndexes` for other sections; verify the prop name.)

- [ ] **Step 3: Swap `detail-comments.tsx`**

Comment body render (replaces the `dangerouslySetInnerHTML` div):
```tsx
<RichTextView value={comment.body} className="font-sans text-ui leading-[1.55] text-ink" />
```
Composer (same remount-on-post pattern):
```tsx
<RichTextEditor
  key={composerKey}
  value=""
  disabled={userId === null}
  features="compact"
  suggestions={boardSuggestions(indexes)}
  placeholder={userId === null ? 'Pick a user in the header to comment' : 'Comment…'}
  onSave={setBody}
/>
```
Remove the `renderMarkdown` import.

- [ ] **Step 4: Swap `field-widget.tsx`**

```tsx
if (field.type === 'string' && (field.config.format === 'markdown' || field.config.format === 'rich')) {
  return (
    <RichTextEditor
      value={typeof value === 'string' ? value : ''}
      disabled={disabled}
      features={Array.isArray(field.config.features) ? (field.config.features as Feature[]) : 'full'}
      onSave={(next) => onChange(next.length > 0 ? next : null)}
    />
  );
}
```
(No suggestions here — the widget has no board indexes; mentions simply don't trigger. Update `software-scheme.ts` seed `format: 'markdown'` → `'rich'`.)

- [ ] **Step 5: Delete legacy + fix tests**

```bash
git rm apps/web/src/components/markdown-editor.tsx apps/web/src/components/markdown-editor.test.tsx apps/web/src/lib/render-markdown.ts
```
Remove the `.md` CSS block from `instrument.css`. Run `pnpm --filter @tickets/web test`; update failing tests (`item-drawer.test.tsx`, `new-item-dialog.test.tsx`, etc.) to interact with the new editor: type into `[contenteditable="true"]`, assert saved payloads are doc-JSON strings (use `isRichDoc` in assertions rather than exact JSON). Verify zero references:
```bash
grep -rn "MarkdownEditor\|renderMarkdown\|render-markdown" apps/web/src
```
Expected: no output.

- [ ] **Step 6: Full web suite + typecheck** → `pnpm --filter @tickets/web test` PASS, `pnpm typecheck` PASS.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web packages/db
git commit -m "feat(web): rich text everywhere — swap all three surfaces, delete markdown editor/renderer"
```

---

### Task 12: MCP boundary — markdown default, `format: 'rich'` passthrough

**Files:**
- Modify: `apps/mcp/package.json` (add `"@tickets/richtext": "workspace:*"`)
- Create: `apps/mcp/src/helpers/rich-content.ts`
- Modify: `apps/mcp/src/tools/add-comment.ts`, `create-ticket.ts`, `update-ticket.ts`, `get-ticket.ts`, `search-tickets.ts`
- Test: `apps/mcp/src/helpers/rich-content.test.ts`

**Interfaces:**
- Consumes: `markdownToDoc`, `docToMarkdown`, `isRichDoc`, `docToText`, `parseDoc` from `@tickets/richtext`; board field definitions (each field has `type` + `config`).
- Produces (`rich-content.ts`):
  - `type ContentFormat = 'markdown' | 'rich'`
  - `encodeBody(body: string, format: ContentFormat): string` — `'markdown'` → `JSON.stringify(markdownToDoc(body))`; `'rich'` → validate with `parseDoc` (throw `Error('format \"rich\" requires a serialized tiptap doc')` when invalid) and pass through.
  - `decodeBody(stored: string, format: ContentFormat): string` — `'markdown'` → `isRichDoc(stored) ? docToMarkdown(parseDoc(stored)!) : stored`; `'rich'` → `isRichDoc(stored) ? stored : JSON.stringify(markdownToDoc(stored))`.
  - `encodeValues(values: Record<string, unknown>, fields: FieldDef[], format: ContentFormat)` / `decodeValues(...)` — apply encode/decodeBody to values whose field is `type === 'string'` with `config.format === 'rich' || 'markdown'`.
  - `searchableText(stored: string): string` — `isRichDoc(stored) ? docToText(parseDoc(stored)!) : stored`.
- Tool changes: `add_comment`, `create_ticket`, `update_ticket` gain `format: z.enum(['markdown', 'rich']).optional()` (default `'markdown'`) and encode on write; `get_ticket` gains the same param and decodes description-family values + comment bodies on read; `search_tickets` matches `query` against `searchableText(...)` of string values.

- [ ] **Step 1: Write the failing test**

`apps/mcp/src/helpers/rich-content.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decodeBody, encodeBody, searchableText } from './rich-content';

const storedDoc = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello', marks: [{ type: 'bold' }] }] }],
});

describe('encodeBody', () => {
  it('markdown encodes to a serialized doc', () => {
    const encoded = encodeBody('**hello**', 'markdown');
    expect(encoded.startsWith('{"type":"doc"')).toBe(true);
  });
  it('rich passes a valid doc through and rejects non-docs', () => {
    expect(encodeBody(storedDoc, 'rich')).toBe(storedDoc);
    expect(() => encodeBody('not a doc', 'rich')).toThrow(/serialized tiptap doc/);
  });
});

describe('decodeBody', () => {
  it('markdown decodes stored docs and passes legacy markdown through', () => {
    expect(decodeBody(storedDoc, 'markdown')).toBe('**hello**');
    expect(decodeBody('# legacy', 'markdown')).toBe('# legacy');
  });
  it('rich returns the doc, converting legacy markdown', () => {
    expect(decodeBody(storedDoc, 'rich')).toBe(storedDoc);
    expect(decodeBody('# legacy', 'rich').startsWith('{"type":"doc"')).toBe(true);
  });
});

describe('searchableText', () => {
  it('extracts plain text from docs, passes markdown through', () => {
    expect(searchableText(storedDoc)).toBe('hello');
    expect(searchableText('plain md')).toBe('plain md');
  });
});
```

- [ ] **Step 2: Run to verify failure** (`pnpm --filter @tickets/mcp test` — check the mcp package's actual test script name first; if it has none, add `"test": "vitest run"` + a minimal `vitest.config.ts` matching the db package's).

- [ ] **Step 3: Implement `rich-content.ts` + wire the five tools**

`rich-content.ts` per the interface block above (straight composition of richtext exports; ~50 lines). Tool wiring:
- `add-comment.ts`: add `format` to inputSchema; `body: encodeBody(body, format ?? 'markdown')` in the POST payload.
- `create-ticket.ts` / `update-ticket.ts`: after loading the board (both already do, for ticket resolution), pass its field list to `encodeValues(values, fields, format ?? 'markdown')`.
- `get-ticket.ts`: decode with `decodeValues`/`decodeBody` before returning; include `format` in the input schema.
- `search-tickets.ts`: where the in-memory filter matches `query` against value strings, wrap the haystack in `searchableText(...)`.

- [ ] **Step 4: Run tests** → PASS. Typecheck → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mcp
git commit -m "feat(mcp): markdown default with rich-doc passthrough at the tool boundary"
```

---

### Task 13: Full verification + deploy

**Files:** none new — verification, smoke, deploy.

- [ ] **Step 1: Full check suite**

```bash
pnpm typecheck
pnpm --filter @tickets/richtext test
pnpm --filter @tickets/db test
pnpm --filter @tickets/api test
pnpm --filter @tickets/web test
pnpm --filter @tickets/mcp test
pnpm build
```
All green before proceeding.

- [ ] **Step 2: Manual smoke against the dev stack** (use the running-the-stack skill for ports/URLs)

- Open an existing migrated ticket (legacy markdown description with old-ID heading) → renders correctly in the editor; edit one word, blur, reload → value now stored as doc JSON, still renders.
- Comment with `@` mention + `#` ticket ref + a pasted image → chips render, image displays, ref chip opens the ticket.
- A rich-text custom field renders and saves.
- MCP: `get_ticket` on the edited ticket returns markdown (heading + text, image as `![](…)`); `add_comment` with markdown shows rich in the web.

- [ ] **Step 3: Design reconciliation**

If the Claude Design pass (prompt: `docs/design/prompts/rich-text-editor.md`) has landed by now: pull via the syncing-design skill, update `docs/design/design-system.html`, and reconcile `.rt` styles/toolbar against it (verifying-a-component skill). If it has not landed, note it as an open follow-up in the final report — do not block deploy.

- [ ] **Step 4: Deploy at the phase boundary**

```bash
docker compose up -d --build
```
Smoke `:4610` once up.

- [ ] **Step 5: Final commit if reconciliation changed anything; report**

```bash
git add -A && git commit -m "chore(web): rich text design reconciliation + deploy"
```
