import { render, screen } from '@testing-library/react';
import { DEFAULT_CONFIG, type MarkConfig } from '../config';
import { fromConfig, toConfig } from '../state';
import { ControlsPanel, tightestGap, GAP_WARNING_DEGREES } from './controls-panel';

function renderPanel(config: MarkConfig) {
  const state = fromConfig(config);
  render(<ControlsPanel state={state} config={toConfig(state)} dispatch={() => {}} />);
}

test('tightestGap finds the smallest of the three pairwise separations on the 180° circle', () => {
  // 10/15/100: |10-15|=5 is the tightest; the other two pairs (85, 90) are wide.
  expect(tightestGap([10, 15, 100])).toBe(5);
  // The locked logo pose (62/27/160) is well separated: gaps are 35, 47, 82.
  expect(tightestGap(DEFAULT_CONFIG.angles)).toBe(35);
});

test('a pose with a tight gap shows the occlusion warning', () => {
  renderPanel({ ...DEFAULT_CONFIG, angles: [10, 15, 100] });
  expect(tightestGap([10, 15, 100])).toBeLessThan(GAP_WARNING_DEGREES);
  expect(screen.getByText(/sticks may hide each other/i)).toBeDefined();
});

test('a well-separated pose does not show the occlusion warning', () => {
  renderPanel(DEFAULT_CONFIG);
  expect(tightestGap(DEFAULT_CONFIG.angles)).toBeGreaterThanOrEqual(GAP_WARNING_DEGREES);
  expect(screen.queryByText(/sticks may hide each other/i)).toBeNull();
});

test('the ratio readout reflects a changed chipReach', () => {
  // chipWeight stays locked at 4.6; chipReach 9 makes the ratio 4.6/9 = 0.51,
  // clearly different from the default pose's 4.6/14 = 0.33.
  renderPanel({ ...DEFAULT_CONFIG, chipReach: 9 });
  expect(screen.getByText(/chip ratio 0\.51/)).toBeDefined();
});
