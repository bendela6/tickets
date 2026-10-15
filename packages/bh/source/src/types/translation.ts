import type { Operator, Scalar } from '@bh/resource';
import type { Context } from './context';

// Each capability of a source's query as its translation into the source's
// own words: a filter's operator as its request, a sort as its own sort
// name, a search as its term.

/** A condition's value, as a query names it. */
export type Operand = Scalar | Scalar[] | undefined;

/**
 * How a source's filter is said in its own request: per field (or attribute
 * path), the operators it serves, and how it joins them. A field or an
 * operator left out isn't offered.
 */
export interface FilterTranslation<Request> {
  /** By field key, or a path ('status.kind'): each operator it serves, as the source's request. */
  fields: Readonly<
    Record<string, Readonly<Partial<Record<Operator, (value: Operand, ctx: Context) => Request>>>>
  >;
  /** Conditions every one of which holds; [] → every row. */
  all: (parts: Request[]) => Request;
  /** Conditions at least one of which holds; none → the source can't join them so. */
  any?: (parts: Request[]) => Request;
  /** Where a condition doesn't hold; none → the source can't. */
  not?: (part: Request) => Request;
}

/** How a source sorts: per field, its own sort; and how many a sort may name. */
export interface SortTranslation<Request> {
  fields: Readonly<Record<string, (dir: 'asc' | 'desc') => Request>>;
  /** How many fields a sort may name; 1 when absent. */
  max?: number;
}

/** How a source searches: the fields it looks in, and the term as its request. */
export interface SearchTranslation<Request> {
  fields: readonly string[];
  send: (term: string) => Request;
}
