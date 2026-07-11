// Metrics — the shared card/port geometry constants. portWorldPos() mirrors the
// CSS box model exactly, so these MUST match app.css (.card-hd height, .field
// height, .card border, .card-body padding, port offsets).

export const HEADER_H = 34; // .card-hd height (must match app.css)
export const ROW_H = 22; // .field height
export const PORT_GAP = 8; // dot distance from card edge
export const CARD_BORDER = 1; // .card border-width
export const BODY_PAD_TOP = 3; // .card-body padding-top
export const CARD_MIN_W = 156;
export const CARD_MAX_W = 320;
export const LAYOUT_MARGIN = 80;
export const STUB = 20; // straight bit a line leaves its port with
