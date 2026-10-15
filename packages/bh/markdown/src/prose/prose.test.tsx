import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Prose } from './prose';

describe('Prose', () => {
  it('draws markdown in the editor’s look, a fence as a code block', () => {
    const { container } = render(
      <Prose>
        {[
          '## Context',
          '',
          'Keep **one** queue, see [the notes](https://example.com).',
          '',
          '```ts',
          'const a = 1;',
          '```',
          '',
          '| Step | Done |',
          '|---|---|',
          '| one | `yes` |',
        ].join('\n')}
      </Prose>,
    );
    // One look for markdown and documents, the editor's: `.rt` draws every element.
    expect(container.firstElementChild).toHaveClass('rt');
    expect(container.firstElementChild).not.toHaveAttribute('data-rt-doc');
    const heading = screen.getByRole('heading', { level: 2, name: 'Context' });
    // Many notes on one screen: no heading claims an id.
    expect(heading.id).toBe('');
    expect(screen.getByRole('link', { name: 'the notes' }).getAttribute('href')).toBe(
      'https://example.com',
    );
    expect(container.querySelector('pre code')?.textContent).toBe('const a = 1;');
    expect(container.querySelector('td code')).toHaveTextContent('yes');
  });

  it('never runs what it is handed: no blocks, no HTML, no script links', () => {
    const { container } = render(
      <Prose>
        {[
          ':::note',
          'Inside.',
          ':::',
          '',
          '[run](javascript:alert(1)) <img src=x onerror=alert(1)> [mail](mailto:a@b.c)',
        ].join('\n')}
      </Prose>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.textContent).toContain(':::note');
    expect(screen.queryByRole('link', { name: 'run' })).toBeNull();
    expect(container.textContent).toContain('run');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('link', { name: 'mail' })).toBeTruthy();
  });

  it('renders nothing for empty input', () => {
    const { container } = render(<Prose>{'  \n'}</Prose>);
    expect(container.innerHTML).toBe('');
  });
});
