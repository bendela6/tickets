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
});
