import { describe, expect, it } from 'vitest';

import { BODY_PAD_TOP, CARD_BORDER, CARD_MAX_W, CARD_MIN_W, HEADER_H, LAYOUT_MARGIN, PORT_GAP, ROW_H, STUB } from './metrics';

// The documented contract: these constants MUST match the component utilities,
// because portWorldPos mirrors the rendered box model. Each paired value is
// pinned here so editing either side means acknowledging the geometry change.
describe('metrics ↔ Tailwind utility pairings (pinned)', () => {
  it('matches the card box model rules', () => {
    expect(HEADER_H).toBe(34); // .card-hd h-8.5
    expect(ROW_H).toBe(22); // .field h-5.5
    expect(CARD_BORDER).toBe(1); // .card border
    expect(BODY_PAD_TOP).toBe(3); // .card-body py-0.75
  });

  it('matches the port offset rules', () => {
    expect(PORT_GAP).toBe(8); // .port -left-2 / left-full ml-2
  });
});

describe('metrics invariants', () => {
  it('keeps card sizing sane', () => {
    expect(CARD_MIN_W).toBeGreaterThan(0);
    expect(CARD_MAX_W).toBeGreaterThan(CARD_MIN_W);
    expect(HEADER_H).toBeGreaterThan(0);
    expect(ROW_H).toBeGreaterThan(0);
    expect(CARD_BORDER).toBeGreaterThanOrEqual(1);
    expect(BODY_PAD_TOP).toBeGreaterThanOrEqual(0);
  });

  it('keeps ports outside the card and stubs longer than the port gap', () => {
    expect(PORT_GAP).toBeGreaterThan(0);
    // A stub must clear the port gap or the first bend would sit inside the pin.
    expect(STUB).toBeGreaterThan(PORT_GAP);
  });

  it('leaves layout margin for the fit padding', () => {
    expect(LAYOUT_MARGIN).toBeGreaterThanOrEqual(40);
  });
});
