import { StreamLanguage } from '@codemirror/language';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { shell } from '@codemirror/legacy-modes/mode/shell';
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
 * The languages with no Lezer grammar of their own, as CodeMirror's stream
 * modes. A stream language is a Lezer parser too, its tokens tagged as
 * Lezer's are, so a code block and an editor colour it through the same
 * syntax map. Made on first use and kept: the editor takes the same one.
 */
const STREAMS = {
  shell: () => StreamLanguage.define(shell),
  dockerfile: () => StreamLanguage.define(dockerFile),
};

export type StreamName = keyof typeof STREAMS;

const streams = new Map<StreamName, StreamLanguage<unknown>>();

/** A stream language, made once. */
export function streamLanguage(name: StreamName): StreamLanguage<unknown> {
  let language = streams.get(name);
  if (!language) {
    language = STREAMS[name]();
    streams.set(name, language);
  }
  return language;
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
  sh: () => streamLanguage('shell').parser,
  shell: () => streamLanguage('shell').parser,
  bash: () => streamLanguage('shell').parser,
  dockerfile: () => streamLanguage('dockerfile').parser,
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
