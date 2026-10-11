import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JsonViewer } from './json-viewer';

/** The document as the viewer draws it, one string per line, folds applied. */
function drawn(container: HTMLElement): string[] {
  const body = within(container).getByRole('group');
  return Array.from(body.querySelectorAll(':scope > div > span.whitespace-pre')).map((line) => {
    return line.textContent ?? '';
  });
}

/** The viewer wired to state, which is what `onChange` assumes of whoever holds the document. */
function Editable({ initial, onEdit }: { initial: unknown; onEdit?: (next: unknown) => void }) {
  const [held, setHeld] = useState(initial);
  return (
    <JsonViewer
      value={held}
      label="doc"
      onChange={(next) => {
        setHeld(next);
        onEdit?.(next);
      }}
    />
  );
}

/** A holder that can also be reset from outside, the way a refetch would reset one. */
function Resettable({ initial, replacement }: { initial: unknown; replacement: unknown }) {
  const [held, setHeld] = useState(initial);
  return (
    <>
      <button type="button" onClick={() => setHeld(replacement)}>
        Replace
      </button>
      <JsonViewer value={held} label="doc" onChange={setHeld} />
    </>
  );
}

describe('JsonViewer history', () => {
  it('records one edit per change, however the editor was closed', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const { container } = render(<Editable initial={{ n: 1 }} onEdit={onEdit} />);

    // Committing returns focus to the document, which blurs the input that is still mounted. One
    // change has to stay one entry, or undoing once would appear to do nothing.
    await user.click(screen.getByRole('button', { name: 'Edit n' }));
    await user.clear(screen.getByRole('textbox', { name: 'Value of n' }));
    await user.type(screen.getByRole('textbox', { name: 'Value of n' }), '2{Enter}');

    expect(onEdit).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(drawn(container)).toEqual(['{', '  "n": 1', '}']);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('commits a draft left by clicking away, if it parses', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Editable initial={{ a: 1, b: 2 }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit a' }));
    await user.clear(screen.getByRole('textbox', { name: 'Value of a' }));
    await user.type(screen.getByRole('textbox', { name: 'Value of a' }), '5');
    await user.click(screen.getByRole('button', { name: 'Edit b' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith({ a: 5, b: 2 });
  });

  it('restores a draft left by clicking away, if it does not parse', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const { container } = render(<Editable initial={{ a: 1, b: 2 }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit a' }));
    await user.clear(screen.getByRole('textbox', { name: 'Value of a' }));
    await user.type(screen.getByRole('textbox', { name: 'Value of a' }), 'nope');
    await user.click(screen.getByRole('button', { name: 'Edit b' }));

    expect(onEdit).not.toHaveBeenCalled();
    expect(drawn(container)).toContain('  "a": 1,');
  });

  it('stacks several edits and walks back through them', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editable initial={{ a: 1, b: 2, c: 3 }} />);

    await user.click(screen.getByRole('button', { name: 'Remove c' }));
    await user.click(screen.getByRole('button', { name: 'Remove b' }));
    expect(drawn(container)).toEqual(['{', '  "a": 1', '}']);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(drawn(container)).toEqual(['{', '  "a": 1,', '  "b": 2,', '  "c": 3', '}']);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('drops the redo stack once a new edit is made', async () => {
    const user = userEvent.setup();
    render(<Editable initial={{ a: 1, b: 2 }} />);

    await user.click(screen.getByRole('button', { name: 'Remove b' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Remove a' }));
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('drops the stack when the document is replaced from outside', async () => {
    const user = userEvent.setup();
    render(<Resettable initial={{ a: 1, b: 2 }} replacement={{ z: 9 }} />);

    await user.click(screen.getByRole('button', { name: 'Remove b' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    // Undoing onto a document nobody is looking at any more is worse than not undoing.
    await user.click(screen.getByRole('button', { name: 'Replace' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('undoes from the keyboard', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editable initial={{ a: 1, b: 2 }} />);

    await user.click(screen.getByRole('button', { name: 'Remove b' }));
    expect(drawn(container)).toEqual(['{', '  "a": 1', '}']);

    await user.keyboard('{Control>}z{/Control}');
    expect(drawn(container)).toEqual(['{', '  "a": 1,', '  "b": 2', '}']);

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(drawn(container)).toEqual(['{', '  "a": 1', '}']);
  });

  it('records nothing for an edit that changes nothing', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Editable initial={{ n: 1 }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit n' }));
    await user.type(screen.getByRole('textbox', { name: 'Value of n' }), '{Enter}');

    expect(onEdit).toHaveBeenCalledWith({ n: 1 });
    // The document handed back is the one that came in, so nothing downstream sees a change.
    expect(onEdit.mock.calls[0]?.[0]).toEqual({ n: 1 });
  });
});
