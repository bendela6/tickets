import { buildExtensions } from '@tickets/richtext';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LinkEditPopover } from './link-popover';

// A real Tiptap Editor (not React-mounted via useEditor) built from the same
// buildExtensions(['link']) production code path uses — gives the popover a
// genuine schema/Link mark/LinkCursorDecoration to work against without
// fighting jsdom's lack of click-to-caret hit-testing (document.elementFromPoint
// is stubbed null in src/test/setup.ts). setTextSelection places the cursor
// deterministically instead.
let mountedElement: HTMLElement | undefined;

function makeLinkEditor(href: string): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  mountedElement = element;
  return new Editor({
    element,
    extensions: buildExtensions(['link']),
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'see ' },
            { type: 'text', text: 'the docs', marks: [{ type: 'link', attrs: { href } }] },
            { type: 'text', text: ' now' },
          ],
        },
      ],
    },
  });
}

describe('LinkEditPopover', () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    mountedElement?.remove();
    mountedElement = undefined;
  });

  it('shows the URL popover once the cursor sits inside a link', () => {
    editor = makeLinkEditor('https://example.com/docs');
    editor.commands.setTextSelection(7); // 2 chars into "the docs" (link range 5..13)
    render(<LinkEditPopover editor={editor} />);
    expect(screen.getByText('https://example.com/docs')).toBeInTheDocument();
  });

  it('does not show the popover once the cursor leaves the link', () => {
    editor = makeLinkEditor('https://example.com/docs');
    editor.commands.setTextSelection(2); // inside "see ", outside the link range
    render(<LinkEditPopover editor={editor} />);
    expect(screen.queryByText('https://example.com/docs')).not.toBeInTheDocument();
  });

  it('remove unsets the link', async () => {
    editor = makeLinkEditor('https://example.com/docs');
    editor.commands.setTextSelection(7);
    render(<LinkEditPopover editor={editor} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove link' }));
    expect(editor.view.dom.querySelector('a')).toBeNull();
  });

  it('edit + Enter updates the href', async () => {
    editor = makeLinkEditor('https://example.com/docs');
    editor.commands.setTextSelection(7);
    render(<LinkEditPopover editor={editor} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit link' }));
    const input = screen.getByRole('textbox', { name: 'Link URL' });
    await user.clear(input);
    await user.type(input, 'https://example.com/updated{Enter}');
    expect(editor.view.dom.querySelector('a')?.getAttribute('href')).toBe('https://example.com/updated');
  });

  it('Escape cancels the edit and leaves the href unchanged', async () => {
    editor = makeLinkEditor('https://example.com/docs');
    editor.commands.setTextSelection(7);
    render(<LinkEditPopover editor={editor} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit link' }));
    const input = screen.getByRole('textbox', { name: 'Link URL' });
    await user.clear(input);
    await user.type(input, 'https://example.com/discarded{Escape}');
    expect(screen.getByText('https://example.com/docs')).toBeInTheDocument();
    expect(editor.view.dom.querySelector('a')?.getAttribute('href')).toBe('https://example.com/docs');
  });

  it('re-arms the popover when cursor moves within the same link after outside click dismissal', async () => {
    editor = makeLinkEditor('https://example.com/docs');
    editor.commands.setTextSelection(7); // 2 chars into "the docs" (link range 5..13)
    render(<LinkEditPopover editor={editor} />);
    expect(screen.getByText('https://example.com/docs')).toBeInTheDocument();

    // Simulate outside mousedown to dismiss the popover by clicking on an external element
    const externalElement = document.createElement('div');
    document.body.appendChild(externalElement);
    externalElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    // Wait for the popover to be dismissed
    await waitFor(() => {
      expect(screen.queryByText('https://example.com/docs')).not.toBeInTheDocument();
    });

    // Move cursor to a different offset within the same link
    editor.commands.setTextSelection(8);

    // Wait for the popover to re-appear
    await waitFor(() => {
      expect(screen.getByText('https://example.com/docs')).toBeInTheDocument();
    });

    // Cleanup
    externalElement.remove();
  });
});
