import { render, screen } from '@testing-library/react';
import { DEFAULT_DOC, type IconDoc } from '../doc';
import { ControlsPanel, GAP_WARNING_DEGREES, tightestGap } from './controls-panel';

function renderPanel(doc: IconDoc) {
  render(<ControlsPanel doc={doc} dispatch={() => {}} />);
}

function docWithAngles(angles: [number, number, number]): IconDoc {
  return {
    ...DEFAULT_DOC,
    elements: DEFAULT_DOC.elements.map((e, i) =>
      (e.type === 'stick' ? { ...e, angle: angles[i] ?? e.angle } : e),
    ),
  };
}

test('tightestGap finds the smallest of the pairwise separations on the 180° circle', () => {
  // 10/15/100: |10-15|=5 is the tightest; the other two pairs (85, 90) are wide.
  expect(tightestGap([10, 15, 100])).toBe(5);
  // The locked logo pose (62/27/160) is well separated: gaps are 35, 47, 82.
  expect(tightestGap([62, 27, 160])).toBe(35);
});

test('a pose with a tight gap shows the occlusion warning', () => {
  renderPanel(docWithAngles([10, 15, 100]));
  expect(tightestGap([10, 15, 100])).toBeLessThan(GAP_WARNING_DEGREES);
  expect(screen.getByText(/sticks may hide each other/i)).toBeDefined();
});

test('a well-separated pose does not show the occlusion warning', () => {
  renderPanel(DEFAULT_DOC);
  expect(tightestGap([62, 27, 160])).toBeGreaterThanOrEqual(GAP_WARNING_DEGREES);
  expect(screen.queryByText(/sticks may hide each other/i)).toBeNull();
});

test('the chip scale slider reflects the chip variant', () => {
  renderPanel(DEFAULT_DOC);
  const slider = screen.getByLabelText(/chip scale/i) as HTMLInputElement;
  expect(Number(slider.value)).toBeCloseTo(DEFAULT_DOC.variants.chip?.scale ?? NaN, 5);
});
