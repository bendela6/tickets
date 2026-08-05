import { captureError } from '@bendela6/signals-react';
import {
  buildExtensions,
  DOC_SENTINEL,
  isDocEmpty,
  parseDoc,
  PRESETS,
  toDisplayDoc,
  toolbarControls,
  type Feature,
} from '@tickets/richtext';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, cn } from '@tickets/ui';
import { uploadImage } from './image-upload';
import { LinkEditPopover } from './link-popover';
import { buildSuggestionHooks, type RichTextSuggestions } from './suggestions';
import { Toolbar, type ToolbarVariant } from './toolbar';
import {
  addUploadDecoration,
  createUploadDecorationsExtension,
  failUploadDecoration,
  findUploadPos,
  progressUploadDecoration,
  removeUploadDecoration,
  retryUploadDecoration,
  type UploadHandlers,
  type UploadHandlersRef,
} from './upload-decorations';

// Renders the toolbar as a bottom action row (border-top hairline, bg-gray-1)
// alongside a submit button and a ⌘↩ hint instead of the default top
// toolbar — RichTextEditor.dc.html §02 comment composer. Both the submit
// button's click and Mod-Enter call `onSubmit` with the doc serialized
// straight off the live editor instance, so the caller doesn't have to wait
// for a blur (the normal `onSave` path) to see the current draft.
type ComposerConfig = {
  onSubmit: (value: string) => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitPending?: boolean;
};

type RichTextEditorProps = {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onSave?: (next: string) => void;
  features?: 'full' | 'compact' | Feature[];
  suggestions?: RichTextSuggestions;
  composer?: ComposerConfig;
};

function resolveFeatures(features: RichTextEditorProps['features']): Feature[] {
  if (Array.isArray(features)) {
    return features;
  }
  return PRESETS[features ?? 'full'];
}

