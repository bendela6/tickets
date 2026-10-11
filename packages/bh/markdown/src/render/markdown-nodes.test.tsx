import { render, screen } from '@testing-library/react';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { describe, expect, it } from 'vitest';
import { renderNodes } from './markdown-nodes';

const nodes = (markdown: string) => {
  return fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }).children;
};

describe('renderNodes', () => {
  it('renders headings, emphasis, and links', () => {
    render(<>{renderNodes(nodes('# Title\n\nSome **bold** and [a link](/x).'), {})}</>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title');
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/x');
  });

  it('renders lists and code', () => {
    render(<>{renderNodes(nodes('- one\n- two\n\n```ts\nconst a = 1;\n```'), {})}</>);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('const a = 1;').tagName).toBe('CODE');
  });

  it('renders a GFM table', () => {
    render(<>{renderNodes(nodes('| a | b |\n| - | - |\n| 1 | 2 |'), {})}</>);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getAllByRole('cell')).toHaveLength(2);
  });

  it('gives a heading the id its text slugs to', () => {
    render(<>{renderNodes(nodes('## When not to use it'), {})}</>);
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('id', 'when-not-to-use-it');
  });
});
