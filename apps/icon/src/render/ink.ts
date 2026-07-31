import { relativeLuminance } from '../doc/contrast';

/**
 * Ink for marks drawn *on the artboard's own ground* rather than on the app
 * chrome — currently the grid.
 *
 * This cannot be a theme token. The artboard's ground is a document colour the
 * author picked, and it is previewed independently of the UI theme, so a grid
 * keyed to the theme is invisible whenever the two disagree — which §12 of the
 * design makes a normal way to work, not an edge case.
 */
const LIGHT_GROUND_GRID = 'rgba(0, 0, 0, 0.075)';
const DARK_GROUND_GRID = 'rgba(255, 255, 255, 0.09)';

/** Above this the ground counts as light and takes dark grid lines. */
const MID_LUMINANCE = 0.35;

export function gridInk(groundHex: string): string {
  return relativeLuminance(groundHex) > MID_LUMINANCE ? LIGHT_GROUND_GRID : DARK_GROUND_GRID;
}
