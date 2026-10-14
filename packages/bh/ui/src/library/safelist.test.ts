import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cursorRing,
  FOCUS_PLACEMENTS,
  FOCUS_TRIGGERS,
  focusRing,
  HUES,
  type FocusPlacement,
  type FocusTrigger,
  type Hue,
} from '../style';

// A class built from a hue (`bg-${hue}-contrast`) is never in the source as
// text, so Tailwind's scanner can't see it in an app: it reaches the app's CSS
// only through the generated safelist, which holds what `variants()` calls
// enumerate. A component that builds one in `cn()` instead, with no variants
// call enumerating it anywhere, compiles to nothing in an app, while its own
// test, reading the class name off the element, passes. ColorPicker's mark was
// transparent that way (TK-103.2). This finds every such class in bh's
// components and checks the safelist holds it for every hue, so the next one
// fails here rather than in an app.

/** `packages/web/ui`, and beside it the packages that draw with its tokens. */
const UI = path.join(import.meta.dirname, '..', '..');
const PACKAGES = path.dirname(UI);

const SAFELIST = new Set(
  Array.from(
    readFileSync(path.join(UI, 'styles/generated/safelist.css'), 'utf8').matchAll(
      /@source inline\("([^"]+)"\);/g,
    ),
    (match) => match[1],
  ),
);

/** Every component source file: no tests, no docs examples, nothing generated. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!['node_modules', 'examples', 'generated'].includes(entry)) {
        sourceFiles(full, out);
      }
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Each package's code, comments out, so prose quoting a class doesn't count. */
const SOURCES = readdirSync(PACKAGES)
  .map((name) => path.join(PACKAGES, name, 'src'))
  .filter((src) => existsSync(src))
  .flatMap((src) => sourceFiles(src))
  .map((file) => {
    return {
      file: path.relative(PACKAGES, file).replaceAll('\\', '/'),
      code: readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\s\/\/\s.*$/gm, ''),
    };
  });

/**
 * A color class with a hue interpolated where its ramp goes:
 * `bg-${hue}-9`, `dark:peer-checked:bg-${tone}-contrast`, `bg-${hue}-9/15`.
 */
const HUE_CLASS =
  /(?<![\w:-])([\w:[\]&-]*?)\$\{[^{}]+\}(-(?:\d{1,2}|contrast)(?:\/\d+)?)(?![\w/-])/g;

/** A call of a ring helper; its arguments, unparsed. */
const RING_CALL = /(?<!function )\b(focusRing|cursorRing)\(([^()]*)\)/g;

function quoted(arg: string | undefined): string | undefined {
  return /^'([\w-]+)'$/.exec(arg ?? '')?.[1];
}

describe('the safelist holds every class a component builds from a hue', () => {
  it('finds the classes it checks', () => {
    // A scan that matched nothing would pass whatever the safelist held.
    const classes = SOURCES.flatMap(({ code }) => [...code.matchAll(HUE_CLASS)]);
    const rings = SOURCES.flatMap(({ code }) => [...code.matchAll(RING_CALL)]);
    expect(classes.length).toBeGreaterThan(50);
    expect(rings.length).toBeGreaterThan(20);
  });

  it('holds `<utility>-${hue}-<rung>` for every hue', () => {
    const missing: string[] = [];
    for (const { file, code } of SOURCES) {
      for (const [built, prefix, rung] of code.matchAll(HUE_CLASS)) {
        const absent = HUES.map((hue) => `${prefix}${hue}${rung}`).filter(
          (name) => !SAFELIST.has(name),
        );
        if (absent.length > 0) {
          missing.push(`${file}: ${built} (${absent.join(' ')})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('holds what focusRing and cursorRing build, at every call', () => {
    // An argument spelled out is that value; any other is every value it
    // could be. One left out is the helper's default.
    const missing = new Set<string>();
    for (const { file, code } of SOURCES) {
      for (const [, helper, args] of code.matchAll(RING_CALL)) {
        const [hueArg, onArg, placementArg] = (args ?? '').split(',').map((arg) => arg.trim());
        const hues = quoted(hueArg) ? [quoted(hueArg) as Hue] : HUES;
        const triggers: readonly FocusTrigger[] =
          onArg === undefined
            ? ['focus-visible']
            : quoted(onArg)
              ? [quoted(onArg) as FocusTrigger]
              : FOCUS_TRIGGERS;
        const placements: readonly FocusPlacement[] =
          placementArg === undefined
            ? ['outward']
            : quoted(placementArg)
              ? [quoted(placementArg) as FocusPlacement]
              : FOCUS_PLACEMENTS;
        for (const hue of hues) {
          const built =
            helper === 'cursorRing'
              ? [cursorRing(hue)]
              : triggers.flatMap((on) => {
                  return placements.map((placement) => focusRing(hue, on, placement));
                });
          for (const name of built.flatMap((classes) => classes.split(' '))) {
            if (!SAFELIST.has(name)) {
              missing.add(`${file}: ${helper}(${args}) builds ${name}`);
            }
          }
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
