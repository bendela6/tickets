// Chooser step of the "+ Add" flow: group, table, or enum — each opening its
// modal in create mode. A group is a group whether or not it has a parent —
// root vs subgroup is chosen by the Parent selector inside GroupModal, so there
// is one "Group" entry here, not separate Zone/Subgroup ones. An enum is a
// model-level type (no group needed), so its entry is always enabled.

import { useDiagramModelOrNull } from '../../state/diagram-context';
import { cn } from '@tickets/ui/cn';
import { Modal } from '../modal';
import { useEditor } from './editor-context';

const option = cn(
  'flex flex-col items-start gap-1 rounded-md border border-gray-600 bg-gray-900 px-3 py-3 text-left',
  'hover:border-gray-500 hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-40',
);

export function AddChooser({ onClose }: { onClose: () => void }) {
  const model = useDiagramModelOrNull();
  const { openModal } = useEditor();
  const hasGroup = !!model?.groups.length;

  return (
    <Modal title="Add to the model" onClose={onClose}>
      <button type="button" className={option} onClick={() => openModal({ kind: 'group' })}>
        <span className="text-sm font-medium text-gray-50">Group</span>
        <span className="text-xs text-gray-400">A group of tables (nest it under another to make a subgroup)</span>
      </button>
      <button
        type="button"
        className={option}
        disabled={!hasGroup}
        title={hasGroup ? undefined : 'Create a group first'}
        onClick={() => openModal({ kind: 'table' })}
      >
        <span className="text-sm font-medium text-gray-50">Table</span>
        <span className="text-xs text-gray-400">A new entity</span>
      </button>
      <button type="button" className={option} onClick={() => openModal({ kind: 'enum' })}>
        <span className="text-sm font-medium text-gray-50">Enum</span>
        <span className="text-xs text-gray-400">A named set of values columns can use as a type</span>
      </button>
    </Modal>
  );
}
