import { useRef, useState } from 'react';
import { cn } from '../ui/cn';
import { renderMarkdown } from '../lib/render-markdown';

type MarkdownEditorProps = {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onSave: (next: string) => void;
};

type WrapMark = { label: string; before: string; after: string };

const TOOLBAR: WrapMark[] = [
  { label: 'B', before: '**', after: '**' },
  { label: 'I', before: '_', after: '_' },
  { label: '</>', before: '`', after: '`' },
  { label: '🔗', before: '[', after: '](url)' },
];

// The description + comment surface. Write in mono, preview as prose; the tab
// pair makes the mode unmistakable. Saves on blur to keep the field contract.
export function MarkdownEditor({ value, disabled, placeholder, onSave }: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function commit() {
    if (draft !== value) {
      onSave(draft);
    }
  }

  function wrapSelection(mark: WrapMark) {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = draft.slice(0, start) + mark.before + draft.slice(start, end) + mark.after + draft.slice(end);
    setDraft(next);
    textarea.focus();
  }

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-raised">
      <div className="flex items-center justify-between border-b border-hairline bg-inset px-1.5 py-1">
        <div role="tablist" className="flex gap-0.5">
          {(['write', 'preview'] as const).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={cn(
                'rounded-ctrl px-2 py-0.5 font-sans text-meta font-medium capitalize',
                tab === name ? 'bg-raised text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
              )}
            >
              {name}
            </button>
          ))}
        </div>
        {tab === 'write' ? (
          <div className="flex gap-0.5">
            {TOOLBAR.map((mark) => (
              <button
                key={mark.label}
                type="button"
                aria-label={mark.label}
                disabled={disabled}
                onClick={() => wrapSelection(mark)}
                className="rounded-ctrl px-1.5 py-0.5 font-mono text-meta text-ink-2 hover:bg-raised hover:text-ink"
              >
                {mark.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {tab === 'write' ? (
        <textarea
          ref={textareaRef}
          value={draft}
          disabled={disabled}
          placeholder={placeholder ?? 'Write markdown…'}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          className="block min-h-40 w-full resize-y bg-raised px-3 py-2 font-mono text-meta leading-relaxed text-ink placeholder:text-ink-3 outline-none"
        />
      ) : (
        <div className="min-h-40 px-3 py-2">
          {draft.trim() ? (
            <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) }} />
          ) : (
            <p className="font-sans text-meta text-ink-3">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}
