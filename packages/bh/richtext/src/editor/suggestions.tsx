import { PluginKey, type EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Extension, type Editor, type Range } from '@tiptap/react';
import {
  exitSuggestion,
  Suggestion,
  type SuggestionOptions,
  type SuggestionProps,
} from '@tiptap/suggestion';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  cn,
  Icon,
  OptionRow,
  Popover,
  PopoverAnchor,
  PopoverContent,
  popupClass,
  POPUP_OFFSET,
  Spinner,
} from '@bh/ui';
import type { Feature } from '../features';
import type { SuggestionHooks } from '../inline-node';

/** One row of a suggestion list: a person, one of the app's records. */
export interface SuggestionItem {
  /** Stored on the chip a pick inserts, as its `id`. */
  id: string | number | null;
  /** What the row says, and the chip's `label`. */
  label: string;
  /** A quieter word after the label: a handle, a title. */
  description?: string;
  /** Drawn before the label: an avatar, a status dot. */
  leading?: ReactNode;
  /** More of the chip's attributes, beside its `id` and `label`. */
  attrs?: Record<string, unknown>;
}

/** Where a trigger's suggestions come from: the app's. */
export interface SuggestionSource {
  /** The items for what is typed after the trigger, as a list or a promise of one. */
  items: (query: string) => readonly SuggestionItem[] | Promise<readonly SuggestionItem[]>;
  /** The list's name, shown over it and read out: "People". */
  label?: string;
}

/** A command in the `/` list. */
export interface SlashCommand {
  /** Its key in the list. */
  id: string;
  /** What the row says. */
  label: string;
  /** A quieter word after the label. */
  description?: string;
  /** Drawn before the label. */
  leading?: ReactNode;
  /** More words it is found by: `h1` for Heading 1. */
  keywords?: readonly string[];
  /** The feature it needs; an editor without it doesn't offer it. */
  feature?: Feature;
  /** Runs it at the caret, where the `/` and what was typed after it were. */
  run: (editor: Editor) => void;
}

/** A small glyph box before a command's label. */
function glyph(content: ReactNode) {
  return (
    <span
      aria-hidden
      className="rounded-4 bg-surface-inset text-11 font-500 text-gray-11 inline-flex size-20 flex-none items-center justify-center font-mono"
    >
      {content}
    </span>
  );
}

/** bh's own `/` commands, one or more for each feature that makes a block. */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: 'paragraph',
    label: 'Text',
    keywords: ['paragraph', 'plain'],
    feature: 'headings',
    leading: glyph('T'),
    run: (editor) => editor.chain().focus().setParagraph().run(),
  },
  ...([1, 2, 3] as const).map((level): SlashCommand => {
    return {
      id: `heading${String(level)}`,
      label: `Heading ${String(level)}`,
      keywords: [`h${String(level)}`, 'title'],
      feature: 'headings',
      leading: glyph(`H${String(level)}`),
      run: (editor) => editor.chain().focus().setHeading({ level }).run(),
    };
  }),
  {
    id: 'bulletList',
    label: 'Bulleted list',
    keywords: ['ul', 'bullet', 'list'],
    feature: 'lists',
    leading: glyph(<Icon name="list" size="sm" />),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'orderedList',
    label: 'Numbered list',
    keywords: ['ol', 'number', 'list'],
    feature: 'lists',
    leading: glyph('1.'),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'taskList',
    label: 'Task list',
    keywords: ['todo', 'checkbox', 'list'],
    feature: 'taskList',
    leading: glyph(<Icon name="check" size="sm" />),
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'blockquote',
    label: 'Quote',
    keywords: ['blockquote'],
    feature: 'blockquote',
    leading: glyph(<Icon name="quote" size="sm" />),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    keywords: ['code', 'pre'],
    feature: 'codeBlock',
    leading: glyph('{}'),
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'callout',
    label: 'Callout',
    keywords: ['note', 'info'],
    feature: 'callout',
    leading: glyph(<Icon name="circle-info" size="sm" />),
    run: (editor) => editor.chain().focus().toggleCallout().run(),
  },
  {
    id: 'details',
    label: 'Collapsible section',
    keywords: ['details', 'toggle'],
    feature: 'details',
    leading: glyph(<Icon name="chevron-right" size="sm" />),
    run: (editor) => editor.chain().focus().setDetails().run(),
  },
  {
    id: 'image',
    label: 'Image',
    keywords: ['picture', 'photo', 'upload'],
    // Offered while the app uploads images.
    feature: 'image',
    leading: glyph(<Icon name="file" size="sm" />),
    run: (editor) => editor.commands.pickImage(),
  },
  {
    id: 'divider',
    label: 'Divider',
    keywords: ['hr', 'rule', 'line'],
    feature: 'divider',
    leading: glyph(<Icon name="minus" size="sm" />),
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
];

