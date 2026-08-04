// Metrics — the shared card/port geometry constants. portWorldPos() mirrors the
// rendered box model exactly, so these MUST match the Tailwind utilities on the
// entity-card components (header height, field height, border, body padding,
// and port offsets).

export const HEADER_H = 36; // card header h-36
export const ROW_H = 24; // field row h-24
export const PORT_GAP = 2; // pin bar centre: the w-4 bar rides right-full/left-full, so its centre sits 2px outside the row edge
export const CARD_BORDER = 1; // .card border-width
export const BODY_PAD_TOP = 4; // card body py-4
export const CARD_MIN_W = 156;
export const CARD_MAX_W = 320;
export const LAYOUT_MARGIN = 80;
export const STUB = 20; // straight bit a line leaves its port with
