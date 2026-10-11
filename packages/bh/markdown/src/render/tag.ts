import {
  createElement,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { MarkdownElements, MarkdownTag } from './elements';

/** The host's component for a tag, or the tag itself. */
export function drawTag<Tag extends MarkdownTag>(
  elements: MarkdownElements,
  tag: Tag,
  props: ComponentPropsWithoutRef<Tag> | null,
  children?: ReactNode,
): ReactElement {
  const element: ElementType = elements[tag] ?? tag;
  return createElement(element, props, children);
}
