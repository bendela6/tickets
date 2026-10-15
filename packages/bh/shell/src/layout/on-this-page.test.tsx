// OnThisPage over a made-up page: a link to each section, nested by level; the
// one being read lit as the <main> it sits in scrolls; a click lights its
// section at once, hands it to the app and keeps it lit until the reader
// scrolls by hand; without onSelect, a click scrolls the page to it; a root
// and a line of the app's own; nothing without sections.

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnThisPage, type OnThisPageProps, type PageSection } from './on-this-page';

// jsdom lays nothing out, so each test lays the page out itself, as
// useScrollSpy's own tests do: where the root sits, how tall it and its
// content are, how far it has scrolled, and where each section starts in it.

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

function layOut(root: Element, layout: Layout) {
  Object.defineProperties(root, {
    scrollTop: { configurable: true, get: () => layout.scrollTop },
    clientHeight: { configurable: true, get: () => layout.clientHeight },
    scrollHeight: { configurable: true, get: () => layout.scrollHeight },
  });
  root.getBoundingClientRect = () => rectAt(layout.top);
  for (const id of Object.keys(layout.sections)) {
    const section = document.getElementById(id);
    if (section) {
      section.getBoundingClientRect = () => {
        return rectAt(layout.top + (layout.sections[id] ?? 0) - layout.scrollTop);
      };
    }
  }
}

const SECTIONS: readonly PageSection[] = [
  { id: 'labelling', label: 'Labelling' },
  { id: 'stacking', label: 'Stacking' },
  { id: 'moving', label: 'Moving' },
  { id: 'storing', label: 'Storing' },
];

/** Four sections 400 pixels apart, in a <main> 500 tall: 1600 of content. */
function boxes(): Layout {
  return {
    top: 0,
    clientHeight: 500,
    scrollHeight: 1600,
    scrollTop: 0,
    sections: { labelling: 0, stacking: 400, moving: 800, storing: 1200 },
  };
}

function Headings({ sections }: { sections: readonly PageSection[] }) {
  return sections.map((section) => {
    return (
      <section key={section.id} id={section.id}>
        <h2>{section.label}</h2>
      </section>
    );
  });
}

/** A page in a <main> that scrolls, as AppShell's does, the list beside its sections. */
function renderPage(layout = boxes(), props: Partial<OnThisPageProps> = {}) {
  const view = render(
    <main data-testid="main">
      <OnThisPage sections={SECTIONS} {...props} />
      <Headings sections={SECTIONS} />
    </main>,
  );
  const main = screen.getByTestId('main');
  layOut(main, layout);
  act(() => {
    fireEvent.scroll(main);
  });
  /** Scrolls the <main> to `y`, as code or the reader does. */
  const scrollTo = (y: number) => {
    layout.scrollTop = y;
    act(() => {
      fireEvent.scroll(main);
    });
  };
  return { ...view, main, scrollTo };
}

function outline(name = 'On this page'): HTMLElement {
  return screen.getByRole('navigation', { name });
}

/** The entry lit, by its name. */
function lit(): string | null {
  const links = within(outline()).getAllByRole('link');
  return (
    links.find((link) => link.getAttribute('aria-current') === 'location')?.textContent ?? null
  );
}

