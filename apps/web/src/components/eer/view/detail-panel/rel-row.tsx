import { entityColor } from '../../engine/colors/entity-color';
import type { Model } from '../../engine/model/types';
import { Card } from './card';
import { Dot } from './dot';

// The row style shared by every clickable list row in the panel.
export const rowClass =
  'flex w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left text-sm hover:border-gray-7 hover:bg-gray-3';

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
      <span className="shrink-0 text-gray-9">{dir === 'out' ? '→' : '←'}</span>
      <Dot color={entityColor(model, otherEntity, colors)} />
      <span className="truncate font-mono text-gray-12">{otherEntity}</span>
      <span className="truncate font-mono text-gray-9">.{otherField}</span>
    </button>
  );
}
