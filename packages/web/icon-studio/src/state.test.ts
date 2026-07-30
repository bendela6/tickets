import { DEFAULT_CONFIG, PRESETS } from './config';
import { fromConfig, INITIAL_STATE, studioReducer, toConfig } from './state';

test('the initial state produces the locked config', () => {
  expect(toConfig(INITIAL_STATE)).toEqual(DEFAULT_CONFIG);
});

test('config round-trips through state', () => {
  expect(toConfig(fromConfig(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG);
});

test('setting a base colour changes only that stick', () => {
  const next = studioReducer(INITIAL_STATE, {
    type: 'setBase', mode: 'light', index: 1, hex: '#123456',
  });
  expect(toConfig(next).light).toEqual([DEFAULT_CONFIG.light[0], '#123456', DEFAULT_CONFIG.light[2]]);
  expect(toConfig(next).dark).toEqual(DEFAULT_CONFIG.dark);
});

test('adjustments are non-destructive — resetting restores the base exactly', () => {
  const adjusted = studioReducer(INITIAL_STATE, {
    type: 'setAdjust', mode: 'light', patch: { sat: 1.6, lit: 0.1 },
  });
  expect(toConfig(adjusted).light).not.toEqual(DEFAULT_CONFIG.light);
  const reset = studioReducer(adjusted, { type: 'resetAdjust' });
  expect(toConfig(reset).light).toEqual(DEFAULT_CONFIG.light);
});

test('adjustments never compound across repeated dispatches', () => {
  const once = studioReducer(INITIAL_STATE, { type: 'setAdjust', mode: 'light', patch: { sat: 1.4 } });
  const twice = studioReducer(once, { type: 'setAdjust', mode: 'light', patch: { sat: 1.4 } });
  expect(toConfig(twice).light).toEqual(toConfig(once).light);
});

test('light and dark adjust independently', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'setAdjust', mode: 'dark', patch: { lit: -0.1 } });
  expect(toConfig(next).light).toEqual(DEFAULT_CONFIG.light);
  expect(toConfig(next).dark).not.toEqual(DEFAULT_CONFIG.dark);
});

test('applying a preset replaces the base and clears adjustments', () => {
  const dirty = studioReducer(INITIAL_STATE, { type: 'setAdjust', mode: 'light', patch: { sat: 1.7 } });
  const next = studioReducer(dirty, { type: 'applyPreset', name: 'neon' });
  expect(toConfig(next).light).toEqual(PRESETS.neon.light);
  expect(toConfig(next).chip).toBe(PRESETS.neon.chip);
});

test('setting an angle changes only that stick', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'setAngle', index: 2, degrees: 90 });
  expect(toConfig(next).angles).toEqual([62, 27, 90]);
});

test('matchRatio derives the chip stroke from its reach', () => {
  const wide = studioReducer(INITIAL_STATE, { type: 'setNumber', key: 'chipReach', value: 18 });
  const matched = studioReducer(wide, { type: 'matchRatio' });
  expect(toConfig(matched).chipWeight).toBeCloseTo(6, 1);
});
