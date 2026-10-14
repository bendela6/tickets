// A JSON document as something to read - and, when the caller hands it an `onChange`, to edit:
// pretty-printed, coloured by what each run is, foldable at every container, numbered down the
// side, and - when it arrives as text rather than as a value - parsed, with the failure pointed at
// instead of swallowed.
//
// The document is flattened to a list of lines (see ./types) rather than rendered as a nested
// tree. Everything on offer here wants a line number: the gutter prints it, a fold jumps over a
// span of them, and a parse error names one.
//
// Editing is structural, not textual. A click lands on a run, and what comes back is a new
// document built by pointer (see ./utils/set-at-pointer and its neighbours) - so a document being
// edited here cannot stop being JSON halfway through, which is the failure mode a textarea has.
// The one editor that does take free text, `TextEdit`, refuses to save anything that will not
// parse.

import { Fragment, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../../../style/cn';
import { Icon } from '../icon';
import { useCopy } from '../use-copy';
import { JsonLine, type LineEditing } from './parts/json-line';
import { LineNumber } from './parts/line-number';
import { RawText } from './parts/raw-text';
import { ToolButton } from './parts/tool-button';
import { TextEdit } from './parts/text-edit';
import type { JsonRow } from './types';
import { useJsonHistory } from './use-json-history';
import { addMemberAtPointer } from './utils/add-member-at-pointer';
import { collapsedByDepth } from './utils/collapsed-by-depth';
import { deleteAtPointer } from './utils/delete-at-pointer';
import { jsonRows } from './utils/json-rows';
import { parseJson } from './utils/parse-json';
import { renameKeyAtPointer } from './utils/rename-key-at-pointer';
import { rowsToText } from './utils/rows-to-text';
import { setAtPointer } from './utils/set-at-pointer';
import { subtreePaths } from './utils/subtree-paths';
import { valueAtPointer } from './utils/value-at-pointer';
import { visibleRows } from './utils/visible-rows';

/**
 * Past this many lines a document opens as an outline - root open, everything under it shut -
 * rather than in full. Nothing here is virtualised, so a 20k-line payload rendered open is a
 * frozen tab; and a document that long is not read top to bottom anyway, it is navigated. A
 * `defaultExpandedDepth` of the caller's own overrides this in either direction.
 */
const OUTLINE_ABOVE_LINES = 500;

/** The root's own pointer, which RFC 6901 spells as the empty string. */
const ROOT_PATH = '';

/** Which editor is open, and on which line. */
interface OpenEditor {
  path: string;
  kind: 'key' | 'value' | 'text';
}

/**
 * Where the viewer is pointed: at a value in hand, or at text that still has to be proven JSON.
 *
 * `onChange` is what makes the document editable, and it answers in whichever currency the
 * document arrived in - a value for `value`, text for `source`. Text that will not parse can still
 * be edited, but only as text: there is no structure to click on until it parses.
 */
type JsonViewerSubject =
  | {
      /** The document, already parsed. Pass this or `source`. */
      value: unknown;
      /** The document as text, parsed here. Pass this or `value`. */
      source?: never;
      /** Makes the document editable, and receives each edit: a value for `value`, text for `source`. */
      onChange?: (next: unknown) => void;
    }
  | {
      /** The document as text, parsed here. Pass this or `value`. */
      source: string;
      /** The document, already parsed. Pass this or `source`. */
      value?: never;
      /** Makes the document editable, and receives each edit: a value for `value`, text for `source`. */
      onChange?: (next: string) => void;
    };

/** Everything the viewer takes besides the document itself. */
interface JsonViewerOptions {
  /**
   * How many levels are open on first render: unset, all of them, unless the document runs past 500 lines.
   *
   * Omitted opens every level, unless the document is long enough to trip `OUTLINE_ABOVE_LINES`,
   * which opens the root and shuts everything under it.
   */
  defaultExpandedDepth?: number;
  /** The gutter. Worth turning off for a two-line value, where the numbers are noise. */
  lineNumbers?: boolean;
  /** The header strip: the line count, fold-all, undo/redo when editable, and copy. */
  toolbar?: boolean;
  /** Names the document - in the header, and to assistive tech. */
  label?: string;
  /** Caps the body and scrolls past it. Unset lets the document run its full height. */
  maxHeight?: number;
  /** Added to the frame's own classes. */
  className?: string;
}

export type JsonViewerProps = JsonViewerSubject & JsonViewerOptions;

/**
 * Reads a JSON document, and edits one when given an `onChange`.
 *
 * Pass `value` for something already parsed, or `source` for raw text - text is parsed here, and
 * text that will not parse is reported rather than blanked, since the reason it will not parse is
 * the thing worth knowing.
 */
export function JsonViewer({
  value,
  source,
  onChange,
  defaultExpandedDepth,
  lineNumbers = true,
  toolbar = true,
  label = 'JSON',
  maxHeight,
  className,
}: JsonViewerProps) {
  // Text has to be proven before it can be drawn; a value in hand is already whatever it is.
  const parsed = useMemo(() => (source === undefined ? null : parseJson(source)), [source]);
  const invalid = parsed !== null && !parsed.ok ? parsed : null;
  const subject = parsed === null ? value : parsed.ok ? parsed.value : undefined;
  const rows = useMemo(() => (invalid === null ? jsonRows(subject) : []), [invalid, subject]);

  // The document in the caller's own currency, which is what history stacks and what `onChange`
  // hands back. Everything in between is structural.
  const current: unknown = source ?? value;
  const editable = onChange !== undefined;
  const history = useJsonHistory(current, onChange as ((next: unknown) => void) | undefined);
  const [editor, setEditor] = useState<OpenEditor | null>(null);
  const body = useRef<HTMLDivElement>(null);

  const expandDepth =
    defaultExpandedDepth ?? (rows.length > OUTLINE_ABOVE_LINES ? 1 : Number.POSITIVE_INFINITY);
  // Keyed on the document's line count rather than on the rows' identity: a caller that rebuilds
  // its value on every render - an inline literal, a fresh `.map()` - would otherwise reopen every
  // fold the reader had just closed. An edit made here changes the line count and must NOT
  // re-derive, which is what the emitted document distinguishes.
  const signature = `${rows.length}:${expandDepth}`;
  const [fold, setFold] = useState(() => {
    return { signature, collapsed: collapsedByDepth(rows, expandDepth) };
  });
  const collapsed =
    fold.signature === signature || Object.is(current, history.emitted)
      ? fold.collapsed
      : collapsedByDepth(rows, expandDepth);
  if (fold.signature !== signature) {
    setFold({ signature, collapsed });
  }

  // A branch opened as text is shown by that editor and nothing else: leaving its members drawn
  // underneath would put the same values on screen twice, one copy of them stale.
  const drawn = useMemo(() => {
    if (editor?.kind !== 'text') {
      return collapsed;
    }
    return new Set([...collapsed, editor.path]);
  }, [collapsed, editor]);
  const lines = useMemo(() => visibleRows(rows, drawn), [rows, drawn]);
  // What is copied is the whole document, unfolded: a fold is how it is being looked at, not an
  // edit to it. Invalid text is copied back exactly as it came in.
  const copyText = useMemo(() => {
    return invalid === null ? rowsToText(rows) : (source ?? '');
  }, [invalid, rows, source]);
  const { copied, failed, copy } = useCopy();

  const toggle = (index: number, deep: boolean) => {
    const row = rows[index];
    if (row === undefined) {
      return;
    }
    const closing = !collapsed.has(row.path);
    const next = new Set(collapsed);
    for (const path of deep ? subtreePaths(rows, index) : [row.path]) {
      if (closing) {
        next.add(path);
      } else {
        next.delete(path);
      }
    }
    setFold((held) => ({ ...held, collapsed: next }));
  };

  const foldAll = (shut: boolean) => {
    setFold((held) => {
      return { ...held, collapsed: shut ? collapsedByDepth(rows, 1) : new Set<string>() };
    });
  };

  /** Hands a new document back in the caller's currency and keeps the focus inside the viewer. */
  const emit = (next: unknown) => {
    history.commit(current, source === undefined ? next : rowsToText(jsonRows(next)));
    body.current?.focus();
  };

  const commitEdit = (row: JsonRow, kind: OpenEditor['kind'], draft: string) => {
    setEditor(null);
    if (kind === 'key') {
      emit(renameKeyAtPointer(subject, row.path, draft));
      return;
    }
    const result = parseJson(draft);
    if (result.ok) {
      emit(setAtPointer(subject, row.path, result.value));
    }
  };

  const addMember = (row: JsonRow) => {
    const added = addMemberAtPointer(subject, row.path);
    if (added === null) {
      return;
    }
    emit(added.document);
    // A member added to a shut container would be invisible, and the reader is about to name it.
    setFold((held) => {
      const next = new Set(held.collapsed);
      next.delete(row.path);
      return { ...held, collapsed: next };
    });
    setEditor({ path: added.pointer, kind: row.container?.type === 'array' ? 'value' : 'key' });
  };

  /** What one line is allowed to do, or null when the document is read-only. */
  const editingFor = (row: JsonRow): LineEditing | null => {
    if (!editable || invalid !== null || row.close !== null) {
      return null;
    }
    const open = editor?.path === row.path ? editor.kind : null;
    return {
      open,
      draft:
        open === 'text' ? rowsToText(jsonRows(valueAtPointer(subject, row.path))) : (row.key ?? ''),
      onOpen: (kind) => setEditor({ path: row.path, kind }),
      onCommit: (draft) => commitEdit(row, open ?? 'value', draft),
      onCancel: () => setEditor(null),
      onAdd: () => addMember(row),
      onRemove:
        row.path === ROOT_PATH
          ? null
          : () => {
              setEditor(null);
              emit(deleteAtPointer(subject, row.path));
            },
    };
  };

  /** Undo and redo from the keyboard, but never out from under an editor's own undo. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!editable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      history.redo(current);
    } else {
      history.undo(current);
    }
  };

  // Invalid text has no structure to click on, so the only way back to a document is to fix the
  // text. It opens on the root pointer, which is also where the root row's own pencil opens.
  const fixingText = invalid !== null && editor !== null;

  const header: ReactNode = toolbar && (
    <div className="border-gray-6 bg-gray-1 flex h-36 shrink-0 items-center gap-6 border-b-1 px-10">
      <span className="text-10 text-gray-11 min-w-0 flex-1 truncate font-mono">{label}</span>
      {invalid === null && (
        <>
          <span className="text-10 text-gray-9 shrink-0 font-mono">{`${rows.length} lines`}</span>
          <ToolButton icon="chevron-right" label="Collapse" onClick={() => foldAll(true)} />
          <ToolButton icon="chevron-down" label="Expand" onClick={() => foldAll(false)} />
        </>
      )}
      {editable && invalid !== null && !fixingText && (
        <ToolButton
          icon="pencil"
          label="Edit as text"
          onClick={() => setEditor({ path: ROOT_PATH, kind: 'text' })}
        />
      )}
      {editable && (
        <>
          <ToolButton
            icon="undo"
            label="Undo"
            disabled={!history.canUndo}
            onClick={() => history.undo(current)}
          />
          <ToolButton
            icon="redo"
            label="Redo"
            disabled={!history.canRedo}
            onClick={() => history.redo(current)}
          />
        </>
      )}
      <ToolButton
        icon={copied ? 'check' : failed ? 'x' : 'copy'}
        label={copied ? 'Copied' : failed ? 'Could not copy' : 'Copy'}
        tone={copied ? 'success' : failed ? 'danger' : 'neutral'}
        onClick={() => void copy(copyText)}
      />
    </div>
  );

  return (
    <div
      className={cn(
        'border-gray-6 bg-surface-inset rounded-6 flex min-h-0 min-w-0 flex-col overflow-hidden border-1',
        className,
      )}
    >
      {header}
      {invalid !== null && (
        <div
          role="alert"
          className="border-red-7 bg-red-3 text-red-11 text-11/16 flex items-start gap-6 border-b-1 px-10 py-7"
        >
          <Icon name="triangle-alert" size="sm" className="mt-1" />
          <span>
            {invalid.line === null
              ? invalid.message
              : `Line ${invalid.line}, column ${invalid.column}: ${invalid.message}`}
          </span>
        </div>
      )}
      <div
        ref={body}
        role="group"
        aria-label={label}
        // Focusable but not tabbable: an edit leaves focus nowhere when its input unmounts, and
        // the keyboard undo has to land somewhere. It is not a stop on the way through the page.
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="min-h-0 overflow-auto outline-none"
        style={maxHeight === undefined ? undefined : { maxHeight }}
      >
        {fixingText ? (
          <div className="p-10">
            <TextEdit
              value={source ?? ''}
              label={`${label} as text`}
              onCommit={(draft) => {
                setEditor(null);
                history.commit(current, draft);
              }}
              onCancel={() => setEditor(null)}
            />
          </div>
        ) : (
          <div
            className={cn(
              'grid w-max gap-x-8 py-6',
              lineNumbers ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-1 pl-10',
            )}
          >
            {invalid !== null ? (
              <RawText text={source ?? ''} errorLine={invalid.line} lineNumbers={lineNumbers} />
            ) : (
              lines.map(({ row, line }) => {
                return (
                  // Keyed by what the line IS, not where it is: an edit that adds or removes a
                  // member shifts every line below it, and a positional key would remount them all
                  // - including the editor the reader is typing in. A closing bracket repeats its
                  // container's pointer, which the suffix separates.
                  <Fragment key={`${row.path}${row.close === null ? '' : '#close'}`}>
                    {lineNumbers && <LineNumber line={line} />}
                    <JsonLine
                      row={row}
                      line={line}
                      folded={row.container !== null && collapsed.has(row.path)}
                      onToggle={toggle}
                      editing={editingFor(row)}
                    />
                  </Fragment>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
