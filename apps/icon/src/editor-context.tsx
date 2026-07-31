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
import { emptyDocument } from './doc/defaults';
import { editorReducer, initialState, type Action, type EditorState } from './doc/store';
import type { IconDoc } from './doc/types';
import { initialView, type ViewState } from './view';

interface Editor {
  state: EditorState;
  dispatch: Dispatch<Action>;
  view: ViewState;
  setView: Dispatch<SetStateAction<ViewState>>;
}

const EditorContext = createContext<Editor | null>(null);

export function EditorProvider({
  doc = emptyDocument('untitled.icon'),
  children,
}: {
  doc?: IconDoc;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(editorReducer, doc, initialState);
  const [view, setView] = useState<ViewState>(() => initialView(doc));
  const value = useMemo(() => ({ state, dispatch, view, setView }), [state, view]);
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): Editor {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error('useEditor must be used inside an EditorProvider');
  return editor;
}
