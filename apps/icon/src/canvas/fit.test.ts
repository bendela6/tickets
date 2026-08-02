import { afterEach, describe, expect, it } from 'vitest';
import { ARTBOARD_PX } from '../doc/constants';
import { canvasRoom } from './fit';

/**
 * A stand-in for a laid-out element. jsdom reports every box as zero — which
 * is itself one of the cases under test — so the sizes are declared.
 */
function boxed(width: number, height: number, padding = 0): HTMLElement {
  const node = document.createElement('div');
  node.style.padding = `${padding}px`;
  Object.defineProperty(node, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(node, 'clientHeight', { value: height, configurable: true });
  document.body.append(node);
  return node;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('canvasRoom', () => {
  it('takes off the padding the column is actually laid out with', () => {
    const scroller = boxed(900, 700);
    const stack = boxed(ARTBOARD_PX + 64, 64 + ARTBOARD_PX, 32);

    expect(canvasRoom(scroller, stack)).toEqual({
      width: 900 - 64,
      height: 700 - 64,
    });
  });

  it('measures the scroller it is given, so the source panel really does take room', () => {
    // The panel is a sibling of the scroller inside the canvas region rather
    // than a layer over it, so opening it shortens the scroller itself. That is
    // the whole mechanism: nothing here is told the panel exists, and ⇧⌘0 still
    // fits the board into what is left instead of into a region it no longer
    // has. A panel drawn over the artboard would leave this reading the old
    // height and fitting the board to a box the panel covers.
    const stack = boxed(ARTBOARD_PX + 64, ARTBOARD_PX + 64, 32);
    const region = 700;
    const panel = region / 3;

    const shut = canvasRoom(boxed(900, region), stack);
    const open = canvasRoom(boxed(900, region - panel), stack);

    expect(shut?.height).toBe(region - 64);
    expect(open?.height).toBe(region - panel - 64);
    // Only the height moves: the panel spans the region rather than sitting
    // beside the artboard.
    expect(open?.width).toBe(shut?.width);
  });

  it('reports nothing rather than a negative room when there is no layout', () => {
    expect(canvasRoom(boxed(0, 0), boxed(0, 0, 32))).toBeNull();
    expect(canvasRoom(null, boxed(900, 700, 32))).toBeNull();
    expect(canvasRoom(boxed(900, 700), null)).toBeNull();
  });
});
