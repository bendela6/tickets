import { createContext, useContext } from 'react';
import type { ControlSize } from '../../../inputs/contract';

/** What an `InlineFieldWrapper` tells the control it wraps. */
export interface InlineField {
  /**
   * The field's label, for a control that draws it itself: as its trigger's
   * muted prefix, "Type: any", or as the text beside its box, a checkbox's.
   * Undefined for a kind whose label the wrapper draws.
   */
  label?: string;
  /** The rung a control in a row takes: `xs`, 30 pixels, as a filter bar's. */
  size: ControlSize;
}

export const InlineFieldContext = createContext<InlineField | undefined>(undefined);

/**
 * What a control inside an `InlineFieldWrapper` should draw: the label inside
 * itself, when its kind takes it there, and the size of a control in a row.
 * Undefined anywhere else, where a control keeps its own size and the label
 * is the wrapper's to draw.
 */
export function useInlineField(): InlineField | undefined {
  return useContext(InlineFieldContext);
}
