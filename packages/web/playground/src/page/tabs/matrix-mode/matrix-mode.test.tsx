import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { boolean as booleanControl, definePlayground, select } from '@tickets/ui';
import { MatrixMode, matrixValues } from './matrix-mode';

// Each axis is a Combobox, not a native <select>, so changing one is two
// gestures: open the trigger, click the option. The list is portalled, hence
// the option query going through `screen`.
function pickAxis(axis: 'rows' | 'columns', key: string) {
  fireEvent.click(screen.getByLabelText(axis));
  fireEvent.click(screen.getByRole('option', { name: key }));
}

// Cells are buttons — but so are the two axis triggers, so a page-wide button
// count measures the chrome as much as the grid. Scope it to the grid, which
// is the thing these assertions are actually about.
function cells(): HTMLElement[] {
  const grid = document.querySelector('.grid[style*="grid-template-columns"]');
  if (!grid) throw new Error('the matrix grid did not render');
  return within(grid as HTMLElement).getAllByRole('button');
}

describe('matrixValues', () => {
  it('throws when xKey is not a select control', () => {
    const controls = {
      variant: select(['primary', 'secondary']),
      size: booleanControl(false),
    };
    const values = { variant: 'primary', size: false };

    expect(() => matrixValues(controls, values, 'size', 'variant')).toThrow(
      'matrix axes must be select controls',
    );
  });

  it('throws when yKey is not a select control', () => {
    const controls = {
      variant: select(['primary', 'secondary']),
      disabled: booleanControl(false),
    };
    const values = { variant: 'primary', disabled: false };

    expect(() => matrixValues(controls, values, 'variant', 'disabled')).toThrow(
      'matrix axes must be select controls',
    );
  });

  it('returns correct x and y arrays', () => {
    const controls = {
      variant: select(['primary', 'secondary', 'ghost']),
      size: select(['sm', 'md', 'lg']),
    };
    const values = { variant: 'primary', size: 'md' };

    const result = matrixValues(controls, values, 'size', 'variant');
    expect(result.x).toEqual(['sm', 'md', 'lg']);
    expect(result.y).toEqual(['primary', 'secondary', 'ghost']);
  });

  it('cell function computes correct cross-product values', () => {
    const controls = {
      variant: select(['primary', 'secondary']),
      size: select(['sm', 'lg']),
    };
    const values = { variant: 'primary', size: 'sm', otherProp: 'kept' };

    const result = matrixValues(controls, values, 'size', 'variant');
    expect(result.cell(0, 0)).toEqual({
      variant: 'primary',
      size: 'sm',
      otherProp: 'kept',
    });
    expect(result.cell(1, 0)).toEqual({
      variant: 'primary',
      size: 'lg',
      otherProp: 'kept',
    });
    expect(result.cell(0, 1)).toEqual({
      variant: 'secondary',
      size: 'sm',
      otherProp: 'kept',
    });
  });
});

