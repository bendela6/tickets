import { parseDocument, type ParseIssue } from './parse/parse';
import type { Registry } from './registry/types';
import { pathOf } from './schema-path';

/** What renders wrong: an unknown block, a body that fails its schema, YAML that doesn't parse. */
export type ValidationError = ParseIssue;

/** What is probably a typo, on its line: it renders, just not as meant. */
export interface ValidationWarning {
  /** The source line it is on, from 1. */
  line: number;
  /** What looks wrong, in a sentence. */
  message: string;
}

/** What `validateDocument` found: errors, and warnings. */
export interface ValidationResult {
  /** What renders wrong; none for a document that draws as written. */
  errors: ValidationError[];
  /** What is probably a typo. */
  warnings: ValidationWarning[];
}

const KNOWN_LANGUAGES = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'yaml',
  'yml',
  'bash',
  'sh',
  'sql',
  'html',
  'css',
  'md',
  'markdown',
  'diff',
  'text',
  'python',
  'go',
  'rust',
]);

/** The 1-based line of a character offset. */
const lineAt = (text: string, index: number) => text.slice(0, index).split('\n').length;

/**
 * Checks a page against the registry. Errors are what renders wrong: an
 * unknown block, a body that fails its schema, YAML that does not parse.
 * Warnings are what is probably a typo: a fence language nothing knows, a
 * directive the scanner did not take, an inline mark with no renderer.
 */
export function validateDocument(source: string, registry: Registry): ValidationResult {
  const doc = parseDocument(source, registry);
  const errors: ValidationError[] = [...doc.issues];
  const warnings: ValidationWarning[] = [];

  for (const block of doc.blocks) {
    const renderer = registry.get(block.name);
    if (!renderer) {
      errors.push({
        block: block.name,
        line: block.line,
        path: '',
        message: `No renderer named "${block.name}" is registered`,
      });
      continue;
    }
    // A body that never parsed holds a `{}` fallback. Checking it would invent
    // "missing field" errors beside the real syntax error, two signals for one
    // defect.
    if (renderer.body !== 'data' || !renderer.schema || block.parseFailed) {
      continue;
    }

    const result = renderer.schema['~standard'].validate(block.data);
    if (result instanceof Promise) {
      errors.push({
        block: block.name,
        line: block.line,
        path: '',
        message: `Renderer "${renderer.name}" has an async schema; only synchronous schemas are supported`,
      });
      continue;
    }
    for (const issue of result.issues ?? []) {
      errors.push({
        block: block.name,
        line: block.line,
        path: pathOf(issue),
        message: issue.message,
      });
    }
  }

  // One word is a language or a block; two are a language and a block, as in
  // ```yaml callout. The scanner leaves a second word it doesn't know as markdown.
  const fences =
    /^`{3,}(?:([A-Za-z][\w-]*)\s+(?=[A-Za-z]))?([A-Za-z][\w-]*)\s*(?:\{[^}]*\})?\s*$/gm;
  for (const match of source.matchAll(fences)) {
    const [, lang, name = ''] = match;
    const line = lineAt(source, match.index);
    if (lang === undefined) {
      if (!registry.get(name) && !KNOWN_LANGUAGES.has(name)) {
        warnings.push({ line, message: `Unknown fence language "${name}" — renderer typo?` });
      }
      continue;
    }
    if (!KNOWN_LANGUAGES.has(lang)) {
      warnings.push({ line, message: `Unknown fence language "${lang}" — typo?` });
    }
    if (!registry.get(name)) {
      warnings.push({ line, message: `Unknown block "${name}" after "${lang}" — renderer typo?` });
    }
  }

  // Blank out fenced blocks and inline code, keeping every offset, before the
  // two unanchored checks below. A page showing `:badge[stable]` as an example
  // (inevitable for a tool that documents its own syntax) would otherwise warn
  // about text that never renders.
  const scannable = source
    .replace(/^```[\s\S]*?^```/gm, (fenced) => fenced.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, (code) => ' '.repeat(code.length));

  // A line that looks like it opens a directive (three or more colons, maybe
  // indented or quoted with one `>`) that the scanner never took. This catches
  // what DIRECTIVE_OPEN cannot: a brace in a quoted value, text after the
  // name, leading space, a directive in a list item or blockquote. A bare
  // `:::` is a closing fence, so trailing content is required.
  const blockOpenLines = new Set(doc.blocks.map((block) => block.line));
  for (const match of scannable.matchAll(/^[ \t]*>?[ \t]*:{3,}(.*)$/gm)) {
    if (!match[1]?.trim()) {
      continue;
    }
    const line = lineAt(scannable, match.index);
    if (blockOpenLines.has(line)) {
      continue;
    }
    warnings.push({
      line,
      message: `Line ${line} looks like a directive ("${match[0].trim()}") but was not recognised as a block`,
    });
  }

  for (const match of scannable.matchAll(/:([A-Za-z][\w-]*)\[[^\]]*\]/g)) {
    const name = match[1] ?? '';
    if (registry.get(name)?.inline) {
      continue;
    }
    warnings.push({
      line: lineAt(scannable, match.index),
      message: `Unknown inline mark ":${name}[...]" — renderer typo?`,
    });
  }

  return { errors, warnings };
}
