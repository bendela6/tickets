// Editor modal routing — which modal (if any) is open, and for which id. Any
// component (top-bar buttons, add-chooser, …) can open one via context without
// prop-drilling; <EditorModals/> (editor-modals.tsx) owns the state and renders
// the actual modal for the current EditorModal.

import { createContext, useContext } from 'react';

export type EditorModal =
  | { kind: 'model' } // edit meta / delete current model
  | { kind: 'new-model' } // title input → createModel(seededRaw(title)) → load it
  | { kind: 'add' } // chooser: zone / subgroup / table → opens group/table modal in create mode
  | { kind: 'group'; id?: string }
  | { kind: 'table'; id?: string }
  | { kind: 'import' } // dev-only: scan a drizzle module, dry-run report, Apply loads the merged model
  | { kind: 'export' }; // dev-only: preview generated drizzle source, Write file via the export route

export interface EditorContextValue {
  modal: EditorModal | null;
  openModal: (m: EditorModal) => void;
  closeModal: () => void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor used outside <EditorModals>');
  return ctx;
}
