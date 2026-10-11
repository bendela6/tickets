import { createRegistry } from '../../registry';
import { MarkdownDoc } from '../../render';
import { pageMarkdown, parsePage } from '../../page';
import { validateDocument } from '../../validate';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { markdownBlocks } from '..';
import { chordOf } from './schema';

const registry = createRegistry(markdownBlocks);

const page = [
  'body:',
  '  - keyboard:',
  '      - keys: [Enter, Space]',
  '        does: Activates the button.',
  '      - keys: [Ctrl+K]',
  '        does: Opens search.',
].join('\n');

describe('keyboard', () => {
  it('draws a row a shortcut, each key a key, either one of a row working', () => {
    const doc = parsePage(page, registry);
    expect(doc.issues).toEqual([]);
    render(
      <MarkdownDoc
        source={'```keyboard\n- keys: [Enter, Space]\n  does: Activates the button.\n```'}
        registry={registry}
      />,
    );
    const [, row] = screen.getAllByRole('row');
    const cells = within(row as HTMLElement).getAllByRole('cell');
    expect([...(cells[0]?.querySelectorAll('kbd') ?? [])].map((key) => key.textContent)).toEqual([
      'Enter',
      'Space',
    ]);
    expect(cells[0]).toHaveTextContent('EnterorSpace');
    expect(cells[1]).toHaveTextContent('Activates the button.');
  });

  it('draws a chord as its keys, joined by +', () => {
    render(
      <MarkdownDoc
        source={'```keyboard\n- keys: [Ctrl+K]\n  does: Opens search.\n```'}
        registry={registry}
      />,
    );
    const keys = [...document.querySelectorAll('kbd')].map((key) => key.textContent);
    expect(keys).toEqual(['Ctrl', 'K']);
  });

  it('reads a + with nothing on one side as the key itself', () => {
    expect(chordOf('Ctrl+Shift+P')).toEqual(['Ctrl', 'Shift', 'P']);
    expect(chordOf('+')).toEqual(['+']);
    expect(chordOf('Ctrl++')).toEqual(['Ctrl', '+']);
  });

  it('rejects a row with no keys, or none that does anything', () => {
    const empty = validateDocument('```keyboard\n- keys: []\n  does: Nothing.\n```', registry);
    expect(empty.errors[0]).toMatchObject({ block: 'keyboard' });
    const silent = validateDocument('```keyboard\n- keys: [Esc]\n```', registry);
    expect(silent.errors[0]).toMatchObject({ block: 'keyboard' });
  });

  it("reads as a table in a page's markdown copy", () => {
    expect(pageMarkdown(parsePage(page, registry), registry)).toBe(
      [
        '| Key | Does |',
        '|---|---|',
        '| `Enter` or `Space` | Activates the button. |',
        '| `Ctrl+K` | Opens search. |',
        '',
      ].join('\n'),
    );
  });
});
