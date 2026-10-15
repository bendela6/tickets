import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScrollSpy, type UseScrollSpyOptions } from './use-scroll-spy';

// jsdom lays nothing out, so each test lays the page out itself: where the
// root sits, how tall it and its content are, how far it has scrolled, and
// where each section starts in its content. A section's top on screen is
// then the root's top, plus where it starts, less the scroll.

interface Layout {
  /** The root's top in the viewport. */
  top: number;
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  /** Where each section starts in the content, by id. */
  sections: Record<string, number>;
}

function rectAt(top: number): DOMRect {
  return {
    top,
    bottom: top,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

/** Lays `scroller` out as `layout` says; `root` is the element whose top it reads, if any. */
function layOut(scroller: Element, layout: Layout, root?: Element) {
  Object.defineProperties(scroller, {
    scrollTop: { configurable: true, get: () => layout.scrollTop },
    clientHeight: { configurable: true, get: () => layout.clientHeight },
    scrollHeight: { configurable: true, get: () => layout.scrollHeight },
  });
  if (root) {
    root.getBoundingClientRect = () => rectAt(layout.top);
  }
  // Read as the hook reads them, so a test can move a section afterwards.
  for (const id of Object.keys(layout.sections)) {
    const section = document.getElementById(id);
    if (section) {
      section.getBoundingClientRect = () => {
        return rectAt(layout.top + (layout.sections[id] ?? 0) - layout.scrollTop);
      };
    }
  }
}

const IDS = ['sowing', 'watering', 'pruning', 'harvest'];

/** Four sections 400 pixels apart, in a root 500 tall: 1600 of content. */
function garden(): Layout {
  return {
    top: 0,
    clientHeight: 500,
    scrollHeight: 1600,
    scrollTop: 0,
    sections: { sowing: 0, watering: 400, pruning: 800, harvest: 1200 },
  };
}

// The plain view it drives: a list of links, and the sections they name in a
// root that scrolls. No component of bh's.
function Garden({ ids = IDS, offset }: { ids?: string[]; offset?: number }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const { activeId, pin } = useScrollSpy(ids, { root, offset });
  return (
    <>
      <nav aria-label="On this page">
        {ids.map((id) => {
          return (
            <a
              key={id}
              href={`#${id}`}
              aria-current={id === activeId ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault();
                pin(id);
              }}
            >
              {id}
            </a>
          );
        })}
      </nav>
      <div ref={setRoot} data-testid="root">
        {IDS.map((id) => {
          return (
            <section key={id} id={id} aria-label={id}>
              <h2>{id}</h2>
            </section>
          );
        })}
      </div>
    </>
  );
}

/** The entry lit, by its text. */
function lit(): string | null {
  return document.querySelector('[aria-current="location"]')?.textContent ?? null;
}

/** Renders the garden laid out as `layout`, and lets the hook read it. */
function renderGarden(layout = garden(), props: { ids?: string[]; offset?: number } = {}) {
  const view = render(<Garden {...props} />);
  const root = screen.getByTestId('root');
  layOut(root, layout, root);
  act(() => {
    fireEvent.scroll(root);
  });
  /** Scrolls the root to `y`, as code or the reader does. */
  const scrollTo = (y: number) => {
    layout.scrollTop = y;
    act(() => {
      fireEvent.scroll(root);
    });
  };
  return { ...view, root, layout, scrollTo };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useScrollSpy', () => {
  describe('the section in view', () => {
    it('is the first before any section has passed the line', () => {
      const page = garden();
      page.sections.sowing = 80;
      renderGarden(page);
      expect(lit()).toBe('sowing');
    });

    it('follows the scroll: the last section whose top has passed the line', () => {
      const { scrollTo } = renderGarden();
      expect(lit()).toBe('sowing');
      scrollTo(450);
      expect(lit()).toBe('watering');
      scrollTo(800);
      expect(lit()).toBe('pruning');
      scrollTo(399);
      expect(lit()).toBe('sowing');
    });

    it('draws the line offset pixels below the root’s top, wherever the root sits', () => {
      const page = garden();
      page.top = 64;
      const { scrollTo } = renderGarden(page, { offset: 120 });
      // watering's top is 64 + 400 - 290 = 174 on screen: 110 below the root's.
      scrollTo(290);
      expect(lit()).toBe('watering');
      scrollTo(270);
      expect(lit()).toBe('sowing');
    });

    it('is the last once a page that scrolls is at its end', () => {
      const { scrollTo } = renderGarden();
      // harvest starts 1200 down, 100 below the top here, and can go no higher.
      scrollTo(1100);
      expect(lit()).toBe('harvest');
    });

    it('goes by the line on a page that does not scroll, never straight to the last', () => {
      const page = garden();
      page.clientHeight = 1600;
      renderGarden(page);
      expect(lit()).toBe('sowing');
    });

    it('reads the page again when the window is resized', () => {
      const { layout } = renderGarden();
      layout.sections.sowing = -100;
      layout.sections.watering = -10;
      act(() => {
        fireEvent(window, new Event('resize'));
      });
      expect(lit()).toBe('watering');
    });

    it('passes over an id with no section on the page', () => {
      const { scrollTo } = renderGarden(garden(), { ids: ['sowing', 'weeding', 'pruning'] });
      scrollTo(450);
      expect(lit()).toBe('sowing');
      scrollTo(850);
      expect(lit()).toBe('pruning');
    });

    it('has none with no ids', () => {
      const { result } = renderHook(() => useScrollSpy([]));
      expect(result.current.activeId).toBeUndefined();
    });
  });

  describe('a pinned section', () => {
    it('is lit from a click on its entry, while the page scrolls from code', async () => {
      const user = userEvent.setup();
      const { scrollTo } = renderGarden();
      await user.click(screen.getByRole('link', { name: 'harvest' }));
      expect(lit()).toBe('harvest');
      // The page scrolling to it, smoothly, passes the others.
      scrollTo(400);
      scrollTo(800);
      expect(lit()).toBe('harvest');
    });

    it('is pinned from the keyboard too', async () => {
      const user = userEvent.setup();
      renderGarden();
      await user.tab();
      await user.tab();
      expect(screen.getByRole('link', { name: 'watering' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(lit()).toBe('watering');
    });

    it.each([
      ['the wheel', (root: HTMLElement) => fireEvent.wheel(root)],
      ['a touch', (root: HTMLElement) => fireEvent.touchMove(root)],
      ['a key', () => fireEvent.keyDown(window, { key: 'ArrowDown' })],
    ])('lets go when the reader scrolls by hand: %s', async (_how, byHand) => {
      const user = userEvent.setup();
      const { root, scrollTo } = renderGarden();
      await user.click(screen.getByRole('link', { name: 'harvest' }));
      act(() => {
        byHand(root);
      });
      // Let go, it shows the section in view again, and follows the scroll.
      expect(lit()).toBe('sowing');
      scrollTo(450);
      expect(lit()).toBe('watering');
    });

    it('is dropped when the ids change', async () => {
      const user = userEvent.setup();
      const { rerender } = renderGarden();
      await user.click(screen.getByRole('link', { name: 'pruning' }));
      expect(lit()).toBe('pruning');
      // Another page, which has a section of the same name.
      rerender(<Garden ids={['sowing', 'pruning']} />);
      expect(lit()).toBe('sowing');
    });
  });

  describe('its root', () => {
    it('watches nothing while null, and gives the first section', () => {
      const add = vi.spyOn(window, 'addEventListener');
      const { result } = renderHook(() => useScrollSpy(IDS, { root: null }));
      expect(result.current.activeId).toBe('sowing');
      expect(add.mock.calls.map(([type]) => type)).not.toContain('scroll');
    });

    it('is the window when left out', () => {
      render(
        <>
          {IDS.map((id) => {
            return <section key={id} id={id} />;
          })}
        </>,
      );
      const page = garden();
      const scroller = document.scrollingElement ?? document.documentElement;
      layOut(scroller, page);
      try {
        const { result } = renderHook(() => useScrollSpy(IDS));
        expect(result.current.activeId).toBe('sowing');
        page.scrollTop = 850;
        act(() => {
          fireEvent.scroll(window);
        });
        expect(result.current.activeId).toBe('pruning');
      } finally {
        // Back to jsdom's own, for the tests after.
        for (const name of ['scrollTop', 'clientHeight', 'scrollHeight']) {
          Reflect.deleteProperty(scroller, name);
        }
      }
    });
  });

  it('keeps pin for its life', () => {
    const { result, rerender } = renderHook(
      (options: UseScrollSpyOptions) => useScrollSpy(IDS, options),
      {
        initialProps: { offset: 0 },
      },
    );
    const { pin } = result.current;
    act(() => pin('pruning'));
    rerender({ offset: 120 });
    expect(result.current.pin).toBe(pin);
  });

  it('subscribes once for a list made again on each render', () => {
    const root = document.createElement('div');
    const add = vi.spyOn(root, 'addEventListener');
    const { rerender } = renderHook(() => useScrollSpy([...IDS], { root }));
    rerender();
    rerender();
    expect(add.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1);
  });

  describe('cleaning up', () => {
    const OURS = new Set(['scroll', 'resize', 'wheel', 'touchmove', 'keydown']);

    // Each listener of those types it adds to the root or the window, until
    // it is removed again.
    function watchListeners(root: HTMLElement) {
      const live: { target: EventTarget; type: string; listener: unknown }[] = [];
      for (const target of [root, window] as EventTarget[]) {
        const add = target.addEventListener.bind(target);
        const remove = target.removeEventListener.bind(target);
        vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
          if (OURS.has(type)) {
            live.push({ target, type, listener });
          }
          add(type, listener, options);
        });
        vi.spyOn(target, 'removeEventListener').mockImplementation((type, listener, options) => {
          const at = live.findIndex((entry) => {
            return entry.target === target && entry.type === type && entry.listener === listener;
          });
          if (at >= 0) {
            live.splice(at, 1);
          }
          remove(type, listener, options);
        });
      }
      return live;
    }

    it.each([
      ['', false],
      [' under StrictMode', true],
    ])('ends every listener it added at unmount%s', (_, strict) => {
      const root = document.createElement('div');
      const live = watchListeners(root);
      const { result, unmount } = renderHook(() => useScrollSpy(IDS, { root }), {
        wrapper: strict ? StrictMode : undefined,
      });
      // Pinned, it listens for the reader too. StrictMode's second run leaves
      // one of each, not two.
      act(() => result.current.pin('pruning'));
      expect(live.map((entry) => entry.type).sort()).toEqual([
        'keydown',
        'resize',
        'scroll',
        'touchmove',
        'wheel',
      ]);
      unmount();
      expect(live).toEqual([]);
    });
  });
});
