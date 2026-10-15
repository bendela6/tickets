import { mergeAttributes, Node } from '@tiptap/core';

/** A callout's tone, written on it as `data-callout`. */
export type CalloutKind = 'info' | 'warning' | 'success' | 'danger';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Wraps the selection in a callout, or lifts it out of the one it is in. */
      toggleCallout: (kind?: CalloutKind) => ReturnType;
    };
  }
}

/** A boxed note of one or more paragraphs, drawn by its `kind`. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  addAttributes() {
    return {
      kind: {
        default: 'info' as CalloutKind,
        parseHTML: (element) => element.getAttribute('data-callout'),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': node.attrs['kind'] }), 0];
  },
  addCommands() {
    return {
      toggleCallout: (kind: CalloutKind = 'info') => {
        return ({ commands, editor }) => {
          return editor.isActive('callout')
            ? commands.lift('callout')
            : commands.wrapIn('callout', { kind });
        };
      },
    };
  },
});
