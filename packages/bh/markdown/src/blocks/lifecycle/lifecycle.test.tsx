import { toExample } from '../../registry';
import { MarkdownDoc } from '../../render';
import { pageMarkdown, parsePage } from '../../page';
import { validateDocument } from '../../validate';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { markdownBlocks } from '..';
import { lifecycleBlock } from '.';

const registry = markdownBlocks;

const fence = (...lines: string[]) => ['```lifecycle', ...lines, '```'].join('\n');

const src = fence(
  'initial: queued',
  'final: [done]',
  'states:',
  '  queued:  { dispatch: running }',
  '  running: { complete: done }',
  '  done:    {}',
);

const draw = (source: string) => render(<MarkdownDoc source={source} registry={registry} />);

describe('lifecycle', () => {
  it('renders a node per state, as a list of the states', () => {
    draw(src);
    ['queued', 'running', 'done'].forEach((state) => {
      expect(screen.getByTestId(`state-${state}`)).toHaveAttribute('data-state', state);
    });
    const list = screen.getByRole('list', { name: 'States' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  it('labels each transition with its event', () => {
    draw(src);
    expect(screen.getByText('dispatch')).toBeInTheDocument();
    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  it('marks the initial and final states', () => {
    draw(src);
    expect(screen.getByTestId('state-queued')).toHaveAttribute('data-initial', 'true');
    expect(screen.getByTestId('state-done')).toHaveAttribute('data-final', 'true');
  });

  it('marks only the initial and final states', () => {
    draw(src);
    expect(screen.getByTestId('state-running')).not.toHaveAttribute('data-initial');
    expect(screen.getByTestId('state-running')).not.toHaveAttribute('data-final');
    expect(screen.getByTestId('state-queued')).not.toHaveAttribute('data-final');
  });

  it('draws one wire per transition, from its state to its target', () => {
    const { container } = draw(src);
    const wires = [...container.querySelectorAll('[data-testid="lifecycle-edge"]')];
    expect(
      wires.map((wire) => [wire.getAttribute('data-from'), wire.getAttribute('data-to')]),
    ).toEqual([
      ['queued', 'running'],
      ['running', 'done'],
    ]);
  });

  it('labels a self transition on a state stacked in the second row', () => {
    const { container } = draw(
      fence(
        'initial: queued',
        'states:',
        '  queued: { toA: a, toB: b }',
        '  a: {}',
        '  b: { retry: b }',
      ),
    );
    expect(screen.getByText('retry')).toBeInTheDocument();
    expect(container.querySelector('[data-event="retry"]')).toHaveAttribute('data-route', 'self');
  });

  it('marks a state no event leads to', () => {
    draw(fence('initial: a', 'states:', '  a: {}', '  orphan: {}'));
    expect(screen.getByTestId('state-orphan')).toHaveAttribute('data-unreachable', 'true');
    expect(screen.getByTestId('state-a')).not.toHaveAttribute('data-unreachable');
  });

  it('tells a screen reader what each state is and where each event leads', () => {
    draw(
      fence(
        'initial: queued',
        'final: [done]',
        'states:',
        '  queued:  { dispatch: running }',
        '  running: { retry: running, complete: done }',
        '  done:    {}',
      ),
    );
    expect(screen.getByTestId('state-queued')).toHaveTextContent(
      'queued: start state; dispatch leads to running',
    );
    expect(screen.getByTestId('state-running')).toHaveTextContent(
      'running: retry stays here; complete leads to done',
    );
    expect(screen.getByTestId('state-done')).toHaveTextContent('done: end state');
  });

  it('names the diagram in its bar and its list of states', () => {
    draw(fence('title: Job states', 'initial: a', 'states:', '  a: {}'));
    expect(screen.getByText('Job states')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Job states: states' })).toBeInTheDocument();
  });

  it('renders the notes as markdown under the diagram', () => {
    draw(fence('initial: a', 'states:', '  a: {}', 'notes: Holds its **slot**.'));
    expect(screen.getByText('slot').tagName).toBe('STRONG');
  });

  it('draws the notes with the host’s elements', () => {
    render(
      <MarkdownDoc
        source={fence('initial: a', 'states:', '  a: {}', 'notes: Holds its slot.')}
        registry={registry}
        elements={{ p: (props) => <p data-testid="host-p" {...props} /> }}
      />,
    );
    expect(screen.getByTestId('host-p')).toHaveTextContent('Holds its slot.');
  });

  it('rejects a transition pointing at an undeclared state', () => {
    const { errors } = validateDocument(
      fence('initial: a', 'states:', '  a: { go: nowhere }'),
      registry,
    );
    expect(errors[0]).toMatchObject({ block: 'lifecycle', path: 'states.a.go' });
    expect(errors[0]?.message).toMatch(/nowhere/);
  });

  it('rejects an initial state that was never declared', () => {
    const { errors } = validateDocument(fence('initial: typo', 'states:', '  a: {}'), registry);
    expect(errors[0]).toMatchObject({ path: 'initial' });
    expect(errors[0]?.message).toMatch(/typo/);
  });

  it('rejects a final state that was never declared', () => {
    const { errors } = validateDocument(
      fence('initial: a', 'final: [ghost]', 'states:', '  a: {}'),
      registry,
    );
    expect(errors[0]).toMatchObject({ path: 'final.0' });
    expect(errors[0]?.message).toMatch(/ghost/);
  });

  it('does not treat an inherited Object property as a declared state', () => {
    const constructor = validateDocument(
      fence('initial: a', 'states:', '  a: { build: constructor }'),
      registry,
    );
    expect(constructor.errors[0]?.message).toMatch(/constructor/);
    const toString = validateDocument(
      fence('initial: a', 'states:', '  a: { show: toString }'),
      registry,
    );
    expect(toString.errors[0]).toMatchObject({ path: 'states.a.show' });
  });

  it('takes a declared state named after an Object property', () => {
    const source = fence('initial: a', 'states:', '  a: { show: toString }', '  toString: {}');
    expect(validateDocument(source, registry).errors).toEqual([]);
  });

  it('says why a state named constructor is never declared', () => {
    const { errors } = validateDocument(
      fence('initial: constructor', 'states:', '  constructor: {}'),
      registry,
    );
    expect(errors[0]).toMatchObject({ path: 'initial' });
    expect(errors[0]?.message).toMatch(/cannot name a state/);
  });

  it('shows an error card, not a diagram, for a machine that fails its schema', () => {
    draw(fence('initial: a', 'states:', '  a: { go: nowhere }'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('state-a')).toBeNull();
  });
});

describe('lifecycle examples', () => {
  const cases = lifecycleBlock.examples.map((example, index) => {
    return { name: `#${index + 1}`, source: toExample(example).source };
  });

  it.each(cases)('$name validates', ({ source }) => {
    expect(validateDocument(source, registry)).toEqual({ errors: [], warnings: [] });
  });

  it.each(cases)('$name renders without an error card', ({ source }) => {
    draw(source);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });
});

describe("lifecycle in a page's markdown copy", () => {
  const copy = (...lines: string[]) => {
    const yaml = ['body:', '  - lifecycle:', ...lines.map((line) => `      ${line}`)].join('\n');
    return pageMarkdown(parsePage(yaml, registry), registry);
  };

  it('reads as the title, where it starts and ends, and a table of transitions', () => {
    expect(
      copy(
        'title: Job states',
        'initial: queued',
        'final: [done, failed]',
        'states:',
        '  queued:  { dispatch: running }',
        '  running: { complete: done, error: failed }',
        '  done:    {}',
        '  failed:  {}',
        'notes: A failed job is **not** retried.',
      ),
    ).toBe(
      [
        '**Job states**',
        '',
        'Starts at `queued`. Ends at `done` or `failed`.',
        '',
        '| From | Event | To |',
        '|---|---|---|',
        '| `queued` | `dispatch` | `running` |',
        '| `running` | `complete` | `done` |',
        '| `running` | `error` | `failed` |',
        '',
        'A failed job is **not** retried.',
        '',
      ].join('\n'),
    );
  });

  it('names a state no event enters or leaves, so the copy drops nothing', () => {
    expect(copy('initial: a', 'states:', '  a: { go: b }', '  b: {}', '  c: {}', '  d: {}')).toBe(
      [
        'Starts at `a`.',
        '',
        '| From | Event | To |',
        '|---|---|---|',
        '| `a` | `go` | `b` |',
        '',
        'No event enters or leaves `c` and `d`.',
        '',
      ].join('\n'),
    );
  });

  it('says so when no event leads anywhere', () => {
    expect(copy('initial: a', 'final: [a]', 'states:', '  a: {}')).toBe(
      ['Starts at `a`. Ends at `a`.', '', 'No event leads anywhere.', ''].join('\n'),
    );
  });

  it('keeps a | in a name from ending its table cell', () => {
    expect(copy('initial: a', 'states:', '  a: { "x|y": b }', '  b: {}')).toContain(
      '| `a` | `x\\|y` | `b` |',
    );
  });
});
