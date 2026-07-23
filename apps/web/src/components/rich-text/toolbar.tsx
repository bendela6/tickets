import type { Editor } from '@tiptap/react';
import type { ToolbarControl } from '@tickets/richtext';
import { useRef } from 'react';
import { cn } from '@tickets/ui/cn';

type ToolbarProps = {
  editor: Editor | null;
  controls: ToolbarControl[];
  disabled?: boolean;
  // Task 10: the 'image' control opens a hidden file input instead of
  // running a chained editor command directly (see CONTROLS.image below).
  onImageFiles?: (files: FileList | null) => void;
};

type ControlDef = {
  label: string;
  className?: string;
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const HEADING_LEVELS = [1, 2, 3] as const;
const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;

// One glyph + one action per toolbar control id (see @tickets/richtext
// REGISTRY for the full id list). Chrome matches the legacy markdown
// editor's toolbar: px-1.75 glyphs in ink-2, active state tinted accent-subtle.
const CONTROLS: Record<string, ControlDef> = {
  bold: {
    label: 'B',
    className: 'font-sans text-meta font-semibold',
    isActive: (editor) => editor.isActive('bold'),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  italic: {
    label: 'I',
    className: 'font-sans text-meta italic',
    isActive: (editor) => editor.isActive('italic'),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  underline: {
    label: 'U',
    className: 'font-sans text-meta font-medium underline',
    isActive: (editor) => editor.isActive('underline'),
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  strike: {
    label: 'S',
    className: 'font-sans text-meta line-through',
    isActive: (editor) => editor.isActive('strike'),
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  code: {
    label: '</>',
    className: 'font-mono text-[11px] font-medium',
    isActive: (editor) => editor.isActive('code'),
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  highlight: {
    label: 'H',
    className: 'font-sans text-meta font-medium',
    isActive: (editor) => editor.isActive('highlight'),
    run: (editor) => editor.chain().focus().toggleHighlight().run(),
  },
  color: {
    label: 'A',
    className: 'font-sans text-meta font-semibold text-accent',
    isActive: (editor) => editor.isActive('textStyle', { color: 'var(--color-accent)' }),
    run: (editor) => {
      if (editor.isActive('textStyle', { color: 'var(--color-accent)' })) {
        editor.chain().focus().unsetColor().run();
      } else {
        editor.chain().focus().setColor('var(--color-accent)').run();
      }
    },
  },
  link: {
    label: '\u{1F517}',
    className: 'font-sans text-meta font-medium',
    isActive: (editor) => editor.isActive('link'),
    run: (editor) => {
      if (editor.isActive('link')) {
        editor.chain().focus().unsetLink().run();
        return;
      }
      const url = typeof window === 'undefined' ? null : window.prompt('Link URL');
      if (url) {
        editor.chain().focus().setLink({ href: url }).run();
      }
    },
  },
  heading: {
    label: 'H1',
    className: 'font-sans text-meta font-semibold',
    isActive: (editor) => HEADING_LEVELS.some((level) => editor.isActive('heading', { level })),
    run: (editor) => {
      const current = HEADING_LEVELS.find((level) => editor.isActive('heading', { level }));
      const next = current === undefined ? 1 : current + 1;
      if (next > 3) {
        editor.chain().focus().setParagraph().run();
      } else {
        editor.chain().focus().toggleHeading({ level: next as 1 | 2 | 3 }).run();
      }
    },
  },
  bulletList: {
    label: '•',
    isActive: (editor) => editor.isActive('bulletList'),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  orderedList: {
    label: '1.',
    className: 'font-sans text-meta font-medium',
    isActive: (editor) => editor.isActive('orderedList'),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  taskList: {
    label: '☑',
    isActive: (editor) => editor.isActive('taskList'),
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  blockquote: {
    label: '❝',
    isActive: (editor) => editor.isActive('blockquote'),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  codeBlock: {
    label: '{ }',
    className: 'font-mono text-[11px] font-medium',
    isActive: (editor) => editor.isActive('codeBlock'),
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  table: {
    label: '▦',
    isActive: (editor) => editor.isActive('table'),
    run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  details: {
    label: '▸',
    isActive: (editor) => editor.isActive('details'),
    run: (editor) =>
      editor.isActive('details')
        ? editor.chain().focus().unsetDetails().run()
        : editor.chain().focus().setDetails().run(),
  },
  callout: {
    label: '!',
    className: 'font-sans text-meta font-semibold',
    isActive: (editor) => editor.isActive('callout'),
    run: (editor) => editor.chain().focus().toggleCallout().run(),
  },
  align: {
    label: '≡',
    isActive: (editor) => ALIGNMENTS.some((alignment) => alignment !== 'left' && editor.isActive({ textAlign: alignment })),
    run: (editor) => {
      const current = ALIGNMENTS.find((alignment) => editor.isActive({ textAlign: alignment })) ?? 'left';
      const next = ALIGNMENTS[(ALIGNMENTS.indexOf(current) + 1) % ALIGNMENTS.length]!;
      editor.chain().focus().setTextAlign(next).run();
    },
  },
  horizontalRule: {
    label: '―',
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  image: {
    label: '\u{1F5BC}',
    // The click handler special-cases 'image' to open the hidden file
    // input (see below) instead of calling this — kept as a no-op so the
    // CONTROLS lookup stays uniform for every id.
    run: () => {},
  },
};

const GROUP_ORDER: ToolbarControl['group'][] = ['marks', 'blocks', 'insert'];

export function Toolbar({ editor, controls, disabled, onImageFiles }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (controls.length === 0) {
    return null;
  }
  const groups = GROUP_ORDER.map((group) => controls.filter((control) => control.group === group)).filter(
    (group) => group.length > 0,
  );

  return (
    <div className="flex items-center border-b border-hairline px-1.5">
      {groups.map((group, index) => (
        <div
          key={group[0]!.group}
          className={cn('flex items-center', index > 0 && 'ml-1.5 border-l border-hairline pl-1.5')}
        >
          {group.map((control) => {
            const def = CONTROLS[control.id];
            if (!def) {
              return null;
            }
            const active = editor !== null && (def.isActive?.(editor) ?? false);
            return (
              <button
                key={control.id}
                type="button"
                aria-label={control.id}
                aria-pressed={def.isActive ? active : undefined}
                disabled={disabled === true || editor === null}
                onClick={() => {
                  if (control.id === 'image') {
                    fileInputRef.current?.click();
                    return;
                  }
                  editor && def.run(editor);
                }}
                className={cn(
                  'rounded px-1.75 py-1 text-ink-2 hover:text-ink',
                  active && 'bg-accent-subtle text-ink',
                  def.className,
                )}
              >
                {def.label}
              </button>
            );
          })}
        </div>
      ))}
      {controls.some((control) => control.id === 'image') ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            onImageFiles?.(event.target.files);
            event.target.value = '';
          }}
        />
      ) : null}
    </div>
  );
}
