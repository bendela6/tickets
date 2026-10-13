import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeBlock } from '.';

const rows = (container: HTMLElement) => [...container.querySelectorAll('[data-line]')];

describe('CodeBlock', () => {
  it('draws a line per line of the value, without the last newline', () => {
    const { container } = render(<CodeBlock value={'a\nb\n'} />);
    expect(rows(container)).toHaveLength(2);
  });

  it('names its file and language in the strip', () => {
    render(<CodeBlock value="FROM node:22" lang="dockerfile" file="Dockerfile" />);
    expect(screen.getByText('Dockerfile')).toBeInTheDocument();
    expect(screen.getByText('dockerfile')).toBeInTheDocument();
  });

  it.each([
    ['sh', 'echo "hi" # say it'],
    ['dockerfile', 'FROM node:22\nRUN pnpm install'],
  ])('colours %s', (lang, sample) => {
    const { container } = render(<CodeBlock value={sample} lang={lang} />);
    expect(container.querySelectorAll('[data-code] span').length).toBeGreaterThan(0);
  });
});
