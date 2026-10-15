import { useEditorState, type Editor } from '@tiptap/react';
import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  cn,
  focusRing,
  Icon,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
  type ControlSize,
} from '@bh/ui';
import { toolbarControls } from '../build-extensions';
import type { Feature } from '../features';
import type { CalloutKind } from '../nodes/callout';
import type { ToolbarControl } from '../registry';

/**
 * What the editor hands the toolbar beside its features: the controls that
 * open something of the editor's own. One whose action is missing isn't drawn,
 * whatever the features say.
 */
export interface ToolbarActions {
  /** Opens the link popup at the selection. */
  link?: () => void;
  /** Whether the link popup is open, which its button says. */
  linking?: boolean;
  /** Starts an `@` mention at the caret: given while the app suggests people. */
  mention?: () => void;
  /** Opens the file picker for images: given while the app uploads them. */
  image?: () => boolean;
}

export interface ToolbarProps {
  editor: Editor;
  features: readonly Feature[];
  size: ControlSize;
  actions?: ToolbarActions;
  /**
   * Where it sits: `top`, above the text, ruled off from it; or `row`, in a
   * composer's row under the text, which rules itself off, beside its submit
   * button.
   */
  placement?: 'top' | 'row';
}

/**
 * Each size's buttons, the space between the toolbar's wrapped lines, and its
 * padding: its first glyph lines up with the text.
 */
const SIZES: Record<ControlSize, { tool: string; lines: string; pad: string }> = {
  xs: { tool: 'h-22 min-w-22 gap-2 px-4 text-12', lines: 'gap-y-2', pad: 'px-5 py-3' },
  md: { tool: 'h-26 min-w-26 gap-3 px-6 text-13', lines: 'gap-y-2', pad: 'px-6 py-4' },
  lg: { tool: 'h-30 min-w-30 gap-4 px-7 text-14', lines: 'gap-y-3', pad: 'px-7 py-5' },
};

/** The space around the toolbar, which a composer's row takes for itself when the toolbar is in it. */
export function toolbarPadding(size: ControlSize): string {
  return SIZES[size].pad;
}

/**
 * A toolbar button: quiet at rest, lit with the accent while its mark or block
 * is on (`aria-pressed`), and a step darker while its menu is open. Its ring is
 * drawn inward, since the buttons sit close together.
 */
const TOOL = cn(
  'inline-flex flex-none items-center justify-center rounded-6 font-sans text-gray-11',
  'transition-colors hover:bg-gray-7 hover:text-gray-12',
  'aria-pressed:bg-indigo-3 aria-pressed:text-indigo-11',
  'data-[state=open]:bg-gray-7 data-[state=open]:text-gray-12',
  focusRing('indigo', 'focus-visible', 'inward'),
);

/** The accent a menu's button wears while what it sets is on, as a pressed toggle does. */
const LIT = 'bg-indigo-3 text-indigo-11';

/**
 * The text colours, as the `color` a text style mark stores: the tokens
 * themselves, so a coloured word follows the theme.
 */
const COLOURS: { label: string; value: string | null; swatch: string }[] = [
  { label: 'Default', value: null, swatch: 'bg-gray-12' },
  { label: 'Accent', value: 'var(--color-indigo-9)', swatch: 'bg-indigo-9' },
  { label: 'Danger', value: 'var(--color-red-9)', swatch: 'bg-red-9' },
  { label: 'Warning', value: 'var(--color-yellow-9)', swatch: 'bg-yellow-9' },
  { label: 'Success', value: 'var(--color-green-9)', swatch: 'bg-green-9' },
];

const CALLOUTS: { kind: CalloutKind; label: string }[] = [
  { kind: 'info', label: 'Info' },
  { kind: 'warning', label: 'Warning' },
  { kind: 'success', label: 'Success' },
  { kind: 'danger', label: 'Danger' },
];

const HEADINGS = [1, 2, 3] as const;
type Level = 0 | (typeof HEADINGS)[number];

type ListKind = 'bulletList' | 'orderedList' | 'taskList';
const LIST_KINDS: ListKind[] = ['bulletList', 'orderedList', 'taskList'];

const LISTS: Record<ListKind, { label: string; glyph: () => ReactNode }> = {
  bulletList: { label: 'Bulleted list', glyph: () => <Icon name="list" size="md" /> },
  orderedList: {
    label: 'Numbered list',
    glyph: () => <span className="font-500 text-11 font-mono">1.</span>,
  },
  taskList: {
    label: 'Task list',
    glyph: () => {
      return (
        <span className="rounded-3 border-1.5 inline-flex size-12 items-center justify-center border-current">
          <Icon name="check" size="2xs" />
        </span>
      );
    },
  },
};

