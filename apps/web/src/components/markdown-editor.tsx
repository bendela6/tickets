import { useState } from 'react';
import { renderMarkdown } from '../lib/render-markdown';

// Preview-first markdown widget: read as rendered md, switch to a textarea to
// edit, save/cancel explicitly (blur-saving markdown is too easy to fat-finger).
export function MarkdownEditor({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled?: boolean;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div>
        {value ? (
          <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>No description.</p>
        )}
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
        >
          Edit
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        rows={10}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        style={{
          font: 'inherit',
          fontSize: 13,
          color: 'var(--ink)',
          background: 'var(--page)',
          border: '1px solid var(--ring)',
          borderRadius: 8,
          padding: '8px 10px',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setEditing(false);
            if (draft !== value) {
              onSave(draft);
            }
          }}
        >
          Save
        </button>
        <button type="button" className="btn" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
