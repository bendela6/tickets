import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ControlHandlePoint, Point } from '../doc/geometry';
import { PointsSelectionOverlay } from './selection-overlay';

const BOX = { x: 0, y: 0, w: 200, h: 100 };

const TRIANGLE: Point[] = [
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 100, y: 100 },
];

/** The two handles a middle node of two cubics would have. */
const CONTROLS: ControlHandlePoint[] = [
  { point: { x: 160, y: 20 }, segment: 1, which: 2, at: { x: 160, y: 20 } },
  { point: { x: 40, y: 20 }, segment: 2, which: 1, at: { x: 40, y: 20 } },
];

/**
 * The overlay inside a surface that would add a node where it is double-clicked
 * — which is what the artboard underneath it actually does.
 */
const draw = (
  over: Partial<Parameters<typeof PointsSelectionOverlay>[0]> = {},
): { onHandleDown: ReturnType<typeof vi.fn>; onSurfaceDoubleClick: ReturnType<typeof vi.fn> } => {
  const onHandleDown = vi.fn();
  const onSurfaceDoubleClick = vi.fn();
  render(
    <div onDoubleClick={onSurfaceDoubleClick}>
      <PointsSelectionOverlay
        points={TRIANGLE}
        box={BOX}
        rotation={0}
        scale={1}
        selectedNode={null}
        controls={[]}
        onHandleDown={onHandleDown}
        {...over}
      />
    </div>,
  );
  return { onHandleDown, onSurfaceDoubleClick };
};

const named = () =>
  screen
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'))
    .filter((label): label is string => label !== null);

describe('the handles of a shape made of points', () => {
  it('offers one per point, named by its place in the list', () => {
    draw();
    expect(named()).toEqual(['Move point 1', 'Move point 2', 'Move point 3', 'Rotate']);
  });

  it('names a two-point run’s ends rather than numbering them', () => {
    draw({ points: TRIANGLE.slice(0, 2) });
    expect(named()).toEqual(['Move start point', 'Move end point', 'Rotate']);
  });

  it('reports which node is selected, and that the others are not', () => {
    draw({ selectedNode: 1 });
    expect(screen.getByRole('button', { name: 'Move point 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Move point 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reports the point it was pressed on', () => {
    const { onHandleDown } = draw();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Move point 3' }));
    expect(onHandleDown.mock.calls[0]?.[0]).toBe('v2');
  });
});

describe('the handles that steer a curve', () => {
  it('shows the selected node’s controls, and says which side of it each is on', () => {
    draw({ selectedNode: 1, controls: CONTROLS });
    expect(named()).toContain('Move incoming control of point 2');
    expect(named()).toContain('Move outgoing control of point 2');
  });

  it('shows none at all while no node is selected', () => {
    // A forty-node path with every handle drawn is a thicket you cannot aim at,
    // so the controls follow the selection rather than the shape.
    draw({ selectedNode: null, controls: CONTROLS });
    expect(named().filter((name) => name.includes('control'))).toEqual([]);
  });

  it('reports the command and the control number it was pressed on', () => {
    const { onHandleDown } = draw({ selectedNode: 1, controls: CONTROLS });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Move incoming control of point 2' }));
    expect(onHandleDown.mock.calls[0]?.[0]).toBe('c1-2');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Move outgoing control of point 2' }));
    expect(onHandleDown.mock.calls[1]?.[0]).toBe('c2-1');
  });

  it('keeps a double-click on a handle from asking the surface for another node', () => {
    // Handles sit exactly on the outline, which is where a double-click adds a
    // node — so without this, double-clicking a node plants one on top of it.
    const { onSurfaceDoubleClick } = draw({ selectedNode: 1, controls: CONTROLS });
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Move point 2' }));
    fireEvent.doubleClick(
      screen.getByRole('button', { name: 'Move incoming control of point 2' }),
    );
    expect(onSurfaceDoubleClick).not.toHaveBeenCalled();
  });

  it('lets a double-click anywhere else through to the surface', () => {
    const { onSurfaceDoubleClick } = draw({ selectedNode: 1, controls: CONTROLS });
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Rotate' }));
    expect(onSurfaceDoubleClick).toHaveBeenCalled();
  });
});