interface Mark {
  label: string;
  glyph: ReactNode;
  run: (editor: Editor) => void;
}

const MARKS: Record<'bold' | 'italic' | 'underline' | 'strike' | 'code', Mark> = {
  bold: {
    label: 'Bold',
    glyph: <span className="font-600">B</span>,
    run: (editor) => editor.chain().toggleBold().run(),
  },
  italic: {
    label: 'Italic',
    glyph: <span className="font-500 italic">I</span>,
    run: (editor) => editor.chain().toggleItalic().run(),
  },
  underline: {
    label: 'Underline',
    glyph: <span className="font-500 underline underline-offset-2">U</span>,
    run: (editor) => editor.chain().toggleUnderline().run(),
  },
  strike: {
    label: 'Strikethrough',
    glyph: <span className="font-500 line-through">S</span>,
    run: (editor) => editor.chain().toggleStrike().run(),
  },
  code: {
    label: 'Code',
    glyph: <span className="font-500 text-11 font-mono">{'</>'}</span>,
    run: (editor) => editor.chain().toggleCode().run(),
  },
};

function runList(editor: Editor, kind: ListKind) {
  const chain = editor.chain();
  if (kind === 'bulletList') {
    chain.toggleBulletList().run();
  } else if (kind === 'orderedList') {
    chain.toggleOrderedList().run();
  } else {
    chain.toggleTaskList().run();
  }
}

/** What the toolbar shows as on at the selection, read again on each change. */
interface Lit {
  marks: Record<string, boolean>;
  level: Level;
  list: ListKind | null;
  blockquote: boolean;
  codeBlock: boolean;
  highlight: boolean;
  colour: string | null;
  callout: CalloutKind | null;
  details: boolean;
  link: boolean;
}

/** Whether the editor's schema has this mark or node: `isActive` says yes to a name it doesn't know. */
function has(editor: Editor, name: string): boolean {
  return name in editor.schema.marks || name in editor.schema.nodes;
}

/** Nothing on: what an editor shows while it is made again, its schema gone. */
const DARK: Lit = {
  marks: {},
  level: 0,
  list: null,
  blockquote: false,
  codeBlock: false,
  highlight: false,
  colour: null,
  callout: null,
  details: false,
  link: false,
};

function litOf(editor: Editor): Lit {
  // A new feature list makes a new editor; until it is drawn, the toolbar
  // still holds the one before, destroyed.
  if (editor.isDestroyed || (editor.schema as Editor['schema'] | null) === null) {
    return DARK;
  }
  const on = (name: string) => has(editor, name) && editor.isActive(name);
  const level = has(editor, 'heading')
    ? HEADINGS.find((each) => editor.isActive('heading', { level: each }))
    : undefined;
  return {
    marks: Object.fromEntries(Object.keys(MARKS).map((mark) => [mark, on(mark)])),
    level: level ?? 0,
    // The innermost list wins: a task list inside a bulleted one is a task list.
    list: (['taskList', 'orderedList', 'bulletList'] as const).find((kind) => on(kind)) ?? null,
    blockquote: on('blockquote'),
    codeBlock: on('codeBlock'),
    highlight: on('highlight'),
    colour: has(editor, 'textStyle')
      ? ((editor.getAttributes('textStyle')['color'] as string | undefined) ?? null)
      : null,
    callout: on('callout')
      ? ((editor.getAttributes('callout')['kind'] as CalloutKind | undefined) ?? 'info')
      : null,
    details: on('details'),
    link: on('link'),
  };
}

type ToolProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size: ControlSize;
  /** The control's name in the toolbar's tab order, which the arrow keys move along. */
  tool: string;
};

/** One button on the strip; a menu's button is one too, through `asChild`. */
const Tool = forwardRef<HTMLButtonElement, ToolProps>(function Tool(
  { size, tool, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      data-rt-tool={tool}
      className={cn(TOOL, SIZES[size].tool, className)}
      {...rest}
    >
      {children}
    </button>
  );
});

/** A menu row's leading mark: a check while it is on, and the room for one while it isn't. */
function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="text-indigo-11 inline-flex w-12 flex-none justify-center">
      {on ? <Icon name="check" size="sm" /> : null}
    </span>
  );
}

