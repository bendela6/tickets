import { describe, expect, it } from 'vitest';
import { createRegistry } from '../registry/registry';
import type { Renderer } from '../registry/types';
import { parseDocument, readFrontmatter } from './parse';

const stub = (name: string, body: Renderer['body']): Renderer => {
  return {
    name,
    body,
    description: name,
    examples: ['x'],
    component: () => null,
  };
};

const registry = createRegistry([
  stub('erd', 'data'),
  stub('transcript', 'text'),
  stub('note', 'markdown'),
]);

describe('parseDocument', () => {
  it('parses front matter', () => {
    const doc = parseDocument('---\nservice: jobs\n---\n\n# Jobs', registry);
    expect(doc.frontmatter).toEqual({ service: 'jobs' });
  });

  it('reads front matter written with CRLF line endings', () => {
    const doc = parseDocument('---\r\nservice: jobs\r\n---\r\n\r\n# Jobs', registry);
    expect(doc.frontmatter).toEqual({ service: 'jobs' });
    expect(doc.headings[0]).toMatchObject({ text: 'Jobs', line: 5 });
  });

  it('reads front matter alone, without parsing the page', () => {
    expect(readFrontmatter('---\ntitle: Button\norder: 1\n---\n\n# Button')).toEqual({
      title: 'Button',
      order: 1,
    });
    expect(readFrontmatter('# No front matter')).toEqual({});
  });

  it('YAML-parses a data body', () => {
    const doc = parseDocument('```erd\ntitle: Core\nzoom: 0.8\n```', registry);
    expect(doc.blocks[0]?.data).toEqual({ title: 'Core', zoom: 0.8 });
  });

  it('keeps a text body verbatim including indentation', () => {
    const doc = parseDocument('```transcript\n$ ls\n    indented\n```', registry);
    expect(doc.blocks[0]?.text).toBe('$ ls\n    indented');
  });

  it('recurses into a markdown body so nested blocks resolve', () => {
    const src = ['::::note', 'Text.', '', '```erd', 'title: Inner', '```', '::::'].join('\n');
    const doc = parseDocument(src, registry);
    expect(doc.blocks.map((block) => block.name)).toEqual(['note', 'erd']);
    expect(doc.blocks[1]?.data).toEqual({ title: 'Inner' });
  });

  it('collects headings with ids and first paragraphs', () => {
    const doc = parseDocument('## Endpoints\n\n### POST /jobs\n\nCreates a job.', registry);
    expect(doc.headings[1]).toMatchObject({
      depth: 3,
      text: 'POST /jobs',
      id: 'post-jobs',
      firstParagraph: 'Creates a job.',
    });
  });

  it('records a YAML syntax error against the source line', () => {
    const doc = parseDocument('# Title\n\n```erd\ntitle: [unclosed\n```', registry);
    expect(doc.issues[0]).toMatchObject({ block: 'erd', line: 4 });
  });

  it('numbers headings against the original source across block boundaries', () => {
    const src = ['```erd', 'title: A', '```', '', '## After the block'].join('\n');
    expect(parseDocument(src, registry).headings[0]).toMatchObject({
      text: 'After the block',
      line: 5,
    });
  });

  it('offsets heading lines by the front matter', () => {
    const src = ['---', 'service: jobs', '---', '', '# Jobs'].join('\n');
    expect(parseDocument(src, registry).headings[0]).toMatchObject({ text: 'Jobs', line: 5 });
  });

  it('points a multi-line YAML error at the offending line, not the block start', () => {
    const src = ['# T', '', '```erd', 'title: Something', 'zoom: [unclosed', '```'].join('\n');
    expect(parseDocument(src, registry).issues[0]).toMatchObject({ block: 'erd', line: 5 });
  });

  it('drops the YAML parser line number from the message, which counts from the body', () => {
    const src = ['# T', '', '```erd', 'title: Something', 'zoom: [unclosed', '```'].join('\n');
    const issue = parseDocument(src, registry).issues[0];
    expect(issue?.line).toBe(5);
    expect(issue?.message).not.toMatch(/at line \d+/);
    // The description itself survives the strip.
    expect(issue?.message.length).toBeGreaterThan(10);
  });
});
