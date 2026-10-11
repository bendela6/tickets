import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JsonViewer } from './json-viewer';
import { addMemberAtPointer } from './utils/add-member-at-pointer';
import { deleteAtPointer } from './utils/delete-at-pointer';
import { nextKey } from './utils/next-key';
import { parentPointer } from './utils/parent-pointer';
import { parsePointer } from './utils/parse-pointer';
import { renameKeyAtPointer } from './utils/rename-key-at-pointer';
import { setAtPointer } from './utils/set-at-pointer';
import { valueAtPointer } from './utils/value-at-pointer';

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

/** The same, for a document that arrives and leaves as text. */
function EditableText({ initial, onEdit }: { initial: string; onEdit?: (next: string) => void }) {
  const [held, setHeld] = useState(initial);
  return (
    <JsonViewer
      source={held}
      label="doc"
      onChange={(next) => {
        setHeld(next);
        onEdit?.(next);
      }}
    />
  );
}

describe('parsePointer', () => {
  it('reads the root as no tokens at all', () => {
    expect(parsePointer('')).toEqual([]);
  });

  it('unescapes a token, slash before tilde', () => {
    expect(parsePointer('/a/b')).toEqual(['a', 'b']);
    expect(parsePointer('/a~1b')).toEqual(['a/b']);
    expect(parsePointer('/a~0b')).toEqual(['a~b']);
    // `~01` unescaped the other way round would become a slash nobody wrote.
    expect(parsePointer('/a~01b')).toEqual(['a~1b']);
  });
});

describe('parentPointer', () => {
  it('splits a pointer into the container and the token', () => {
    expect(parentPointer('/a/b')).toEqual({ parent: '/a', token: 'b' });
    expect(parentPointer('/a')).toEqual({ parent: '', token: 'a' });
  });

  it('says the root sits in nothing', () => {
    expect(parentPointer('')).toBeNull();
  });
});

describe('valueAtPointer', () => {
  it('reads through objects and arrays', () => {
    const document = { a: [{ b: 1 }] };
    expect(valueAtPointer(document, '')).toBe(document);
    expect(valueAtPointer(document, '/a/0/b')).toBe(1);
  });

  it('reads nothing out of a pointer that names nothing', () => {
    expect(valueAtPointer({ a: 1 }, '/a/b')).toBeUndefined();
    expect(valueAtPointer({ a: 1 }, '/z')).toBeUndefined();
  });
});

describe('setAtPointer', () => {
  it('writes a value and leaves the key where it was', () => {
    expect(setAtPointer({ a: 1, b: 2, c: 3 }, '/b', 9)).toEqual({ a: 1, b: 9, c: 3 });
    expect(Object.keys(setAtPointer({ a: 1, b: 2, c: 3 }, '/b', 9) as object)).toEqual([
      //
      'a',
      'b',
      'c',
    ]);
  });

  it('replaces the whole document at the root', () => {
    expect(setAtPointer({ a: 1 }, '', [1, 2])).toEqual([1, 2]);
  });

  it('copies the containers on the path and nothing else', () => {
    const untouched = { deep: true };
    const document = { keep: untouched, change: { n: 1 } };
    const next = setAtPointer(document, '/change/n', 2) as typeof document;
    expect(next).not.toBe(document);
    expect(next.keep).toBe(untouched);
    expect(next.change).not.toBe(document.change);
  });

  it('writes into an array by index', () => {
    expect(setAtPointer({ a: [1, 2, 3] }, '/a/1', 'two')).toEqual({ a: [1, 'two', 3] });
  });

  it('leaves the document alone when the pointer names nothing', () => {
    const document = { a: 1 };
    expect(setAtPointer(document, '/a/b', 2)).toBe(document);
    expect(setAtPointer(document, '/z', 2)).toBe(document);
    expect(setAtPointer({ a: [1] }, '/a/5', 2)).toEqual({ a: [1] });
  });
});

describe('deleteAtPointer', () => {
  it('removes an object key and keeps the order of the rest', () => {
    const next = deleteAtPointer({ a: 1, b: 2, c: 3 }, '/b');
    expect(next).toEqual({ a: 1, c: 3 });
    expect(Object.keys(next as object)).toEqual(['a', 'c']);
  });

  it('splices an array member out, shifting what follows', () => {
    expect(deleteAtPointer({ a: [1, 2, 3] }, '/a/0')).toEqual({ a: [2, 3] });
  });

  it('refuses the root, which would leave no document', () => {
    const document = { a: 1 };
    expect(deleteAtPointer(document, '')).toBe(document);
  });

  it('leaves the document alone when the pointer names nothing', () => {
    const document = { a: 1 };
    expect(deleteAtPointer(document, '/z')).toBe(document);
  });
});

