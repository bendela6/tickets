import { act, render, renderHook, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsClipped } from './use-is-clipped';

// jsdom lays nothing out, so every box is 0 by 0. These sizes stand in for a
// browser's: a box is as wide and tall as its style says, and its text is
// CHAR pixels a character on one line, or `data-lines` lines of 20 pixels.
let CHAR = 8;
const SIZES = ['clientWidth', 'scrollWidth', 'clientHeight', 'scrollHeight'] as const;

function laidOut() {
  const width = (el: HTMLElement) => parseFloat(el.style.width) || 0;
  const height = (el: HTMLElement) => parseFloat(el.style.height) || 0;
  const sizes: Record<(typeof SIZES)[number], (el: HTMLElement) => number> = {
    clientWidth: width,
    scrollWidth: (el) => Math.max(width(el), (el.textContent?.length ?? 0) * CHAR),
    clientHeight: height,
    scrollHeight: (el) => Math.max(height(el), Number(el.dataset.lines ?? 0) * 20),
  };
  SIZES.forEach((size) => {
    Object.defineProperty(HTMLElement.prototype, size, {
      configurable: true,
      get(this: HTMLElement) {
        return sizes[size](this);
      },
    });
  });
}

/** A ResizeObserver the test drives: `resize(box)` reports a box as a browser would. */
class FakeResizeObserver {
  static made: FakeResizeObserver[] = [];
  observed = new Set<Element>();
  disconnected = false;
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.made.push(this);
  }
  observe(target: Element) {
    this.observed.add(target);
  }
  unobserve(target: Element) {
    this.observed.delete(target);
  }
  disconnect() {
    this.observed.clear();
    this.disconnected = true;
  }
  resize(target: Element) {
    this.callback([{ target } as ResizeObserverEntry], this);
  }
}

const live = () => FakeResizeObserver.made.filter((observer) => !observer.disconnected);

beforeEach(() => {
  CHAR = 8;
  FakeResizeObserver.made = [];
  laidOut();
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  SIZES.forEach((size) => {
    Reflect.deleteProperty(HTMLElement.prototype, size);
  });
  vi.unstubAllGlobals();
});

// The plain view it drives: a box that clips its text, and a line that says
// what the hook says. No component of bh's.
function Line({ text, width, lines }: { text: string; width: number; lines?: number }) {
  const { isClipped, ref } = useIsClipped(text);
  return (
    <>
      <p
        ref={ref}
        data-testid="box"
        data-lines={lines}
        style={{ width, height: 40 }}
        className="overflow-hidden whitespace-nowrap"
      >
        {text}
      </p>
      <output>{isClipped ? 'clipped' : 'fits'}</output>
    </>
  );
}

const said = () => screen.getByRole('status').textContent;

