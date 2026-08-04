import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { HUE_TOKEN, hueToken } from './hue-token';

// This test exists because the hue -> token path spans three packages and no
// single one of them can see the whole chain: @tickets/db names the hues,
// @tickets/ui declares the tokens, and apps/web is the only place that has to
// turn one into the other. Everything in between compiles and every unit test
// passes with a hue whose token is never emitted — the failure is a custom
// property that resolves to nothing at paint time, which took a whole-branch
// CSS-bundle review to spot the first time round.
//
// Files, not imports: apps/web deliberately takes no dependency on @tickets/db
// (see erd-types.ts's header — the web bundle must not pull the db package in),
// and tokens.css is CSS. Reading them as text is the only way one test sees
// both ends. That also means this test is checking the REAL sources, not a
// restatement of them.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../../..');
const read = (p: string) => readFileSync(join(repoRoot, p), 'utf8');

const schemaGroupsSrc = read('packages/db/src/schema/schema-groups.ts');
const groupTablesSrc = read('packages/db/src/schema/introspect/group-tables.ts');
// The generated stylesheets are split one per token type; colours.css is the
// only one that declares the `--color-*` bridge this test reads.
const tokensCss = read('packages/web/ui/styles/generated/colors.css');

// Curated hues: every `color: '<hue>'` in SCHEMA_GROUPS.
const curatedHues = [...schemaGroupsSrc.matchAll(/^\s*color: '([a-z]+)',$/gm)].map((m) => m[1]!);

// Namespace-fallback hues: the FALLBACK_HUES array literal in group-tables.ts,
// used for any table whose schema the curated config does not know.
const fallbackHues = (groupTablesSrc.match(/const FALLBACK_HUES = \[([^\]]*)\]/)?.[1] ?? '')
  .split(',')
  .map((s) => s.trim().replace(/^'|'$/g, ''))
  .filter(Boolean);

// Token names tokens.css actually declares (the generated `tokens:theme` block
// inside `@theme inline`).
const declaredTokens = new Set(
  [...tokensCss.matchAll(/^\s*(--color-[a-z]+-\d+):/gm)].map((m) => m[1]!),
);

describe('every hue the schema data can produce has a reachable token', () => {
  // Guards against the three regexes above quietly matching nothing and making
  // the real assertions vacuous — the exact way this class of test rots.
  it('actually parsed the hue lists and the token declarations', () => {
    expect(curatedHues.length).toBeGreaterThanOrEqual(7);
    expect(curatedHues).toContain('indigo'); // the largest curated group
    expect(fallbackHues.length).toBeGreaterThanOrEqual(9);
    expect(fallbackHues).toContain('yellow'); // fallback-only, in no curated group
    expect(declaredTokens.size).toBeGreaterThan(50);
  });

  it('maps every SCHEMA_GROUPS colour', () => {
    expect(curatedHues.filter((h) => hueToken(h) === null)).toEqual([]);
  });

  it('maps every namespace-fallback hue', () => {
    expect(fallbackHues.filter((h) => hueToken(h) === null)).toEqual([]);
  });

  it('resolves each mapped hue to a token tokens.css declares', () => {
    // A token string that names a variable @tickets/ui never declares is
    // exactly as broken as no mapping at all: `stroke: var(--edge-c)` with an
    // undefined property is an invalid declaration, so the edge paints
    // `stroke: none` rather than falling back to anything.
    const unreachable = Object.entries(HUE_TOKEN).filter(([, token]) => {
      const name = token.match(/^var\((--color-[a-z]+-\d+)\)$/)?.[1];
      return !name || !declaredTokens.has(name);
    });
    expect(unreachable).toEqual([]);
  });

  it('spells every token out as a literal, which is what makes Tailwind emit it', () => {
    // With `@theme inline` a utility bakes its value in (`bg-indigo-9` compiles
    // to `var(--ins-indigo-9)`), so neither a utility nor a safelist entry puts
    // `--color-indigo-9` in :root — only the exact text `var(--color-indigo-9)`
    // in a scanned file does. Measured: bg-pink-3/purple-3/teal-3/yellow-3 are
    // all safelisted and none of their --color-*-3 variables is emitted.
    // Interpolation here would compile and silently emit nothing.
    const src = read('apps/web/src/components/eer/adapter/hue-token.ts');
    const mapBlock = src.match(/export const HUE_TOKEN[\s\S]*?\n\};/)?.[0] ?? '';
    expect(mapBlock).toContain('blue'); // parsed something
    for (const token of Object.values(HUE_TOKEN)) expect(mapBlock).toContain(token);
    expect(mapBlock).not.toMatch(/var\(--color-\$\{/);
  });
});
