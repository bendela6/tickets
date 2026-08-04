import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { booleanOf } from './boolean/engine';
import type { BooleanEngine } from './boolean/ops';
import { emptyDocument } from './doc/defaults';
import { editorReducer, initialState, type Action, type EditorState } from './doc/store';
import type { IconDoc } from './doc/types';
import { initialView, type ViewState } from './view';

interface Editor {
  state: EditorState;
  dispatch: Dispatch<Action>;
  view: ViewState;
  setView: Dispatch<SetStateAction<ViewState>>;
  /**
   * What performs a boolean operation.
   *
   * Here rather than imported where it is used, so that a test can hand in a
   * fake and prove the ordering, the placement, the paint and the undo entry
   * without a WebAssembly module anywhere near it. That is the whole return on
   * having stated the engine as one function: the boundary is a value, so it
   * can be replaced.
   */
  engine: BooleanEngine;
}

const EditorContext = createContext<Editor | null>(null);

export function EditorProvider({
  doc = emptyDocument('untitled.icon'),
  engine = booleanOf,
  children,
}: {
  doc?: IconDoc;
  engine?: BooleanEngine;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(editorReducer, doc, initialState);
  const [view, setView] = useState<ViewState>(initialView);
  const value = useMemo(
    () => ({ state, dispatch, view, setView, engine }),
    [state, view, engine],
  );
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): Editor {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error('useEditor must be used inside an EditorProvider');
  return editor;
}
