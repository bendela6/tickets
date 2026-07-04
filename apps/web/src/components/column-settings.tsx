import { useState } from 'react';
import type { BoardIndexes } from '../utils/index-board';
import type { ViewColumn, ViewConfig } from '../utils/view-config';

function columnLabel(column: ViewColumn, indexes: BoardIndexes): string {
  if (column.source === 'number') {
    return 'ID';
  }
  if (column.source === 'type') {
    return 'Type';
  }
  if (column.source === 'progress') {
    return 'Progress';
  }
  return indexes.fieldById.get(column.fieldId)?.label ?? `field ${column.fieldId}`;
}

// Show/hide columns popover; visibility persists into the view config.
export function ColumnSettings({
  indexes,
  config,
  onUpdate,
}: {
  indexes: BoardIndexes;
  config: ViewConfig;
  onUpdate: (mutate: (current: ViewConfig) => ViewConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <button type="button" className="btn" title="Columns" onClick={() => setOpen(!open)}>
        ▦ columns
      </button>
      {open ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '110%',
            zIndex: 25,
            background: 'var(--surface)',
            border: '1px solid var(--ring)',
            borderRadius: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.14)',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 180,
          }}
        >
          {config.columns.map((column, index) => (
            <label
              key={index}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}
            >
              <input
                type="checkbox"
                checked={column.hidden !== true}
                onChange={(event) => {
                  const visible = event.target.checked;
                  onUpdate((current) => ({
                    ...current,
                    columns: current.columns.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, hidden: !visible } : entry,
                    ),
                  }));
                }}
              />
              {columnLabel(column, indexes)}
            </label>
          ))}
        </div>
      ) : null}
    </span>
  );
}
