import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, test, vi } from 'vitest';
import { FileInput, formatBytes, type UploadFile } from './file-input';

describe('formatBytes', () => {
  it('uses units people read, not bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

const FILES: UploadFile[] = [
  { id: '1', name: 'design.png', size: 1536 },
  { id: '2', name: 'trace.log', progress: 40 },
  { id: '3', name: 'huge.zip', error: 'Larger than 10 MB' },
];

test('it is a drop target AND a button', async () => {
  // Drop-only is unreachable by keyboard; button-only ignores the gesture most
  // people try first.
  const onSelect = vi.fn();
  render(<FileInput value={[]} onChange={() => {}} onSelect={onSelect} label="Attachments" />);
  const target = screen.getByRole('button', { name: 'Attachments' });

  fireEvent.drop(target, { dataTransfer: { files: [new File(['x'], 'a.txt')] } });
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect.mock.calls[0]?.[0][0].name).toBe('a.txt');
});

test('dragging over answers, and leaving takes it back', () => {
  render(<FileInput value={[]} onChange={() => {}} label="Attachments" />);
  const target = screen.getByRole('button', { name: 'Attachments' });
  expect(target).toHaveTextContent('Drop files here');

  fireEvent.dragOver(target);
  expect(target).toHaveTextContent('Drop to attach');

  fireEvent.dragLeave(target);
  expect(target).toHaveTextContent('Drop files here');
});

test('an error belongs to its file, not to the control', () => {
  // One rejected file must not condemn the rest.
  render(<FileInput value={FILES} onChange={() => {}} />);
  expect(screen.getByText('Larger than 10 MB')).toBeInTheDocument();
  expect(screen.getByText('design.png')).toBeInTheDocument();
  expect(screen.getByText('trace.log')).toBeInTheDocument();
});

test('a file in flight shows progress; a settled one shows its size', () => {
  render(<FileInput value={FILES} onChange={() => {}} />);
  expect(screen.getByText('1.5 KB')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

test('each file has its own remove target', async () => {
  const onChange = vi.fn();
  render(<FileInput value={FILES} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Remove trace.log' }));
  expect(onChange).toHaveBeenCalledWith([FILES[0], FILES[2]]);
});

test('a single-file input takes only the first of a multi-drop', () => {
  const onSelect = vi.fn();
  render(
    <FileInput
      value={[]}
      onChange={() => {}}
      onSelect={onSelect}
      multiple={false}
      label="Attachments"
    />,
  );
  fireEvent.drop(screen.getByRole('button', { name: 'Attachments' }), {
    dataTransfer: { files: [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')] },
  });
  expect(onSelect.mock.calls[0]?.[0]).toHaveLength(1);
});

test('read-only shows the files and drops the remove targets', () => {
  render(<FileInput value={FILES} onChange={() => {}} readOnly />);
  expect(screen.getByText('design.png')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
});

test('a locked control refuses a drop', () => {
  const onSelect = vi.fn();
  render(
    <FileInput value={[]} onChange={() => {}} onSelect={onSelect} readOnly label="Attachments" />,
  );
  fireEvent.drop(screen.getByRole('button', { name: 'Attachments' }), {
    dataTransfer: { files: [new File(['x'], 'a.txt')] },
  });
  expect(onSelect).not.toHaveBeenCalled();
});

test('a label for its id names the drop target, and opens the dialog only when it can', async () => {
  // `id` is the button's, so the label names what is focused, and its click
  // goes through the button, which a read-only control refuses.
  const opened = vi.spyOn(HTMLInputElement.prototype, 'click');
  const { rerender } = render(
    <>
      <label htmlFor="files">Files</label>
      <FileInput id="files" value={[]} onChange={() => {}} readOnly />
    </>,
  );
  expect(screen.getByRole('button', { name: 'Files' })).toHaveAttribute('id', 'files');
  await userEvent.click(screen.getByText('Files'));
  expect(opened).not.toHaveBeenCalled();

  rerender(
    <>
      <label htmlFor="files">Files</label>
      <FileInput id="files" value={[]} onChange={() => {}} />
    </>,
  );
  await userEvent.click(screen.getByText('Files'));
  expect(opened).toHaveBeenCalledTimes(1);
});

test('unnamed, the drop target reads its own text', () => {
  render(<FileInput value={[]} onChange={() => {}} />);
  expect(
    screen.getByRole('button', { name: 'Drop files here, or click to browse' }),
  ).toBeInTheDocument();
});

test('the file input behind the target is out of reach of assistive tech', () => {
  const { container } = render(<FileInput id="files" value={[]} onChange={() => {}} />);
  const input = container.querySelector('input[type="file"]');
  expect(input).not.toHaveAttribute('id');
  expect(input).toHaveAttribute('aria-hidden', 'true');
});

test('each progress bar is named for its file', () => {
  render(<FileInput value={FILES} onChange={() => {}} />);
  expect(screen.getByRole('progressbar', { name: 'Uploading trace.log' })).toBeInTheDocument();
});
