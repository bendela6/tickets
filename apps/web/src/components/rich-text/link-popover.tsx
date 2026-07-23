import { getMarkRange, posToDOMRect, type Editor } from '@tiptap/react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { IconLink2, IconPencil, IconTrash2 } from './toolbar-icons';

// Forces a re-render whenever the given Tiptap editor fires a transaction or
// selection-update event. RichTextEditor already re-renders on every
// transaction (`shouldRerenderOnTransaction: true`), which would carry this
// component along for free when it's mounted there — but this hook makes the
// popover correct standing alone too (link-popover.test.tsx drives a bare
// Editor instance with no surrounding React re-render loop).
function useEditorTick(editor: Editor | null) {
  const [, forceRender] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    if (editor === null) {
      return;
    }
    editor.on('transaction', forceRender);
    editor.on('selectionUpdate', forceRender);
    return () => {
      editor.off('transaction', forceRender);
      editor.off('selectionUpdate', forceRender);
    };
  }, [editor]);
}

// jsdom position = 0,0 fallback — same established pattern as
// suggestions.tsx's SuggestionList. posToDOMRect needs real layout
// (getClientRects) to return a meaningful rect, which jsdom doesn't have —
// wrap it so a lookup that can't resolve a real rect anchors at 0,0 instead
// of throwing.
function safeLinkRect(editor: Editor, from: number, to: number): DOMRect | null {
  try {
    return posToDOMRect(editor.view, from, to);
  } catch {
    return null;
  }
}

function containsTarget(node: HTMLElement | null, target: EventTarget | null): boolean {
  return node !== null && target instanceof Node && node.contains(target);
}

// RichTextEditor.dc.html §07: when the (collapsed) cursor sits inside a link
// mark, show a small fixed popover below the link — URL, edit, remove. No
// modal; edit swaps the URL text for an inline input in the same popover
// (Enter commits `setLink`, Escape cancels back to the display row).
export function LinkEditPopover({ editor }: { editor: Editor | null }) {
  useEditorTick(editor);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dismissedAtPosRef = useRef<number | null>(null);

  const linkType = editor?.schema.marks['link'];
  const active =
    editor !== null &&
    linkType !== undefined &&
    editor.isEditable &&
    editor.state.selection.empty &&
    editor.isActive('link');

  // Compute the current cursor position and link range
  const currentPos = active ? editor!.state.selection.$from.pos : null;
  const currentRange = active && linkType ? getMarkRange(editor!.state.selection.$from, linkType) : null;

  // Re-arm on every fresh entry into a link — a previous dismissal (outside
  // click) or a finished edit shouldn't stick once the cursor leaves and
  // comes back to a(nother) link. Also re-arm if the cursor position changes
  // (any selection change re-arms when dismissed).
  useEffect(() => {
    if (!active) {
      setEditing(false);
      setDismissed(false);
      dismissedAtPosRef.current = null;
    } else if (
      dismissed &&
      dismissedAtPosRef.current !== null &&
      currentPos !== null &&
      currentPos !== dismissedAtPosRef.current
    ) {
      // Cursor position changed (even within the same link) — re-arm
      setDismissed(false);
      dismissedAtPosRef.current = null;
    } else if (!dismissed) {
      // Just entered or re-armed — clear the position reference
      dismissedAtPosRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm on active, currentPos, or dismissed changes
  }, [active, currentPos, dismissed]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Click-outside dismissal. A click on the popover itself (edit/remove
  // buttons, the URL text) never reaches here — the popover's own
  // onMouseDown below prevents the default that would otherwise blur the
  // editor's selection out from under it, same idiom SuggestionList uses.
  useEffect(() => {
    if (editor === null || !active) {
      return;
    }
    const onDocMouseDown = (event: MouseEvent) => {
      if (
        !containsTarget(popoverRef.current, event.target) &&
        !containsTarget(editor.view.dom as HTMLElement, event.target)
      ) {
        setDismissed(true);
        dismissedAtPosRef.current = currentPos;
      }
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [editor, active, currentPos]);

  if (editor === null || linkType === undefined || !active || dismissed) {
    return null;
  }

  const range = getMarkRange(editor.state.selection.$from, linkType);
  const href = (editor.getAttributes('link')['href'] as string | undefined) ?? '';
  const rect = range ? safeLinkRect(editor, range.from, range.to) : null;

  const commit = (url: string) => {
    const trimmed = url.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (trimmed.length === 0) {
      chain.unsetLink().run();
    } else {
      chain.setLink({ href: trimmed }).run();
    }
    setEditing(false);
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 flex items-center gap-2 rounded-card border border-hairline bg-raised px-2.5 py-1.5 shadow-lg"
      style={{ left: rect?.left ?? 0, top: rect?.bottom ?? 0 }}
      // Keeps the editor's own selection/focus intact when clicking a
      // button in here — a real mousedown-driven focus change would blur
      // the contenteditable and collapse the very selection this popover is
      // anchored to. The input is excluded so normal in-place caret
      // placement while editing still works.
      onMouseDown={(event) => {
        if (event.target !== inputRef.current) {
          event.preventDefault();
        }
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          aria-label="Link URL"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(draft);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setEditing(false);
            }
          }}
          className="w-55 bg-transparent font-mono text-[12px] text-accent outline-none"
        />
      ) : (
        <>
          <span className="inline-flex shrink-0 text-accent">
            <IconLink2 size={13} />
          </span>
          <span className="max-w-55 truncate font-mono text-[12px] text-accent">{href}</span>
        </>
      )}
      <span className="h-3.5 w-px shrink-0 bg-hairline" />
      <button
        type="button"
        aria-label="Edit link"
        onClick={() => {
          setDraft(href);
          setEditing(true);
        }}
        className="flex size-5.5 shrink-0 items-center justify-center rounded-ctrl text-ink-2 hover:bg-inset"
      >
        <IconPencil size={13} />
      </button>
      <button
        type="button"
        aria-label="Remove link"
        onClick={remove}
        className="flex size-5.5 shrink-0 items-center justify-center rounded-ctrl text-ink-2 hover:bg-inset"
      >
        <IconTrash2 size={13} />
      </button>
    </div>
  );
}
