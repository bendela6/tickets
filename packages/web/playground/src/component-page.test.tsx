import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import {
  boolean as booleanControl,
  collectDemos,
  definePlayground,
  isDemoError,
  select,
} from '@tickets/ui';
import { setAxeForTests } from './axe';
import { ComponentPage } from './component-page';

// react-resizable-panels needs real layout (ResizeObserver-driven sizing) to
// do anything useful, which jsdom can't provide meaningfully. Mock it with a
// pass-through so ComponentPage's own wiring (defaultLayout, defaultSize,
// which children go in which Panel, the persistence callback) is directly
// assertable, while still rendering real children for the tab-switching /
// controls-flow assertions below.
type Layout = Record<string, number>;
type LayoutChangedMeta = { isUserInteraction: boolean };

vi.mock('react-resizable-panels', () => ({
  Group: ({
    children,
    id,
    orientation,
    defaultLayout,
    onLayoutChanged,
  }: {
    children: ReactNode;
    id?: string;
    orientation?: string;
    defaultLayout?: Layout;
    onLayoutChanged?: (layout: Layout, meta: LayoutChangedMeta) => void;
  }) => (
    <div
      data-testid="panel-group"
      data-id={id}
      data-orientation={orientation}
      data-default-layout={defaultLayout ? JSON.stringify(defaultLayout) : undefined}
    >
      <button
        type="button"
        data-testid="simulate-user-resize"
        onClick={() => onLayoutChanged?.({ stage: 65, controls: 35 }, { isUserInteraction: true })}
      />
      <button
        type="button"
        data-testid="simulate-programmatic-layout"
        onClick={() => onLayoutChanged?.({ stage: 50, controls: 50 }, { isUserInteraction: false })}
      />
      {children}
    </div>
  ),
  Panel: ({
    children,
    id,
    defaultSize,
    minSize,
    maxSize,
    collapsible,
    collapsedSize,
    onResize,
  }: {
    children: ReactNode;
    id?: string;
    defaultSize?: string | number;
    minSize?: string | number;
    maxSize?: string | number;
    collapsible?: boolean;
    collapsedSize?: string | number;
    onResize?: (size: { asPercentage: number; inPixels: number }) => void;
  }) => (
    <div
      data-testid="panel"
      data-id={id}
      data-default-size={defaultSize}
      data-min-size={minSize}
      data-max-size={maxSize}
      data-collapsible={collapsible ? 'true' : undefined}
      data-collapsed-size={collapsedSize}
    >
      {/* Stands in for dragging the separator past minSize, which is how the
          library itself collapses a panel — jsdom can't do a real drag. */}
      {onResize && (
        <button
          type="button"
          data-testid={`simulate-drag-collapse-${id}`}
          onClick={() => onResize({ asPercentage: 0, inPixels: 0 })}
        />
      )}
      {children}
    </div>
  ),
  Separator: ({ className }: { className?: string }) => (
    <div data-testid="resize-handle" className={className} />
  ),
}));

const demos = collectDemos({
  button: {
    meta: { title: 'Button', group: 'Form controls' },
    states: [{ name: 'primary', render: () => <b>state-btn</b> }],
    playground: definePlayground({
      controls: {
        variant: select(['primary', 'secondary'], { label: 'variant' }),
        loading: booleanControl(false, { label: 'loading' }),
      },
      render: (v) => (
        <button data-variant={v.variant} data-loading={v.loading}>
          play-btn
        </button>
      ),
    }),
  },
});
const demo = demos[0];
if (!demo || isDemoError(demo)) throw new Error('fixture demo failed to collect');