describe('renameKeyAtPointer', () => {
  it('renames in place rather than moving the member to the end', () => {
    const next = renameKeyAtPointer({ a: 1, b: 2, c: 3 }, '/b', 'beta');
    expect(Object.keys(next as object)).toEqual(['a', 'beta', 'c']);
    expect(next).toEqual({ a: 1, beta: 2, c: 3 });
  });

  it('refuses a name a sibling already holds, rather than dropping one of them', () => {
    const document = { a: 1, b: 2 };
    expect(renameKeyAtPointer(document, '/b', 'a')).toBe(document);
  });

  it('refuses an empty name and a rename to the same name', () => {
    const document = { a: 1 };
    expect(renameKeyAtPointer(document, '/a', '')).toBe(document);
    expect(renameKeyAtPointer(document, '/a', 'a')).toBe(document);
  });

  it('refuses an array member, which has an index rather than a key', () => {
    const document = { a: [1] };
    expect(renameKeyAtPointer(document, '/a/0', 'x')).toBe(document);
  });
});

describe('nextKey', () => {
  it('names the first one plainly and numbers the rest', () => {
    expect(nextKey([])).toBe('newKey');
    expect(nextKey(['newKey'])).toBe('newKey2');
    expect(nextKey(['newKey', 'newKey2'])).toBe('newKey3');
  });
});

describe('addMemberAtPointer', () => {
  it('appends a null key to an object and says where it landed', () => {
    expect(addMemberAtPointer({ a: 1 }, '')).toEqual({
      document: { a: 1, newKey: null },
      pointer: '/newKey',
    });
  });

  it('appends a null to an array and says where it landed', () => {
    expect(addMemberAtPointer({ a: [1] }, '/a')).toEqual({
      document: { a: [1, null] },
      pointer: '/a/1',
    });
  });

  it('adds nothing to a scalar, which is not a container', () => {
    expect(addMemberAtPointer({ a: 1 }, '/a')).toBeNull();
  });
});

