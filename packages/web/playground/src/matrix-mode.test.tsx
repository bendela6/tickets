import { render, screen } from '@testing-library/react';
import { boolean as booleanControl, definePlayground, select } from '@tickets/ui/gallery';
import { MatrixMode, matrixValues } from './matrix-mode';

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
      />,
    );

    const cells = screen.getAllByRole('button');
    // 2 rows (primary, secondary) × 2 columns (sm, md) = 4 cells
    expect(cells).toHaveLength(4);
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
      />,
    );

    // Row and column labels come from select options
    // Check that all expected texts appear in the document
    expect(screen.getAllByText('primary')).toBeTruthy();
    expect(screen.getAllByText('secondary')).toBeTruthy();
    expect(screen.getAllByText('sm')).toBeTruthy();
    expect(screen.getAllByText('lg')).toBeTruthy();
  });

  it('renders correct matrix dimensions caption', () => {
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
      />,
    );

    expect(screen.getByText('matrix: 3 × 2')).toBeTruthy();
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
      />,
    );

    const grid = container.querySelector('.grid[style*="grid-template-columns"]');
    expect(grid?.getAttribute('style')).toContain('grid-template-columns: 104px repeat(3, 1fr)');
  });
});
