import { describe, expect, it } from 'vitest';
import { readMarkdown, readRichText } from './reading';

describe('readMarkdown', () => {
  it('writes headings, paragraphs and lists as lines without their marks', () => {
    const source =
      '# Plan\n\nFirst paragraph,\nsecond line.\n\n## Steps\n\n- one\n* two\n+ three\n\n1. four\n2) five';
    expect(readMarkdown(source)).toBe(
      'Plan\nFirst paragraph,\nsecond line.\nSteps\none\ntwo\nthree\nfour\nfive',
    );
  });

  it('writes quotes, tasks and nested lists without their marks', () => {
    expect(readMarkdown('> quoted\n>> deeper\n\n- [ ] open\n- [x] done\n  - nested')).toBe(
      'quoted\ndeeper\nopen\ndone\nnested',
    );
  });

  it('writes a link as its words, an image as its alt text, an autolink as its address', () => {
    expect(
      readMarkdown('See [the docs](https://example.com/docs) and ![a chart](chart.png).'),
    ).toBe('See the docs and a chart.');
    expect(readMarkdown('Go to <https://example.com> now')).toBe('Go to https://example.com now');
    expect(readMarkdown('[ref link][1] here')).toBe('ref link here');
  });

  it('writes emphasis, strikethrough and code without their marks', () => {
    expect(readMarkdown('**bold** and *italic* and ~~gone~~ and `code`')).toBe(
      'bold and italic and gone and code',
    );
    expect(readMarkdown('__bold__ and _italic_ and ***both***')).toBe('bold and italic and both');
  });

  it('keeps an underscore or a star that is not emphasis', () => {
    expect(readMarkdown('snake_case_name and 2 * 3 * 4')).toBe('snake_case_name and 2 * 3 * 4');
    expect(readMarkdown(String.raw`a \*literal\* star`)).toBe('a *literal* star');
  });

  it('leaves out a rule, a setext underline and a table’s rule, and writes a row’s cells apart', () => {
    expect(readMarkdown('Title\n=====\n\ntext\n\n---\n\nmore')).toBe('Title\ntext\nmore');
    expect(readMarkdown('| a | b |\n| --- | :-: |\n| 1 | 2 |')).toBe('a b\n1 2');
  });

  it('writes a code block as its lines, marks and all', () => {
    const source = 'before\n\n```ts\nconst a = **1**;\n\n# not a heading\n```\n\nafter';
    expect(readMarkdown(source)).toBe('before\nconst a = **1**;\n# not a heading\nafter');
  });

  it('drops html tags, and reads any line ending', () => {
    expect(readMarkdown('a <b>bold</b> word<br/>')).toBe('a bold word');
    expect(readMarkdown('one\r\ntwo\rthree')).toBe('one\ntwo\nthree');
    expect(readMarkdown('')).toBe('');
  });
});

describe('readRichText', () => {
  const doc = (...content: unknown[]) => JSON.stringify({ type: 'doc', content });
  const paragraph = (...texts: string[]) => {
    return {
      type: 'paragraph',
      content: texts.map((text) => {
        return { type: 'text', text };
      }),
    };
  };

  it('writes a paragraph’s pieces of text as one line, whatever their marks', () => {
    expect(
      readRichText(
        doc({
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Some ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' words' },
          ],
        }),
      ),
    ).toBe('Some bold words');
  });

  it('writes a block to a line: paragraphs, headings and the items of lists', () => {
    const list = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [paragraph('one')] },
        { type: 'listItem', content: [paragraph('two')] },
      ],
    };
    const heading = {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Steps' }],
    };
    expect(readRichText(doc(heading, paragraph('Intro'), list, paragraph('Last')))).toBe(
      'Steps\nIntro\none\ntwo\nLast',
    );
  });

  it('writes a hard break as a new line in the block, and leaves out empty blocks', () => {
    const broken = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }],
    };
    expect(readRichText(doc(broken, { type: 'paragraph' }, paragraph('')))).toBe('a\nb');
  });

  it('writes a quote’s and a code block’s text', () => {
    const quote = { type: 'blockquote', content: [paragraph('quoted')] };
    const code = { type: 'codeBlock', content: [{ type: 'text', text: 'let a = 1;' }] };
    expect(readRichText(doc(quote, code))).toBe('quoted\nlet a = 1;');
  });

  it('gives back text that is no document as it is, and nothing for a document with no text', () => {
    expect(readRichText('plain words')).toBe('plain words');
    expect(readRichText('{"type":"doc"')).toBe('{"type":"doc"');
    expect(readRichText('42')).toBe('');
    expect(readRichText('null')).toBe('');
    expect(readRichText(doc())).toBe('');
  });
});
