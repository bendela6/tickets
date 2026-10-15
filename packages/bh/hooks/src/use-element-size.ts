import { useCallback, useState, type RefCallback } from 'react';

/** Which of an element's boxes is measured. */
export type MeasuredBox = 'content-box' | 'border-box';

/** What `useElementSize` takes. Every option is optional: `useElementSize()`. */
export interface UseElementSizeOptions {
  /** The box measured: `content-box`, inside the padding, unless `border-box`, out to the border's outer edge. */
  box?: MeasuredBox;
}

/** What `useElementSize` gives back: the size, then the ref. */
export interface UseElementSizeResult<T extends Element> {
  /** The box's width in pixels, as laid out; `undefined` until the element is measured, on a server, and while there is none. */
  width: number | undefined;
  /** The box's height in pixels, as laid out; `undefined` until the element is measured, on a server, and while there is none. */
  height: number | undefined;
  /** Goes on the element to measure. The same function for the hook's life, while `box` is the same. */
  ref: RefCallback<T>;
}

interface Size {
  width: number;
  height: number;
}

const px = (value: string) => Number.parseFloat(value) || 0;

/** The element's size now, read from layout as it mounts. */
function measure(element: Element, box: MeasuredBox): Size {
  const rect = element.getBoundingClientRect();
  if (box === 'border-box') {
    return { width: rect.width, height: rect.height };
  }
  const style = getComputedStyle(element);
  const across =
    px(style.paddingLeft) +
    px(style.paddingRight) +
    px(style.borderLeftWidth) +
    px(style.borderRightWidth);
  const down =
    px(style.paddingTop) +
    px(style.paddingBottom) +
    px(style.borderTopWidth) +
    px(style.borderBottomWidth);
  return { width: Math.max(0, rect.width - across), height: Math.max(0, rect.height - down) };
}

/** The size a `ResizeObserver` reports, in the box asked for. */
function observed(entry: ResizeObserverEntry, box: MeasuredBox): Size {
  if (box === 'border-box') {
    const size = entry.borderBoxSize[0];
    return size ? { width: size.inlineSize, height: size.blockSize } : measure(entry.target, box);
  }
  return { width: entry.contentRect.width, height: entry.contentRect.height };
}

/**
 * An element's width and height, measured as it mounts and again whenever it
 * changes size: a chart drawn to its container's width, a panel that lays out
 * by the room it has. It draws nothing, and wires nothing but the ref.
 *
 * Its server value is no size: `width` and `height` are `undefined` until the
 * element is measured, in the browser, before it first paints. Destructure
 * with a default for a number to draw with: `const { width = 0, ref } =
 * useElementSize()`.
 */
export function useElementSize<T extends Element = HTMLElement>({
  box = 'content-box',
}: UseElementSizeOptions = {}): UseElementSizeResult<T> {
  const [size, setSize] = useState<Size | undefined>(undefined);

  // A callback ref, so an element that comes later, or is swapped for
  // another, is measured as it arrives. It measures before the browser
  // paints, so nothing shows at the wrong size first, and then follows the
  // element with a ResizeObserver where the browser has one.
  const ref = useCallback<RefCallback<T>>(
    (element) => {
      if (!element) {
        return undefined;
      }
      const take = (next: Size) => {
        // A measurement that comes out the same keeps the object it had.
        setSize((before) => {
          return before?.width === next.width && before.height === next.height ? before : next;
        });
      };
      take(measure(element, box));
      // Without one, it is measured as it mounts and not again.
      const observer =
        typeof ResizeObserver === 'undefined'
          ? undefined
          : new ResizeObserver(([entry]) => {
              if (entry) {
                take(observed(entry, box));
              }
            });
      observer?.observe(element, { box });
      // With no element, there is no size.
      return () => {
        observer?.disconnect();
        setSize(undefined);
      };
    },
    [box],
  );

  return { width: size?.width, height: size?.height, ref };
}
