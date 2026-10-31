import { HUES, type Hue } from '@tilewise/ui';
import type { StatusKind } from '../api/types';
import { KIND_TONE } from '../domain/status';

// An option's, a status's or a type's color: one of tilewise's eleven hues, stored by
// name in config.color, so it goes to tilewise's components as it is.
export type OptionColor = Hue;

// Lifecycle kind -> named palette color. This is the workflow field's swatch
// source wherever a picker needs an OptionColor (e.g. FieldWidget's combobox
// chips). domain/status.ts's KIND_TONE is the app's ONE status-kind color
// mapping — nothing else may decide it — so this delegates to it (OptionColor
// is just a type alias for Hue, KIND_TONE's value type) and only adds the
// `null` case (unassigned/unknown kind) that KIND_TONE, indexed by the
// non-nullable StatusKind, doesn't cover.
export function kindColor(kind: StatusKind | null): OptionColor {
  return kind === null ? 'gray' : KIND_TONE[kind];
}

// The colour a new option or type starts with in the settings tabs' pickers:
// the first of tilewise's hues, as when the pickers stored hexes.
export const DEFAULT_OPTION_COLOR: OptionColor = HUES[0];
