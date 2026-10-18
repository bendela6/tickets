import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parse/parse';
import { noBlocks } from '../registry/registry';
import { MarkdownDoc } from './doc-view';
import type { MarkdownElements } from './elements';

// The package draws plain HTML; the host swaps in its own components, the
// error card included, and each one is handed what it needs.

const registry = noBlocks;

const elements: MarkdownElements = {
  p: (props) => <p data-testid="host-p" {...props} />,
  h2: (props) => <h2 data-testid="host-h2" {...props} />,
  code: ({ children }) => <code data-testid="host-code">{children}</code>,
  codeBlock: ({ lang, value }) => {
    return (
      <pre data-testid="host-code-block" data-lang={lang}>
        {value}
      </pre>
    );
  },
  errorCard: ({ title, reasons }) => {
    return (
      <div role="alert" data-testid="host-card" data-reasons={reasons.length}>
        {title}
      </div>
    );
  },
};

describe('the host’s elements', () => {
  it('draws paragraphs and inline code with the host’s components', () => {
    render(<MarkdownDoc source="Use `size` here." registry={registry} elements={elements} />);
    expect(screen.getByTestId('host-p')).toHaveTextContent('Use size here.');
    expect(screen.getByTestId('host-code')).toHaveTextContent('size');
  });

  it('hands a heading its id, the one the parser lists', () => {
    const source = '## When not to use it';
    render(<MarkdownDoc source={source} registry={registry} elements={elements} />);
    const [heading] = parseDocument(source, registry).headings;
    expect(screen.getByTestId('host-h2')).toHaveAttribute('id', heading?.id);
  });

  it('hands a code block its language and text, apart from inline code', () => {
    render(
      <MarkdownDoc source={'```tsx\n<Button />\n```'} registry={registry} elements={elements} />,
    );
    const block = screen.getByTestId('host-code-block');
    expect(block).toHaveAttribute('data-lang', 'tsx');
    expect(block).toHaveTextContent('<Button />');
    expect(screen.queryByTestId('host-code')).toBeNull();
  });

  it('draws the error card with the host’s component', () => {
    render(<MarkdownDoc source={':::nosuch\nx\n:::'} registry={registry} elements={elements} />);
    const card = screen.getByTestId('host-card');
    expect(card).toHaveTextContent('No renderer named "nosuch"');
    expect(card).toHaveAttribute('data-reasons', '0');
  });

  it('draws plain HTML where the host gives nothing', () => {
    render(<MarkdownDoc source={':::nosuch\nx\n:::'} registry={registry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Block not rendered');
    expect(screen.queryByRole('list')).toBeNull();
  });
});
