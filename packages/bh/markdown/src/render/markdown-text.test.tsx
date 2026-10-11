import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownText } from './markdown-text';

describe('MarkdownText', () => {
  it('draws plain markdown with the host elements', () => {
    render(
      <MarkdownText
        source={'## Plan\n\n- **one** and [two](https://example.com)\n\n| A |\n|---|\n| b |'}
        elements={{ strong: ({ children }) => <b data-testid="strong">{children}</b> }}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Plan');
    expect(screen.getByTestId('strong')).toHaveTextContent('one');
    expect(screen.getByRole('link', { name: 'two' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(screen.getByRole('table')).toHaveTextContent('b');
  });

  it('keeps what would be a block or a mark as text, and draws no raw HTML', () => {
    const { container } = render(
      <MarkdownText
        source={[
          ':::note',
          'Inside.',
          ':::',
          '',
          '```callout',
          'type: tip',
          '```',
          '',
          'A :badge[mark] and <b>html</b>.',
        ].join('\n')}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container).toHaveTextContent(':::note Inside. :::');
    expect(container.querySelector('pre code')).toHaveTextContent('type: tip');
    expect(container).toHaveTextContent('A :badge[mark] and html.');
    expect(container.querySelector('b')).toBeNull();
  });
});