/** A row's content: its check, a glyph, and its words. */
function Row({
  on = false,
  glyph,
  children,
}: {
  on?: boolean;
  glyph?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-8">
      <Check on={on} />
      {/* The glyph only shows what the words say: a highlighted A, a swatch. */}
      {glyph ? (
        <span aria-hidden className="inline-flex">
          {glyph}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/** One of several, the one that is on checked: a `menuitemradio`. */
function Choice({
  checked,
  onSelect,
  glyph,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  glyph?: ReactNode;
  children: ReactNode;
}) {
  return (
    <MenuItem role="menuitemradio" aria-checked={checked} onSelect={onSelect}>
      <Row on={checked} glyph={glyph}>
        {children}
      </Row>
    </MenuItem>
  );
}

/**
 * Where the focus goes when one of the toolbar's menus closes. Picked with the
 * pointer, the text gets it back, as if the menu had never taken it; picked
 * with the keys, or closed with Escape, it goes back to the menu's button, as
 * a menu's does, so the toolbar keeps the focus it was given.
 */
function useMenuFocus(editor: Editor) {
  const pointer = useRef(false);
  return {
    onPointerDown: () => {
      pointer.current = true;
    },
    onKeyDown: () => {
      pointer.current = false;
    },
    onCloseAutoFocus: (event: Event) => {
      if (pointer.current) {
        pointer.current = false;
        event.preventDefault();
        if (!editor.isDestroyed) {
          editor.view.focus();
        }
      }
    },
  };
}

/**
 * The editor's formatting toolbar: the controls its features make, in the
 * registry's groups, a separator between each. A mark or a block is a toggle,
 * `aria-pressed` while it is on at the selection. A command with several kinds
 * is a menu: the text style (paragraph or a heading), the list, and "More
 * formatting", whose text colour and callout are submenus.
 *
 * It is one tab stop, `role="toolbar"`: the arrow keys, Home and End move along
 * it. A control pressed with the pointer leaves the focus in the text; pressed
 * with the keys, it keeps it, so several can be pressed in a row and Tab goes on
 * into the text.
 */
export function Toolbar({ editor, features, size, actions = {}, placement = 'top' }: ToolbarProps) {
  const lit = useEditorState({ editor, selector: ({ editor: current }) => litOf(current) });
  const menuFocus = useMenuFocus(editor);
  const bar = useRef<HTMLDivElement>(null);
  // The control holding the toolbar's tab stop: the last one focused.
  const [holder, setHolder] = useState<string | null>(null);

  // One tab stop: the control last focused, or the first while that one is
  // gone (disabled, or its feature switched off).
  useLayoutEffect(() => {
    const tools = [...(bar.current?.querySelectorAll<HTMLButtonElement>('[data-rt-tool]') ?? [])];
    const stop =
      tools.find((tool) => tool.dataset['rtTool'] === holder && !tool.disabled) ?? tools[0];
    for (const tool of tools) {
      tool.tabIndex = tool === stop ? 0 : -1;
    }
  });

  const ids = new Set(toolbarControls(features).map((control) => control.id));

  /** A toggle's press: from the pointer the text keeps the focus; from the keys, the button does. */
  const press = (run: (editor: Editor) => void) => {
    return (event: MouseEvent<HTMLButtonElement>) => {
      // `detail` counts a click's presses; a click made with the keys has none.
      if (event.detail > 0) {
        editor.view.focus();
      }
      run(editor);
    };
  };
  // A press never takes the focus from the text, so the selection a toggle
  // applies to stays drawn.
  const keepFocus = (event: MouseEvent) => {
    event.preventDefault();
  };

  const toggle = (
    id: string,
    label: string,
    glyph: ReactNode,
    pressed: boolean,
    run: (e: Editor) => void,
  ) => {
    return (
      <Tool
        key={id}
        size={size}
        tool={id}
        aria-label={label}
        aria-pressed={pressed}
        onMouseDown={keepFocus}
        onClick={press(run)}
      >
        {glyph}
      </Tool>
    );
  };

  const groups: Record<ToolbarControl['group'], ReactNode[]> = {
    block: [],
    marks: [],
    link: [],
    lists: [],
    blocks: [],
    insert: [],
    overflow: [],
  };

  if (ids.has('blockType')) {
    const style = lit.level === 0 ? 'Paragraph' : `Heading ${String(lit.level)}`;
    groups.block.push(
      <Menu key="blockType">
        <MenuTrigger asChild>
          <Tool size={size} tool="blockType" aria-label={`Text style: ${style}`} className="px-8">
            <span className="font-500 text-12">{style}</span>
            <Icon name="chevron-down" size="sm" />
          </Tool>
        </MenuTrigger>
        <MenuContent {...menuFocus}>
          <Choice checked={lit.level === 0} onSelect={() => editor.chain().setParagraph().run()}>
            Paragraph
          </Choice>
          {HEADINGS.map((level) => {
            return (
              <Choice
                key={level}
                checked={lit.level === level}
                onSelect={() => editor.chain().setHeading({ level }).run()}
              >
                Heading {level}
              </Choice>
            );
          })}
        </MenuContent>
      </Menu>,
    );
  }

  for (const [id, mark] of Object.entries(MARKS)) {
    if (ids.has(id)) {
      groups.marks.push(toggle(id, mark.label, mark.glyph, lit.marks[id] ?? false, mark.run));
    }
  }

  // The link control opens the editor's link popup, `@` starts a mention,
  // and the image control opens the file picker for the editor's upload.
  if (ids.has('link') && actions.link) {
    groups.link.push(
      <Tool
        key="link"
        size={size}
        tool="link"
        aria-label="Link"
        aria-pressed={lit.link}
        aria-haspopup="dialog"
        aria-expanded={actions.linking ?? false}
        onMouseDown={keepFocus}
        onClick={actions.link}
      >
        <Icon name="link" size="md" />
      </Tool>,
    );
  }

  if (ids.has('at') && actions.mention) {
    groups.link.push(
      <Tool
        key="at"
        size={size}
        tool="at"
        aria-label="Mention"
        onMouseDown={keepFocus}
        onClick={actions.mention}
      >
        <span className="font-500">@</span>
      </Tool>,
    );
  }

  const lists = LIST_KINDS.filter((kind) => ids.has(kind));
  const [only] = lists;
  if (lists.length === 1 && only) {
    groups.lists.push(
      toggle(only, LISTS[only].label, LISTS[only].glyph(), lit.list === only, (e) => {
        return runList(e, only);
      }),
    );
  } else if (only) {
    const shown = lit.list ?? only;
    groups.lists.push(
      <Menu key="lists">
        <MenuTrigger asChild>
          <Tool
            size={size}
            tool="lists"
            aria-label={lit.list ? `List: ${LISTS[lit.list].label}` : 'List'}
            className={cn(lit.list && LIT)}
          >
            {LISTS[shown].glyph()}
            <Icon name="chevron-down" size="xs" />
          </Tool>
        </MenuTrigger>
        <MenuContent {...menuFocus}>
          {lists.map((kind) => {
            return (
              <Choice key={kind} checked={lit.list === kind} onSelect={() => runList(editor, kind)}>
                {LISTS[kind].label}
              </Choice>
            );
          })}
        </MenuContent>
      </Menu>,
    );
  }

  if (ids.has('blockquote')) {
    groups.blocks.push(
      toggle('blockquote', 'Quote', <Icon name="quote" size="md" />, lit.blockquote, (e) => {
        return e.chain().toggleBlockquote().run();
      }),
    );
  }
  if (ids.has('codeBlock')) {
    groups.blocks.push(
      toggle(
        'codeBlock',
        'Code block',
        <span className="font-500 text-11 font-mono">{'{ }'}</span>,
        lit.codeBlock,
        (e) => e.chain().toggleCodeBlock().run(),
      ),
    );
  }

  if (ids.has('image') && actions.image) {
    const pick = actions.image;
    groups.insert.push(
      <Tool
        key="image"
        size={size}
        tool="image"
        aria-label="Image"
        aria-haspopup="dialog"
        onMouseDown={keepFocus}
        onClick={() => {
          pick();
        }}
      >
        <span className="rounded-3 border-1.5 relative inline-block h-12 w-15 border-current">
          <span className="absolute top-2 left-2 size-3 rounded-full bg-current" />
        </span>
      </Tool>,
    );
  }

  const more = moreItems(editor, ids, lit);
  if (more.length > 0) {
    groups.overflow.push(
      <Menu key="more">
        <MenuTrigger asChild>
          <Tool size={size} tool="more" aria-label="More formatting">
            <Icon name="plus" size="md" />
          </Tool>
        </MenuTrigger>
        <MenuContent align="end" {...menuFocus}>
          {more}
        </MenuContent>
      </Menu>,
    );
  }

  const strip = Object.entries(groups).filter(([, items]) => items.length > 0);
  if (strip.length === 0) {
    return null;
  }

  // The arrow keys move along the strip, wrapping at its ends; Home and End go to them.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tools = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-rt-tool]:not([disabled])'),
    ];
    const at = tools.findIndex((tool) => tool === event.target);
    if (at === -1) {
      return;
    }
    const next = {
      ArrowRight: (at + 1) % tools.length,
      ArrowLeft: (at - 1 + tools.length) % tools.length,
      Home: 0,
      End: tools.length - 1,
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      tools[next]?.focus();
    }
  };

  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label="Formatting"
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        const id = event.target.getAttribute('data-rt-tool');
        if (id !== null) {
          setHolder(id);
        }
      }}
      className={cn(
        'flex flex-wrap items-center',
        SIZES[size].lines,
        placement === 'top' ? cn('border-gray-7 border-b-1', SIZES[size].pad) : 'min-w-0 flex-1',
      )}
    >
      {strip.map(([group, items], index) => {
        return (
          <div key={group} className="flex items-center gap-2">
            {index > 0 ? (
              <span
                role="separator"
                aria-orientation="vertical"
                className="bg-gray-7 mx-4 h-16 w-px"
              />
            ) : null}
            {items}
          </div>
        );
      })}
    </div>
  );
}

