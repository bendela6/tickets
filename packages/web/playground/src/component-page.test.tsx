import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { boolean as booleanControl, collectDemos, definePlayground, isDemoError, select } from '@tickets/ui/gallery';
import { ComponentPage } from './component-page';

// react-resizable-panels needs real layout (ResizeObserver-driven sizing) to
// do anything useful, which jsdom can't provide meaningfully. Mock it with a
// pass-through so ComponentPage's own wiring (autoSaveId, defaultSize, which
// children go in which Panel) is directly assertable, while still rendering
// real children for the tab-switching / controls-flow assertions below.
vi.mock('react-resizable-panels', () => ({
  PanelGroup: ({
    children,
    autoSaveId,
    direction,
  }: {
    children: ReactNode;
    autoSaveId?: string;
    direction?: string;
  }) => (
    <div data-testid="panel-group" data-auto-save-id={autoSaveId} data-direction={direction}>
      {children}
    </div>
  ),
  Panel: ({
    children,
    defaultSize,
    minSize,
    maxSize,
  }: {
    children: ReactNode;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
  }) => (
    <div data-testid="panel" data-default-size={defaultSize} data-min-size={minSize} data-max-size={maxSize}>
      {children}
    </div>
  ),
  PanelResizeHandle: ({ className }: { className?: string }) => (
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
    expect(within(codeWrapper).getByText('Coming in this build.')).toBeTruthy();
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

  it('wires the Preview PanelGroup with autoSaveId="playground-workbench" and the documented split', () => {
    render(<ComponentPage demo={demo} />);
    const group = screen.getByTestId('panel-group');
    expect(group.dataset.autoSaveId).toBe('playground-workbench');
    expect(group.dataset.direction).toBe('horizontal');

    const panels = screen.getAllByTestId('panel');
    expect(panels).toHaveLength(2);
    expect(panels[0]?.dataset.defaultSize).toBe('70');
    expect(panels[1]?.dataset.defaultSize).toBe('30');
    expect(panels[1]?.dataset.minSize).toBe('20');
    expect(panels[1]?.dataset.maxSize).toBe('34');
  });
});
