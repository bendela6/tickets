import { parser as css } from '@lezer/css';
import type { highlightCode } from '@lezer/highlight';
import { parser as javascript } from '@lezer/javascript';
import { parser as json } from '@lezer/json';
import { parser as yaml } from '@lezer/yaml';

/** What `highlightCode` needs from a grammar: something that parses a string to a tree. */
export interface Grammar {
  parse(input: string): Parameters<typeof highlightCode>[1];
}

/**
 * Language name to grammar, built on first use and kept, since `configure()`
 * makes a new parser each call. Adding a language is one line here, and one
 * grammar package on this package's dependencies if it is new.
 */
const FACTORIES: Record<string, () => Grammar> = {
  ts: () => javascript.configure({ dialect: 'ts' }),
  tsx: () => javascript.configure({ dialect: 'ts jsx' }),
  js: () => javascript,
  jsx: () => javascript.configure({ dialect: 'jsx' }),
  json: () => json,
  yaml: () => yaml,
  yml: () => yaml,
  css: () => css,
};

const made = new Map<string, Grammar>();

/** The grammar for a language name, or undefined for one this package does not ship. */
export function grammarFor(lang: string): Grammar | undefined {
  // `lang` comes from the page, and `constructor` would otherwise resolve
  // through Object.prototype.
  const factory = Object.hasOwn(FACTORIES, lang) ? FACTORIES[lang] : undefined;
  if (!factory) {
    return undefined;
  }
  let grammar = made.get(lang);
  if (!grammar) {
    grammar = factory();
    made.set(lang, grammar);
  }
  return grammar;
}

/** The languages a code block colours; any other shows plain. */
export const LANGUAGES = Object.keys(FACTORIES);