describe('ComponentPage', () => {
  afterEach(() => {
    localStorage.clear();
    setAxeForTests(null);
  });

  it('renders a real tablist with Preview active', () => {
    render(<ComponentPage demo={demo} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    const preview = screen.getByRole('tab', { name: 'Preview' });
    const props = screen.getByRole('tab', { name: 'Docs' });
    expect(screen.getByRole('tab', { name: 'Implementation' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Demo' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'A11y' })).toBeTruthy();
    // The generated snippet moved onto the Preview stage, so there is no
    // separate Code tab to duplicate it.
    expect(screen.queryByRole('tab', { name: 'Code' })).toBeNull();
    expect(preview.className).toContain('border-accent');
    expect(props.className).not.toContain('border-accent');
    expect(preview.getAttribute('aria-selected')).toBe('true');
    expect(props.getAttribute('aria-selected')).toBe('false');
  });

  it('shows the generated code for the current controls on the Preview stage', () => {
    const { container } = render(<ComponentPage demo={demo} />);
    const previewWrapper = container.firstElementChild!.children[1] as HTMLElement;

    expect(within(previewWrapper).getByText('CODE')).toBeTruthy();
    expect(within(previewWrapper).getByText(/<Button \/>/)).toBeTruthy();

    // A control change is reflected without leaving the tab — the whole point
    // of hosting the snippet next to the playground.
    fireEvent.change(screen.getByLabelText('variant'), { target: { value: 'secondary' } });
    expect(within(previewWrapper).getByText(/variant="secondary"/)).toBeTruthy();

    // The props documentation is no longer on this stage; it has its own tab.
    expect(within(previewWrapper).queryByText('API')).toBeNull();
  });

  it('switching tabs hides (not unmounts) the preview and preserves playground state', () => {
    const { container } = render(<ComponentPage demo={demo} />);
    // ComponentPage's outer div: [0] tab strip, [1] preview pane, [2] props
    // pane, [3] implementation pane, [4] demo pane, [5] a11y pane — each pane
    // toggles `hidden`.
    const root = container.firstElementChild!;
    const previewWrapper = root.children[1] as HTMLElement;
    const docsWrapper = root.children[2] as HTMLElement;

    fireEvent.change(screen.getByLabelText('variant'), { target: { value: 'secondary' } });
    expect(screen.getByText('play-btn').getAttribute('data-variant')).toBe('secondary');
    expect(previewWrapper.className).toBe('');
    expect(docsWrapper.className).toBe('hidden');

    fireEvent.click(screen.getByRole('tab', { name: 'Docs' }));
    expect(previewWrapper.className).toBe('hidden');
    expect(docsWrapper.className).toBe('');
    expect(within(docsWrapper).getByText('API')).toBeTruthy();
    expect(within(docsWrapper).getByText('variant')).toBeTruthy();
    // Preview content is still in the DOM (hidden), not unmounted.
    expect(screen.getByText('play-btn').getAttribute('data-variant')).toBe('secondary');

    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(previewWrapper.className).toBe('');
    expect(docsWrapper.className).toBe('hidden');
    expect(screen.getByText('play-btn').getAttribute('data-variant')).toBe('secondary');
    expect((screen.getByLabelText('variant') as HTMLSelectElement).value).toBe('secondary');
  });

  it('rail renders ControlsPanel for the playground controls', () => {
    render(<ComponentPage demo={demo} />);
    expect(screen.getByLabelText('variant')).toBeTruthy();
    expect(screen.getByLabelText('loading')).toBeTruthy();
  });

  it('Reset restores initial control values', () => {
    render(<ComponentPage demo={demo} />);
    fireEvent.change(screen.getByLabelText('variant'), { target: { value: 'secondary' } });
    expect(screen.getByText('play-btn').getAttribute('data-variant')).toBe('secondary');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('play-btn').getAttribute('data-variant')).toBe('primary');
  });

  it('wires the Preview Group with id="playground-workbench" and a collapsible pixel-sized rail', () => {
    render(<ComponentPage demo={demo} />);
    const group = screen.getByTestId('panel-group');
    expect(group.dataset.id).toBe('playground-workbench');
    expect(group.dataset.orientation).toBe('horizontal');

    const panels = screen.getAllByTestId('panel');
    expect(panels).toHaveLength(2);
    expect(panels[0]?.dataset.id).toBe('stage');
    expect(panels[1]?.dataset.id).toBe('controls');
    // Pixel sizes (numbers), not percentages — a % rail grows with the
    // viewport now that the shell is full-bleed.
    expect(panels[1]?.dataset.defaultSize).toBe('310');
    expect(panels[1]?.dataset.minSize).toBe('240');
    expect(panels[1]?.dataset.maxSize).toBe('520');
    expect(panels[1]?.dataset.collapsible).toBe('true');
    expect(panels[1]?.dataset.collapsedSize).toBe('0');
  });

  it('feeds defaultLayout from localStorage("playground-workbench-v2") into the Group', () => {
    localStorage.setItem('playground-workbench-v2', JSON.stringify({ stage: 60, controls: 40 }));
    render(<ComponentPage demo={demo} />);
    const group = screen.getByTestId('panel-group');
    expect(group.dataset.defaultLayout).toBe(JSON.stringify({ stage: 60, controls: 40 }));
  });

  it('ignores a layout saved under the retired percentage-era key', () => {
    localStorage.setItem('playground-workbench', JSON.stringify({ stage: 60, controls: 40 }));
    render(<ComponentPage demo={demo} />);
    expect(screen.getByTestId('panel-group').dataset.defaultLayout).toBeUndefined();
  });

  it('persists the layout on onLayoutChanged only when isUserInteraction is true', () => {
    render(<ComponentPage demo={demo} />);

    fireEvent.click(screen.getByTestId('simulate-programmatic-layout'));
    expect(localStorage.getItem('playground-workbench-v2')).toBeNull();

    fireEvent.click(screen.getByTestId('simulate-user-resize'));
    expect(localStorage.getItem('playground-workbench-v2')).toBe(
      JSON.stringify({ stage: 65, controls: 35 }),
    );
  });

  describe('collapsible controls rail', () => {
    function railBody() {
      const panel = screen.getAllByTestId('panel')[1]!;
      // The rail's own wrapper — hidden while collapsed so its content can't
      // be tabbed into behind a zero-width panel. Matched on h-full rather
      // than flex: `hidden` and `flex` are both display utilities, so twMerge
      // drops `flex` from the class list when the rail collapses.
      return panel.querySelector('div.h-full') as HTMLElement;
    }

    it('toggles the rail and persists the choice', () => {
      render(<ComponentPage demo={demo} />);
      const toggle = screen.getByRole('button', { name: /hide controls/i });
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(railBody().className).not.toContain('hidden');

      fireEvent.click(toggle);
      const reopened = screen.getByRole('button', { name: /show controls/i });
      expect(reopened.getAttribute('aria-expanded')).toBe('false');
      expect(railBody().className).toContain('hidden');
      expect(localStorage.getItem('playground-workbench-collapsed')).toBe('true');

      fireEvent.click(reopened);
      expect(screen.getByRole('button', { name: /hide controls/i })).toBeTruthy();
      expect(railBody().className).not.toContain('hidden');
      expect(localStorage.getItem('playground-workbench-collapsed')).toBe('false');
    });

    it('restores a persisted collapsed rail on mount', () => {
      localStorage.setItem('playground-workbench-collapsed', 'true');
      render(<ComponentPage demo={demo} />);
      expect(screen.getByRole('button', { name: /show controls/i })).toBeTruthy();
      expect(railBody().className).toContain('hidden');
    });

    it('follows a collapse driven by dragging the separator, not just the button', () => {
      render(<ComponentPage demo={demo} />);
      fireEvent.click(screen.getByTestId('simulate-drag-collapse-controls'));
      expect(screen.getByRole('button', { name: /show controls/i })).toBeTruthy();
      expect(localStorage.getItem('playground-workbench-collapsed')).toBe('true');
    });
  });

  it('renders Split themes toggle in header when on Preview tab', () => {
    render(<ComponentPage demo={demo} />);
    expect(screen.getByLabelText('Split themes')).toBeTruthy();
  });

  it('hides Split themes toggle when not on Preview tab', () => {
    render(<ComponentPage demo={demo} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Docs' }));
    expect(screen.queryByLabelText('Split themes')).toBeNull();
  });

  it('renders Matrix toggle only when ≥2 select controls exist', () => {
    const demoWith2Selects = collectDemos({
      button: {
        meta: { title: 'Button', group: 'Form controls' },
        states: [{ name: 'primary', render: () => <b>state-btn</b> }],
        playground: definePlayground({
          controls: {
            variant: select(['primary', 'secondary']),
            size: select(['sm', 'lg']),
            loading: booleanControl(false),
          },
          render: (v) => (
            <button data-variant={v.variant}>play-btn</button>
          ),
        }),
      },
    })[0];
    if (!demoWith2Selects || isDemoError(demoWith2Selects)) throw new Error('fixture demo failed');

    render(<ComponentPage demo={demoWith2Selects} />);
    expect(screen.getByLabelText('Matrix')).toBeTruthy();
  });

  it('hides Matrix toggle when <2 select controls', () => {
    // demo has only 1 select (variant) and 1 boolean (loading)
    render(<ComponentPage demo={demo} />);
    expect(screen.queryByLabelText('Matrix')).toBeNull();
  });

  it('wraps StateGrid in ThemeSplit when Split themes is on', () => {
    const { container } = render(<ComponentPage demo={demo} />);
    fireEvent.click(screen.getByLabelText('Split themes'));

    const panels = container.querySelectorAll('[data-theme]');
    expect(panels).toHaveLength(2);
    expect(panels[0]?.getAttribute('data-theme')).toBe('light');
    expect(panels[1]?.getAttribute('data-theme')).toBe('dark');
  });

  it('shows StateGrid when Split themes is off', () => {
    render(<ComponentPage demo={demo} />);
    expect(screen.getByText('STATES')).toBeTruthy();
  });

  describe('matrix mode axis wiring', () => {
    // Three select controls (not two) so a "pick a fresh, non-colliding
    // axis" case is distinguishable from the "pick the other axis's
    // current key" swap case. `loading` stays boolean and is deliberately
    // never targeted below — it isn't a legal matrix axis (matrixValues
    // requires both axes to be select controls) and the real selects never
    // offer it as an option.
    function renderMatrixDemo() {
      const demoWith3Selects = collectDemos({
        button: {
          meta: { title: 'Button', group: 'Form controls' },
          states: [{ name: 'primary', render: () => <b>state-btn</b> }],
          playground: definePlayground({
            controls: {
              variant: select(['primary', 'secondary']),
              size: select(['sm', 'lg']),
              tone: select(['soft', 'loud']),
              loading: booleanControl(false),
            },
            render: (v) => <button data-variant={v.variant}>play-btn</button>,
          }),
        },
      })[0];
      if (!demoWith3Selects || isDemoError(demoWith3Selects)) throw new Error('fixture demo failed');

      const utils = render(<ComponentPage demo={demoWith3Selects} />);
      fireEvent.click(screen.getByLabelText('Matrix'));
      return utils;
    }

    it('changing the rows select updates the matrix grid', () => {
      renderMatrixDemo();
      // Default axes: rows=size (2), columns=variant (2) -> 4 grid cells,
      // plus the always-on PlaygroundCard preview button below the grid.
      expect(screen.getAllByRole('button', { name: 'play-btn' })).toHaveLength(5);
      expect(screen.getByText('matrix: size × variant')).toBeTruthy();

      fireEvent.change(screen.getByLabelText('rows'), { target: { value: 'tone' } });
      // rows=tone (2 options) x columns=variant (2) -> still 4 grid cells,
      // but the caption must reflect the newly picked axis name.
      expect(screen.getAllByRole('button', { name: 'play-btn' })).toHaveLength(5);
      expect(screen.getByText('matrix: tone × variant')).toBeTruthy();
    });

    it('picking the other axis current key swaps the axes instead of colliding', () => {
      renderMatrixDemo();
      expect(screen.getByText('matrix: size × variant')).toBeTruthy();

      // columns is currently "variant"; pick "variant" for rows too.
      fireEvent.change(screen.getByLabelText('rows'), { target: { value: 'variant' } });

      // Axes swapped: rows=variant, columns=size — never equal.
      expect(screen.getByText('matrix: variant × size')).toBeTruthy();
      expect((screen.getByLabelText('rows') as HTMLSelectElement).value).toBe('variant');
      expect((screen.getByLabelText('columns') as HTMLSelectElement).value).toBe('size');

      // Both axes remain independently usable after the swap.
      fireEvent.change(screen.getByLabelText('columns'), { target: { value: 'tone' } });
      expect(screen.getByText('matrix: variant × tone')).toBeTruthy();
    });
  });

  it('renders A11yTab when a11y tab is active', () => {
    render(<ComponentPage demo={demo} />);
    fireEvent.click(screen.getByRole('tab', { name: 'A11y' }));
    expect(screen.getByText('no audit yet')).toBeTruthy();
  });

  it('keeps preview mounted while viewing other tabs so audits can access rendered DOM', () => {
    const { container } = render(<ComponentPage demo={demo} />);
    const root = container.firstElementChild!;
    const previewWrapper = root.children[1] as HTMLElement;

    // Preview is visible initially
    expect(previewWrapper.className).toBe('');
    expect(screen.getByText('play-btn')).toBeTruthy();

    // Switch to A11y tab
    fireEvent.click(screen.getByRole('tab', { name: 'A11y' }));
    // Preview wrapper is hidden but still mounted (not unmounted)
    expect(previewWrapper.className).toBe('hidden');
    // Preview content is still in the DOM
    expect(screen.getByText('play-btn')).toBeTruthy();

    // A11y tab content is visible
    expect(screen.getByText('no audit yet')).toBeTruthy();
  });
});

