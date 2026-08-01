import type { SvgNode } from './parse';

/**
 * The `<style>` blocks a file carries, resolved onto its elements.
 *
 * Icon files state their colours in CSS more often than they state them on the
 * elements, because a class and a `prefers-color-scheme` block are the only way
 * a single SVG can carry two colour schemes. Every colour in this document
 * model is a pair, so that block is not decoration — it is the half of each
 * pair the importer would otherwise have to invent.
 *
 * This is not a CSS engine and must not become one. It resolves the selector
 * forms icon files are written with — a type, a class, an id, and a compound of
 * those — and reports every other form rather than guessing at it, which is the
 * bargain the rest of this importer makes with everything it cannot represent.
 */

/** Which colour scheme a rule is stated for. */
type Scheme = 'always' | 'light' | 'dark';

/** A compound selector: at most one type, at most one id, any number of classes. */
interface Selector {
  tag: string | null;
  id: string | null;
  classes: readonly string[];
  /**
   * How strongly it binds: ids, then classes, then types, in the order CSS
   * compares them. Packed into one number because comparing is the only thing
   * ever done with it, and a hundred classes in one selector is not a file
   * anybody has.
   */
  weight: number;
}

interface StyleRule {
  selector: Selector;
  declarations: Readonly<Record<string, string>>;
  scheme: Scheme;
}

export interface Stylesheet {
  /** In source order across every block, which is what breaks a tie in weight. */
  readonly rules: readonly StyleRule[];
  /** What could not be applied, each said the way the import report says things. */
  readonly problems: readonly string[];
}

const COMMENT = /\/\*[\s\S]*?\*\//g;
const DECLARATION = /([\w-]+)\s*:\s*([^;]+)/g;
const IMPORTANT = /\s*!\s*important\s*$/i;

const withoutComments = (text: string): string => text.replace(COMMENT, ' ');

/** A snippet of the file, short enough to read in a dialog. */
function quoted(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return `"${line.length > 60 ? `${line.slice(0, 57)}…` : line}"`;
}

/**
 * A declaration block as property and value.
 *
 * Shared with the inline `style` attribute rather than written twice: the two
 * are one grammar, and a file that writes `fill:#0f0` in a class and again in
 * an attribute has to read the same both times or the cascade below is ranking
 * values that were never comparable. Property names are lower-cased because CSS
 * does not care about their case and the attributes they land on are lower-case
 * to begin with.
 */
export function parseDeclarations(text: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (text === undefined) return out;
  for (const found of withoutComments(text).matchAll(DECLARATION)) {
    const property = found[1];
    const value = found[2];
    if (property === undefined || value === undefined) continue;
    // Later wins within one block, which is the cascade's own rule.
    out[property.toLowerCase()] = value.replace(IMPORTANT, '').trim();
  }
  return out;
}

/* ── the grammar ────────────────────────────────────────────────────────── */

