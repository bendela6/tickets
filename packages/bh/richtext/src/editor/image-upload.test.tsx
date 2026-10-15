import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';
import type { DocNode } from '../detect';
import { sizeOf } from './image-upload';
import { docOf, Held, paragraph, parsed, textbox } from './test/held';

/** Every node of a document, depth first. */
const nodesOf = (doc: DocNode): DocNode[] => [doc, ...(doc.content ?? []).flatMap(nodesOf)];
const imagesIn = (value: unknown) => nodesOf(parsed(value)).filter((node) => node.type === 'image');

const png = (name = 'shot.png') => {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
};

/** An upload the test settles: each call waits until it is told how it went. */
function fakeUpload() {
  const calls: {
    file: File;
    progress: (percent: number) => void;
    done: (src: string) => void;
    fail: (error: Error) => void;
  }[] = [];
  const upload = vi.fn((file: File, progress: (percent: number) => void) => {
    return new Promise<string>((resolve, reject) => {
      calls.push({ file, progress, done: resolve, fail: reject });
    });
  });
  return { upload, calls };
}

const paste = (files: File[]) => {
  fireEvent.paste(textbox(), { clipboardData: { files, getData: () => '' } });
};

describe('image upload', () => {
  it('holds a pasted image’s place while it goes up, with its progress, then puts the image there', async () => {
    const user = userEvent.setup();
    const { upload, calls } = fakeUpload();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('see'))} uploadImage={upload} onChange={onChange} />);
    await user.click(textbox());
    paste([png()]);

    expect(upload).toHaveBeenCalledOnce();
    expect(upload.mock.calls[0]?.[0].name).toBe('shot.png');
    const bar = screen.getByRole('progressbar', { name: 'Uploading shot.png' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    // Nothing in the document yet: only a place for it.
    expect(onChange).not.toHaveBeenCalled();

    act(() => calls[0]?.progress(40.4));
    expect(bar).toHaveAttribute('aria-valuenow', '40');

    await act(async () => calls[0]?.done('https://cdn.example/shot.png'));
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(imagesIn(onChange.mock.lastCall?.[0])).toEqual([
      expect.objectContaining({
        attrs: expect.objectContaining({ src: 'https://cdn.example/shot.png', alt: 'shot.png' }),
      }),
    ]);
    expect(textbox().querySelector('img')).toHaveAttribute('src', 'https://cdn.example/shot.png');
  });

  it('keeps what is typed while an image goes up, puts it where it was pasted, and leaves the caret be', async () => {
    const user = userEvent.setup();
    const { upload, calls } = fakeUpload();
    const onChange = vi.fn();
    render(<Held uploadImage={upload} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('before');
    paste([png()]);
    await user.keyboard(' after');
    await act(async () => calls[0]?.done('/a.png'));
    // The typing goes on where it was, not at the image.
    await user.keyboard(' more');

    const doc = parsed(onChange.mock.lastCall?.[0]);
    const text = nodesOf(doc)
      .map((node) => (node.type === 'image' ? '[image]' : (node.text ?? '')))
      .join('');
    expect(text).toBe('before[image] after more');
  });

  it('says a failed upload failed, without touching the text, and Retry tries again', async () => {
    const user = userEvent.setup();
    const { upload, calls } = fakeUpload();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('kept'))} uploadImage={upload} onChange={onChange} />);
    await user.click(textbox());
    paste([png('big.png')]);
    await act(async () => calls[0]?.fail(new Error('Too large')));

    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed: Too large');
    expect(screen.getByRole('alert')).toHaveTextContent(`big.png · ${sizeOf(3)}`);
    expect(textbox()).toHaveTextContent('kept');
    await user.keyboard(' still here');
    expect(imagesIn(onChange.mock.lastCall?.[0])).toEqual([]);

    // A second press while it goes up again starts nothing more.
    const retry = screen.getByRole('button', { name: 'Retry' });
    await user.click(retry);
    fireEvent.click(retry);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[1]?.[0].name).toBe('big.png');
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => calls[1]?.done('/big.png'));
    expect(imagesIn(onChange.mock.lastCall?.[0])).toHaveLength(1);
    expect(textbox()).toHaveTextContent('kept');
    expect(textbox()).toHaveTextContent('still here');
  });

  it('takes a failed upload’s place away on Remove, and nothing goes in', async () => {
    const user = userEvent.setup();
    const { upload, calls } = fakeUpload();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('kept'))} uploadImage={upload} onChange={onChange} />);
    await user.click(textbox());
    paste([png()]);
    await act(async () => calls[0]?.fail(new Error('Offline')));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(textbox().querySelector('[data-upload-place]')).toBeNull();
    expect(upload).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uploads the images the toolbar’s Image picks, and a dropped one', async () => {
    const user = userEvent.setup();
    const { upload, calls } = fakeUpload();
    const onChange = vi.fn();
    const { container } = render(<Held uploadImage={upload} onChange={onChange} />);
    const picker = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(picker).toHaveAttribute('accept', 'image/*');
    const opened = vi.spyOn(picker as HTMLInputElement, 'click');
    await user.click(textbox());
    await user.click(screen.getByRole('button', { name: 'Image' }));
    expect(opened).toHaveBeenCalledOnce();

    await user.upload(picker as HTMLInputElement, png('picked.png'));
    expect(upload.mock.lastCall?.[0].name).toBe('picked.png');

    // jsdom lays nothing out, so ProseMirror finds no place under the pointer:
    // the drop is said to land at the text's start.
    const { view } = (textbox() as HTMLElement & { editor: Editor }).editor;
    vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: 1, inside: -1 });
    fireEvent.drop(textbox(), {
      dataTransfer: { files: [png('dropped.png')], types: ['Files'], getData: () => '' },
    });
    expect(upload.mock.lastCall?.[0].name).toBe('dropped.png');
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);

    await act(async () => {
      calls[0]?.done('/picked.png');
      calls[1]?.done('/dropped.png');
    });
    expect(imagesIn(onChange.mock.lastCall?.[0]).map((image) => image.attrs?.['src'])).toEqual(
      expect.arrayContaining(['/picked.png', '/dropped.png']),
    );
  });

  it('offers / Image while it uploads, and nothing of images without an upload', async () => {
    const user = userEvent.setup();
    const { upload } = fakeUpload();
    const { unmount, container } = render(<Held uploadImage={upload} slashCommands />);
    const opened = vi.spyOn(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      'click',
    );
    await user.click(textbox());
    await user.keyboard('/ima');
    await user.click(await screen.findByRole('option', { name: 'Image' }));
    expect(opened).toHaveBeenCalledOnce();
    unmount();

    const onChange = vi.fn();
    const without = render(<Held slashCommands onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Image' })).toBeNull();
    expect(without.container.querySelector('input[type="file"]')).toBeNull();
    await user.click(textbox());
    await user.keyboard('/ima');
    expect(screen.queryByRole('option', { name: 'Image' })).toBeNull();
    await user.keyboard('{Escape}');
    paste([png()]);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('sizeOf', () => {
  it('reads a size in bytes, kilobytes or megabytes', () => {
    expect(sizeOf(512)).toBe('512 B');
    expect(sizeOf(2048)).toBe('2.0 KB');
    expect(sizeOf(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
