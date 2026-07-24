import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import {
  boolean as booleanControl,
  collectDemos,
  definePlayground,
  isDemoError,
  select,
} from '@tickets/ui/gallery';
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
  }: {
    children: ReactNode;
    id?: string;
    defaultSize?: string | number;
    minSize?: string | number;
    maxSize?: string | number;
  }) => (
    <div
      data-testid="panel"
      data-id={id}
      data-default-size={defaultSize}
      data-min-size={minSize}
      data-max-size={maxSize}
    >
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
  });

  it('renders the tab strip with Preview active', () => {
    render(<ComponentPage demo={demo} />);
    const preview = screen.getByRole('button', { name: 'Preview' });
    const code = screen.getByRole('button', { name: 'Code' });
    expect(screen.getByRole('button', { name: 'Source' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'A11y' })).toBeTruthy();
    expect(preview.className).toContain('border-accent');
    expect(code.className).not.toContain('border-accent');
  });

  it('switching tabs hides (not unmounts) the preview and preserves playground state', () => {
    const { container } = render(<ComponentPage demo={demo} />);
    // ComponentPage's outer div: [0] tab strip, [1] preview pane, [2] code
    // pane, [3] source pane, [4] a11y pane — each pane toggles `hidden`.
    const root = container.firstElementChild!;
    const previewWrapper = root.children[1] as HTMLElement;
    const codeWrapper = root.children[2] as HTMLElement;

    fireEvent.change(screen.getByLabelText('variant'), { target: { value: 'secondary' } });
    expect(screen.getByText('play-btn').getAttribute('data-variant')).toBe('secondary');
    expect(previewWrapper.className).toBe('');
    expect(codeWrapper.className).toBe('hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    expect(previewWrapper.className).toBe('hidden');
    expect(codeWrapper.className).toBe('');
    // Code tab reflects the live control values (variant changed above), not
    // the old "Coming in this build." placeholder — see code-tab.test.tsx for
    // the full snippet-generation/highlighting behavior.
    expect(within(codeWrapper).getByText(/variant="secondary"/)).toBeTruthy();
    // Preview content is still in the DOM (hidden), not unmounted.
    expect(screen.getByText('play-btn').getAttribute('data-variant')).toBe('secondary');

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(previewWrapper.className).toBe('');
    expect(codeWrapper.className).toBe('hidden');
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

  it('wires the Preview Group with id="playground-workbench" and the documented split', () => {
    render(<ComponentPage demo={demo} />);
    const group = screen.getByTestId('panel-group');
    expect(group.dataset.id).toBe('playground-workbench');
    expect(group.dataset.orientation).toBe('horizontal');

    const panels = screen.getAllByTestId('panel');
    expect(panels).toHaveLength(2);
    expect(panels[0]?.dataset.id).toBe('stage');
    expect(panels[0]?.dataset.defaultSize).toBe('70');
    expect(panels[1]?.dataset.id).toBe('controls');
    expect(panels[1]?.dataset.defaultSize).toBe('30');
    expect(panels[1]?.dataset.minSize).toBe('20');
    expect(panels[1]?.dataset.maxSize).toBe('34');
  });

  it('feeds defaultLayout from localStorage("playground-workbench") into the Group', () => {
    localStorage.setItem('playground-workbench', JSON.stringify({ stage: 60, controls: 40 }));
    render(<ComponentPage demo={demo} />);
    const group = screen.getByTestId('panel-group');
    expect(group.dataset.defaultLayout).toBe(JSON.stringify({ stage: 60, controls: 40 }));
  });

  it('persists the layout on onLayoutChanged only when isUserInteraction is true', () => {
    render(<ComponentPage demo={demo} />);

    fireEvent.click(screen.getByTestId('simulate-programmatic-layout'));
    expect(localStorage.getItem('playground-workbench')).toBeNull();

    fireEvent.click(screen.getByTestId('simulate-user-resize'));
    expect(localStorage.getItem('playground-workbench')).toBe(
      JSON.stringify({ stage: 65, controls: 35 }),
    );
  });
});