/** "More formatting": highlight and text colour, then the blocks: callout, collapsible section, divider. */
function moreItems(editor: Editor, ids: Set<string>, lit: Lit): ReactNode[] {
  const marks: ReactNode[] = [];
  if (ids.has('highlight')) {
    marks.push(
      <MenuItem
        key="highlight"
        role="menuitemcheckbox"
        aria-checked={lit.highlight}
        onSelect={() => editor.chain().toggleHighlight().run()}
      >
        <Row
          on={lit.highlight}
          glyph={
            <span className="rounded-3 bg-highlight font-600 text-gray-12 text-12 inline-flex size-16 items-center justify-center">
              A
            </span>
          }
        >
          Highlight
        </Row>
      </MenuItem>,
    );
  }
  if (ids.has('color')) {
    marks.push(
      <MenuSub key="color">
        <MenuSubTrigger>
          <Row
            glyph={
              <span className="font-600 text-indigo-11 text-12 inline-flex size-16 items-center justify-center underline decoration-2 underline-offset-2">
                A
              </span>
            }
          >
            Text colour
          </Row>
        </MenuSubTrigger>
        <MenuSubContent>
          {COLOURS.map((colour) => {
            return (
              <Choice
                key={colour.label}
                checked={lit.colour === colour.value}
                glyph={<span aria-hidden className={cn('size-10 rounded-full', colour.swatch)} />}
                onSelect={() => {
                  if (colour.value === null) {
                    editor.chain().unsetColor().run();
                  } else {
                    editor.chain().setColor(colour.value).run();
                  }
                }}
              >
                {colour.label}
              </Choice>
            );
          })}
        </MenuSubContent>
      </MenuSub>,
    );
  }

  const blocks: ReactNode[] = [];
  if (ids.has('callout')) {
    blocks.push(
      <MenuSub key="callout">
        <MenuSubTrigger>
          <Row
            on={lit.callout !== null}
            glyph={<Icon name="circle-info" size="md" className="text-gray-11" />}
          >
            Callout
          </Row>
        </MenuSubTrigger>
        <MenuSubContent>
          {CALLOUTS.map(({ kind, label }) => {
            return (
              <Choice
                key={kind}
                checked={lit.callout === kind}
                onSelect={() => {
                  // Its own kind again takes the callout away; another kind repaints it.
                  if (lit.callout === null || lit.callout === kind) {
                    editor.chain().toggleCallout(kind).run();
                  } else {
                    editor.chain().updateAttributes('callout', { kind }).run();
                  }
                }}
              >
                {label}
              </Choice>
            );
          })}
        </MenuSubContent>
      </MenuSub>,
    );
  }
  if (ids.has('details')) {
    blocks.push(
      <MenuItem
        key="details"
        role="menuitemcheckbox"
        aria-checked={lit.details}
        onSelect={() => {
          if (lit.details) {
            editor.chain().unsetDetails().run();
          } else {
            editor.chain().setDetails().run();
          }
        }}
      >
        <Row
          on={lit.details}
          glyph={<Icon name="chevron-right" size="md" className="text-gray-11" />}
        >
          Collapsible section
        </Row>
      </MenuItem>,
    );
  }
  if (ids.has('horizontalRule')) {
    blocks.push(
      <MenuItem key="divider" onSelect={() => editor.chain().setHorizontalRule().run()}>
        <Row glyph={<Icon name="minus" size="md" className="text-gray-11" />}>Divider</Row>
      </MenuItem>,
    );
  }

  return marks.length > 0 && blocks.length > 0
    ? [...marks, <MenuSeparator key="separator" />, ...blocks]
    : [...marks, ...blocks];
}
