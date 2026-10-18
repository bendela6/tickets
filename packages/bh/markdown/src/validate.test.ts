import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { parseDocument } from './parse/parse';
import { noBlocks } from './registry/registry';
import type { Renderer } from './registry/types';
import { validateDocument } from './validate';

const erd: Renderer<{ title: string }> = {
  name: 'erd',
  body: 'data',
  description: 'An ERD.',
  schema: v.object({ title: v.string() }),
  examples: ['```erd\ntitle: Core\n```'],
  component: () => null,
};

const code: Renderer<{ lang?: string }> = {
  name: 'code',
  body: 'data',
  description: 'A code fragment.',
  schema: v.object({ lang: v.optional(v.string()) }),
  examples: ['```code\n```'],
  component: () => null,
};

const registry = noBlocks.register({ erd, code });

describe('validateDocument', () => {
  it('reports nothing for a valid document', () => {
    expect(validateDocument('```erd\ntitle: Core\n```', registry).errors).toEqual([]);
  });

  it('reports the block, line, and schema path for a schema violation', () => {
    const { errors } = validateDocument('# T\n\n```erd\ntitle: 3\n```', registry);
    expect(errors[0]).toMatchObject({ block: 'erd', line: 3, path: 'title' });
    expect(errors[0]?.message).toMatch(/string/i);
  });

  it('reports an unknown block name', () => {
    const { errors } = validateDocument(':::nosuch\nx\n:::', registry);
    expect(errors[0]).toMatchObject({ block: 'nosuch', line: 1 });
    expect(errors[0]?.message).toMatch(/no renderer/i);
  });

  it('warns on a fence language that is neither a renderer nor a known language', () => {
    const { warnings } = validateDocument('# T\n\n```erdd\ntitle: Core\n```', registry);
    expect(warnings[0]).toMatchObject({ line: 3 });
    expect(warnings[0]?.message).toMatch(/erdd/);
  });

  it('warns on an attributed fence language that is neither a renderer nor a known language', () => {
    const { warnings } = validateDocument('# T\n\n```erdd{title=x}\ntitle: Core\n```', registry);
    expect(warnings[0]).toMatchObject({ line: 3 });
    expect(warnings[0]?.message).toMatch(/erdd/);
  });

  it('does not warn on an attributed fence for a registered renderer', () => {
    const { warnings } = validateDocument('# T\n\n```code{lang=ts}\n```', registry);
    expect(warnings).toEqual([]);
  });

  it('does not warn on a known language before a registered renderer', () => {
    const { warnings } = validateDocument('# T\n\n```ts code{numbers=false}\n```', registry);
    expect(warnings).toEqual([]);
  });

  it('warns on an unregistered name after a fence language', () => {
    const { warnings } = validateDocument('# T\n\n```ts coed\nconst a = 1;\n```', registry);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ line: 3 });
    expect(warnings[0]?.message).toMatch(/"coed" after "ts"/);
  });

  it('reads a comment naming a block as a comment, not a block', () => {
    const source = "# T\n\n[//]: # 'erd{zoom=2}'\ntitle: Core\n[//]: # '/erd'";
    expect(validateDocument(source, registry)).toEqual({ errors: [], warnings: [] });
    expect(parseDocument(source, registry).blocks).toEqual([]);
  });

  it('does not warn on an ordinary comment', () => {
    const source = "[//]: # 'a note to the next editor'\n\n<!-- and one in HTML -->";
    expect(validateDocument(source, registry).warnings).toEqual([]);
  });

  it('warns on an unknown language before a registered renderer', () => {
    const { warnings } = validateDocument('# T\n\n```tss code\nconst a = 1;\n```', registry);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/"tss"/);
  });

  it('reports a YAML syntax error once, without inventing schema errors for the fallback', () => {
    const { errors } = validateDocument('```erd\ntitle: [unterminated\n```', registry);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).not.toMatch(/expected string/i);
  });

  it('warns on an inline mark with no registered renderer', () => {
    const { warnings } = validateDocument('A :nosuch[thing] here.', registry);
    expect(warnings[0]?.message).toMatch(/nosuch/);
  });

  it('warns on an inline mark in prose, but not inside a fence or inline code', () => {
    const doc = [
      '```',
      ':nosuch[thing]',
      '```',
      '',
      'Use `:nosuch[thing]` in prose, or plain :nosuch[thing] too.',
    ].join('\n');
    const { warnings } = validateDocument(doc, registry);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/nosuch/);
  });

  it('records an async schema as an error instead of throwing', () => {
    const slow: Renderer<{ title: string }> = {
      name: 'slow',
      body: 'data',
      description: 'A renderer whose schema resolves asynchronously.',
      schema: {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: async () => ({ value: { title: 'ok' } }),
        },
      },
      examples: ['```slow\ntitle: x\n```'],
      component: () => null,
    };
    const { errors } = validateDocument('```slow\ntitle: x\n```', noBlocks.register({ erd, slow }));
    expect(errors[0]).toMatchObject({ block: 'slow' });
    expect(errors[0]?.message).toMatch(/synchronous/i);
  });
});

describe('validateDocument — unrecognised directive lines', () => {
  const warning: Renderer = {
    name: 'warning',
    body: 'markdown',
    description: 'A warning callout.',
    examples: [':::warning\nx\n:::'],
    component: () => null,
  };
  const directives = noBlocks.register({ warning });

  it('warns once on a directive whose quoted attribute value contains a brace', () => {
    const src = ':::warning{title="Do {not} run"}\nBody.\n:::';
    const { warnings } = validateDocument(src, directives);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ line: 1 });
    expect(warnings[0]?.message).toMatch(/not recognised/i);
  });

  it('warns once on trailing text after the directive name', () => {
    const src = ':::warning extra\nBody.\n:::';
    const { warnings } = validateDocument(src, directives);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ line: 1 });
  });

  it('warns once on a directive with one leading space', () => {
    const src = ' :::warning\nBody.\n:::';
    const { warnings } = validateDocument(src, directives);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ line: 1 });
  });

  it('warns once on a directive indented inside a list item', () => {
    const src = ['- item', '  :::warning', '  body', '  :::'].join('\n');
    const { warnings } = validateDocument(src, directives);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ line: 2 });
  });

  it('warns once on a directive prefixed by a blockquote marker', () => {
    const src = ['> :::warning', '> body', '> :::'].join('\n');
    const { warnings } = validateDocument(src, directives);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ line: 1 });
  });

  it('does not warn on a well-formed directive', () => {
    const src = ':::warning\nBody.\n:::';
    expect(validateDocument(src, directives).warnings).toEqual([]);
  });

  it('does not warn on a well-formed nested directive (four colons wrapping three)', () => {
    const src = ['::::warning', ':::warning', 'inner', ':::', '::::'].join('\n');
    expect(validateDocument(src, directives).warnings).toEqual([]);
  });

  it('does not warn on directive-shaped text shown as an example inside a fenced code block', () => {
    const src = ['```markdown', ':::warning extra', 'x', ':::', '```'].join('\n');
    expect(validateDocument(src, directives).warnings).toEqual([]);
  });
});
