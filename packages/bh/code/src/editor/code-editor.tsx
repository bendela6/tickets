import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  simplifySelection,
  temporarilySetTabFocusMode,
} from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderText,
  type KeyBinding,
} from '@codemirror/view';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@bh/ui';
import { SYNTAX_HIGHLIGHTER } from '../highlight';
import { editorLanguage } from './languages';

export interface CodeEditorProps {
  /** The text, verbatim. */
  value: string;
  /** The whole text after each edit. */
  onChange?: (value: string) => void;
  /** Picks the grammar: `shell` (or `sh`, `bash`), `dockerfile`, `yaml`. Any other edits plain. */
  lang?: string;
  /** Names the text in the strip above it: its file, or what the script is for. */
  title?: ReactNode;
  /** The editable area's id. */
  id?: string;
  /** Its accessible name; by default the title, when that is text. */
  label?: string;
  /** The id of the element naming it, as a field's label does; wins over `label`. */
  labelledBy?: string;
  /** How tall it starts, in lines. It grows with its text from there. */
  minLines?: number;
  /** Shows the text, numbered and coloured, without taking edits. */
  readOnly?: boolean;
  /** Shown while it is empty. */
  placeholder?: string;
  /** The text has a problem: a red border, and `aria-invalid`. */
  invalid?: boolean;
}

/** One line's height, in px: the code block's, so a fragment and its editor line up. */
const LINE = 20;
/** The space above the first line and below the last, in px. */
const PAD = 10;

/** Marks a change the page made (a new `value`), which is no edit to report. */
const fromValue = Annotation.define<boolean>();

/** The editor's chrome, in the page's tokens, so it themes with the page. */
const THEME = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: `${LINE}px` },
  '.cm-content': { padding: `${PAD}px 0`, caretColor: 'var(--color-gray-12)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--color-gray-8)',
    border: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 16px 0 12px' },
  '.cm-activeLine': { backgroundColor: 'var(--color-indigo-2)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-gray-12)' },
  '.cm-line': { padding: '0 16px 0 0' },
  '.cm-placeholder': { color: 'var(--color-gray-9)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-indigo-4)',
  },
});

/**
 * Tab indents, so Escape lets the next Tab (within two seconds) move on to the
 * next field instead, keeping what Escape does anyway: one caret again.
 */
const ESCAPE_THEN_TAB: KeyBinding = {
  key: 'Escape',
  run: (view) => {
    simplifySelection(view);
    return temporarilySetTabFocusMode(view);
  },
};

/** What a read-only editor drops: the caret's line, which says nothing there. */
const editing = (readOnly: boolean): Extension => {
  return readOnly
    ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
    : [highlightActiveLine(), highlightActiveLineGutter()];
};

interface Naming {
  id?: string;
  name?: string;
  labelledBy?: string;
  readOnly: boolean;
  invalid: boolean;
}

/** What the editable area says about itself: its id, its name, and its state. */
const attributesOf = ({ id, name, labelledBy, readOnly, invalid }: Naming): Extension => {
  const attrs: Record<string, string> = {};
  if (id) {
    attrs.id = id;
  }
  if (labelledBy) {
    attrs['aria-labelledby'] = labelledBy;
  } else if (name) {
    attrs['aria-label'] = name;
  }
  if (readOnly) {
    attrs['aria-readonly'] = 'true';
  }
  if (invalid) {
    attrs['aria-invalid'] = 'true';
  }
  return EditorView.contentAttributes.of(attrs);
};

interface Caret {
  line: number;
  column: number;
  lines: number;
}

const caretOf = (state: EditorState): Caret => {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  return { line: line.number, column: head - line.from + 1, lines: state.doc.lines };
};

/**
 * Code being written: a strip naming it, with its line count and where the
 * caret is, then the lines, numbered and coloured as a `CodeBlock` colours
 * them. It has no scroll box of its own: it starts `minLines` tall and grows
 * with its text, so the page is the one thing that scrolls. A long line
 * scrolls sideways inside it, as in a code block.
 *
 * Tab indents, as in any editor; Escape, then Tab, moves on to the next field
 * (and Ctrl-M, Shift-Alt-M on a Mac, turns that on until pressed again).
 */
export function CodeEditor({
  value,
  onChange,
  lang,
  title,
  id,
  label,
  labelledBy,
  minLines = 6,
  readOnly = false,
  placeholder,
  invalid = false,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changed = useRef(onChange);
  changed.current = onChange;
  const name = label ?? (typeof title === 'string' ? title : undefined);
  // The props the editor is made with; later changes reach it below.
  const made = useRef({
    value,
    lang,
    readOnly,
    placeholder,
    minLines,
    id,
    name,
    labelledBy,
    invalid,
  });
  const language = useRef(new Compartment());
  const edits = useRef(new Compartment());
  const attributes = useRef(new Compartment());
  const [caret, setCaret] = useState<Caret>(() => {
    return { line: 1, column: 1, lines: value.split('\n').length };
  });

  useEffect(() => {
    const first = made.current;
    const editor = new EditorView({
      parent: host.current ?? undefined,
      state: EditorState.create({
        doc: first.value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([ESCAPE_THEN_TAB, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          language.current.of(editorLanguage(first.lang) ?? []),
          edits.current.of(editing(first.readOnly)),
          attributes.current.of(attributesOf(first)),
          syntaxHighlighting(SYNTAX_HIGHLIGHTER),
          first.placeholder ? placeholderText(first.placeholder) : [],
          THEME,
          EditorView.theme({
            '.cm-scroller': { minHeight: `${first.minLines * LINE + 2 * PAD}px` },
          }),
          EditorView.updateListener.of((update) => {
            const outside = update.transactions.some((tr) => tr.annotation(fromValue));
            if (update.docChanged && !outside) {
              changed.current?.(update.state.doc.toString());
            }
            if (update.docChanged || update.selectionSet) {
              setCaret(caretOf(update.state));
            }
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    view.current?.dispatch({
      effects: attributes.current.reconfigure(
        attributesOf({ id, name, labelledBy, readOnly, invalid }),
      ),
    });
  }, [id, name, labelledBy, readOnly, invalid]);

  useEffect(() => {
    view.current?.dispatch({
      effects: language.current.reconfigure(editorLanguage(lang) ?? []),
    });
  }, [lang]);

  useEffect(() => {
    view.current?.dispatch({ effects: edits.current.reconfigure(editing(readOnly)) });
  }, [readOnly]);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
        annotations: fromValue.of(true),
      });
    }
  }, [value]);

  return (
    <div
      data-lang={lang}
      className={cn(
        'rounded-6 overflow-hidden border-1',
        readOnly ? 'bg-surface-raised' : 'bg-surface-field focus-within:border-indigo-9',
        invalid ? 'border-red-9' : 'border-gray-6',
      )}
    >
      <div className="bg-surface-inset border-gray-6 text-11 text-gray-10 flex h-36 items-center gap-8 border-b-1 px-12 font-mono">
        {title ? <span className="text-12 text-gray-12 min-w-0 truncate">{title}</span> : null}
        <span className="flex-1" />
        <span className="tabular-nums">
          {caret.lines} {caret.lines === 1 ? 'line' : 'lines'}
        </span>
        {readOnly ? null : (
          <>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Ln {caret.line}, Col {caret.column}
            </span>
          </>
        )}
        {lang ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{lang}</span>
          </>
        ) : null}
      </div>
      <div ref={host} />
    </div>
  );
}
