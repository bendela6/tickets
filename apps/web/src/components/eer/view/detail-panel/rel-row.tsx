import { Dot } from '@tickets/ui';
import { entityColor } from '../../engine/colors/entity-color';
import type { Model } from '../../engine/model/types';
import { Card } from './card';

// The row style shared by every clickable list row in the panel.
export const rowClass =
  'flex w-full cursor-pointer items-center gap-8 rounded-6 border-1 border-transparent px-8 py-8 text-left text-12 hover:border-gray-7 hover:bg-surface-inset';

export function RelRow({
  model,
  colors,
  cardinality,
  here,
  dir,
  otherEntity,
  otherField,
  onClick,
}: {
  model: Model;
  colors?: ReadonlyMap<string, string>;
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
      <span className="truncate font-mono text-gray-11">{here}</span>
      <span className="shrink-0 text-gray-11">{dir === 'out' ? '→' : '←'}</span>
      <Dot color={entityColor(model, otherEntity, colors)} />
      <span className="truncate font-mono text-gray-12">{otherEntity}</span>
      <span className="truncate font-mono text-gray-11">.{otherField}</span>
    </button>
  );
}
