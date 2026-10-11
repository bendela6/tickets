import { cn } from '../../../../../style/cn';
import { Icon } from '../../icon';
import type { JsonRow, JsonTokenKind } from '../types';
import { rowLabel } from '../utils/row-label';
import { rowTokens } from '../utils/row-tokens';
import { InlineEdit } from './inline-edit';
import { TextEdit } from './text-edit';

/** One colour per kind, from the ramps the source viewer already reads code in. */
const TOKEN_CLASS: Record<JsonTokenKind, string> = {
  key: 'text-blue-11',
  string: 'text-green-11',
  number: 'text-orange-11',
  boolean: 'text-purple-11',
  null: 'text-gray-9',
  punctuation: 'text-gray-9',
  summary: 'text-gray-9 italic',
  invalid: 'text-red-11',
};

/** Everything a line needs to be editable. Null on a read-only document. */
export interface LineEditing {
  /** Which editor is open on this line. */
  open: 'key' | 'value' | 'text' | null;
  /** What the open editor is seeded with. */
  draft: string;
  onOpen: (kind: 'key' | 'value' | 'text') => void;
  onCommit: (draft: string) => void;
  onCancel: () => void;
  onAdd: () => void;
  /** Null for the root, which sits in no container and so cannot be removed. */
  onRemove: (() => void) | null;
}

interface JsonLineProps {
  row: JsonRow;
  line: number;
  folded: boolean;
  /** Takes the row's index in the unfolded document, and whether alt was held. */
  onToggle: (index: number, deep: boolean) => void;
  editing: LineEditing | null;
}

/** A run the reader can click into. Keeps the run's own colour; the box only appears under it. */
function EditableRun({
  text,
  kind,
  label,
  onOpen,
}: {
  text: string;
  kind: JsonTokenKind;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onOpen}
      className={cn(
        'rounded-2 hover:bg-gray-4 focus-visible:bg-gray-4 cursor-text px-0 font-mono outline-none',
        TOKEN_CLASS[kind],
      )}
    >
      {text}
    </button>
  );
}

/** The trailing controls, which appear when the line is hovered or something in it has focus. */
function RowActions({ row, line, editing }: { row: JsonRow; line: number; editing: LineEditing }) {
  const container = row.container !== null;
  const name = rowLabel(row, line);
  return (
    <span className="invisible ml-8 inline-flex items-center gap-2 align-top group-focus-within:visible group-hover:visible">
      {container && (
        <button
          type="button"
          aria-label={`Add a member to ${name}`}
          onClick={editing.onAdd}
          className="text-gray-9 hover:text-gray-12 hover:bg-gray-4 rounded-2 inline-flex h-16 w-16 cursor-pointer items-center justify-center"
        >
          <Icon name="plus" size="2xs" />
        </button>
      )}
      {container && (
        <button
          type="button"
          aria-label={`Edit ${name} as text`}
          onClick={() => editing.onOpen('text')}
          className="text-gray-9 hover:text-gray-12 hover:bg-gray-4 rounded-2 inline-flex h-16 w-16 cursor-pointer items-center justify-center"
        >
          <Icon name="pencil" size="2xs" />
        </button>
      )}
      {editing.onRemove !== null && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={editing.onRemove}
          className="text-gray-9 hover:text-red-11 hover:bg-gray-4 rounded-2 inline-flex h-16 w-16 cursor-pointer items-center justify-center"
        >
          <Icon name="x" size="2xs" />
        </button>
      )}
    </span>
  );
}

/** One line: its indent, its fold control if it opens anything, its runs, and its controls. */
export function JsonLine({ row, line, folded, onToggle, editing }: JsonLineProps) {
  const foldable = row.container !== null && row.container.size > 0;
  const name = rowLabel(row, line);

  if (editing?.open === 'text') {
    return (
      <span className="pr-10">
        <TextEdit
          value={editing.draft}
          label={`${name} as text`}
          onCommit={editing.onCommit}
          onCancel={editing.onCancel}
        />
      </span>
    );
  }

  return (
    <span className="text-11/16 group pr-10 font-mono whitespace-pre">
      {'  '.repeat(row.depth)}
      {foldable ? (
        <button
          type="button"
          aria-expanded={!folded}
          aria-label={`${folded ? 'Expand' : 'Collapse'} ${name}`}
          title="Alt-click to fold the whole branch"
          onClick={(event) => onToggle(line - 1, event.altKey)}
          className="text-gray-9 hover:text-gray-12 inline-flex h-16 w-12 shrink-0 cursor-pointer items-center justify-center align-top"
        >
          <Icon name={folded ? 'chevron-right' : 'chevron-down'} size="2xs" />
        </button>
      ) : (
        <span aria-hidden={true} className="inline-block h-16 w-12 align-top" />
      )}
      {rowTokens(row, folded).map((token, position) => {
        if (editing !== null && token.kind === 'key') {
          return editing.open === 'key' ? (
            <InlineEdit
              key={position}
              kind="key"
              value={row.key ?? ''}
              label={`Key ${row.key ?? ''}`}
              onCommit={editing.onCommit}
              onCancel={editing.onCancel}
            />
          ) : (
            <EditableRun
              key={position}
              text={token.text}
              kind="key"
              label={`Rename ${name}`}
              onOpen={() => editing.onOpen('key')}
            />
          );
        }
        // Identity, not kind: on a folded container the summary runs are not the row's value, and
        // only the row's own scalar is the thing an editor would replace.
        if (editing !== null && token === row.value) {
          return editing.open === 'value' ? (
            <InlineEdit
              key={position}
              kind="value"
              value={token.text}
              label={`Value of ${name}`}
              onCommit={editing.onCommit}
              onCancel={editing.onCancel}
            />
          ) : (
            <EditableRun
              key={position}
              text={token.text}
              kind={token.kind}
              label={`Edit ${name}`}
              onOpen={() => editing.onOpen('value')}
            />
          );
        }
        return (
          // Position is the identity: two runs of one line can carry the same text and kind.
          <span key={position} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        );
      })}
      {editing !== null && <RowActions row={row} line={line} editing={editing} />}
    </span>
  );
}
