import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  simplifySelection,
  temporarilySetTabFocusMode,
} from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  gutters,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderText,
  type KeyBinding,
} from '@codemirror/view';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@bh/ui';
import { SYNTAX_HIGHLIGHTER } from '../highlight';
import type { LineProblems } from '../problems';
import { editorLanguage, type FenceLanguage } from './languages';
import { problemLines, setProblems } from './problem-lines';

export interface CodeEditorProps {
  /** The text, verbatim. */
  value: string;
  /** The whole text after each edit. */
  onChange?: (value: string) => void;
  /**
   * Picks the grammar: `shell` (or `sh`, `bash`), `dockerfile`, `yaml`, `tsx`
   * (or `ts`, `jsx`, `js`) and `markdown` (or `md`). Any other edits plain.
   */
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
  /** The lines with a problem: each number in the problem's tone, the line tinted, as a code block marks them. */
  problems?: LineProblems;
  /**
   * The lines alone, with no strip or border: for a pane that names and frames
   * the code itself, as an example's does.
   */
  bare?: boolean;
  /**
   * In markdown, the language a fence's code is in, from its info string; by
   * default the info's first word. Read with `lang`.
   */
  fenceLanguage?: FenceLanguage;
  /**
   * CodeMirror extensions the app adds, such as completions or line wrapping.
   * Read when the editor is made.
   */
  extensions?: Extension;
}

/** One line's height, in px: the code block's, so a fragment and its editor line up. */
const LINE = 20;
/** The space above the first line and below the last, in px: the code block's too. */
const PAD = 12;

const NO_PROBLEMS: LineProblems = new Map();

/** Marks a change the page made (a new `value`), which is no edit to report. */
const fromValue = Annotation.define<boolean>();

/** The editor's chrome, in the page's tokens, so it themes with the page. */
const THEME = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: 'transparent', color: 'var(--color-gray-12)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: `${LINE}px` },
  '.cm-content': { padding: `${PAD}px 0`, caretColor: 'var(--color-gray-12)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--color-gray-8)',
    border: 'none',
  },
  // A code block's gutter: a bar's room on the left, for a problem's.
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 16px 0 12px',
    borderLeft: '2px solid transparent',
    fontVariantNumeric: 'tabular-nums',
  },
  '.cm-activeLine': { backgroundColor: 'var(--color-indigo-2)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-gray-12)' },
  // Without the caret, its line says nothing.
  '&:not(.cm-focused) .cm-activeLine': { backgroundColor: 'transparent' },
  '&:not(.cm-focused) .cm-activeLineGutter': { color: 'var(--color-gray-8)' },
  '.cm-line': { padding: '0 16px 0 0' },
  '.cm-placeholder': { color: 'var(--color-gray-9)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-indigo-4)',
  },
  '.cm-matchingBracket': { backgroundColor: 'var(--color-gray-4)', outline: 'none' },
  '.cm-gutterElement.cm-problem-error': {
    borderLeftColor: 'var(--color-red-9)',
    color: 'var(--color-red-11)',
  },
  '.cm-gutterElement.cm-problem-warning': {
    borderLeftColor: 'var(--color-orange-9)',
    color: 'var(--color-orange-11)',
  },
  '.cm-line.cm-problem-error': { backgroundColor: 'var(--color-red-3)' },
  '.cm-line.cm-problem-warning': { backgroundColor: 'var(--color-orange-3)' },
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
  problems,
  bare = false,
  fenceLanguage,
  extensions = [],
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
    fenceLanguage,
    readOnly,
    placeholder,
    minLines,
    id,
    name,
    labelledBy,
    invalid,
    problems: problems ?? NO_PROBLEMS,
    extensions,
  });
  const language = useRef(new Compartment());
  const edits = useRef(new Compartment());
  const attributes = useRef(new Compartment());
  const [caret, setCaret] = useState<Caret>(() => {
    return { line: 1, column: 1, lines: value.split('\n').length };
  });

  // Made before the browser paints, so an editor that takes the place of the
  // code it loaded behind never shows the pane empty between the two.
  useLayoutEffect(() => {
    const first = made.current;
    const editor = new EditorView({
      parent: host.current ?? undefined,
      state: EditorState.create({
        doc: first.value,
        extensions: [
          // The numbers scroll sideways with their lines, as in a code block.
          gutters({ fixed: false }),
          lineNumbers(),
          history(),
          indentOnInput(),
          bracketMatching(),
          keymap.of([ESCAPE_THEN_TAB, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          language.current.of(editorLanguage(first.lang, first.fenceLanguage) ?? []),
          edits.current.of(editing(first.readOnly)),
          attributes.current.of(attributesOf(first)),
          problemLines(first.problems),
          syntaxHighlighting(SYNTAX_HIGHLIGHTER),
          first.placeholder ? placeholderText(first.placeholder) : [],
          THEME,
          EditorView.theme({
            '.cm-scroller': { minHeight: `${first.minLines * LINE + 2 * PAD}px` },
          }),
          first.extensions,
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
      effects: language.current.reconfigure(editorLanguage(lang, fenceLanguage) ?? []),
    });
  }, [lang, fenceLanguage]);

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

  // After the value, so the problems land on the lines of the text they are about.
  useEffect(() => {
    view.current?.dispatch({ effects: setProblems.of(problems ?? NO_PROBLEMS) });
  }, [problems]);

  // Bare or framed, the lines stay in the same place, so the editor made in
  // them survives a change from one to the other.
  return (
    <div
      data-lang={lang}
      className={cn(
        !bare && 'rounded-6 overflow-hidden border-1',
        !bare && (readOnly ? 'bg-surface-raised' : 'bg-surface-field focus-within:border-indigo-9'),
        !bare && (invalid ? 'border-red-9' : 'border-gray-6'),
      )}
    >
      {bare ? null : (
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
      )}
      <div ref={host} />
    </div>
  );
}
