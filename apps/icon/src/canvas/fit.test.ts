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

  it('reports nothing rather than a negative room when there is no layout', () => {
    expect(canvasRoom(boxed(0, 0), boxed(0, 0, 32))).toBeNull();
    expect(canvasRoom(null, boxed(900, 700, 32))).toBeNull();
    expect(canvasRoom(boxed(900, 700), null)).toBeNull();
  });
});
