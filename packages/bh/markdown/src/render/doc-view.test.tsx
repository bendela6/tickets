import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRegistry } from '../registry/registry';
import type { Renderer } from '../registry/types';
import { MarkdownDoc } from './doc-view';

const note: Renderer = {
  name: 'note',
  body: 'markdown',
  description: 'A note.',
  examples: [':::note\nx\n:::'],
  component: ({ children }) => <aside data-testid="note">{children}</aside>,
};

const boom: Renderer = {
  name: 'boom',
  body: 'data',
  description: 'Always throws.',
  examples: ['```boom\n{}\n```'],
  component: () => {
    throw new Error('kaboom');
  },
};

const registry = createRegistry([note, boom]);

describe('MarkdownDoc', () => {
  it('renders a block through its registered renderer', () => {
    render(<MarkdownDoc source={':::note\nHello **you**.\n:::'} registry={registry} />);
    expect(screen.getByTestId('note')).toHaveTextContent('Hello you.');
  });

  it('renders a fallback card for an unregistered block', () => {
    render(<MarkdownDoc source={':::nosuch\nx\n:::'} registry={registry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/nosuch/);
  });

  it('isolates a throwing renderer and keeps siblings rendered', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MarkdownDoc source={'# Heading\n\n```boom\n{}\n```\n\nAfter.'} registry={registry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/kaboom/);
    expect(screen.getByRole('heading')).toHaveTextContent('Heading');
    expect(screen.getByText('After.')).toBeInTheDocument();
  });

  it('passes host context through to a renderer', () => {
    const probe: Renderer = {
      name: 'probe',
      body: 'data',
      description: 'Renders a value from host context.',
      examples: ['```probe\n{}\n```'],
      component: ({ ctx }) => <span data-testid="probe">{String(ctx.who)}</span>,
    };
    render(
      <MarkdownDoc
        source={'```probe\n{}\n```'}
        registry={createRegistry([probe])}
        ctx={{ who: 'host' }}
      />,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('host');
  });

  it('keeps a sibling block rendering when its neighbour throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MarkdownDoc source={'```boom\n{}\n```\n\n:::note\nStill here.\n:::'} registry={registry} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/kaboom/);
    expect(screen.getByTestId('note')).toHaveTextContent('Still here.');
  });

  it('recovers a block once the source is fixed and re-parsed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const flaky: Renderer<{ bad?: boolean }> = {
      name: 'flaky',
      body: 'data',
      description: 'Throws only when its body says to, so recovery can be tested.',
      examples: ['```flaky\nbad: false\n```'],
      component: ({ data }) => {
        if (data.bad) {
          throw new Error('kaboom');
        }
        return <span data-testid="flaky">recovered</span>;
      },
    };
    const flakyRegistry = createRegistry([flaky]);

    const { rerender } = render(
      <MarkdownDoc source={'```flaky\nbad: true\n```'} registry={flakyRegistry} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/kaboom/);

    rerender(<MarkdownDoc source={'```flaky\nbad: false\n```'} registry={flakyRegistry} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('flaky')).toHaveTextContent('recovered');
  });
});
