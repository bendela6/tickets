import { useRef, useState } from 'react';
import { cn } from '../ui/cn';
import { renderMarkdown } from '../lib/render-markdown';

type MarkdownEditorProps = {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onSave: (next: string) => void;
};

type WrapMark = { label: string; before: string; after: string; className: string };

// Each toolbar glyph carries its own type treatment per the spec: bold sans B,
// italic sans I, mono </>, medium sans link — all in ink-2.
const TOOLBAR: WrapMark[] = [
  { label: 'B', before: '**', after: '**', className: 'font-sans text-meta font-semibold' },
  { label: 'I', before: '_', after: '_', className: 'font-sans text-meta italic' },
  { label: '</>', before: '`', after: '`', className: 'font-mono text-[11px] font-medium' },
  { label: '🔗', before: '[', after: '](url)', className: 'font-sans text-meta font-medium' },
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
    <div
      className={cn(
        'overflow-hidden rounded-[10px] border bg-raised',
        tab === 'write' ? 'border-control' : 'border-hairline',
      )}
    >
      <div className="flex items-center justify-between border-b border-hairline px-1.5">
        <div role="tablist" className="flex">
          {(['write', 'preview'] as const).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={cn(
                'px-2.5 py-2.25 font-sans text-meta font-medium capitalize',
                tab === name
                  ? '-mb-px border-b-2 border-accent text-ink'
                  : 'text-ink-3 hover:text-ink',
              )}
            >
              {name}
            </button>
          ))}
        </div>
        {tab === 'write' ? (
          <div className="flex">
            {TOOLBAR.map((mark) => (
              <button
                key={mark.label}
                type="button"
                aria-label={mark.label}
                disabled={disabled}
                onClick={() => wrapSelection(mark)}
                className={cn('px-1.75 text-ink-2 hover:text-ink', mark.className)}
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
          className="block min-h-27.5 w-full resize-y bg-raised p-3 font-mono text-ui leading-[1.6] text-ink placeholder:text-ink-3 outline-none"
        />
      ) : (
        <div className="min-h-27.5 p-3">
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
