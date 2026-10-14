import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  describe('its copy button', () => {
    afterEach(() => vi.unstubAllGlobals());

    function clipboard(writeText: (text: string) => Promise<void>) {
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    }

    it('copies the code without its last newline, and says Copied', async () => {
      const writeText = vi.fn(() => Promise.resolve());
      clipboard(writeText);
      render(<CodeBlock value={'a\nb\n'} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      expect(writeText).toHaveBeenCalledWith('a\nb');
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });

    it('says Could not copy when the browser refuses', async () => {
      clipboard(() => Promise.reject(new Error('denied')));
      render(<CodeBlock value="a" />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      expect(screen.getByRole('button', { name: 'Could not copy' })).toBeInTheDocument();
    });
  });
});