const COMPOUND = /^(\*|[A-Za-z][\w-]*)?((?:[.#][A-Za-z_-][\w-]*)*)$/;
const SIMPLE = /[.#][A-Za-z_-][\w-]*/g;

/** One compound selector, or null when it is a form this does not resolve. */
function selectorOf(text: string): Selector | null {
  const found = COMPOUND.exec(text);
  if (!found) return null;
  const name = found[1];
  const tag = name === undefined || name === '*' ? null : name;
  let id: string | null = null;
  const classes: string[] = [];
  for (const part of (found[2] ?? '').matchAll(SIMPLE)) {
    const token = part[0];
    if (token.startsWith('#')) {
      // Two ids in one compound can never both match, so the file means
      // something this cannot work out — better refused than half-applied.
      if (id !== null) return null;
      id = token.slice(1);
    } else {
      classes.push(token.slice(1));
    }
  }
  if (tag === null && id === null && classes.length === 0 && name !== '*') return null;
  return {
    tag,
    id,
    classes,
    weight: (id === null ? 0 : 10000) + classes.length * 100 + (tag === null ? 0 : 1),
  };
}

/**
 * The index of the `}` closing the `{` at `open`, or -1 when nothing does.
 *
 * Depth-counted rather than found by search, because `@media` nests a whole
 * block of rules inside itself and the first `}` is the end of the first rule
 * within it. Quotes are tracked so a brace inside a string cannot unbalance the
 * count.
 */
function closingBrace(text: string, open: number): number {
  let depth = 0;
  let quote = '';
  for (let at = open; at < text.length; at++) {
    const character = text.charAt(at);
    if (quote !== '') {
      if (character === '\\') at += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return -1;
}

const SCHEME = /prefers-color-scheme\s*:\s*(dark|light)/i;

/** The words a colour-scheme query may also carry without changing what it asks. */
const HARMLESS = new Set(['', 'media', 'only', 'all', 'screen', 'and']);

/**
 * What a media query asks about.
 *
 * Only the colour scheme can be answered here — there is no viewport, no
 * printer and no pointer for the rest of them — so a query carrying any other
 * condition is refused whole rather than applied on the half of it this
 * understands.
 */
function schemeOf(prelude: string): { scheme: Scheme } | { problem: string } {
  const found = SCHEME.exec(prelude);
  if (!found) {
    return {
      problem: `${quoted(prelude)} asks about something other than the colour scheme, so its rules were not applied`,
    };
  }
  const rest = prelude.replace('@', ' ').replace(SCHEME, ' ');
  for (const word of rest.split(/[\s,()]+/)) {
    if (!HARMLESS.has(word.toLowerCase())) {
      return {
        problem: `${quoted(prelude)} carries a condition beyond the colour scheme, which cannot be answered here, so its rules were not applied`,
      };
    }
  }
  return { scheme: found[1]?.toLowerCase() === 'light' ? 'light' : 'dark' };
}

/** A query inside a query, when the two can both hold. */
function narrower(outer: Scheme, inner: Scheme): Scheme | null {
  if (outer === 'always') return inner;
  return outer === inner ? outer : null;
}

const UNCLOSED = 'a block is missing its closing brace, so the rules after it were not read';

function readInto(source: string, scheme: Scheme, rules: StyleRule[], problems: string[]): void {
  const text = withoutComments(source);
  let at = 0;
  while (at < text.length) {
    while (at < text.length && /\s/.test(text.charAt(at))) at += 1;
    if (at >= text.length) return;

    if (text.charAt(at) === '@') {
      const semicolon = text.indexOf(';', at);
      const brace = text.indexOf('{', at);
      // An at-rule either carries a block or ends at a semicolon. `@import` is
      // the second kind, and reading it as the first would swallow every rule
      // up to the end of whatever block came next.
      if (brace < 0 || (semicolon >= 0 && semicolon < brace)) {
        const end = semicolon < 0 ? text.length : semicolon;
        problems.push(`${quoted(text.slice(at, end))} is an at-rule this does not act on`);
        at = end + 1;
        continue;
      }
      const close = closingBrace(text, brace);
      if (close < 0) {
        problems.push(UNCLOSED);
        return;
      }
      const prelude = text.slice(at, brace).trim();
      const body = text.slice(brace + 1, close);
      at = close + 1;
      if (!/^@media\b/i.test(prelude)) {
        problems.push(`${quoted(prelude)} is an at-rule this does not act on, so nothing inside it was applied`);
        continue;
      }
      const asked = schemeOf(prelude);
      if ('problem' in asked) {
        problems.push(asked.problem);
        continue;
      }
      const both = narrower(scheme, asked.scheme);
      if (both === null) {
        problems.push(
          `${quoted(prelude)} sits inside a query for the other colour scheme, so nothing in it can ever apply`,
        );
        continue;
      }
      readInto(body, both, rules, problems);
      continue;
    }

    const brace = text.indexOf('{', at);
    if (brace < 0) {
      problems.push(`${quoted(text.slice(at))} is not a rule this reads`);
      return;
    }
    const close = closingBrace(text, brace);
    if (close < 0) {
      problems.push(UNCLOSED);
      return;
    }
    const prelude = text.slice(at, brace).trim();
    const body = text.slice(brace + 1, close);
    at = close + 1;
    if (/!\s*important/i.test(body)) {
      problems.push(
        'an !important declaration was read as an ordinary one — importance is not weighed here, so an inline style still beats it',
      );
    }
    const declarations = parseDeclarations(body);
    for (const one of prelude.split(',')) {
      const written = one.trim();
      if (written === '') continue;
      const selector = selectorOf(written);
      if (selector === null) {
        problems.push(
          `${quoted(written)} is a selector this does not resolve — a type, a class, an id, or a compound of those — so its declarations were not applied`,
        );
        continue;
      }
      rules.push({ selector, declarations, scheme });
    }
  }
}

/**
 * Every `<style>` block in the file as one stylesheet.
 *
 * Each block is read on its own so that one which never closes its braces costs
 * its own rules rather than the ones a later block states — a file with a
 * broken stylesheet is still mostly a file.
 */
export function readStylesheet(blocks: readonly string[]): Stylesheet {
  const rules: StyleRule[] = [];
  const problems: string[] = [];
  for (const block of blocks) readInto(block, 'always', rules, problems);
  return { rules, problems };
}

/* ── the cascade ────────────────────────────────────────────────────────── */

/** Everything a compound selector may ask of an element. */
interface Facts {
  tag: string;
  id: string | undefined;
  classes: readonly string[];
}

function factsOf(node: SvgNode): Facts {
  const id = node.attrs['id']?.trim();
  const classes = (node.attrs['class'] ?? '')
    .trim()
    .split(/\s+/)
    .filter((name) => name !== '');
  return { tag: node.tag, id: id === '' ? undefined : id, classes };
}

function matches(selector: Selector, facts: Facts): boolean {
  if (selector.tag !== null && selector.tag !== facts.tag) return false;
  if (selector.id !== null && selector.id !== facts.id) return false;
  return selector.classes.every((name) => facts.classes.includes(name));
}

interface Won {
  value: string;
  weight: number;
  scheme: Scheme;
}

/**
 * The declarations in force for one element under one preference.
 *
 * Weight first and source order second, which is the whole of CSS's ordering
 * that this needs: an id beats a class beats a type, and where two selectors
 * bind equally the later one wins. A media query adds nothing to a rule's
 * weight, so a dark block cannot overrule an id merely by being inside one.
 */
function cascade(sheet: Stylesheet, facts: Facts, schemes: readonly Scheme[]): Map<string, Won> {
  const won = new Map<string, Won>();
  for (const rule of sheet.rules) {
    if (!schemes.includes(rule.scheme)) continue;
    if (!matches(rule.selector, facts)) continue;
    for (const [property, value] of Object.entries(rule.declarations)) {
      const held = won.get(property);
      if (held && held.weight > rule.selector.weight) continue;
      won.set(property, { value, weight: rule.selector.weight, scheme: rule.scheme });
    }
  }
  return won;
}

/** What the stylesheet says about one element, per half of the colour pair. */
export interface Applied {
  /** What holds with no dark preference — and the fallback for the dark half. */
  light: Readonly<Record<string, string>>;
  /** Only what a dark preference changes. Empty when the file states no dark half. */
  dark: Readonly<Record<string, string>>;
}

function appliedTo(sheet: Stylesheet, facts: Facts): Applied {
  const light = cascade(sheet, facts, ['always', 'light']);
  const dark = cascade(sheet, facts, ['always', 'dark']);
  const lightValues: Record<string, string> = {};
  for (const [property, won] of light) lightValues[property] = won.value;
  const darkValues: Record<string, string> = {};
  for (const [property, won] of dark) {
    // A dark rule that restates the light colour still counts as stated: the
    // file has said what the dark half is, and the importer must not report it
    // as a colour nobody chose.
    if (won.scheme === 'dark' || won.value !== light.get(property)?.value) {
      darkValues[property] = won.value;
    }
  }
  return { light: lightValues, dark: darkValues };
}

/** An element with the cascade resolved onto it. */
export interface StyledNode {
  tag: string;
  /**
   * Presentation attributes with the stylesheet folded in: a rule beats an
   * attribute of the same name, and the element's own `style` beats both, which
   * is the order CSS itself ranks the three in.
   */
  attrs: Readonly<Record<string, string>>;
  /** The properties a dark preference changes, and what it changes them to. */
  dark: Readonly<Record<string, string>>;
  children: StyledNode[];
}

/** The tree with every element's declarations resolved. */
export function applyStylesheet(node: SvgNode, sheet: Stylesheet): StyledNode {
  // The parser has already folded the inline style into the attributes, so the
  // declarations it stated are read back out to know which of them a rule must
  // not overrule.
  const inline = parseDeclarations(node.attrs['style']);
  const applied = appliedTo(sheet, factsOf(node));
  const attrs: Record<string, string> = { ...node.attrs };
  for (const [property, value] of Object.entries(applied.light)) {
    if (inline[property] === undefined) attrs[property] = value;
  }
  const dark: Record<string, string> = {};
  for (const [property, value] of Object.entries(applied.dark)) {
    if (inline[property] === undefined) dark[property] = value;
  }
  return {
    tag: node.tag,
    attrs,
    dark,
    children: node.children.map((child) => applyStylesheet(child, sheet)),
  };
}
