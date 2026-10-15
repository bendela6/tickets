import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DocNode } from '../detect';
import { hrefOf } from './link-popover';
import { docOf, Held, paragraph, parsed, textbox } from './test/held';

/** Every node of a document, depth first. */
const nodesOf = (doc: DocNode): DocNode[] => [doc, ...(doc.content ?? []).flatMap(nodesOf)];
const lastDoc = (onChange: ReturnType<typeof vi.fn>) => parsed(onChange.mock.lastCall?.[0]);
/** The text in the last reported document that carries a link, and where it goes. */
const linksIn = (onChange: ReturnType<typeof vi.fn>) => {
  return nodesOf(lastDoc(onChange)).flatMap((node) => {
    const link = node.marks?.find((mark) => mark.type === 'link');
    return link ? [{ text: node.text, href: link.attrs?.['href'] }] : [];
  });
};
const address = () => screen.getByRole('textbox', { name: 'Link address' });

// A link at the very start, where the caret lands when the text takes the focus.
const linked = docOf({
  type: 'paragraph',
  content: [
    {
      type: 'text',
      text: 'the docs',
      marks: [{ type: 'link', attrs: { href: 'https://example.com/docs' } }],
    },
    { type: 'text', text: ' today' },
  ],
});

describe('the link popup', () => {
  it('opens from the toolbar at the selection, and links it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('read this'))} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('{Control>}a{/Control}');
    await user.click(screen.getByRole('button', { name: 'Link' }));

    expect(screen.getByRole('dialog', { name: 'Add link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link' })).toHaveAttribute('aria-expanded', 'true');
    expect(address()).toHaveFocus();
    await user.keyboard('example.com/docs{Enter}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(linksIn(onChange)).toEqual([{ text: 'read this', href: 'https://example.com/docs' }]);
    // The focus is back in the text, and the toolbar shows the link.
    expect(textbox()).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Link' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens on ⌘K, and Escape closes it with the text unchanged and focused', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('plain'))} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('{Control>}k{/Control}');
    expect(address()).toHaveFocus();
    await user.keyboard('somewhere{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(textbox()).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('puts the address in as its own linked text where nothing is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('https://bh.dev{Enter}');
    expect(linksIn(onChange)).toEqual([{ text: 'https://bh.dev', href: 'https://bh.dev' }]);
    // What is typed after it isn't part of the link.
    await user.keyboard(' next');
    expect(linksIn(onChange)).toEqual([{ text: 'https://bh.dev', href: 'https://bh.dev' }]);
    expect(textbox()).toHaveTextContent('https://bh.dev next');
  });

  it('shows the link the caret is in, without taking the focus', async () => {
    const user = userEvent.setup();
    render(<Held initial={linked} />);
    await user.click(textbox());
    const shown = screen.getByRole('dialog', { name: 'Link' });
    expect(within(shown).getByRole('link')).toHaveAttribute('href', 'https://example.com/docs');
    expect(within(shown).getByRole('link')).toHaveAttribute('target', '_blank');
    expect(textbox()).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Link' })).toHaveAttribute('aria-pressed', 'true');

    // Escape puts it away, and the text keeps the focus.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(textbox()).toHaveFocus();
  });

  it('edits the whole link the caret is in', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held initial={linked} onChange={onChange} />);
    await user.click(textbox());
    await user.click(screen.getByRole('button', { name: 'Edit link' }));

    expect(screen.getByRole('dialog', { name: 'Edit link' })).toBeInTheDocument();
    expect(address()).toHaveValue('https://example.com/docs');
    expect(address()).toHaveFocus();
    await user.clear(address());
    await user.keyboard('https://example.com/new{Enter}');

    expect(linksIn(onChange)).toEqual([{ text: 'the docs', href: 'https://example.com/new' }]);
    expect(textbox()).toHaveFocus();
  });

  it('takes the link away, from the shown link or from the editing one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(<Held initial={linked} onChange={onChange} />);
    await user.click(textbox());
    await user.click(screen.getByRole('button', { name: 'Remove link' }));
    expect(linksIn(onChange)).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();

    onChange.mockClear();
    render(<Held initial={linked} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(linksIn(onChange)).toEqual([]);
    expect(textbox()).toHaveFocus();
  });

  it('refuses an address it can’t link to, and says so', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('click'))} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('{Control>}a{/Control}{Control>}k{/Control}');
    await user.keyboard('javascript:alert(1){Enter}');
    expect(address()).toHaveAttribute('aria-invalid', 'true');
    expect(address()).toHaveAccessibleDescription('This address can’t be linked to.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is not there without the link feature', async () => {
    const user = userEvent.setup();
    render(<Held initial={docOf(paragraph('plain'))} features={['marks']} />);
    expect(screen.queryByRole('button', { name: 'Link' })).toBeNull();
    await user.click(textbox());
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('hrefOf', () => {
  it('makes an address with no scheme a web address, and leaves the rest as written', () => {
    expect(hrefOf(' example.com/docs ')).toBe('https://example.com/docs');
    expect(hrefOf('http://example.com')).toBe('http://example.com');
    expect(hrefOf('mailto:me@example.com')).toBe('mailto:me@example.com');
    expect(hrefOf('/docs')).toBe('/docs');
    expect(hrefOf('#top')).toBe('#top');
    expect(hrefOf('')).toBe('');
  });
});