describe('useIsClipped', () => {
  describe('what it measures', () => {
    it('says a text shorter than its box fits', () => {
      render(<Line text="Lisbon" width={200} />);
      expect(said()).toBe('fits');
    });

    it('says a text longer than its box is clipped, before anything else happens', () => {
      render(<Line text="packages/web/hooks/src/use-is-clipped.ts" width={120} />);
      expect(said()).toBe('clipped');
    });

    it('lets a text run a pixel over and still fit', () => {
      // 10 characters of 8 pixels, in 79 pixels and in 78.
      const { rerender } = render(<Line text="abcdefghij" width={79} />);
      expect(said()).toBe('fits');
      rerender(<Line text="abcdefghij" width={78} />);
      act(() => live()[0]?.resize(screen.getByTestId('box')));
      expect(said()).toBe('clipped');
    });

    it('counts a text that runs past the bottom, as a clamped paragraph does', () => {
      render(<Line text="short" width={200} lines={3} />);
      expect(said()).toBe('clipped');
    });
  });

  describe('when it measures again', () => {
    it('measures when its text changes', () => {
      const { rerender } = render(<Line text="Porto" width={120} />);
      expect(said()).toBe('fits');
      rerender(<Line text="Porto, Vila Nova de Gaia" width={120} />);
      expect(said()).toBe('clipped');
      rerender(<Line text="Braga" width={120} />);
      expect(said()).toBe('fits');
    });

    it('measures when its box is resized, and not before', () => {
      const { rerender } = render(<Line text="Valencia" width={200} />);
      // A new width with the same text: nothing is read until the observer
      // reports, as a render reads no layout.
      rerender(<Line text="Valencia" width={40} />);
      expect(said()).toBe('fits');
      act(() => live()[0]?.resize(screen.getByTestId('box')));
      expect(said()).toBe('clipped');
    });

    it('measures when a webfont loads', () => {
      const fonts = new EventTarget();
      Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
      try {
        render(<Line text="Tbilisi" width={60} />);
        expect(said()).toBe('fits');
        // The webfont's letters are wider; neither the box nor the text changed.
        CHAR = 12;
        act(() => {
          fonts.dispatchEvent(new Event('loadingdone'));
        });
        expect(said()).toBe('clipped');
      } finally {
        Reflect.deleteProperty(document, 'fonts');
      }
    });

    it('measures a new box as it arrives', () => {
      function Swapped({ wide }: { wide: boolean }) {
        const { isClipped, ref } = useIsClipped('Seville');
        return (
          <>
            {wide ? (
              <p ref={ref} style={{ width: 200 }}>
                Seville
              </p>
            ) : (
              <div ref={ref} style={{ width: 20 }}>
                Seville
              </div>
            )}
            <output>{isClipped ? 'clipped' : 'fits'}</output>
          </>
        );
      }
      const { rerender } = render(<Swapped wide />);
      expect(said()).toBe('fits');
      rerender(<Swapped wide={false} />);
      expect(said()).toBe('clipped');
    });

    it('measures on mount and on a new text where there is no ResizeObserver', () => {
      vi.stubGlobal('ResizeObserver', undefined);
      const { rerender } = render(<Line text="Turin" width={60} />);
      expect(said()).toBe('fits');
      rerender(<Line text="Turin, Piedmont" width={60} />);
      expect(said()).toBe('clipped');
    });
  });

  describe('with no box', () => {
    it('is false on its first render, and while there is no box', () => {
      function Maybe({ shown }: { shown: boolean }) {
        const { isClipped, ref } = useIsClipped('Batumi');
        return (
          <>
            {shown ? (
              <p ref={ref} style={{ width: 10 }}>
                Batumi
              </p>
            ) : null}
            <output>{isClipped ? 'clipped' : 'fits'}</output>
          </>
        );
      }
      const { rerender } = render(<Maybe shown={false} />);
      expect(said()).toBe('fits');
      rerender(<Maybe shown />);
      expect(said()).toBe('clipped');
      rerender(<Maybe shown={false} />);
      expect(said()).toBe('fits');
    });
  });

  it('keeps its ref for its life', () => {
    const { result, rerender } = renderHook(({ text }) => useIsClipped(text), {
      initialProps: { text: 'Ana' },
    });
    const { ref } = result.current;
    rerender({ text: 'Giorgi' });
    expect(result.current.ref).toBe(ref);
  });

  it('watches every box on the page with one observer', () => {
    render(
      <>
        <Line text="Lisbon" width={200} />
        <Line text="Porto" width={200} />
      </>,
    );
    expect(live()).toHaveLength(1);
    expect(live()[0]?.observed.size).toBe(2);
  });

  it('leaves one observation under StrictMode', () => {
    render(
      <StrictMode>
        <Line text="Braga" width={200} />
      </StrictMode>,
    );
    expect(live()).toHaveLength(1);
    expect([...(live()[0]?.observed ?? [])]).toEqual([screen.getByTestId('box')]);
  });

  describe('cleaning up', () => {
    it('stops observing at unmount, and listens for no webfont', () => {
      const fonts = new EventTarget();
      const add = vi.spyOn(fonts, 'addEventListener');
      const remove = vi.spyOn(fonts, 'removeEventListener');
      Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
      try {
        const { unmount } = render(<Line text="Nino" width={200} />);
        expect(add).toHaveBeenCalledTimes(1);
        unmount();
        expect(live()).toEqual([]);
        expect(remove).toHaveBeenCalledWith('loadingdone', add.mock.calls[0]?.[1]);
      } finally {
        Reflect.deleteProperty(document, 'fonts');
      }
    });

    it('stops observing a box that goes, while others stay', () => {
      function Two({ both }: { both: boolean }) {
        return (
          <>
            <Line text="Luca" width={200} />
            {both ? <Line text="Elena" width={200} /> : null}
          </>
        );
      }
      const { rerender } = render(<Two both />);
      rerender(<Two both={false} />);
      expect(live()).toHaveLength(1);
      expect(live()[0]?.observed.size).toBe(1);
    });
  });
});
