// What an example panel shows and how a split sits, and the stage's least
// height: what an app's own page format names when it says how a panel opens.

/** What an example panel shows: the result, the result and its code, or the code. */
export type ExamplePanelMode = 'view' | 'split' | 'source';

/** How a split sits: the code under the result, or beside it. */
export type ExamplePanelLayout = 'vertical' | 'horizontal';

/** Every mode, in the order the panel offers them. */
export const EXAMPLE_PANEL_MODES: readonly ExamplePanelMode[] = ['view', 'split', 'source'];

/** Both layouts: under, then beside. */
export const EXAMPLE_PANEL_LAYOUTS: readonly ExamplePanelLayout[] = ['vertical', 'horizontal'];

/** The result stage's least height when the app sets none, in pixels: room for a small result. */
export const EXAMPLE_STAGE_HEIGHT = 200;
