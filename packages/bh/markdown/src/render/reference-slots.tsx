import type { ImageReference, LinkReference } from 'mdast';
import type { ReactNode } from 'react';
import { useDocContext } from './context';
import { drawTag } from './tag';

/**
 * The bracket text as written, for a reference with no definition: an
 * authoring error, so it stays visible rather than vanishing.
 */
function literalReference(node: LinkReference | ImageReference, inner: ReactNode): ReactNode {
  let tail = '';
  if (node.referenceType === 'full') {
    tail = `[${node.label ?? node.identifier}]`;
  } else if (node.referenceType === 'collapsed') {
    tail = '[]';
  }
  return (
    <>
      {node.type === 'imageReference' ? '![' : '['}
      {inner}
      {`]${tail}`}
    </>
  );
}

interface LinkReferenceSlotProps {
  node: LinkReference;
  /** The link's text, drawn; taken rather than walked here, as BlockSlot says why. */
  inner: ReactNode;
}

/** `[text][id]`, through the page's `[id]: /url` definition. */
export function LinkReferenceSlot({ node, inner }: LinkReferenceSlotProps) {
  const { definitions, elements } = useDocContext();
  const definition = definitions.get(node.identifier);
  if (!definition) {
    return literalReference(node, inner);
  }
  const props = { href: definition.url, title: definition.title ?? undefined };
  return drawTag(elements, 'a', props, inner);
}

/** `![alt][id]`, through the page's `[id]: /url` definition. */
export function ImageReferenceSlot({ node }: { node: ImageReference }) {
  const { definitions, elements } = useDocContext();
  const definition = definitions.get(node.identifier);
  if (!definition) {
    return literalReference(node, node.alt ?? '');
  }
  const props = { src: definition.url, alt: node.alt ?? '', title: definition.title ?? undefined };
  return drawTag(elements, 'img', props);
}