describe('MatrixMode', () => {
  it('renders correct number of cells (x × y grid)', () => {
    const playground = definePlayground({
      controls: {
        variant: select(['primary', 'secondary']),
        size: select(['sm', 'md']),
      },
      render: (v) => <button>{v.variant}</button>,
    });
    const values = { variant: 'primary', size: 'sm' };

    render(
      <MatrixMode
        playground={playground}
        values={values}
        xKey="size"
        yKey="variant"
        onXKeyChange={vi.fn()}
        onYKeyChange={vi.fn()}
      />,
    );

    const grid = cells();
    // 2 rows (primary, secondary) × 2 columns (sm, md) = 4 cells
    expect(grid).toHaveLength(4);
  });

  it('renders axis labels', () => {
    const playground = definePlayground({
      controls: {
        variant: select(['primary', 'secondary']),
        size: select(['sm', 'lg']),
      },
      render: (v) => <div>{v.variant}</div>,
    });
    const values = { variant: 'primary', size: 'sm' };

    render(
      <MatrixMode
        playground={playground}
        values={values}
        xKey="size"
        yKey="variant"
        onXKeyChange={vi.fn()}
        onYKeyChange={vi.fn()}
      />,
    );

    // Row and column labels come from select options
    // Check that all expected texts appear in the document
    expect(screen.getAllByText('primary')).toBeTruthy();
    expect(screen.getAllByText('secondary')).toBeTruthy();
    expect(screen.getAllByText('sm')).toBeTruthy();
    expect(screen.getAllByText('lg')).toBeTruthy();
  });

  it('renders the axis control names (rows × columns) as the caption, not counts', () => {
    const playground = definePlayground({
      controls: {
        variant: select(['a', 'b', 'c']),
        size: select(['x', 'y']),
      },
      render: () => <div />,
    });
    const values = { variant: 'a', size: 'x' };

    render(
      <MatrixMode
        playground={playground}
        values={values}
        xKey="size"
        yKey="variant"
        onXKeyChange={vi.fn()}
        onYKeyChange={vi.fn()}
      />,
    );

    expect(screen.getByText('matrix: variant × size')).toBeTruthy();
    expect(screen.queryByText('matrix: 3 × 2')).toBeNull();
  });

  it('renders with correct grid layout style', () => {
    const playground = definePlayground({
      controls: {
        variant: select(['a', 'b']),
        size: select(['x', 'y', 'z']),
      },
      render: () => <div />,
    });
    const values = { variant: 'a', size: 'x' };

    const { container } = render(
      <MatrixMode
        playground={playground}
        values={values}
        xKey="size"
        yKey="variant"
        onXKeyChange={vi.fn()}
        onYKeyChange={vi.fn()}
      />,
    );

    const grid = container.querySelector('.grid[style*="grid-template-columns"]');
    expect(grid?.getAttribute('style')).toContain('grid-template-columns: 104px repeat(3, 1fr)');
  });

  it('changing the rows select calls onYKeyChange with the newly picked key', () => {
    const playground = definePlayground({
      controls: {
        variant: select(['primary', 'secondary']),
        size: select(['sm', 'lg']),
      },
      render: () => <div />,
    });
    const values = { variant: 'primary', size: 'sm' };
    const onYKeyChange = vi.fn();

    render(
      <MatrixMode
        playground={playground}
        values={values}
        xKey="size"
        yKey="variant"
        onXKeyChange={vi.fn()}
        onYKeyChange={onYKeyChange}
      />,
    );

    pickAxis('rows', 'size');
    expect(onYKeyChange).toHaveBeenCalledWith('size');
  });

  it('changing the columns select calls onXKeyChange with the newly picked key', () => {
    const playground = definePlayground({
      controls: {
        variant: select(['primary', 'secondary']),
        size: select(['sm', 'lg']),
      },
      render: () => <div />,
    });
    const values = { variant: 'primary', size: 'sm' };
    const onXKeyChange = vi.fn();

    render(
      <MatrixMode
        playground={playground}
        values={values}
        xKey="size"
        yKey="variant"
        onXKeyChange={onXKeyChange}
        onYKeyChange={vi.fn()}
      />,
    );

    pickAxis('columns', 'variant');
    expect(onXKeyChange).toHaveBeenCalledWith('variant');
  });

  it('changing rows updates the grid once the parent applies the new key', () => {
    // Stand in for component-page.tsx's state wiring: feed the changed key
    // straight back in as the new yKey prop.
    const playground = definePlayground({
      controls: {
        variant: select(['primary', 'secondary', 'ghost']),
        status: select(['open', 'closed']),
      },
      render: (v) => <button>{v.variant}</button>,
    });

    function Wrapper() {
      const [yKey, setYKey] = useState('variant');
      return (
        <MatrixMode
          playground={playground}
          values={{ variant: 'primary', status: 'open' }}
          xKey="status"
          yKey={yKey}
          onXKeyChange={vi.fn()}
          onYKeyChange={setYKey}
        />
      );
    }

    render(<Wrapper />);
    // Starting axis: rows=variant (3 options) × columns=status (2 options) = 6 cells.
    expect(cells()).toHaveLength(6);
    expect(screen.getByText('matrix: variant × status')).toBeTruthy();

    // Re-pick rows as status too, to isolate the "grid re-renders off the
    // new yKey prop" behavior from the swap rule (covered separately in
    // component-page.test.tsx): status has 2 options, so rows×columns
    // becomes 2×2 = 4 cells.
    pickAxis('rows', 'status');
    expect(cells()).toHaveLength(4);
    expect(screen.getByText('matrix: status × status')).toBeTruthy();
  });
});