// The description/comment rich-text surface. Same save contract as the
// legacy markdown editor it replaced: commit on blur only when the doc
// actually changed, and emit '' (not '{}') for an empty doc so
// `next.length > 0 ? next : null` keeps working at call sites.
export function RichTextEditor({
  value,
  disabled,
  placeholder,
  onSave,
  features,
  suggestions,
  composer,
}: RichTextEditorProps) {
  const [focused, setFocused] = useState(false);
  const featureList = resolveFeatures(features);
  const toolbarVariant: ToolbarVariant = features === 'compact' ? 'compact' : 'full';
  // handlePaste/handleDrop close over this ref rather than the `editor`
  // binding below: they're passed into the same useEditor() call that
  // produces `editor`, so `editor` itself isn't in scope yet at the point
  // the closures are created. The ref is kept current every render (see
  // assignment right after useEditor), which is enough because paste/drop
  // can only fire after the surface has mounted at least once.
  const editorRef = useRef<Editor | null>(null);

  // Tiptap's Placeholder extension is configured once, when buildExtensions
  // runs (see the frozen-deps useMemo below) — but the placeholder prop can
  // change afterward without remounting the editor (detail-comments swaps
  // its copy once a user is picked in the header). Threading a function
  // that reads this ref keeps the placeholder live: the extension calls it
  // on every decoration pass instead of capturing a stale string.
  const placeholderRef = useRef(placeholder);
  placeholderRef.current = placeholder;

  // Synchronous lock to prevent double-submission on rapid Mod-Enter presses.
  // Both keydowns can see the same stale submitPending value in their closure,
  // so without a lock both would call submitCurrent(). Set when onSubmit is
  // actually called, released when submitPending cycles back to false.
  const submitLockRef = useRef(false);

  // A corrupt stored doc (starts with the doc sentinel but fails to parse as
  // JSON/doc) silently falls back to plain-paragraph rendering via
  // toDisplayDoc — report it once so the corruption doesn't go unnoticed.
  useEffect(() => {
    if (value.startsWith(DOC_SENTINEL) && parseDoc(value) === null) {
      captureError(new Error('RichTextEditor: stored doc failed to parse'), {
        mechanism: 'manual',
        contexts: { richText: { length: value.length } },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check only when the stored value itself changes
  }, [value]);

  // Ref-forwarded the same way placeholderRef is: the upload decorations
  // plugin (built once, below, since it must be a stable extension identity)
  // calls handlersRef.current.onRetry/onRemove, which are reassigned to
  // fresh closures every render so they always see the latest editorRef/
  // uploadImage state without the plugin itself needing to be rebuilt.
  const uploadHandlersRef = useRef<UploadHandlers>({ onRetry: () => {}, onRemove: () => {} }) as UploadHandlersRef;
  const uploadSeqRef = useRef(0);

  const extensions = useMemo(
    () => [
      ...buildExtensions(featureList, buildSuggestionHooks(suggestions), {
        placeholder: () => placeholderRef.current ?? '',
      }),
      createUploadDecorationsExtension(uploadHandlersRef),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feature list + suggestion identity are stable per surface; placeholder is read live from placeholderRef so it isn't a dependency; uploadHandlersRef is a stable ref
    [],
  );

  // Save-comparison subtlety: `value` may be markdown while the emitted
  // `next` is doc JSON, so an unchanged value must not fire onSave. Compare
  // against the doc's own initial serialization — captured from the editor's
  // OWN getJSON(), not from a raw `JSON.stringify(toDisplayDoc(value))`. The
  // latter looked equivalent but wasn't: schema-driven extensions (e.g.
  // TextAlign, enabled by the 'align' feature) stamp normalized attrs like
  // `textAlign: null` onto every paragraph the moment the doc is loaded into
  // the editor, so a raw pre-schema doc never round-trips byte-identical to
  // editor.getJSON() even with zero edits — comparing against it produced a
  // false "changed" on every blur of an untouched stored doc.
  //
  // Captured via a render-time ref guard rather than the `onCreate` option:
  // Tiptap's `create` event fires from a `window.setTimeout(..., 0)` inside
  // `Editor.mount()` (see @tiptap/core), which never runs before a
  // synchronous `fireEvent.blur` in jsdom tests. With `immediatelyRender:
  // true`, `useEditor` already returns the live instance on the very first
  // render, so `editor.getJSON()` is available immediately — no need to wait
  // for an async lifecycle event just to read the doc it was created with.
  const initialRef = useRef<string | null>(null);

  // Runs (or re-runs, on Retry) the actual upload for a file already backing
  // an upload-decorations widget at `id`. Position is deliberately NOT
  // captured here — it's re-read from the decoration (`findUploadPos`) at
  // both progress time and success time, since DecorationSet.map() has kept
  // it correct through any edits that happened while the request was in
  // flight (design§06: "the block never jumps").
  const runUpload = (id: string, file: File): void => {
    uploadImage(file, (loaded, total) => {
      const instance = editorRef.current;
      if (instance === null || instance.isDestroyed) {
        return;
      }
      progressUploadDecoration(instance.view, id, total > 0 ? (loaded / total) * 100 : 0);
    })
      .then((result) => {
        const instance = editorRef.current;
        if (instance === null || instance.isDestroyed) {
          return;
        }
        // No caret fallback: the upload-decorations plugin re-anchors the
        // widget through any edit (including one that deletes its anchor
        // range), so a live decoration should always exist here. If it
        // somehow doesn't, inserting at the caret would land the image
        // wherever the user's cursor happens to be — unrelated to this
        // upload — so dropping the insert is the safer failure mode.
        const insertPos = findUploadPos(instance.state, id);
        if (insertPos === null) {
          return;
        }
        removeUploadDecoration(instance.view, id);
        instance
          .chain()
          .focus()
          .insertContentAt(insertPos, { type: 'image', attrs: { src: result.url, alt: file.name } })
          .run();
      })
      .catch(() => {
        const instance = editorRef.current;
        if (instance === null || instance.isDestroyed) {
          return;
        }
        // Design§06 "failed": the in-place slot (danger tint, Retry/Remove)
        // fully replaces the old inline error line under the editor — one
        // failure surface instead of two disconnected ones, and it stays
        // anchored right where the image would have landed.
        failUploadDecoration(instance.view, id);
      });
  };

  uploadHandlersRef.current = {
    onRetry: (id, file) => {
      const instance = editorRef.current;
      if (instance === null || instance.isDestroyed) {
        return;
      }
      retryUploadDecoration(instance.view, id);
      runUpload(id, file);
    },
    onRemove: (id) => {
      const instance = editorRef.current;
      if (instance === null || instance.isDestroyed) {
        return;
      }
      removeUploadDecoration(instance.view, id);
    },
  };

  // Shared by paste, drop, and the toolbar's hidden file input. Never
  // inserts a doc node for a pending/failed upload (spec rule: no dangling
  // placeholder that could survive a failed/cancelled upload) — instead each
  // file gets its own upload-decorations widget (ProseMirror widget
  // decoration, pure UI) at the insert position; the real image node only
  // lands once the upload resolves. `pos` pins the drop coordinates; omitted
  // for paste/toolbar so it falls back to the caret.
  //
  // The editorRef survives unmount pointing at a destroyed editor (Tiptap's
  // Editor.destroy() nulls its commandManager but doesn't null the instance
  // itself). Guard against a missing/destroyed editor with both a null check
  // and isDestroyed flag before touching it.
  const insertImagesFromFiles = (files: FileList | null | undefined, pos?: number): boolean => {
    const images = files ? Array.from(files).filter((file) => file.type.startsWith('image/')) : [];
    if (images.length === 0) {
      return false;
    }
    const instance = editorRef.current;
    if (instance === null || instance.isDestroyed) {
      return true;
    }
    for (const file of images) {
      const insertPos = pos ?? instance.state.selection.from;
      const id = `up-${++uploadSeqRef.current}`;
      addUploadDecoration(instance.view, id, file, insertPos);
      runUpload(id, file);
    }
    return true;
  };

  // Shared by the composer's submit button and its Mod-Enter shortcut: read
  // the live doc straight off the editor instance (not the blur-driven
  // `initialRef`/onSave state) so a submit never depends on a blur having
  // fired first. Same empty-doc encoding onBlur uses ('' rather than the
  // literal empty-doc JSON) so callers can share the `next.length > 0`
  // convention either path produces.
  //
  // Guards composer.submitDisabled/submitPending itself rather than relying
  // solely on the button's `disabled` prop: the Mod-Enter path in
  // handleKeyDown below calls this directly, bypassing the DOM disabled
  // state entirely, so without a check here a pending/disabled composer
  // could still be double-submitted from the keyboard. Also no-ops on an
  // empty doc — matching what a caller-driven `submitDisabled` would
  // normally already prevent via the button — so Mod-Enter on empty content
  // can't fire a submit either.
  const submitCurrent = () => {
    const instance = editorRef.current;
    if (instance === null || instance.isDestroyed || composer === undefined) {
      return;
    }
    if (submitLockRef.current) {
      return;
    }
    if (composer.submitDisabled === true || composer.submitPending === true) {
      return;
    }
    const doc = instance.getJSON();
    if (isDocEmpty(doc as never)) {
      return;
    }
    submitLockRef.current = true;
    composer.onSubmit(JSON.stringify(doc));
  };

  const editor = useEditor({
    extensions,
    content: toDisplayDoc(value),
    editable: disabled !== true,
    immediatelyRender: true,
    // Tiptap v3 does NOT re-render the consuming component on every
    // transaction by default (see @tiptap/react's useEditor selector) — the
    // toolbar's active-mark highlighting and the block-type select's live
    // label both read `editor.isActive(...)` at render time, so without this
    // they'd only ever reflect the doc as of the last unrelated re-render
    // (e.g. a focus/blur). This does mean a re-render per keystroke/selection
    // change, which is the standard tradeoff for a toolbar that reflects
    // live editor state.
    shouldRerenderOnTransaction: true,
    editorProps: {
      handlePaste: (_view, event) => insertImagesFromFiles(event.clipboardData?.files),
      handleDrop: (view, event) => {
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        return insertImagesFromFiles(event.dataTransfer?.files, coords?.pos);
      },
      handleKeyDown: (_view, event) => {
        if (composer !== undefined && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          // Still swallow the keystroke (return true, no newline) even when
          // it can't submit — `event.repeat` fires on every autorepeat tick
          // while the key is held, and submitDisabled/submitPending guard
          // against a second Mod-Enter landing mid-mutation — but don't call
          // submitCurrent in either case; it also re-checks
          // submitDisabled/submitPending/empty itself as a second guard.
          if (event.repeat || composer.submitDisabled === true || composer.submitPending === true) {
            return true;
          }
          submitCurrent();
          return true;
        }
        return false;
      },
    },
    onFocus: () => setFocused(true),
    onBlur: ({ editor: instance }) => {
      setFocused(false);
      const doc = instance.getJSON();
      const serialized = JSON.stringify(doc);
      if (serialized === initialRef.current) {
        return;
      }
      const next = isDocEmpty(doc as never) ? '' : serialized;
      // Advance the baseline before calling onSave so the next blur (with no
      // further edits) compares against the just-saved state instead of the
      // original stored value — otherwise every later blur re-fires onSave.
      initialRef.current = serialized;
      onSave?.(next);
    },
  });

  editorRef.current = editor;

  if (editor !== null && initialRef.current === null) {
    initialRef.current = JSON.stringify(editor.getJSON());
  }

  useEffect(() => {
    if (editor !== null && editor.isEditable !== (disabled !== true)) {
      editor.setEditable(disabled !== true);
    }
  }, [editor, disabled]);

  // Release the submit lock when the composer's pending state cycles back to false.
  useEffect(() => {
    if (composer?.submitPending !== true) {
      submitLockRef.current = false;
    }
  }, [composer?.submitPending]);

  const toolbar = (
    <Toolbar
      editor={editor}
      controls={toolbarControls(featureList)}
      disabled={disabled}
      variant={toolbarVariant}
      onImageFiles={(files) => insertImagesFromFiles(files)}
    />
  );

  // States (RichTextEditor.dc.html §03): rest = hairline border; focused =
  // control-weight accent border + the app's standard 3px halo (same
  // ring-indigo-3 pattern every other input uses); disabled = page-bg
  // fill (not the inset token — the design's own mockup uses `--bg`) with a
  // not-allowed cursor over the content and a dimmed toolbar.
  const stateClasses = disabled
    ? 'border-gray-6 bg-gray-1'
    : focused
      ? 'border-indigo-9 bg-surface-raised ring-3 ring-indigo-3'
      : 'border-gray-6 bg-surface-raised';

  return (
    <div>
      <div className={cn('overflow-hidden rounded-xl border-1', stateClasses)}>
        {composer === undefined ? (
          <div className={cn('flex items-center border-b-1 border-gray-6 px-8 py-5', disabled && 'opacity-45')}>
            {toolbar}
          </div>
        ) : null}
        <EditorContent
          editor={editor}
          className={cn(
            'rt block w-full p-12 outline-none',
            composer !== undefined ? 'min-h-44' : 'min-h-110',
            disabled && 'cursor-default',
          )}
        />
        {composer !== undefined ? (
          <div className="flex items-center gap-8 border-t-1 border-gray-6 bg-gray-1 px-8 py-6 dark:bg-surface-inset">
            <div className={cn('min-w-0 flex-1', disabled && 'opacity-45')}>{toolbar}</div>
            <span className="font-mono text-11 text-gray-9">⌘↩</span>
            <Button
              variant="solid"
              size="sm"
              disabled={composer.submitDisabled}
              loading={composer.submitPending}
              onClick={submitCurrent}
            >
              {composer.submitLabel ?? 'Comment'}
            </Button>
          </div>
        ) : null}
      </div>
      <LinkEditPopover editor={editor} />
    </div>
  );
}
