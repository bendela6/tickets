import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutKind = 'info' | 'warning' | 'success' | 'danger';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      toggleCallout: (kind?: CalloutKind) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  addAttributes() {
    return { kind: { default: 'info' as CalloutKind, parseHTML: (el) => el.getAttribute('data-callout') } };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': node.attrs['kind'] }), 0];
  },
  addCommands() {
    return {
      toggleCallout:
        (kind: CalloutKind = 'info') =>
        ({ commands, editor }) =>
          editor.isActive('callout')
            ? commands.lift('callout')
            : commands.wrapIn('callout', { kind }),
    };
  },
});