describe('JsonViewer editing', () => {
  it('stays read-only without an onChange', () => {
    render(<JsonViewer value={{ a: 1 }} label="doc" />);
    expect(screen.queryByRole('button', { name: 'Edit a' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('edits a scalar in place, typed as JSON', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Editable initial={{ attempts: 2, ok: true }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit attempts' }));
    await user.clear(screen.getByRole('textbox', { name: 'Value of attempts' }));
    await user.type(screen.getByRole('textbox', { name: 'Value of attempts' }), '7{Enter}');

    expect(onEdit).toHaveBeenCalledWith({ attempts: 7, ok: true });
  });

  it('reads the draft as JSON, so a type change needs no type picker', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Editable initial={{ n: 1 }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit n' }));
    await user.clear(screen.getByRole('textbox', { name: 'Value of n' }));
    await user.type(screen.getByRole('textbox', { name: 'Value of n' }), '{{}{Enter}');

    expect(onEdit).toHaveBeenCalledWith({ n: {} });
  });

  it('will not commit a draft that is not JSON, and says why', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Editable initial={{ n: 1 }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit n' }));
    await user.clear(screen.getByRole('textbox', { name: 'Value of n' }));
    await user.type(screen.getByRole('textbox', { name: 'Value of n' }), 'nope');

    const input = screen.getByRole('textbox', { name: 'Value of n' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await user.type(input, '{Enter}');
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('restores the line on Escape', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const { container } = render(<Editable initial={{ n: 1 }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit n' }));
    await user.clear(screen.getByRole('textbox', { name: 'Value of n' }));
    await user.type(screen.getByRole('textbox', { name: 'Value of n' }), '9{Escape}');

    expect(onEdit).not.toHaveBeenCalled();
    expect(drawn(container)).toContain('  "n": 1');
  });

  it('renames a key without moving the member', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Editable initial={{ a: 1, b: 2, c: 3 }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Rename b' }));
    await user.clear(screen.getByRole('textbox', { name: 'Key b' }));
    await user.type(screen.getByRole('textbox', { name: 'Key b' }), 'beta{Enter}');

    expect(Object.keys(onEdit.mock.calls[0]?.[0] as object)).toEqual(['a', 'beta', 'c']);
  });

  it('refuses a rename onto a sibling, leaving the document as it was', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const { container } = render(<Editable initial={{ a: 1, b: 2 }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Rename b' }));
    await user.clear(screen.getByRole('textbox', { name: 'Key b' }));
    await user.type(screen.getByRole('textbox', { name: 'Key b' }), 'a{Enter}');

    expect(drawn(container)).toEqual(['{', '  "a": 1,', '  "b": 2', '}']);
  });

  it('adds a member to an object and opens its key for naming', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editable initial={{ a: 1 }} />);

    await user.click(screen.getByRole('button', { name: 'Add a member to the object on line 1' }));

    expect(drawn(container)).toContain('  "a": 1,');
    expect(screen.getByRole('textbox', { name: 'Key newKey' })).toBeTruthy();
  });

  it('adds a member to an array and opens its value', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editable initial={{ items: [1] }} />);

    await user.click(screen.getByRole('button', { name: 'Add a member to items' }));

    // The new member's editor is open over its line, so the line only reads back once it closes.
    expect(screen.getByRole('textbox', { name: 'Value of the value on line 4' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(drawn(container)).toEqual(['{', '  "items": [', '    1,', '    null', '  ]', '}']);
  });

  it('opens a container that was folded shut when a member is added to it', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editable initial={{ nested: { a: 1 } }} />);

    await user.click(screen.getByRole('button', { name: 'Collapse nested' }));
    expect(drawn(container)).toEqual(['{', '  "nested": { 1 key }', '}']);

    await user.click(screen.getByRole('button', { name: 'Add a member to nested' }));
    await user.keyboard('{Escape}');
    expect(drawn(container)).toEqual([
      //
      '{',
      '  "nested": {',
      '    "a": 1,',
      '    "newKey": null',
      '  }',
      '}',
    ]);
  });

  it('removes a member', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Editable initial={{ a: 1, b: 2 }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Remove b' }));
    expect(onEdit).toHaveBeenCalledWith({ a: 1 });
  });

  it('offers no Remove on the root, which sits in no container', () => {
    render(<Editable initial={{ a: 1 }} />);
    expect(screen.queryByRole('button', { name: 'Remove the object on line 1' })).toBeNull();
  });

  it('replaces a whole branch from the text editor', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Editable initial={{ graph: { nodes: [] } }} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit graph as text' }));
    const draft = screen.getByRole('textbox', { name: 'graph as text' });
    await user.clear(draft);
    // `{{` and `[[` are userEvent's escapes for the literal brackets.
    await user.type(draft, '{{"nodes":[[1]}');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEdit).toHaveBeenCalledWith({ graph: { nodes: [1] } });
  });

  it('shows a branch opened as text in one place only', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editable initial={{ graph: { nodes: [] }, other: 1 }} />);

    await user.click(screen.getByRole('button', { name: 'Edit graph as text' }));

    // The editor stands for the whole branch - its own line and every member it holds - so the
    // only drawn lines left are the ones outside it.
    expect(drawn(container)).toEqual(['{', '  "other": 1', '}']);
    expect(screen.getByRole('textbox', { name: 'graph as text' })).toHaveValue(
      '{\n  "nodes": []\n}',
    );
  });

  it('will not save a branch that is not JSON', async () => {
    const user = userEvent.setup();
    render(<Editable initial={{ graph: {} }} />);

    await user.click(screen.getByRole('button', { name: 'Edit graph as text' }));
    await user.type(screen.getByRole('textbox', { name: 'graph as text' }), 'nope');

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('undoes and redoes an edit', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editable initial={{ a: 1, b: 2 }} />);

    await user.click(screen.getByRole('button', { name: 'Remove b' }));
    expect(drawn(container)).toEqual(['{', '  "a": 1', '}']);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(drawn(container)).toEqual(['{', '  "a": 1,', '  "b": 2', '}']);

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(drawn(container)).toEqual(['{', '  "a": 1', '}']);
  });

  it('has nothing to undo or redo before an edit', () => {
    render(<Editable initial={{ a: 1 }} />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('keeps the reader’s folds through an edit that changes the line count', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editable initial={{ nested: { a: 1 }, b: 2, c: 3 }} />);

    await user.click(screen.getByRole('button', { name: 'Collapse nested' }));
    await user.click(screen.getByRole('button', { name: 'Remove c' }));

    expect(drawn(container)).toEqual(['{', '  "nested": { 1 key },', '  "b": 2', '}']);
  });

  it('hands text back as text when the document arrived as text', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<EditableText initial={'{"a":1}'} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit a' }));
    await user.clear(screen.getByRole('textbox', { name: 'Value of a' }));
    await user.type(screen.getByRole('textbox', { name: 'Value of a' }), '2{Enter}');

    expect(onEdit).toHaveBeenCalledWith('{\n  "a": 2\n}');
  });

  it('repairs text that will not parse, which has no structure to click on', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const { container } = render(<EditableText initial={'{ nope'} onEdit={onEdit} />);

    // Nothing structural is on offer: there are no runs to click and no container to add to.
    expect(screen.queryByRole('button', { name: /^Rename / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add a member/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit as text' }));
    const draft = screen.getByRole('textbox', { name: 'doc as text' });
    await user.clear(draft);
    await user.type(draft, '{{"a":1}');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEdit).toHaveBeenCalledWith('{"a":1}');
    expect(drawn(container)).toEqual(['{', '  "a": 1', '}']);
  });
});
