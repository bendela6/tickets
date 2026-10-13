import { yaml } from '@codemirror/lang-yaml';
import type { Extension } from '@codemirror/state';
import { streamLanguage } from '../highlight/grammars';

/**
 * The languages the editor knows, by the names a code block takes, so the
 * same text reads the same in both. Each made on first use and kept.
 */
const FACTORIES: Record<string, () => Extension> = {
  sh: () => streamLanguage('shell'),
  shell: () => streamLanguage('shell'),
  bash: () => streamLanguage('shell'),
  dockerfile: () => streamLanguage('dockerfile'),
  yaml: () => yaml(),
  yml: () => yaml(),
};

const made = new Map<string, Extension>();

/** The editor's grammar for a language name, or undefined for one it edits plain. */
export function editorLanguage(lang: string | undefined): Extension | undefined {
  const factory = lang && Object.hasOwn(FACTORIES, lang) ? FACTORIES[lang] : undefined;
  if (!lang || !factory) {
    return undefined;
  }
  let language = made.get(lang);
  if (!language) {
    language = factory();
    made.set(lang, language);
  }
  return language;
}

/** The languages the editor colours; any other edits plain. */
export const EDITOR_LANGUAGES = Object.keys(FACTORIES);