/** How many lists deep an entry sits: 1 for the top list. */
function depthOf(name: string): number {
  let depth = 0;
  for (let at = screen.getByRole('link', { name }).parentElement; at; at = at.parentElement) {
    if (at.tagName === 'UL') {
      depth += 1;
    }
  }
  return depth;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OnThisPage', () => {
  it('links to each section, under its heading', () => {
    renderPage();
    const list = outline();
    expect(within(list).getByText('On this page')).toBeInTheDocument();
    const links = within(list).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Labelling',
      'Stacking',
      'Moving',
      'Storing',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#labelling',
      '#stacking',
      '#moving',
      '#storing',
    ]);
  });

  it('lights the section being read as the <main> it sits in scrolls', () => {
    const { scrollTo } = renderPage();
    expect(lit()).toBe('Labelling');
    // Stacking's heading is 50 pixels above the top, Moving's 350 below.
    scrollTo(450);
    expect(lit()).toBe('Stacking');
    // Moving's is 100 below: past the line, 120 pixels down unless given.
    scrollTo(700);
    expect(lit()).toBe('Moving');
    // At the end, the last, which can never reach the line.
    scrollTo(1100);
    expect(lit()).toBe('Storing');
  });

  it('lights a section picked at once, hands it to the app, and keeps it lit until the reader scrolls', async () => {
    const onSelect = vi.fn();
    const { main, scrollTo } = renderPage(boxes(), { onSelect });
    await userEvent.click(screen.getByRole('link', { name: 'Moving' }));
    expect(lit()).toBe('Moving');
    expect(onSelect).toHaveBeenCalledWith(SECTIONS[2]);
    // The page scrolling there from code passes Stacking: Moving stays lit.
    scrollTo(450);
    expect(lit()).toBe('Moving');
    // A turn of the wheel is the reader's own: the page lights what is in view.
    act(() => {
      fireEvent.wheel(main);
    });
    expect(lit()).toBe('Stacking');
  });

  it('scrolls the <main> until the heading is at its top, without onSelect', async () => {
    // The <main> starts 56 pixels down, under a bar.
    const { main } = renderPage({ ...boxes(), top: 56 });
    const scrollTo = vi.fn();
    main.scrollTo = scrollTo;
    await userEvent.click(screen.getByRole('link', { name: 'Moving' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 800, behavior: 'smooth' });
    expect(lit()).toBe('Moving');
  });

  it('scrolls the window outside a <main>', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    render(
      <>
        <OnThisPage sections={SECTIONS} />
        <Headings sections={SECTIONS} />
      </>,
    );
    const moving = document.getElementById('moving');
    if (moving) {
      moving.getBoundingClientRect = () => rectAt(300);
    }
    await userEvent.click(screen.getByRole('link', { name: 'Moving' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'smooth' });
  });

  it('watches a root of the app’s own, with its own line', () => {
    function InABox() {
      const [box, setBox] = useState<HTMLDivElement | null>(null);
      return (
        <main>
          <OnThisPage sections={SECTIONS} root={box} offset={24} />
          <div ref={setBox} data-testid="box">
            <Headings sections={SECTIONS} />
          </div>
        </main>
      );
    }
    render(<InABox />);
    const box = screen.getByTestId('box');
    const layout = boxes();
    layOut(box, layout);
    const scrollBox = (y: number) => {
      layout.scrollTop = y;
      act(() => {
        fireEvent.scroll(box);
      });
    };
    // Stacking's heading 50 pixels down: under a line 24 down, not yet read.
    scrollBox(350);
    expect(lit()).toBe('Labelling');
    scrollBox(390);
    expect(lit()).toBe('Stacking');
  });

  it('lists a section under the nearest one before it with a lower level', () => {
    const sections: readonly PageSection[] = [
      { id: 'boxes', label: 'Boxes' },
      { id: 'small', label: 'Small', level: 3 },
      { id: 'flat', label: 'Flat', level: 4 },
      { id: 'large', label: 'Large', level: 3 },
      { id: 'labels', label: 'Labels', level: 2 },
      // An h4 straight under an h2 is one step in, not two.
      { id: 'tape', label: 'Tape', level: 4 },
    ];
    render(
      <main>
        <OnThisPage sections={sections} />
        <Headings sections={sections} />
      </main>,
    );
    expect(
      ['Boxes', 'Small', 'Flat', 'Large', 'Labels', 'Tape'].map((name) => depthOf(name)),
    ).toEqual([1, 2, 3, 2, 1, 2]);
    // Each list is a list a screen reader counts: the top one has two items.
    const top = within(outline()).getAllByRole('list')[0];
    expect(top?.querySelectorAll(':scope > li')).toHaveLength(2);
  });

  it('takes the app’s words for its heading and its name', () => {
    render(<OnThisPage sections={SECTIONS} label="In this guide" />);
    expect(outline('In this guide')).toHaveTextContent(/^In this guide/);
  });

  it('draws nothing without sections, so a page with none needs no condition', () => {
    render(<OnThisPage sections={[]} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
