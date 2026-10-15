import { Extension, getMarkRange } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Marks the link the caret is in with `is-editing-link`, which the prose sheet
 * tints (`.rt .is-editing-link`), so a link's edit popup has a visible anchor.
 * It is a decoration: nothing changes in the document and nothing goes on the
 * undo stack. It is recomputed on every selection change, and only while the
 * editor is editable and the selection is a caret.
 */
export const LinkCursorDecoration = Extension.create({
  name: 'linkCursorDecoration',
  addProseMirrorPlugins() {
    const linkType = this.editor.schema.marks['link'];
    if (!linkType) {
      return [];
    }
    return [
      new Plugin({
        key: new PluginKey('linkCursorDecoration'),
        props: {
          decorations: (state) => {
            if (!this.editor.isEditable) {
              return null;
            }
            const { selection } = state;
            if (!selection.empty) {
              return null;
            }
            const range = getMarkRange(selection.$from, linkType);
            if (!range) {
              return null;
            }
            return DecorationSet.create(state.doc, [
              Decoration.inline(range.from, range.to, { class: 'is-editing-link' }),
            ]);
          },
        },
      }),
    ];
  },
});
