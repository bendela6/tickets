import { wirePath, type Placed, type Relation } from './layout';

type WireState = 'rest' | 'active';

const STATES: readonly WireState[] = ['rest', 'active'];

/** A wire at rest in a border gray; the wires of the card being dragged in the primary tone. */
const WIRE: Record<WireState, string> = {
  rest: 'fill-none stroke-gray-8',
  active: 'fill-none stroke-indigo-9',
};

/** The arrowhead, the same colour as its wire. */
const TIP: Record<WireState, string> = {
  rest: 'fill-gray-8',
  active: 'fill-indigo-9',
};

export interface WiresProps {
  /** A prefix for the arrowheads' ids, unique on the page. */
  id: string;
  relations: readonly Relation[];
  placed: readonly Placed[];
  /** The table being dragged, whose wires are drawn active. */
  active?: string;
  width: number;
  height: number;
}

/**
 * Every relation as a wire from the referencing column's row to an arrowhead
 * at the referenced column's row. Drawn under the cards, and decoration only:
 * a screen reader hears each foreign key's target from its row instead.
 */
export function Wires({ id, relations, placed, active, width, height }: WiresProps) {
  const at = new Map(placed.map((table) => [table.name, table.at]));
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0 overflow-visible"
    >
      <defs>
        {STATES.map((state) => {
          return (
            <marker
              key={state}
              id={`${id}-tip-${state}`}
              viewBox="0 0 8 8"
              refX={7}
              refY={4}
              markerWidth={8}
              markerHeight={8}
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M1 1 L7 4 L1 7 Z" className={TIP[state]} />
            </marker>
          );
        })}
      </defs>
      {relations.map((relation, index) => {
        const from = at.get(relation.from);
        const to = at.get(relation.to);
        if (!from || !to) {
          return null;
        }
        const state: WireState =
          active !== undefined && (relation.from === active || relation.to === active)
            ? 'active'
            : 'rest';
        return (
          <path
            key={index}
            data-testid="erd-edge"
            data-from={`${relation.from}.${relation.column}`}
            data-to={relation.ref}
            data-active={state === 'active' ? 'true' : undefined}
            d={wirePath(from, relation.fromRow, to, relation.toRow)}
            className={WIRE[state]}
            strokeWidth={1.5}
            strokeLinecap="round"
            markerEnd={`url(#${id}-tip-${state})`}
          />
        );
      })}
    </svg>
  );
}
