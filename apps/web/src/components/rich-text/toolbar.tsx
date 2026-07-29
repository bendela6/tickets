import type { Editor } from '@tiptap/react';
import type { ToolbarControl } from '@tickets/richtext';
import { DropdownMenu } from 'radix-ui';
import { useRef, type ReactNode } from 'react';
import { cn, Icon, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@tickets/ui';

export type ToolbarVariant = 'full' | 'compact';

type ToolbarProps = {
  editor: Editor | null;
  controls: ToolbarControl[];
  disabled?: boolean;
  // 'full' renders the leading block-type select and trailing "+" overflow
  // menu (RichTextEditor.dc.html §01); 'compact' renders neither and trims
  // a few ids from the strip (see HIDDEN_IN_COMPACT below) so a one-line
  // comment stays one line tall (§02).
  variant?: ToolbarVariant;
  // Task 10: the 'image' control opens a hidden file input instead of
  // running a chained editor command directly (see CONTROLS.image below).
  onImageFiles?: (files: FileList | null) => void;
};

type ControlDef = {
  content: ReactNode;
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const HEADING_LEVELS = [1, 2, 3] as const;

// 26px / min-width 26 / radius 6 (RteToolbar.dc.html BTN const); hover =
// inset bg, active = accent-subtle bg + accent content.
const BTN =
  'inline-flex h-6.5 min-w-6.5 flex-none items-center justify-center gap-0.75 rounded-md px-1.5 ' +
  'text-gray-11 hover:bg-surface-inset disabled:pointer-events-none disabled:opacity-40';
const ACTIVE = 'bg-indigo-3 text-indigo-9 hover:bg-indigo-3';

// One glyph + one action per toolbar control id (see @tickets/richtext
// REGISTRY for the full id list). Text glyph treatments match the DEF table
// in RteToolbar.dc.html; icon glyphs stand in for lucide via @tickets/ui's
// Icon registry (list/quote/link/plus/chevron-down/chevron-right/
// circle-info/minus/check).
const CONTROLS: Record<string, ControlDef> = {
  bold: {
    content: <span className="font-sans text-13 font-600">B</span>,
    isActive: (editor) => editor.isActive('bold'),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  italic: {
    content: <span className="font-sans text-13 font-500 italic">I</span>,
    isActive: (editor) => editor.isActive('italic'),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  underline: {
    content: (
      <span className="font-sans text-13 font-500 underline [text-underline-offset:2.5px]">U</span>
    ),
    isActive: (editor) => editor.isActive('underline'),
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  strike: {
    content: <span className="font-sans text-13 font-500 line-through">S</span>,
    isActive: (editor) => editor.isActive('strike'),
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  code: {
    content: <span className="font-mono text-[10.5px] font-500 tracking-[-0.02em]">{'</>'}</span>,
    isActive: (editor) => editor.isActive('code'),
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  link: {
    content: <Icon name="link" size="md" />,
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
  at: {
    content: <span className="font-sans text-[13.5px] font-500">@</span>,
    // Inserts a literal '@' at the caret — the mentions Suggestion plugin
    // (packages/richtext/src/nodes/refs.ts) watches document transactions
    // for the trigger char and opens its own popover from there.
    run: (editor) => editor.chain().focus().insertContent('@').run(),
  },
  bulletList: {
    content: <Icon name="list" size="md" />,
    isActive: (editor) => editor.isActive('bulletList'),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  orderedList: {
    content: <span className="font-mono text-[11.5px] font-500">1.</span>,
    isActive: (editor) => editor.isActive('orderedList'),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  taskList: {
    content: (
      <span className="box-border flex h-3 w-3 items-center justify-center rounded-sm border-2 border-current">
        <Icon name="check" size="2xs" />
      </span>
    ),
    isActive: (editor) => editor.isActive('taskList'),
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  blockquote: {
    content: <Icon name="quote" size="md" />,
    isActive: (editor) => editor.isActive('blockquote'),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  codeBlock: {
    content: <span className="font-mono text-11 font-500 tracking-[-0.06em]">{'{ }'}</span>,
    isActive: (editor) => editor.isActive('codeBlock'),
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  image: {
    content: (
      <span className="relative box-border inline-block h-3 w-3.75 rounded-sm border-2 border-current">
        <span className="absolute top-0.5 left-0.5 h-0.75 w-0.75 rounded-full bg-current" />
      </span>
    ),
    // The click handler special-cases 'image' to open the hidden file
    // input (see below) instead of calling this — kept as a no-op so the
    // CONTROLS lookup stays uniform for every strip id.
    run: () => {},
  },
  // Overflow-only ids (rendered as menu rows by OverflowMenu, never as
  // strip buttons) — `content` is unused there but kept for shape parity.
  highlight: {
    content: <span className="font-sans text-12 font-600">A</span>,
    isActive: (editor) => editor.isActive('highlight'),
    run: (editor) => editor.chain().focus().toggleHighlight().run(),
  },
  callout: {
    content: <Icon name="circle-info" size="md" />,
    isActive: (editor) => editor.isActive('callout'),
    run: (editor) => editor.chain().focus().toggleCallout().run(),
  },
  details: {
    content: <Icon name="chevron-right" size="md" />,
    isActive: (editor) => editor.isActive('details'),
    run: (editor) =>
      editor.isActive('details')
        ? editor.chain().focus().unsetDetails().run()
        : editor.chain().focus().setDetails().run(),
  },
  horizontalRule: {
    content: <Icon name="minus" size="md" />,
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
};

// Text-color swatches (overflow "Text color" submenu) — resolved as CSS
// custom-property strings rather than getComputedStyle-resolved hex so the
// applied mark stays token-driven across themes; Tiptap's Color extension
// stores whatever string it's given on the textStyle mark's `color` attr
// and it renders fine as `color: var(--x)` in the DOM.
const COLOR_SWATCHES: { id: string; label: string; value: string | null }[] = [
  { id: 'accent', label: 'Accent', value: 'var(--color-indigo-9)' },
  { id: 'danger', label: 'Danger', value: 'var(--color-red-9)' },
  { id: 'warning', label: 'Warning', value: 'var(--color-yellow-9)' },
  { id: 'success', label: 'Success', value: 'var(--color-green-9)' },
  { id: 'default', label: 'Default', value: null },
];

const STRIP_GROUP_ORDER: ToolbarControl['group'][] = ['marks', 'link', 'lists', 'blocks', 'insert'];

// RteToolbar.dc.html's compact tool list runs codeblock straight into img
// with no separator, while full config keeps every group visually distinct
// (`sep,quote,codeblock,sep,img,sep,more`) — the one place the two variants
// diverge on grouping rather than just membership, so it's special-cased
// here instead of generalized into STRIP_GROUP_ORDER.
function mergeCompactBlocksAndInsert(groups: ToolbarControl[][]): ToolbarControl[][] {
  const blocksIndex = groups.findIndex((group) => group[0]?.group === 'blocks');
  const insertIndex = groups.findIndex((group) => group[0]?.group === 'insert');
  if (blocksIndex === -1 || insertIndex === -1) {
    return groups;
  }
  const merged = [...groups];
  merged[blocksIndex] = [...merged[blocksIndex]!, ...merged[insertIndex]!];
  merged.splice(insertIndex, 1);
  return merged;
}

// '@' only shows in the compact composer strip — full config triggers
// mentions by typing '@' inline (RteToolbar.dc.html FULL has no 'at').
const HIDDEN_IN_FULL = new Set(['at']);
// underline / ordered-list / quote drop from the compact strip so a
// one-line comment stays one line tall, even though their features (marks /
// lists / blockquote) may still be enabled for the surface.
const HIDDEN_IN_COMPACT = new Set(['underline', 'orderedList', 'blockquote']);

const OVERFLOW_IDS = new Set(['highlight', 'color', 'callout', 'details', 'horizontalRule']);

export function Toolbar({ editor, controls, disabled, variant = 'full', onImageFiles }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (controls.length === 0) {
    return null;
  }

  const blockTypeControl = variant === 'full' ? controls.find((c) => c.id === 'blockType') : undefined;
  const overflowIds = new Set(
    variant === 'full' ? controls.filter((c) => OVERFLOW_IDS.has(c.id)).map((c) => c.id) : [],
  );

  const hidden = variant === 'compact' ? HIDDEN_IN_COMPACT : HIDDEN_IN_FULL;
  const stripControls = controls.filter(
    (c) => c.group !== 'block' && c.group !== 'overflow' && !hidden.has(c.id),
  );

  let groups = STRIP_GROUP_ORDER.map((group) => stripControls.filter((c) => c.group === group)).filter(
    (group) => group.length > 0,
  );
  if (variant === 'compact') {
    groups = mergeCompactBlocksAndInsert(groups);
  }

  const renderStripButton = (control: ToolbarControl) => {
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
        className={cn(BTN, active && ACTIVE)}
      >
        {def.content}
      </button>
    );
  };

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
      {blockTypeControl ? <BlockTypeSelect editor={editor} disabled={disabled} /> : null}
      {groups.map((group, index) => (
        <div
          key={group[0]!.group}
          className={cn(
            'flex items-center gap-0.5',
            (index > 0 || blockTypeControl !== undefined) && 'ml-1 border-l border-gray-6 pl-1',
          )}
        >
          {group.map(renderStripButton)}
        </div>
      ))}
      {overflowIds.size > 0 ? (
        <div
          className={cn((groups.length > 0 || blockTypeControl !== undefined) && 'ml-1 border-l border-gray-6 pl-1')}
        >
          <OverflowMenu editor={editor} ids={overflowIds} disabled={disabled} />
        </div>
      ) : null}
      {controls.some((c) => c.id === 'image') ? (
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

const BLOCK_TYPES: { level: 0 | 1 | 2 | 3; label: string }[] = [
  { level: 0, label: 'Paragraph' },
  { level: 1, label: 'Heading 1' },
  { level: 2, label: 'Heading 2' },
  { level: 3, label: 'Heading 3' },
];

function currentBlockLabel(editor: Editor | null): string {
  if (editor !== null) {
    for (const level of HEADING_LEVELS) {
      if (editor.isActive('heading', { level })) {
        return `Heading ${level}`;
      }
    }
  }
  return 'Paragraph';
}

// Leading "Paragraph" chevron control (full config only, RichTextEditor.dc.html
// §01) — replaces the old cycling H1 toggle button. Label reflects the
// block at the cursor; picking an item applies the matching editor command.
function BlockTypeSelect({ editor, disabled }: { editor: Editor | null; disabled?: boolean }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          disabled={disabled === true || editor === null}
          className="mr-1 inline-flex h-6.5 flex-none items-center gap-1 rounded-md px-2 text-gray-11 hover:bg-surface-inset disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="font-sans text-12 font-500">{currentBlockLabel(editor)}</span>
          <Icon name="chevron-down" size="sm" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="min-w-37.5">
        {BLOCK_TYPES.map((type) => (
          <MenuItem
            key={type.level}
            onSelect={() => {
              if (editor === null) {
                return;
              }
              if (type.level === 0) {
                editor.chain().focus().setParagraph().run();
              } else {
                editor.chain().focus().toggleHeading({ level: type.level }).run();
              }
            }}
          >
            {type.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

// "+" overflow menu (full config only, RteToolbar.dc.html FULL/overflowOpen):
// Highlight, Text color, [sep], Callout, Collapsible section, Divider.
function OverflowMenu({
  editor,
  ids,
  disabled,
}: {
  editor: Editor | null;
  ids: Set<string>;
  disabled?: boolean;
}) {
  const run = (fn: (editor: Editor) => void) => {
    if (editor !== null) {
      fn(editor);
    }
  };
  const hasColorRow = ids.has('highlight') || ids.has('color');
  const hasInsertRow = ids.has('callout') || ids.has('details') || ids.has('horizontalRule');

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="More formatting"
          disabled={disabled === true || editor === null}
          className={BTN}
        >
          <Icon name="plus" size="md" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" className="w-54 rounded-xl p-1.5">
        {ids.has('highlight') ? (
          <MenuItem className="h-7.5" shortcut="⌘⇧H" onSelect={() => run(CONTROLS.highlight!.run)}>
            <span className="inline-flex items-center gap-2.25">
              <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-highlight font-sans text-12 font-600 text-gray-12">
                A
              </span>
              Highlight
            </span>
          </MenuItem>
        ) : null}
        {ids.has('color') ? <TextColorRow onPick={(value) => run((e) => applyTextColor(e, value))} /> : null}
        {hasColorRow && hasInsertRow ? <MenuSeparator /> : null}
        {ids.has('callout') ? (
          <MenuItem className="h-7.5" onSelect={() => run(CONTROLS.callout!.run)}>
            <span className="inline-flex items-center gap-2.25">
              <span className="inline-flex text-gray-11">
                <Icon name="circle-info" size="md" />
              </span>
              Callout
            </span>
          </MenuItem>
        ) : null}
        {ids.has('details') ? (
          <MenuItem className="h-7.5" onSelect={() => run(CONTROLS.details!.run)}>
            <span className="inline-flex items-center gap-2.25">
              <span className="inline-flex text-gray-11">
                <Icon name="chevron-right" size="md" />
              </span>
              Collapsible section
            </span>
          </MenuItem>
        ) : null}
        {ids.has('horizontalRule') ? (
          <MenuItem className="h-7.5" onSelect={() => run(CONTROLS.horizontalRule!.run)}>
            <span className="inline-flex items-center gap-2.25">
              <span className="inline-flex text-gray-11">
                <Icon name="minus" size="md" />
              </span>
              Divider
            </span>
          </MenuItem>
        ) : null}
      </MenuContent>
    </Menu>
  );
}

function applyTextColor(editor: Editor, value: string | null) {
  if (value === null) {
    editor.chain().focus().unsetColor().run();
  } else {
    editor.chain().focus().setColor(value).run();
  }
}

// Text color row: a small inline swatch row appears in a Radix submenu
// rather than a separate dedicated color picker — accent / danger /
// warning / success / default, matching the app's status-kind palette.
function TextColorRow({ onPick }: { onPick: (value: string | null) => void }) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger asChild>
        <div className="flex h-7.5 cursor-pointer items-center gap-2.25 rounded-md px-2 text-gray-12 outline-none select-none data-[highlighted]:bg-surface-inset data-[state=open]:bg-surface-inset">
          <span className="font-sans text-[12.5px] leading-[1.15] font-600 text-indigo-9 [border-bottom:3px_solid_var(--color-indigo-9)]">
            A
          </span>
          <span className="font-sans text-13/19">Text color</span>
        </div>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          sideOffset={4}
          className="z-50 flex items-center gap-1.5 rounded-lg border border-gray-6 bg-surface-raised p-1.5 shadow-lg"
        >
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              aria-label={swatch.label}
              onClick={() => onPick(swatch.value)}
              className="h-5.5 w-5.5 flex-none rounded-full border border-gray-6"
              style={{ background: swatch.value ?? 'var(--color-surface-raised)' }}
            />
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}
