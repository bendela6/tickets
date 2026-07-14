// Which end of an edge is the "many" side, from its cardinality — drives the
// crow's-foot heads and which pins light up (the "one" ends).

export type EndKind = 'one' | 'many';

export function endKinds(card: string): [EndKind, EndKind] {
  switch (card) {
    case '1-n':
      return ['one', 'many'];
    case 'n-1':
      return ['many', 'one'];
    case 'n-m':
      return ['many', 'many'];
    default: // 1-1
      return ['one', 'one'];
  }
}
