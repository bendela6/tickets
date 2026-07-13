// Owns "which modal is open, for which id" and renders it — the single place
// that decides which component answers a given EditorModal. Wrap the app in
// this (inside <DiagramProvider>) so any descendant (top-bar buttons, the add
// chooser, …) can call useEditor().openModal without prop-drilling.

import { useEffect, useState, type ReactNode } from 'react';

import { AddChooser } from './add-chooser';
import { EditorContext, type EditorModal } from './editor-context';
import { GroupModal } from './group-modal';
import { ModelModal } from './model-modal';
import { NewModelModal } from './new-model-modal';
import { TableModal } from './table-modal';

export function EditorModals({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<EditorModal | null>(null);
  const closeModal = () => setModal(null);

  // DEV handle for browser verification — same idiom as diagram-provider's
  // window.__eer. The detail panel's "Edit" button is the normal entry point
  // into GroupModal/TableModal's edit mode now, but this remains the way a
  // manual smoke test opens any modal by hand, e.g.
  // window.__editor.openModal({ kind: 'group', id: 'some-zone' }).
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __editor: unknown }).__editor = { openModal: setModal, closeModal };
    }
  }, []);

  return (
    <EditorContext.Provider value={{ modal, openModal: setModal, closeModal }}>
      {children}
      {modal?.kind === 'model' && <ModelModal onClose={closeModal} />}
      {modal?.kind === 'new-model' && <NewModelModal onClose={closeModal} />}
      {modal?.kind === 'add' && <AddChooser onClose={closeModal} />}
      {/* `key` forces a remount whenever the target id changes — GroupModal/TableModal
          seed their draft state with useState(existing?.field ?? …) once, at mount, so
          without this, opening the modal for A then (without a full unmount in between)
          for B would keep showing A's fields. */}
      {modal?.kind === 'group' && <GroupModal key={`group:${modal.id ?? 'new'}`} id={modal.id} onClose={closeModal} />}
      {modal?.kind === 'table' && <TableModal key={`table:${modal.id ?? 'new'}`} id={modal.id} onClose={closeModal} />}
    </EditorContext.Provider>
  );
}