/** The commands that match what was typed after `/`: those starting with it first. */
export function matchCommands(commands: readonly SlashCommand[], query: string): SlashCommand[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [...commands];
  }
  const words = (command: SlashCommand) => {
    return [command.label, ...(command.keywords ?? [])].map((w) => w.toLowerCase());
  };
  const starts = commands.filter((command) => {
    return words(command).some((word) => word.startsWith(needle));
  });
  const within = commands.filter((command) => {
    return !starts.includes(command) && words(command).some((word) => word.includes(needle));
  });
  return [...starts, ...within];
}

/** One row as the list draws it. */
interface Row {
  key: string;
  label: string;
  description?: string;
  leading?: ReactNode;
}

/** The list that is open: whose it is, its rows, and where it hangs. */
interface Open {
  pluginKey: PluginKey;
  view: EditorView;
  label?: string;
  rows: Row[];
  loading: boolean;
  pick: (index: number) => void;
  rect: () => DOMRect | null;
}

/** How a trigger's items become rows, and what a picked one hands its command. */
interface Shape<I> {
  rows: (items: I[]) => Row[];
  chosen: (item: I) => unknown;
  label?: () => string | undefined;
}

/**
 * The suggestion list's state, shared by every trigger in one editor: at most
 * one list is open. The plugins report into it (`renderer`), and send it the
 * keys while it is open; the editor draws `list` and points the text at the
 * row under the cursor (`activeId`).
 */
export function useSuggestionList() {
  const [open, setOpen] = useState<Open | null>(null);
  const [cursor, setCursor] = useState(0);
  // What the keys read, at once, between renders.
  const live = useRef<{ open: Open | null; cursor: number }>({ open: null, cursor: 0 });
  const listId = useId();

  const api = useMemo(() => {
    const show = (next: Open | null) => {
      live.current = { open: next, cursor: 0 };
      setOpen(next);
      setCursor(0);
    };
    const move = (to: number) => {
      live.current = { ...live.current, cursor: to };
      setCursor(to);
    };
    const onKeyDown = (event: KeyboardEvent): boolean => {
      const { open: current, cursor: at } = live.current;
      if (current === null) {
        return false;
      }
      // Escape closes the list (the popover takes it first), and it stays
      // closed until the caret moves on.
      if (event.key === 'Escape') {
        return true;
      }
      const count = current.rows.length;
      if (count === 0) {
        return false;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        move((at + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        current.pick(at);
        return true;
      }
      return false;
    };
    /** The `render` a Suggestion plugin takes, reporting into this list. */
    const renderer = <I,>(pluginKey: PluginKey, shape: Shape<I>) => {
      return () => {
        const report = (props: SuggestionProps<I>) => {
          show({
            pluginKey,
            view: props.editor.view,
            label: shape.label?.(),
            rows: shape.rows(props.items),
            loading: props.loading,
            pick: (index) => {
              const item = props.items[index];
              if (item !== undefined) {
                props.command(shape.chosen(item));
              }
            },
            rect: () => props.clientRect?.() ?? null,
          });
        };
        return {
          onStart: report,
          onUpdate: report,
          onExit: () => show(null),
          onKeyDown: ({ event }: { event: KeyboardEvent }) => onKeyDown(event),
        };
      };
    };
    return { renderer, move };
  }, []);

  const activeId = open && open.rows.length > 0 ? `${listId}-${String(cursor)}` : undefined;
  const list =
    open === null ? null : (
      <SuggestionList open={open} cursor={cursor} listId={listId} onMove={api.move} />
    );
  return { renderer: api.renderer, list, listId: open ? listId : undefined, activeId };
}

export type SuggestionListApi = ReturnType<typeof useSuggestionList>;

/** Whether the node can go where the trigger was typed, as Mention's own check. */
function fits(state: EditorState, range: Range, name: string): boolean {
  const type = state.schema.nodes[name];
  return (
    type !== undefined &&
    state.doc.resolve(range.from).parent.type.contentMatch.matchType(type) !== null
  );
}

/**
 * Each inline node's suggestion hook, by name: its items come from the app's
 * source for it, read when typed, so new sources need no new editor. A node
 * with no source opens no list.
 */
export function suggestionHooks(
  names: readonly string[],
  sources: { readonly current: Readonly<Record<string, SuggestionSource>> | undefined },
  renderer: SuggestionListApi['renderer'],
): SuggestionHooks {
  return Object.fromEntries(
    names.map((name): [string, Partial<SuggestionOptions<SuggestionItem>>] => {
      const pluginKey = new PluginKey(`suggest-${name}`);
      return [
        name,
        {
          pluginKey,
          allow: ({ state, range, editor }) => {
            return (
              editor.isEditable && sources.current?.[name] !== undefined && fits(state, range, name)
            );
          },
          items: async ({ query }) => {
            const source = sources.current?.[name];
            return source ? [...(await source.items(query))] : [];
          },
          render: renderer<SuggestionItem>(pluginKey, {
            label: () => sources.current?.[name]?.label,
            rows: (items) => {
              return items.map((item, index) => {
                return {
                  key: `${String(item.id ?? item.label)}-${String(index)}`,
                  label: item.label,
                  description: item.description,
                  leading: item.leading,
                };
              });
            },
            // The node's own command inserts it, with these as its attributes.
            chosen: (item) => ({ id: item.id, label: item.label, ...item.attrs }),
          }),
        },
      ];
    }),
  );
}

/** The `/` list: the commands the editor offers, read when typed. */
export function slashCommands(
  commands: { readonly current: readonly SlashCommand[] },
  renderer: SuggestionListApi['renderer'],
) {
  const pluginKey = new PluginKey('slashCommands');
  return Extension.create({
    name: 'slashCommands',
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCommand, SlashCommand>({
          editor: this.editor,
          char: '/',
          pluginKey,
          allow: ({ editor }) => editor.isEditable && commands.current.length > 0,
          items: ({ query }) => matchCommands(commands.current, query),
          command: ({ editor, range, props }) => {
            editor.chain().focus().deleteRange(range).run();
            props.run(editor);
          },
          render: renderer<SlashCommand>(pluginKey, {
            label: () => 'Commands',
            rows: (items) => {
              return items.map((command) => {
                return {
                  key: command.id,
                  label: command.label,
                  description: command.description,
                  leading: command.leading,
                };
              });
            },
            chosen: (command) => command,
          }),
        }),
      ];
    },
  });
}

