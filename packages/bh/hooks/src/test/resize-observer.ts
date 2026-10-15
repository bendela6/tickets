import { act } from '@testing-library/react';
import { vi } from 'vitest';

// jsdom lays nothing out and has no ResizeObserver: this one is driven by
// hand, and remembers each observer it made, what it watches and whether it
// was disconnected.

export interface FakeObserver {
  callback: ResizeObserverCallback;
  targets: Set<Element>;
  options: ResizeObserverOptions | undefined;
  disconnected: boolean;
}

/** Installs a ResizeObserver for the test, and what drives it. */
export function fakeResizeObserver() {
  const made: FakeObserver[] = [];
  class Fake {
    #own: FakeObserver;
    constructor(callback: ResizeObserverCallback) {
      this.#own = { callback, targets: new Set(), options: undefined, disconnected: false };
      made.push(this.#own);
    }
    observe(target: Element, options?: ResizeObserverOptions) {
      this.#own.targets.add(target);
      this.#own.options = options;
    }
    unobserve(target: Element) {
      this.#own.targets.delete(target);
    }
    disconnect() {
      this.#own.targets.clear();
      this.#own.disconnected = true;
    }
  }
  vi.stubGlobal('ResizeObserver', Fake);

  /** Every live observer watching `target` hears it is now `width` by `height`, in each box. */
  function resize(target: Element, width: number, height: number) {
    const entry = {
      target,
      contentRect: { width, height } as DOMRectReadOnly,
      contentBoxSize: [{ inlineSize: width, blockSize: height }],
      borderBoxSize: [{ inlineSize: width, blockSize: height }],
      devicePixelContentBoxSize: [],
    } as unknown as ResizeObserverEntry;
    act(() => {
      for (const observer of made) {
        if (!observer.disconnected && observer.targets.has(target)) {
          observer.callback([entry], {} as ResizeObserver);
        }
      }
    });
  }

  return {
    made,
    resize,
    /** The observers still connected. */
    live: () => made.filter((observer) => !observer.disconnected),
  };
}

/** Lays every element out at `width` by `height`, as getBoundingClientRect reports it. */
export function layOut(width: number, height: number) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  });
}
