import { stringify } from 'yaml';
import { parseAttrs } from '../parse/attrs';
import type { BlockNode, Registry } from '../registry/types';
import type { PageItem, ParsedPage } from './parse-page';

// A YAML page as plain markdown: its copy, which every reader without the
// site sees (GitHub, an editor's preview, a Claude session in an app). Prose
// is written as it is, a heading as a heading, and each block as its renderer
// says, or as a markdown document would write it. An inline mark in either is
// written by its renderer too, when it writes one.

/** What `pageMarkdown` writes beside the page's own items. */
export interface PageMarkdownOptions {
  /** The page's title, written as its `# Title`. */
  title?: string;
  /** A line no viewer shows, written under the frontmatter: where the copy comes from. */
  note?: string;
  /**
   * Where a link leads in the copy: given each destination as the page writes
   * it, outside code, the one to write instead; undefined keeps it. A site
   * writes its own paths as files here, so the copy's links work where it is
   * read.
   */
  link?: (href: string) => string | undefined;
}

/** Code in a fence, longer than any run of backticks inside it. */
export function fenced(info: string, code: string): string {
  const runs = [...code.matchAll(/^`{3,}/gm)].map((match) => match[0].length);
  const ticks = '`'.repeat(Math.max(3, ...runs.map((length) => length + 1)));
  return `${ticks}${info}\n${code.replace(/\n$/, '')}\n${ticks}`;
}

/** A block as a markdown document would write it: a fence, or its markdown as it is. */
function asWritten(node: BlockNode, body: 'data' | 'markdown' | 'text'): string {
  if (body === 'markdown') {
    return node.text ?? '';
  }
  if (body === 'data') {
    return fenced(node.name, stringify(node.data ?? {}));
  }
  return fenced(typeof node.attrs.lang === 'string' ? node.attrs.lang : '', node.text ?? '');
}

const INLINE = /:([A-Za-z][\w-]*)\[([^\]]*)\](\{[^}]*\})?/g;

const blank = (code: string) => code.replace(/[^\n]/g, ' ');

/**
 * Markdown with its code blanked, every offset kept, so what is shown as code
 * is never read as a mark or a link: each fence (closed by a run of its own
 * character at least as long, or by the end) and each code span.
 */
function outsideCode(text: string): string {
  const lines = text.split('\n');
  let fence: { char: string; length: number } | undefined;
  const kept = lines.map((line) => {
    const run = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (run?.[0] === fence.char && run.length >= fence.length && line.trim() === run) {
        fence = undefined;
      }
      return blank(line);
    }
    if (run) {
      fence = { char: run[0] ?? '`', length: run.length };
      return blank(line);
    }
    return line;
  });
  // A span closes on a run as long as the one it opened with, within its paragraph.
  return kept.join('\n').replace(/(?<!`)(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)/g, blank);
}

/**
 * Text with each inline mark outside code written as its renderer writes it:
 * `:badge[stable]{tone=success}` as what `badge` makes of it. A mark whose
 * renderer writes nothing of its own stays as written.
 */
function marksWritten(text: string, registry: Registry): string {
  const scannable = outsideCode(text);
  let out = '';
  let last = 0;
  for (const match of scannable.matchAll(INLINE)) {
    const [raw, name = '', label = '', attrsSource = ''] = match;
    const renderer = registry.has(name) ? registry.get(name) : undefined;
    if (!renderer?.inline || !renderer.toMarkdown) {
      continue;
    }
    const attrs = parseAttrs(attrsSource);
    const mark: BlockNode = { type: 'block', name, attrs, text: label, line: 1 };
    out += text.slice(last, match.index) + renderer.toMarkdown(mark);
    last = match.index + raw.length;
  }
  return out + text.slice(last);
}

/** A link's destination: after `](`, or after a definition's `[label]:`. */
const DESTINATION = /(?<=\]\()[^\s()<>]+|(?<=^ {0,3}\[[^\]\n]+\]:[ \t]*)[^\s<>]+/gm;

/** Text with each link outside code led where `link` says. */
function linksWritten(text: string, link: NonNullable<PageMarkdownOptions['link']>): string {
  let out = '';
  let last = 0;
  for (const match of outsideCode(text).matchAll(DESTINATION)) {
    const written = link(match[0]);
    if (written !== undefined) {
      out += text.slice(last, match.index) + written;
      last = match.index + match[0].length;
    }
  }
  return out + text.slice(last);
}

function itemMarkdown(item: PageItem, registry: Registry): string {
  if (item.kind === 'prose') {
    return marksWritten(item.text, registry);
  }
  if (item.kind === 'heading') {
    return `${'#'.repeat(item.depth)} ${marksWritten(item.text, registry)}`;
  }
  if (!registry.has(item.node.name)) {
    return '';
  }
  const renderer = registry.get(item.node.name);
  return renderer.toMarkdown?.(item.node) ?? asWritten(item.node, renderer.body);
}

/** A parsed YAML page as plain markdown, frontmatter first. */
export function pageMarkdown(
  page: ParsedPage,
  registry: Registry,
  options: PageMarkdownOptions = {},
): string {
  const parts: string[] = [];
  if (Object.keys(page.frontmatter).length > 0) {
    parts.push(`---\n${page.frontmatterYaml.trim()}\n---`);
  }
  if (options.note) {
    // A link reference definition: CommonMark never shows it. Its title can't hold a `'`.
    parts.push(`[//]: # '${options.note.replaceAll("'", '’')}'`);
  }
  if (options.title) {
    parts.push(`# ${options.title}`);
  }
  for (const item of page.items) {
    const markdown = itemMarkdown(item, registry).trimEnd();
    parts.push(options.link ? linksWritten(markdown, options.link) : markdown);
  }
  return `${parts.filter(Boolean).join('\n\n')}\n`;
}