/**
 * The open list, a bh `Popover` anchored at the trigger through
 * `PopoverAnchor`. The focus stays in the text: the keys reach the list
 * through the plugin, and a press on a row picks it without taking the focus.
 */
function SuggestionList({
  open,
  cursor,
  listId,
  onMove,
}: {
  open: Open;
  cursor: number;
  listId: string;
  onMove: (index: number) => void;
}) {
  const headingId = useId();
  const anchor = useMemo(() => {
    return {
      current: {
        contextElement: open.view.dom,
        getBoundingClientRect: () => open.rect() ?? open.view.dom.getBoundingClientRect(),
      },
    };
  }, [open]);

  // The row under the cursor stays in sight as the arrows move it.
  useEffect(() => {
    document.getElementById(`${listId}-${String(cursor)}`)?.scrollIntoView({ block: 'nearest' });
  }, [listId, cursor]);

  const close = () => exitSuggestion(open.view, open.pluginKey);

  return (
    <Popover
      open
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        align="start"
        sideOffset={POPUP_OFFSET}
        className={cn(popupClass, 'max-h-320 w-280 overflow-y-auto')}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        // A press in the text moves the caret, which says whether the list stays.
        onPointerDownOutside={(event) => {
          if (open.view.dom.contains(event.target as Node)) {
            event.preventDefault();
          }
        }}
        // A press on a row picks it; the text keeps the focus.
        onMouseDown={(event) => event.preventDefault()}
      >
        {open.label ? (
          <div
            id={headingId}
            className="text-11 font-500 text-gray-11 px-9 pt-4 pb-2 font-sans tracking-wider uppercase"
          >
            {open.label}
          </div>
        ) : null}
        <div
          role="listbox"
          id={listId}
          aria-labelledby={open.label ? headingId : undefined}
          aria-label={open.label ? undefined : 'Suggestions'}
          aria-busy={open.loading || undefined}
        >
          {open.rows.map((row, index) => {
            return (
              <OptionRow
                key={row.key}
                id={`${listId}-${String(index)}`}
                cursor={index === cursor}
                leading={row.leading}
                trailing={
                  row.description ? (
                    <span className="text-12 text-gray-11 max-w-120 shrink-0 truncate">
                      {row.description}
                    </span>
                  ) : undefined
                }
                onPick={() => {
                  onMove(index);
                  open.pick(index);
                }}
              >
                {row.label}
              </OptionRow>
            );
          })}
        </div>
        {open.rows.length === 0 ? (
          <div
            role="status"
            className="text-13 text-gray-11 flex items-center gap-8 px-9 py-6 font-sans"
          >
            {open.loading ? (
              <>
                <Spinner size="sm" label="" />
                Looking…
              </>
            ) : (
              'No matches'
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
