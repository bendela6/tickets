import { useMemo, type ReactNode } from 'react';
import type { BlockNode } from '../registry/types';
import { pathOf } from '../schema-path';
import { BlockBoundary } from './block-boundary';
import { useDocContext } from './context';
import { DefaultErrorCard } from './elements';

interface BlockSlotProps {
  node: BlockNode;
  /**
   * The block's markdown body, drawn. A thunk rather than an import of the
   * walker, which imports this file: a cycle ESM would resolve to a
   * half-initialised module.
   */
  renderChildren: () => ReactNode;
}

/** One block: its renderer, or the error card saying why not. */
export function BlockSlot({ node, renderChildren }: BlockSlotProps) {
  const { registry, doc, ctx, elements } = useDocContext();
  const ErrorCard = elements.errorCard ?? DefaultErrorCard;
  const renderer = registry.get(node.name);

  // A block whose data fails its own schema shows the card in place, so a
  // failure that slipped past validation is visible, not a normal-looking
  // card built from bad data. Keyed on the node, so the schema runs once per
  // parse. An async schema cannot be checked here (validateDocument reports
  // it), so the block renders.
  const issues = useMemo(() => {
    if (renderer?.body !== 'data' || !renderer.schema || node.parseFailed) {
      return null;
    }
    const result = renderer.schema['~standard'].validate(node.data);
    if (result instanceof Promise) {
      return null;
    }
    return result.issues?.length ? result.issues : null;
  }, [node, renderer]);

  if (!renderer) {
    return <ErrorCard title={`No renderer named "${node.name}"`} reasons={[]} />;
  }
  if (issues) {
    return (
      <ErrorCard
        title={`Block "${node.name}" failed validation`}
        reasons={issues.map((issue) => `${pathOf(issue) || '(root)'}: ${issue.message}`)}
      />
    );
  }

  const Block = renderer.component;
  const children = renderer.body === 'markdown' ? renderChildren() : undefined;
  const data = renderer.body === 'text' ? node.text : node.data;

  return (
    <BlockBoundary name={node.name} resetKey={doc} errorCard={ErrorCard}>
      <Block data={data} attrs={node.attrs} doc={doc} ctx={ctx}>
        {children}
      </Block>
    </BlockBoundary>
  );
}
