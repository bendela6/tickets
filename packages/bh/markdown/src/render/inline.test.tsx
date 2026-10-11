import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRegistry } from '../registry/registry';
import type { Renderer } from '../registry/types';
import { MarkdownDoc } from './doc-view';

const badge: Renderer<string> = {
  name: 'badge',
  body: 'text',
  inline: true,
  description: 'An inline badge.',
  examples: ['Release :badge[stable]{color=green} today.'],
  component: ({ data, attrs }) => {
    return (
      <span data-testid="badge" data-color={attrs.color}>
        {data}
      </span>
    );
  },
};

const registry = createRegistry([badge]);

describe('inline marks', () => {
  it('renders a mark inside a paragraph, keeping the surrounding text', () => {
    render(
      <MarkdownDoc source={'Release :badge[stable]{color=green} today.'} registry={registry} />,
    );
    expect(screen.getByTestId('badge')).toHaveTextContent('stable');
    expect(screen.getByTestId('badge')).toHaveAttribute('data-color', 'green');
    expect(screen.getByText(/Release/)).toBeInTheDocument();
    expect(screen.getByText(/today\./)).toBeInTheDocument();
  });

  it('renders a mark inside a heading', () => {
    render(<MarkdownDoc source={'# Jobs :badge[stable]{color=green}'} registry={registry} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Jobs stable');
  });

  it('leaves an unregistered mark as literal text', () => {
    render(<MarkdownDoc source={'A :nosuch[thing] here.'} registry={registry} />);
    expect(screen.getByText(/:nosuch\[thing\]/)).toBeInTheDocument();
  });

  it('recovers a throwing inline mark once the source changes', () => {
    let shouldThrow = true;
    const flaky: Renderer<string> = {
      name: 'flaky',
      body: 'text',
      inline: true,
      description: 'A renderer that throws until told not to.',
      examples: ['A :flaky[x] mark.'],
      component: () => {
        if (shouldThrow) {
          throw new Error('boom');
        }
        return <span data-testid="flaky-ok">ok</span>;
      },
    };
    const flakyRegistry = createRegistry([flaky]);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <MarkdownDoc source={'A :flaky[x] mark.'} registry={flakyRegistry} />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    rerender(<MarkdownDoc source={'A :flaky[x] mark, changed.'} registry={flakyRegistry} />);
    expect(screen.getByTestId('flaky-ok')).toBeInTheDocument();
  });
});
