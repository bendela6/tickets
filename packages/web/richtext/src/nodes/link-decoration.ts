import { Extension, getMarkRange } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// RichTextEditor.dc.html §07 "Link editing": cursor-in-link tints the link
// span (`.rt .is-editing-link`, apps/web/src/styles/instrument.css) so the
// LinkEditPopover (apps/web/src/components/rich-text/link-popover.tsx) has a
// visible anchor to point at. A ProseMirror decoration keeps this purely
// visual — no document mutation, no undo-stack entry — recomputed from the
// current (collapsed) cursor position on every selection change.
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
            // Only show the editing tint when the editor is editable
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
