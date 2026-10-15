import { createContext, useContext } from 'react';

/** What an `inline` row tells the fields in it. */
export interface InlineRow {
  /**
   * With `overflow: { collapse }`, how many of a `rules` field's chips show
   * before a "+3 more" button that shows the rest.
   */
  collapse?: number;
}

export const InlineRowContext = createContext<InlineRow | undefined>(undefined);

/** What the `inline` row a field sits in tells it; undefined outside one. */
export function useInlineRow(): InlineRow | undefined {
  return useContext(InlineRowContext);
}
