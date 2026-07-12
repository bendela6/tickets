// Metrics — the shared card/port geometry constants. portWorldPos() mirrors the
// rendered box model exactly, so these MUST match the Tailwind utilities on the
// entity-card components (header height, field height, border, body padding,
// and port offsets).

export const HEADER_H = 34; // card header h-8.5
export const ROW_H = 22; // .field h-5.5
export const PORT_GAP = 8; // dot distance from card edge
export const CARD_BORDER = 1; // .card border-width
export const BODY_PAD_TOP = 4; // card body py-1
export const CARD_MIN_W = 156;
export const CARD_MAX_W = 320;
export const LAYOUT_MARGIN = 80;
export const STUB = 20; // straight bit a line leaves its port with
