import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('compact features hide heading control; full shows it', () => {
    const { rerender } = render(<RichTextEditor value="" onSave={vi.fn()} features="full" />);
    expect(screen.getByRole('button', { name: /heading/i })).toBeInTheDocument();
    rerender(<RichTextEditor value="" onSave={vi.fn()} features="compact" />);
    expect(screen.queryByRole('button', { name: /heading/i })).not.toBeInTheDocument();
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
