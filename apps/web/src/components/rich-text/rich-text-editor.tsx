import { captureError } from '@bendela6/signals-react';
import {
  buildExtensions,
  isDocEmpty,
  parseDoc,
  PRESETS,
  toDisplayDoc,
  toolbarControls,
  type Feature,
} from '@tickets/richtext';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../ui/cn';
import { buildSuggestionHooks, type RichTextSuggestions } from './suggestions';
import { Toolbar } from './toolbar';

type RichTextEditorProps = {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onSave: (next: string) => void;
  features?: 'full' | 'compact' | Feature[];
  suggestions?: RichTextSuggestions;
};

// parseDoc's sentinel check, mirrored here so we can flag a corrupt stored
// doc without re-parsing it (toDisplayDoc already falls back gracefully).
const DOC_SENTINEL = '{"type":"doc"';

function resolveFeatures(features: RichTextEditorProps['features']): Feature[] {
  if (Array.isArray(features)) {
    return features;
  }
  return PRESETS[features ?? 'full'];
}

// The description/comment rich-text surface. Same save contract as
// MarkdownEditor: commit on blur only when the doc actually changed, and
// emit '' (not '{}') for an empty doc so `next.length > 0 ? next : null`
// keeps working at call sites.
export function RichTextEditor({
  value,
  disabled,
  placeholder,
  onSave,
  features,
  suggestions,
}: RichTextEditorProps) {
  const [focused, setFocused] = useState(false);
  const featureList = resolveFeatures(features);

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

  const extensions = useMemo(
    () => buildExtensions(featureList, buildSuggestionHooks(suggestions)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feature list + suggestion identity are stable per surface
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

  const editor = useEditor({
    extensions,
    content: toDisplayDoc(value),
    editable: disabled !== true,
    immediatelyRender: true,
    onFocus: () => setFocused(true),
    onBlur: ({ editor: instance }) => {
      setFocused(false);
      const doc = instance.getJSON();
      const serialized = JSON.stringify(doc);
      if (serialized === initialRef.current) {
        return;
      }
      const next = isDocEmpty(doc as never) ? '' : serialized;
      onSave(next);
    },
  });

  if (editor !== null && initialRef.current === null) {
    initialRef.current = JSON.stringify(editor.getJSON());
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[10px] border bg-raised',
        focused ? 'border-control' : 'border-hairline',
      )}
    >
      <Toolbar editor={editor} controls={toolbarControls(featureList)} disabled={disabled} />
      <EditorContent
        editor={editor}
        className="rt block min-h-27.5 w-full p-3 font-sans text-ui leading-[1.6] text-ink outline-none"
        data-placeholder={placeholder}
      />
    </div>
  );
}
