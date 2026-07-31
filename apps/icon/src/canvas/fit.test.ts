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

const BOARD = { width: 512, height: 512 };
/** The transport and the held poses, under the artboard. */
const BELOW = 60;

afterEach(() => {
  document.body.replaceChildren();
});

describe('canvasRoom', () => {
  it('takes off the padding and everything stacked below the artboard', () => {
    const scroller = boxed(900, 700);
    const stack = boxed(ARTBOARD_PX + 64, 64 + ARTBOARD_PX + BELOW, 32);

    expect(canvasRoom(scroller, stack, BOARD, 100)).toEqual({
      width: 900 - 64,
      height: 700 - 64 - BELOW,
    });
  });

  it('measures what is below at the zoom actually on screen', () => {
    // At 50% the artboard draws half as tall, so the same column height means
    // the transport and poses account for more of it — subtracting a constant
    // artboard size here would have reported room that does not exist.
    const scroller = boxed(900, 700);
    const stack = boxed(ARTBOARD_PX + 64, 64 + ARTBOARD_PX / 2 + BELOW, 32);

    expect(canvasRoom(scroller, stack, BOARD, 50)).toEqual({
      width: 900 - 64,
      height: 700 - 64 - BELOW,
    });
  });

  it('reports nothing rather than a negative room when there is no layout', () => {
    expect(canvasRoom(boxed(0, 0), boxed(0, 0, 32), BOARD, 100)).toBeNull();
    expect(canvasRoom(null, boxed(900, 700, 32), BOARD, 100)).toBeNull();
    expect(canvasRoom(boxed(900, 700), null, BOARD, 100)).toBeNull();
  });
});
