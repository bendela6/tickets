import { Extension, getMarkRange, posToDOMRect, useEditorState, type Editor } from '@tiptap/react';
import { useId, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { Button, Icon, Input, Popover, PopoverAnchor, PopoverContent } from '@bh/ui';

/** ⌘K (Ctrl+K) in the text opens the link popup, as the toolbar's Link does. */
export const LinkShortcut = Extension.create<{ open: () => void }>({
  name: 'linkShortcut',
  addOptions() {
    return { open: () => {} };
  },
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        if (!this.editor.isEditable) {
          return false;
        }
        this.options.open();
        return true;
      },
    };
  },
});

/** A stretch of the document: a selection, or a link's text. */
interface Range {
  from: number;
  to: number;
}

/** The link the editor's selection is in: its text, and where it goes. */
interface LinkAt extends Range {
  href: string;
}

/** The link at the selection's start, its whole text, or none. */
function linkAt(editor: Editor): LinkAt | null {
  const type = editor.schema.marks['link'];
  if (!type || !editor.isActive('link')) {
    return null;
  }
  const range = getMarkRange(editor.state.selection.$from, type);
  if (!range) {
    return null;
  }
  return { ...range, href: String(editor.getAttributes('link')['href'] ?? '') };
}

/**
 * A place in the text as the popover's anchor: a virtual element radix
 * measures, in the page, wherever the text has scrolled to. It falls back to
 * the editor's own box where nothing is laid out.
 */
function anchorAt(editor: Editor, range: Range) {
  return {
    current: {
      // Scrolling in the editor's scrolling parents moves it too.
      contextElement: editor.view.dom,
      getBoundingClientRect: () => {
        try {
          return posToDOMRect(editor.view, range.from, range.to);
        } catch {
          return editor.view.dom.getBoundingClientRect();
        }
      },
    },
  };
}

/**
 * An address as the link stores it: one with no scheme, `example.com`, is a
 * web address. A path, a fragment or a query stays as written.
 */
export function hrefOf(typed: string): string {
  const href = typed.trim();
  if (href === '' || /^[a-z][a-z\d+.-]*:/i.test(href) || /^[/#?.]/.test(href)) {
    return href;
  }
  return `https://${href}`;
}

export interface LinkPopoverProps {
  editor: Editor;
  /** Whether the address is being written: the toolbar's Link and ⌘K open it. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

/**
 * The editor's link popup, a bh `Popover` anchored at the text through
 * `PopoverAnchor`. Two of them, one at a time:
 *
 * - While the caret sits in a link, in a focused editor, a small one under the
 *   link shows where it goes, with Edit and Remove. It takes no focus, so the
 *   typing goes on; Escape or a press elsewhere puts it away until the caret
 *   moves.
 * - Writing the address (the toolbar's Link, ⌘K, or Edit): an input under the
 *   selection, or under the whole link the caret is in. Enter applies it, an
 *   empty address takes the link away, and with no selection the address goes
 *   in as its own linked text. Escape closes it. Either way the focus goes back
 *   to the text, unless a press elsewhere took it.
 */
export function LinkPopover({ editor, editing, onEditingChange }: LinkPopoverProps) {
  const at = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (current.isDestroyed || !current.isEditable) {
        return null;
      }
      const link = linkAt(current);
      return {
        link,
        empty: current.state.selection.empty,
        focused: current.isFocused,
        selection: { from: current.state.selection.from, to: current.state.selection.to },
      };
    },
  });
  // The caret position the shown link was put away at: it stays away until the caret moves.
  const [dismissed, setDismissed] = useState<number | null>(null);

  if (at === null) {
    return null;
  }
  if (editing) {
    return (
      <EditLink
        editor={editor}
        // Where the selection was when it opened: the whole link it was in, or
        // the selection itself.
        target={at.link ?? { ...at.selection, href: '' }}
        onClose={() => onEditingChange(false)}
      />
    );
  }
  const shown = at.link !== null && at.empty && at.focused && dismissed !== at.selection.from;
  if (!shown || at.link === null) {
    return null;
  }
  return (
    <ShowLink
      editor={editor}
      link={at.link}
      onEdit={() => onEditingChange(true)}
      onDismiss={() => setDismissed(at.selection.from)}
    />
  );
}

