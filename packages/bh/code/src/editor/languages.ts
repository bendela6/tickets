import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { LanguageSupport } from '@codemirror/language';
import { streamLanguage } from '../highlight/grammars';

/**
 * The language a markdown fence's code is in, from its info string (what
 * follows the opening fence), as a name `lang` takes; nothing edits it plain.
 */
export type FenceLanguage = (info: string) => string | undefined;

/** A fence's language by default: the first word of its info, as in ` ```yaml `. */
export const FENCE_FIRST_WORD: FenceLanguage = (info) => /^[\w-]+/.exec(info.trim())?.[0];

/** Markdown, its fences' code coloured in the language `fence` names. */
function markdownWith(fence: FenceLanguage): LanguageSupport {
  return markdown({
    codeLanguages: (info) => {
      const name = fence(info);
      return (name ? editorLanguage(name, fence)?.language : undefined) ?? null;
    },
  });
}

/**
 * The languages the editor knows, by the names a code block takes, so the
 * same text reads the same in both. Markdown's fences colour in these too.
 */
const FACTORIES: Record<string, (fence: FenceLanguage) => LanguageSupport> = {
  sh: () => new LanguageSupport(streamLanguage('shell')),
  shell: () => new LanguageSupport(streamLanguage('shell')),
  bash: () => new LanguageSupport(streamLanguage('shell')),
  dockerfile: () => new LanguageSupport(streamLanguage('dockerfile')),
  yaml: () => yaml(),
  yml: () => yaml(),
  ts: () => javascript({ typescript: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  js: () => javascript(),
  jsx: () => javascript({ jsx: true }),
  markdown: markdownWith,
  md: markdownWith,
};

/** Each language made on first use and kept, under the fence rule its markdown was made with. */
const made = new WeakMap<FenceLanguage, Map<string, LanguageSupport>>();

/**
 * The editor's grammar for a language name, or undefined for one it edits
 * plain. `fence` names the language of a markdown fence's code.
 */
export function editorLanguage(
  lang: string | undefined,
  fence: FenceLanguage = FENCE_FIRST_WORD,
): LanguageSupport | undefined {
  // `lang` comes from the page, and `constructor` would otherwise resolve
  // through Object.prototype.
  const factory = lang && Object.hasOwn(FACTORIES, lang) ? FACTORIES[lang] : undefined;
  if (!lang || !factory) {
    return undefined;
  }
  let languages = made.get(fence);
  if (!languages) {
    languages = new Map();
    made.set(fence, languages);
  }
  let language = languages.get(lang);
  if (!language) {
    language = factory(fence);
    languages.set(lang, language);
  }
  return language;
}

/** The languages the editor colours; any other edits plain. */
export const EDITOR_LANGUAGES = Object.keys(FACTORIES);
