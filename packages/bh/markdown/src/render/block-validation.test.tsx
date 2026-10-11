import { render, screen } from '@testing-library/react';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { createRegistry } from '../registry/registry';
import type { Renderer } from '../registry/types';
import { MarkdownDoc } from './doc-view';

// A block whose data fails its own schema shows an error card in place, so a
// failure that slips past validation is visible rather than silent.

const numbered: Renderer<{ n: number }> = {
  name: 'numbered',
  body: 'data',
  description: 'A renderer requiring a numeric field, used to test page-level validation.',
  schema: v.object({ n: v.number() }),
  examples: ['```numbered\nn: 1\n```'],
  component: ({ data }) => <span data-testid="numbered">{data.n}</span>,
};

const registry = createRegistry([numbered]);

describe('BlockSlot — page-level schema validation', () => {
  it('renders a valid block normally', () => {
    render(<MarkdownDoc source={'```numbered\nn: 1\n```'} registry={registry} />);
    expect(screen.getByTestId('numbered')).toHaveTextContent('1');
  });

  it('renders an error card naming the block and the failing path for invalid data', () => {
    render(<MarkdownDoc source={'```numbered\nn: "x"\n```'} registry={registry} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Block "numbered" failed validation');
    expect(screen.getByRole('listitem')).toHaveTextContent(/^n: /);
    expect(screen.queryByTestId('numbered')).toBeNull();
  });

  it('runs the schema once per parse, not once per render', () => {
    let calls = 0;
    const counted: Renderer<{ n: number }> = {
      name: 'counted',
      body: 'data',
      description: 'Counts how many times its schema is invoked, to check memoisation.',
      schema: {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: (value: unknown) => {
            calls += 1;
            return { value: value as { n: number } };
          },
        },
      },
      examples: ['```counted\nn: 1\n```'],
      component: ({ data }) => <span data-testid="counted">{data.n}</span>,
    };
    const countedRegistry = createRegistry([counted]);
    const source = '```counted\nn: 1\n```';
    const { rerender } = render(<MarkdownDoc source={source} registry={countedRegistry} />);
    rerender(<MarkdownDoc source={source} registry={countedRegistry} />);
    rerender(<MarkdownDoc source={source} registry={countedRegistry} />);
    expect(calls).toBe(1);
  });

  it('falls through to rendering when the schema is asynchronous, rather than throwing', () => {
    const slow: Renderer<{ n: number }> = {
      name: 'slow',
      body: 'data',
      description: 'A renderer whose schema resolves asynchronously.',
      schema: {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: async () => ({ value: { n: 1 } }),
        },
      },
      examples: ['```slow\nn: 1\n```'],
      component: ({ data }) => <span data-testid="slow">{data.n}</span>,
    };
    const slowRegistry = createRegistry([slow]);
    render(<MarkdownDoc source={'```slow\nn: 1\n```'} registry={slowRegistry} />);
    expect(screen.getByTestId('slow')).toBeInTheDocument();
  });
});
