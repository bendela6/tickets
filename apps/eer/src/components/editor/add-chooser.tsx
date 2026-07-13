// Chooser step of the "+ Add" flow: zone / subgroup / table, each opening the
// group or table modal in create mode. Design note (see task report): the
// EditorModal union's `group` variant carries only an optional edit-mode id,
// so "Zone" and "Subgroup" both open the same create-mode GroupModal — its own
// kind radio (defaulting to zone) is where the user actually picks one. This
// keeps the union verbatim rather than widening it for a cosmetic default.

import { useDiagramModelOrNull } from '../../state/diagram-context';
import { cn } from '../../ui/cn';
import { Modal } from '../modal';
import { useEditor } from './editor-context';

const option = cn(
  'flex flex-col items-start gap-1 rounded-md border border-gray-600 bg-gray-900 px-3 py-3 text-left',
  'hover:border-gray-500 hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-40',
);

export function AddChooser({ onClose }: { onClose: () => void }) {
  const model = useDiagramModelOrNull();
  const { openModal } = useEditor();
  const hasZone = !!model?.groups.some((g) => !g.parent);
  const hasGroup = !!model?.groups.length;

  return (
    <Modal title="Add to the model" onClose={onClose}>
      <button type="button" className={option} onClick={() => openModal({ kind: 'group' })}>
        <span className="text-sm font-medium text-gray-50">Zone</span>
        <span className="text-xs text-gray-400">A top-level group of tables</span>
      </button>
      <button
        type="button"
        className={option}
        disabled={!hasZone}
        title={hasZone ? undefined : 'Create a zone first'}
        onClick={() => openModal({ kind: 'group' })}
      >
        <span className="text-sm font-medium text-gray-50">Subgroup</span>
        <span className="text-xs text-gray-400">Nested inside a zone</span>
      </button>
      <button
        type="button"
        className={option}
        disabled={!hasGroup}
        title={hasGroup ? undefined : 'Create a zone first'}
        onClick={() => openModal({ kind: 'table' })}
      >
        <span className="text-sm font-medium text-gray-50">Table</span>
        <span className="text-xs text-gray-400">A new entity</span>
      </button>
    </Modal>
  );
}
