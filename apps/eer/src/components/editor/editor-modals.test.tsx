import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import type { EditorContextValue } from './editor-context';
import { useEditor } from './editor-context';
import { EditorModals } from './editor-modals';

afterEach(cleanup);

let editorRef: EditorContextValue | null = null;
function EditorGrab() {
  editorRef = useEditor();
  return null;
}

describe('EditorModals routing', () => {
  // Regression for the carried finding: <TableModal>/<GroupModal> seed their
  // draft with useState(existing?.field ?? …) once, at mount. The routed JSX
  // ({modal?.kind === 'table' && <TableModal id={modal.id} .../>}) stays true
  // across a close+reopen that both land in the SAME React commit (e.g. two
  // context calls inside one handler/batch) — React never renders the
  // intermediate "closed" frame, so it diffs TableModal(id=A) straight against
  // TableModal(id=B): same type + position, no key, so it's a prop UPDATE, not
  // a remount, and B's form would show A's stale draft. The `key` in
  // editor-modals.tsx forces the remount regardless of how the open/close
  // calls happen to batch.
  it('remounts the table modal per target id — B never shows a stale draft of A', async () => {
    await renderDiagram(
      <EditorModals>
        <EditorGrab />
      </EditorModals>,
      twoZoneRaw(),
    );

    await act(async () => editorRef!.openModal({ kind: 'table', id: 'users' }));
    expect((screen.getByLabelText('Column 2 name') as HTMLInputElement).value).toBe('name');

    // Both calls in one batch — see the comment above for why this is the
    // actual repro path, not just "click close, then click open".
    await act(async () => {
      editorRef!.closeModal();
      editorRef!.openModal({ kind: 'table', id: 'orders' });
    });

    expect(screen.getByText('Edit orders')).toBeInTheDocument();
    expect((screen.getByLabelText('Column 2 name') as HTMLInputElement).value).toBe('users_id');
    expect((screen.getByLabelText('Column 1 name') as HTMLInputElement).value).toBe('id');
  });

  it('remounts the group modal per target id — B never shows a stale draft of A', async () => {
    await renderDiagram(
      <EditorModals>
        <EditorGrab />
      </EditorModals>,
      twoZoneRaw(),
    );

    await act(async () => editorRef!.openModal({ kind: 'group', id: 'z1' }));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Zone One');

    await act(async () => {
      editorRef!.closeModal();
      editorRef!.openModal({ kind: 'group', id: 'z2' });
    });

    expect(screen.getByText('Edit Zone Two')).toBeInTheDocument();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Zone Two');
  });
});
