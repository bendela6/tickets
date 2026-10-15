import type { CalloutKind } from '@bh/richtext';
import { safeSource, type ProseNodeProps, type ProseNodes } from './document';

// bh's own nodes, as @bh/richtext's editor draws them: a callout, a mention
// and an image. An app's renderers, by the same names, win over these.

const KINDS = new Set<CalloutKind>(['info', 'warning', 'success', 'danger']);

/** A boxed note, by its `kind`: `<div data-callout>`, which `.rt` draws with its icon. */
function Callout({ node, children }: ProseNodeProps) {
  const kind = node.attrs?.['kind'];
  return (
    <div data-callout={KINDS.has(kind as CalloutKind) ? (kind as CalloutKind) : 'info'}>
      {children}
    </div>
  );
}

/**
 * A chip's initials: the first letters of the first two words ("Mara K." is
 * MK), or a single word's first two ("beka" is BE), as the editor's chip has.
 */
export function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return (parts[0] ?? '').slice(0, 2).toUpperCase();
}

/** `@name`, a person: the chip with their initials. */
function Mention({ node }: ProseNodeProps) {
  const label = String(node.attrs?.['label'] ?? '');
  return (
    <span data-mention={label}>
      <span data-mention-avatar="">{initials(label)}</span>
      {label}
    </span>
  );
}

/** An image, from an address the web or the app serves; its alt text is kept, empty when it has none. */
function Image({ node }: ProseNodeProps) {
  const src = safeSource(node.attrs?.['src']);
  const alt = node.attrs?.['alt'];
  const title = node.attrs?.['title'];
  if (src === undefined) {
    return null;
  }
  return (
    <img
      src={src}
      alt={typeof alt === 'string' ? alt : ''}
      title={typeof title === 'string' ? title : undefined}
    />
  );
}

/** bh's renderers, by node type. */
export const BH_NODES: ProseNodes = { callout: Callout, mention: Mention, image: Image };