/** The link the caret is in: where it goes, Edit and Remove. It never takes the focus. */
function ShowLink({
  editor,
  link,
  onEdit,
  onDismiss,
}: {
  editor: Editor;
  link: LinkAt;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const anchor = useMemo(() => anchorAt(editor, link), [editor, link.from, link.to]);
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) {
          onDismiss();
        }
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        aria-label="Link"
        className="flex max-w-360 items-center gap-4 py-4 pr-4 pl-10"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        // A press in the text moves the caret, which says whether this stays.
        onPointerDownOutside={(event) => {
          if (editor.view.dom.contains(event.target as Node)) {
            event.preventDefault();
          }
        }}
        // Its buttons keep the focus in the text, where the caret is.
        onMouseDown={(event) => {
          if (!(event.target as Element).closest('a')) {
            event.preventDefault();
          }
        }}
      >
        <Icon name="link" size="sm" className="text-gray-11" />
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-12 text-indigo-11 min-w-0 flex-1 truncate font-mono hover:underline"
        >
          {link.href}
        </a>
        <Button variant="ghost" size="sm" icon="pencil" label="Edit link" onClick={onEdit} />
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          label="Remove link"
          onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Writing the address, for the selection or the link it is in. */
function EditLink({
  editor,
  target,
  onClose,
}: {
  editor: Editor;
  target: LinkAt;
  onClose: () => void;
}) {
  // Taken once, when it opens: the selection moves while the input has the focus.
  const [range] = useState<LinkAt>(target);
  const anchor = useMemo(() => anchorAt(editor, range), [editor, range]);
  const [draft, setDraft] = useState(range.href);
  const [refused, setRefused] = useState(false);
  const refusedId = useId();
  // A press elsewhere took the focus: it isn't given back to the text.
  const elsewhere = useRef(false);
  const linked = range.href !== '';

  const remove = () => {
    editor.chain().setTextSelection(range).unsetLink().run();
    onClose();
  };

  const apply = (event: SyntheticEvent) => {
    event.preventDefault();
    const href = hrefOf(draft);
    if (href === '') {
      if (linked) {
        remove();
      } else {
        onClose();
      }
      return;
    }
    if (!editor.can().setLink({ href })) {
      setRefused(true);
      return;
    }
    if (range.from === range.to) {
      // No text to link: the address goes in as its own, and what is typed
      // after it isn't part of the link.
      editor
        .chain()
        .insertContentAt(range.from, {
          type: 'text',
          text: href,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .unsetMark('link')
        .run();
    } else {
      editor.chain().setTextSelection(range).setLink({ href }).run();
    }
    onClose();
  };

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        aria-label={linked ? 'Edit link' : 'Add link'}
        className="w-360 p-8"
        onInteractOutside={() => {
          elsewhere.current = true;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Closed by the page going away, there is no text to go back to.
          if (!elsewhere.current && !editor.isDestroyed) {
            editor.view.focus();
          }
        }}
      >
        <form onSubmit={apply} className="flex flex-col gap-6">
          <div className="flex items-center gap-6">
            <Input
              aria-label="Link address"
              aria-describedby={refused ? refusedId : undefined}
              size="xs"
              placeholder="https://…"
              value={draft}
              tone={refused ? 'danger' : undefined}
              onChange={(next) => {
                setDraft(next);
                setRefused(false);
              }}
              className="min-w-0 flex-1 font-mono"
            />
            <Button type="submit" variant="solid" size="sm">
              {linked ? 'Save' : 'Add'}
            </Button>
            {linked ? (
              <Button variant="ghost" size="sm" onClick={remove}>
                Remove
              </Button>
            ) : null}
          </div>
          {refused ? (
            <p id={refusedId} className="text-12/17 text-red-11 px-2 font-sans">
              This address can’t be linked to.
            </p>
          ) : null}
        </form>
      </PopoverContent>
    </Popover>
  );
}
