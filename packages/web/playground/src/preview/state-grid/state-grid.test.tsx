import { render, screen } from '@testing-library/react';
import { CELL_MIN, StateGrid } from './state-grid';
import { collectDemos, isDemoError, type DemoSize } from '@tickets/ui';

function buildDemo(size?: DemoSize) {
  const collected = collectDemos({
    './x.demo.tsx': {
      meta: { title: 'Button', group: 'Form controls', ...(size ? { size } : {}) },
      states: [
        { name: 'primary', render: () => <button>New ticket</button> },
        { name: 'loading', render: () => <button>Creating…</button> },
      ],
    },
  })[0]!;
  if (isDemoError(collected)) throw new Error(collected.error);
  return collected;
}

const demo = buildDemo();

function grid(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[style*="--demo-cell"]');
  if (!el) throw new Error('expected a grid carrying --demo-cell');
  return el as HTMLElement;
}

describe('StateGrid', () => {
  it('renders the title, STATES label, one labeled card per state, and stable ids', () => {
    render(<StateGrid demo={demo} />);
    expect(screen.getByRole('heading', { name: 'Button' })).toBeTruthy();
    expect(screen.getByText('STATES')).toBeTruthy();
    expect(screen.getByText('primary')).toBeTruthy();
    expect(screen.getByText('loading')).toBeTruthy();
    expect(document.getElementById('button--primary')).toBeTruthy();
    expect(document.getElementById('button--loading')).toBeTruthy();
    expect(screen.getByText('New ticket')).toBeTruthy();
  });

  it('sizes the cell grid from meta.size, defaulting to md', () => {
    expect(grid(render(<StateGrid demo={demo} />).container).style.getPropertyValue('--demo-cell')).toBe(
      CELL_MIN.md,
    );
  });

  it.each(['sm', 'lg', 'full'] as const)('honours meta.size="%s"', (size) => {
    const { container } = render(<StateGrid demo={buildDemo(size)} />);
    expect(grid(container).style.getPropertyValue('--demo-cell')).toBe(CELL_MIN[size]);
  });

  it('gives every size a distinct width so the scale actually varies', () => {
    expect(new Set(Object.values(CELL_MIN)).size).toBe(Object.keys(CELL_MIN).length);
  });
});
