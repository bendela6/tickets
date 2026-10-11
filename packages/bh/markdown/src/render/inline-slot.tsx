import { parseAttrs } from '../parse/attrs';
import { BlockBoundary } from './block-boundary';
import { useDocContext } from './context';
import { DefaultErrorCard } from './elements';

interface InlineSlotProps {
  name: string;
  label: string;
  attrsSource: string;
  /** The mark as written, shown as-is when no inline renderer has its name. */
  raw: string;
}

/** An inline mark, `:badge[stable]{color=green}`, inside a run of text. */
export function InlineSlot({ name, label, attrsSource, raw }: InlineSlotProps) {
  const { registry, doc, ctx, elements } = useDocContext();
  const renderer = registry.get(name);
  if (!renderer?.inline) {
    return raw;
  }

  const Mark = renderer.component;
  return (
    <BlockBoundary name={name} resetKey={doc} errorCard={elements.errorCard ?? DefaultErrorCard}>
      <Mark data={label} attrs={parseAttrs(attrsSource)} doc={doc} ctx={ctx} />
    </BlockBoundary>
  );
}
