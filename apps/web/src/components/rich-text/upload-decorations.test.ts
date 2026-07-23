import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { describe, expect, it } from 'vitest';
import {
  addUploadDecoration,
  createUploadDecorationsPlugin,
  failUploadDecoration,
  findUploadPos,
  progressUploadDecoration,
  removeUploadDecoration,
  retryUploadDecoration,
  type UploadHandlers,
  type UploadHandlersRef,
} from './upload-decorations';

// Exercises the DecorationSet contract directly against a bare EditorView
// (no React/Tiptap editor needed) — this is the mechanism the design-spec
// position-mapping guarantee actually rests on: DecorationSet.map() carries
// each upload's insert position through concurrent doc edits for free.
// DOM-level rendering of the pending/failed cards is covered in
// rich-text-editor.test.tsx.
const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', group: 'block', toDOM: () => ['p', 0], parseDOM: [{ tag: 'p' }] },
    text: {},
  },
});

function makeView(handlers?: Partial<UploadHandlers>) {
  const handlersRef: UploadHandlersRef = {
    current: { onRetry: () => {}, onRemove: () => {}, ...handlers },
  };
  const plugin = createUploadDecorationsPlugin(handlersRef);
  const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('hello ')])]);
  const state = EditorState.create({ doc, plugins: [plugin] });
  const view = new EditorView(document.createElement('div'), { state });
  return { view, handlersRef };
}

function file(name = 'shot.png'): File {
  return new File([new Uint8Array([1])], name, { type: 'image/png' });
}

describe('upload-decorations plugin', () => {
  it('add creates a decoration findable at the given position', () => {
    const { view } = makeView();
    addUploadDecoration(view, 'a', file(), 7);
    expect(findUploadPos(view.state, 'a')).toBe(7);
  });

  it('inserting text before the decoration shifts its mapped position (DecorationSet.map)', () => {
    const { view } = makeView();
    // "hello " occupies positions 1..7 in <p>hello </p> — anchor at the end.
    addUploadDecoration(view, 'a', file(), 7);
    expect(findUploadPos(view.state, 'a')).toBe(7);

    // Type before the upload's position, as if the user kept editing above
    // it while the request was still in flight.
    view.dispatch(view.state.tr.insertText('X', 1));

    expect(findUploadPos(view.state, 'a')).toBe(8); // shifted by the inserted char, not stale
  });

  it('multiple concurrent uploads track independent positions through the same edit', () => {
    const { view } = makeView();
    addUploadDecoration(view, 'a', file('a.png'), 2);
    addUploadDecoration(view, 'b', file('b.png'), 7);

    view.dispatch(view.state.tr.insertText('X', 1));

    expect(findUploadPos(view.state, 'a')).toBe(3);
    expect(findUploadPos(view.state, 'b')).toBe(8);
  });

  it('remove clears the decoration', () => {
    const { view } = makeView();
    addUploadDecoration(view, 'a', file(), 7);
    removeUploadDecoration(view, 'a');
    expect(findUploadPos(view.state, 'a')).toBeNull();
  });

  it('progress, fail, and retry mutate the card in place without dropping the decoration', () => {
    const { view } = makeView();
    addUploadDecoration(view, 'a', file(), 7);

    progressUploadDecoration(view, 'a', 50);
    expect(findUploadPos(view.state, 'a')).toBe(7);

    failUploadDecoration(view, 'a');
    expect(findUploadPos(view.state, 'a')).toBe(7);

    retryUploadDecoration(view, 'a');
    expect(findUploadPos(view.state, 'a')).toBe(7);
  });

  it('an unknown id resolves to null instead of throwing', () => {
    const { view } = makeView();
    expect(findUploadPos(view.state, 'ghost')).toBeNull();
  });

  // prosemirror-view maps a widget decoration to nothing when a transaction
  // deletes the range containing its anchor. Without re-anchoring, the
  // upload UI silently vanishes even though the upload is still alive.
  it('deleting a range spanning the anchor re-anchors the widget instead of dropping it', () => {
    const { view } = makeView();
    // "hello " occupies doc positions 1..7 (<p>hello </p>) — anchor at the end.
    addUploadDecoration(view, 'a', file(), 7);
    expect(findUploadPos(view.state, 'a')).toBe(7);

    // Delete the whole "hello " text — a range that contains the anchor.
    view.dispatch(view.state.tr.delete(1, 7));

    // Decoration survives, remapped/clamped into the shrunk doc — not null.
    const pos = findUploadPos(view.state, 'a');
    expect(pos).not.toBeNull();
    // Doc stays clean: no placeholder/dangling node was inserted for it.
    expect(view.state.doc.textContent).toBe('');

    // A subsequent fail must render into a node that's actually attached to
    // the live view, not an orphaned decoration lost from the set.
    failUploadDecoration(view, 'a');
    const card = view.dom.querySelector('[data-upload-card="a"]');
    expect(card).not.toBeNull();
    expect(view.dom.contains(card)).toBe(true);
    expect(card).toHaveAttribute('data-upload-status', 'failed');

    // Retry from the re-anchored card keeps tracking the same (remapped)
    // position and re-renders as pending.
    retryUploadDecoration(view, 'a');
    expect(findUploadPos(view.state, 'a')).toBe(pos);
    expect(view.dom.querySelector('[data-upload-card="a"]')).toHaveAttribute('data-upload-status', 'pending');
  });

  it('deleting the anchor of a still-pending upload keeps it re-anchored and visible mid-flight', () => {
    const { view } = makeView();
    addUploadDecoration(view, 'a', file(), 7);
    progressUploadDecoration(view, 'a', 40);

    view.dispatch(view.state.tr.delete(1, 7));

    const pos = findUploadPos(view.state, 'a');
    expect(pos).not.toBeNull();
    const card = view.dom.querySelector('[data-upload-card="a"]');
    expect(view.dom.contains(card)).toBe(true);
    expect(card).toHaveAttribute('data-upload-status', 'pending');
  });

  it('entries are cleaned up after remove: a later fail/progress for that id is a no-op with no DOM', () => {
    const { view } = makeView();
    addUploadDecoration(view, 'a', file(), 7);
    removeUploadDecoration(view, 'a');
    expect(findUploadPos(view.state, 'a')).toBeNull();

    // No entry left for 'a' — these must no-op instead of resurrecting a card.
    progressUploadDecoration(view, 'a', 50);
    failUploadDecoration(view, 'a');
    expect(findUploadPos(view.state, 'a')).toBeNull();
    expect(view.dom.querySelector('[data-upload-card="a"]')).toBeNull();

    // Deleting doc content afterward must not resurrect the removed entry
    // either (reanchor only touches entries still tracked by the plugin).
    view.dispatch(view.state.tr.delete(1, 5));
    expect(findUploadPos(view.state, 'a')).toBeNull();
    expect(view.dom.querySelector('[data-upload-card="a"]')).toBeNull();
  });
});
