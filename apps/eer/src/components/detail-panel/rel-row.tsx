import { entityColor } from '../../engine/render/entity-color';
import type { Model } from '../../engine/model/types';
import { Card } from './card';
import { Dot } from './dot';

// The row style shared by every clickable list row in the panel.
export const rowClass =
  'flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2 py-[0.4rem] text-left text-[0.74rem] hover:border-border-2 hover:bg-surface-2';

export function RelRow({
  model,
  cardinality,
  here,
  dir,
  otherEntity,
  otherField,
  onClick,
}: {
  model: Model;
  cardinality: string;
  here: string;
  dir: 'out' | 'in';
  otherEntity: string;
  otherField: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={rowClass} onClick={onClick}>
      <Card>{cardinality}</Card>
      <span className="truncate font-mono text-muted">{here}</span>
      <span className="shrink-0 text-dim">{dir === 'out' ? '→' : '←'}</span>
      <Dot color={entityColor(model, otherEntity)} />
      <span className="truncate font-mono text-ink">{otherEntity}</span>
      <span className="truncate font-mono text-dim">.{otherField}</span>
    </button>
  );
}
