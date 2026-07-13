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
  // window.__eer. No UI entry point reaches GroupModal's edit mode yet (that's
  // a detail-panel "Edit" affordance, out of this task's file scope), so this
  // is how a manual smoke test (or a future task) opens any modal by hand, e.g.
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
      {modal?.kind === 'group' && <GroupModal id={modal.id} onClose={closeModal} />}
      {modal?.kind === 'table' && <TableModal id={modal.id} onClose={closeModal} />}
    </EditorContext.Provider>
  );
}
