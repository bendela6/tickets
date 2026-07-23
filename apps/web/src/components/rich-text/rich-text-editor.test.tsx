import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './rich-text-editor';
import { RichTextView } from './rich-text-view';

afterEach(() => vi.restoreAllMocks());

const storedDoc = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'from doc' }] }],
});

describe('RichTextEditor', () => {
  it('renders legacy markdown content', () => {
    render(<RichTextEditor value={'# Legacy\n\nbody'} onSave={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Legacy');
  });

  it('renders stored doc JSON and saves doc JSON on blur when changed', () => {
    const onSave = vi.fn();
    render(<RichTextEditor value={storedDoc} onSave={onSave} />);
    expect(screen.getByText('from doc')).toBeInTheDocument();
    const surface = document.querySelector('[contenteditable="true"]')!;
    fireEvent.blur(surface);
    expect(onSave).not.toHaveBeenCalled(); // unchanged → no save
  });

  it('compact features hide the block-type select; full shows it', () => {
    const { rerender } = render(<RichTextEditor value="" onSave={vi.fn()} features="full" />);
    expect(screen.getByRole('button', { name: 'Paragraph' })).toBeInTheDocument();
    rerender(<RichTextEditor value="" onSave={vi.fn()} features="compact" />);
    expect(screen.queryByRole('button', { name: 'Paragraph' })).not.toBeInTheDocument();
  });

  it('block-type select applies a heading via editor commands and reflects the cursor', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} features="full" />);
    await user.click(screen.getByRole('button', { name: 'Paragraph' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Heading 2' }));
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Heading 2' })).toBeInTheDocument();
  });

  it('full config renders the overflow "+" menu with highlight/color/callout/collapsible/divider', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} features="full" />);
    await user.click(screen.getByRole('button', { name: /more formatting/i }));
    expect(await screen.findByRole('menuitem', { name: /highlight/i })).toBeInTheDocument();
    expect(screen.getByText('Text color')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /callout/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /collapsible section/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /divider/i })).toBeInTheDocument();
  });

  it('compact config has no overflow menu and drops underline/ordered-list/quote from the strip', () => {
    render(<RichTextEditor value="" onSave={vi.fn()} features="compact" />);
    expect(screen.queryByRole('button', { name: /more formatting/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'underline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'orderedList' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'blockquote' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'bold' })).toBeInTheDocument();
  });

  it('compact config renders an "@" control that inserts the mention trigger', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} features="compact" />);
    await user.click(screen.getByRole('button', { name: 'at' }));
    expect(document.querySelector('[contenteditable="true"]')!.textContent).toBe('@');
  });

  it('separators collapse with their group instead of doubling up or trailing', () => {
    // link, lists (bulletList+orderedList), blocks (codeBlock) — no headings
    // (no block-select) and no highlight/color/callout/details/divider (no
    // overflow "+"), so the strip should render exactly 3 group clusters
    // with 2 separators between them — none leading, none trailing.
    render(<RichTextEditor value="" onSave={vi.fn()} features={['link', 'lists', 'codeBlock']} />);
    const toolbarWrap = document.querySelector('.rt')!.previousElementSibling!;
    const toolbarRoot = toolbarWrap.firstElementChild!;
    const clusters = toolbarRoot.querySelectorAll(':scope > div');
    expect(clusters).toHaveLength(3);
    expect(toolbarRoot.firstElementChild).toBe(clusters[0]); // no leading separator
    expect(toolbarRoot.lastElementChild).toBe(clusters[2]); // no trailing separator
  });

  it('overflow-only config (no strip groups, no block-select) renders the "+" button with no leading separator', () => {
    // features = ['callout','divider'] contribute only overflow-group
    // controls — zero strip groups and no blockType select — so the "+"
    // wrapper must not carry the leading hairline separator meant to divide
    // it from strip content that isn't there.
    render(<RichTextEditor value="" onSave={vi.fn()} features={['callout', 'divider']} />);
    const overflowButton = screen.getByRole('button', { name: /more formatting/i });
    expect(overflowButton).toBeInTheDocument();
    const toolbarWrap = document.querySelector('.rt')!.previousElementSibling!;
    const toolbarRoot = toolbarWrap.firstElementChild!;
    const wrapper = toolbarRoot.lastElementChild!;
    expect(wrapper.contains(overflowButton)).toBe(true);
    expect(wrapper.className).not.toContain('border-l');
  });

  it('focused container gets the accent border + halo; blur restores the hairline', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} />);
    const container = document.querySelector('.rt')!.parentElement!;
    expect(container.className).toContain('border-hairline');
    await user.click(document.querySelector('[contenteditable="true"]')!);
    expect(container.className).toContain('border-accent');
    expect(container.className).toContain('ring-accent-subtle');
    await user.tab();
    expect(container.className).toContain('border-hairline');
  });

  it('disabled container fills with the page background and dims the toolbar', () => {
    render(<RichTextEditor value="" onSave={vi.fn()} disabled />);
    const container = document.querySelector('.rt')!.parentElement!;
    expect(container.className).toContain('bg-app');
    const toolbarWrap = document.querySelector('.rt')!.previousElementSibling!;
    expect(toolbarWrap.className).toContain('opacity-45');
    expect(document.querySelector('.rt')!.className).toContain('cursor-not-allowed');
  });

  it('composer renders the toolbar in a bottom action row with the submit button and ⌘↩ hint', () => {
    const onSubmit = vi.fn();
    render(
      <RichTextEditor
        value=""
        onSave={vi.fn()}
        features="compact"
        composer={{ onSubmit }}
      />,
    );
    expect(screen.getByText('⌘↩')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Comment' });
    expect(button).toBeInTheDocument();
    // Bottom row, not top: the editor content comes BEFORE the toolbar in
    // DOM order when composer is set.
    const content = document.querySelector('.rt')!;
    const actionRow = content.nextElementSibling!;
    expect(actionRow.contains(button)).toBe(true);
    expect(actionRow.querySelector('button[aria-label="bold"]')).not.toBeNull();
  });

  it('composer submit button calls onSubmit with the live serialized doc', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} features="compact" composer={{ onSubmit }} />);
    await user.type(document.querySelector('[contenteditable="true"]')!, 'hi');
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const doc = JSON.parse(onSubmit.mock.calls[0]![0] as string);
    expect(doc.content[0].content[0].text).toBe('hi');
  });

  it('⌘↩ (Mod-Enter) submits the composer instead of inserting a newline', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} features="compact" composer={{ onSubmit }} />);
    const surface = document.querySelector('[contenteditable="true"]')!;
    await user.type(surface, 'hi{Meta>}{Enter}{/Meta}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const doc = JSON.parse(onSubmit.mock.calls[0]![0] as string);
    // Still a single paragraph — Mod-Enter did not insert a newline/split.
    expect(doc.content).toHaveLength(1);
  });

  it('Mod-Enter does not submit while the composer is pending or disabled', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <RichTextEditor value="" onSave={vi.fn()} features="compact" composer={{ onSubmit, submitPending: true }} />,
    );
    const surface = document.querySelector('[contenteditable="true"]')!;
    await user.type(surface, 'hi{Meta>}{Enter}{/Meta}');
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <RichTextEditor value="" onSave={vi.fn()} features="compact" composer={{ onSubmit, submitDisabled: true }} />,
    );
    await user.type(surface, '{Meta>}{Enter}{/Meta}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('a repeat-flagged Mod-Enter keydown does not submit (holding the key down)', () => {
    const onSubmit = vi.fn();
    render(<RichTextEditor value="" onSave={vi.fn()} features="compact" composer={{ onSubmit }} />);
    const surface = document.querySelector('[contenteditable="true"]')!;
    fireEvent.keyDown(surface, { key: 'Enter', metaKey: true, repeat: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('two rapid Mod-Enter keydowns do not double-submit (synchronous lock)', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <RichTextEditor value="" onSave={vi.fn()} features="compact" composer={{ onSubmit }} />,
    );
    const surface = document.querySelector('[contenteditable="true"]')!;
    await user.type(surface, 'hi');

    // Fire both Mod-Enter keydowns back-to-back with NO rerender between them.
    // Both see the stale submitPending value in their closure, but the
    // synchronous lock prevents the second from calling onSubmit.
    fireEvent.keyDown(surface, { key: 'Enter', metaKey: true, repeat: false });
    fireEvent.keyDown(surface, { key: 'Enter', metaKey: true, repeat: false });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submitCurrent no-ops on an empty doc — Mod-Enter with no content does not call onSubmit', () => {
    const onSubmit = vi.fn();
    render(<RichTextEditor value="" onSave={vi.fn()} features="compact" composer={{ onSubmit }} />);
    const surface = document.querySelector('[contenteditable="true"]')!;
    fireEvent.keyDown(surface, { key: 'Enter', metaKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disabled editor is not editable', () => {
    render(<RichTextEditor value="" onSave={vi.fn()} disabled />);
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
  });

  it('disabled prop dynamically toggles editability', () => {
    const { rerender } = render(<RichTextEditor value="" onSave={vi.fn()} disabled={false} />);
    expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument();
    expect(document.querySelector('[contenteditable="false"]')).toBeNull();

    rerender(<RichTextEditor value="" onSave={vi.fn()} disabled={true} />);
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
    expect(document.querySelector('[contenteditable="false"]')).toBeInTheDocument();

    rerender(<RichTextEditor value="" onSave={vi.fn()} disabled={false} />);
    expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument();
    expect(document.querySelector('[contenteditable="false"]')).toBeNull();
  });

  it('pasting an image file uploads it and inserts an image node, no placeholder while pending', async () => {
    let resolveUpload!: (value: Response) => void;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveUpload = resolve;
      }),
    );
    render(<RichTextEditor value="" onSave={vi.fn()} />);
    const surface = document.querySelector('[contenteditable="true"]')!;
    const file = new File([new Uint8Array([1, 2])], 'shot.png', { type: 'image/png' });

    fireEvent.paste(surface, { clipboardData: { files: [file], getData: () => '' } });

    expect(fetchMock).toHaveBeenCalledWith('/api/attachments', expect.objectContaining({ method: 'POST' }));
    expect(document.querySelector('img')).toBeNull(); // no placeholder while the upload is pending

    resolveUpload(new Response(JSON.stringify({ id: 1, url: '/api/attachments/1' }), { status: 201 }));
    await waitFor(() => expect(document.querySelector('img')).not.toBeNull());
    expect(document.querySelector('img')!.getAttribute('src')).toBe('/api/attachments/1');
    expect(document.querySelector('img')!.getAttribute('alt')).toBe('shot.png');
  });

  it('failed paste upload shows an inline error line and inserts nothing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'unsupported attachment type' }), { status: 415 }),
    );
    render(<RichTextEditor value="" onSave={vi.fn()} />);
    const surface = document.querySelector('[contenteditable="true"]')!;
    const file = new File([new Uint8Array([1])], 'x.png', { type: 'image/png' });

    fireEvent.paste(surface, { clipboardData: { files: [file], getData: () => '' } });

    expect(await screen.findByText('unsupported attachment type')).toHaveClass('text-danger');
    expect(document.querySelector('img')).toBeNull();
  });

  it('toolbar image control uploads the picked file and inserts an image node', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 2, url: '/api/attachments/2' }), { status: 201 }),
    );
    render(<RichTextEditor value="" onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'image' }));
    const fileInput = document.querySelector('input[type="file"]')! as HTMLInputElement;
    const file = new File([new Uint8Array([1])], 'toolbar.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(document.querySelector('img')).not.toBeNull());
    expect(document.querySelector('img')!.getAttribute('src')).toBe('/api/attachments/2');
  });

  it('shows the placeholder text on the empty paragraph for an empty doc', () => {
    render(<RichTextEditor value="" onSave={vi.fn()} placeholder="Comment…" />);
    const empty = document.querySelector('.is-editor-empty')!;
    expect(empty).toHaveAttribute('data-placeholder', 'Comment…');
  });

  it('hides the placeholder once the doc has content', () => {
    render(<RichTextEditor value={storedDoc} onSave={vi.fn()} placeholder="Comment…" />);
    expect(document.querySelector('.is-editor-empty')).toBeNull();
  });

  it('shows the placeholder on the empty paragraph for a disabled editor', () => {
    render(<RichTextEditor value="" onSave={vi.fn()} disabled placeholder="Pick a user in the header to comment" />);
    const empty = document.querySelector('.is-editor-empty')!;
    expect(empty).toHaveAttribute('data-placeholder', 'Pick a user in the header to comment');
  });

  it('does not re-fire onSave on a second blur with no further edits', async () => {
    const onSave = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 3, url: '/api/attachments/3' }), { status: 201 }),
    );
    render(<RichTextEditor value="" onSave={onSave} />);
    const surface = document.querySelector('[contenteditable="true"]')!;
    const file = new File([new Uint8Array([1])], 'shot.png', { type: 'image/png' });

    // Change the doc (paste an image — proven elsewhere in this file to
    // land via editor commands, unlike raw contenteditable typing which
    // jsdom doesn't wire through ProseMirror).
    fireEvent.paste(surface, { clipboardData: { files: [file], getData: () => '' } });
    await waitFor(() => expect(document.querySelector('img')).not.toBeNull());

    fireEvent.blur(surface);
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.focus(surface);
    fireEvent.blur(surface); // no edit since the previous save
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('a non-image paste leaves default paste behavior untouched (no upload attempted)', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<RichTextEditor value="" onSave={vi.fn()} />);
    const surface = document.querySelector('[contenteditable="true"]')!;
    const file = new File([new Uint8Array([1])], 'notes.txt', { type: 'text/plain' });

    fireEvent.paste(surface, { clipboardData: { files: [file], getData: () => '' } });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('RichTextView', () => {
  it('renders a doc with a callout even though views never edit', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'callout', attrs: { kind: 'warning' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'careful' }] }] }],
    });
    render(<RichTextView value={doc} />);
    expect(screen.getByText('careful')).toBeInTheDocument();
    expect(document.querySelector('[data-callout="warning"]')).not.toBeNull();
  });
});
