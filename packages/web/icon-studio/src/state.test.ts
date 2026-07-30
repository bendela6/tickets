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

test('setChip sets the chip colour and leaves everything else untouched', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'setChip', hex: '#abcdef' });
  const config = toConfig(next);
  expect(config.chip).toBe('#abcdef');
  expect(config.light).toEqual(DEFAULT_CONFIG.light);
  expect(config.dark).toEqual(DEFAULT_CONFIG.dark);
  expect(config.angles).toEqual(DEFAULT_CONFIG.angles);
  expect(config.bareWeight).toBe(DEFAULT_CONFIG.bareWeight);
  expect(config.chipReach).toBe(DEFAULT_CONFIG.chipReach);
  expect(config.chipWeight).toBe(DEFAULT_CONFIG.chipWeight);
});

test('loadConfig replaces the whole state and clears adjustments', () => {
  const dirty = studioReducer(INITIAL_STATE, { type: 'setAdjust', mode: 'light', patch: { lit: 0.3 } });
  expect(toConfig(dirty).light).not.toEqual(DEFAULT_CONFIG.light);

  const customConfig: typeof DEFAULT_CONFIG = {
    light: ['#111111', '#222222', '#333333'],
    dark: ['#444444', '#555555', '#666666'],
    chip: '#999999',
    angles: [30, 60, 90],
    bareWeight: 1.5,
    chipReach: 12,
    chipWeight: 4,
    motion: { speed: 200, restSpread: 12, ramp: 0.5, restPose: 'fan' },
  };

  const next = studioReducer(dirty, { type: 'loadConfig', config: customConfig });
  const result = toConfig(next);

  expect(result).toEqual(customConfig);
  expect(result.light).not.toBe(customConfig.light);
  expect(result.dark).not.toBe(customConfig.dark);
  expect(result.angles).not.toBe(customConfig.angles);
});

test('setMotion patches one field and leaves the rest of the block alone', () => {
  const next = studioReducer(INITIAL_STATE, { type: 'setMotion', patch: { speed: 260 } });
  const { motion } = toConfig(next);

  expect(motion.speed).toBe(260);
  expect(motion.restSpread).toBe(DEFAULT_CONFIG.motion.restSpread);
  expect(motion.ramp).toBe(DEFAULT_CONFIG.motion.ramp);
  expect(motion.restPose).toBe(DEFAULT_CONFIG.motion.restPose);
});

test('resetMotion restores the locked motion block without touching the palette', () => {
  const tuned = studioReducer(
    studioReducer(INITIAL_STATE, { type: 'setMotion', patch: { speed: 40, restPose: 'fan' } }),
    { type: 'setChip', hex: '#abcdef' },
  );
  const next = studioReducer(tuned, { type: 'resetMotion' });
  const config = toConfig(next);

  expect(config.motion).toEqual(DEFAULT_CONFIG.motion);
  expect(config.chip).toBe('#abcdef');
});

test('a config written before the motion block existed still opens, on the defaults', () => {
  // The committed icons.config.json predates motion; dropping it must not throw
  // or produce an undefined block that the preview would then read.
  const { motion: _omitted, ...legacy } = DEFAULT_CONFIG;
  const state = fromConfig(legacy as typeof DEFAULT_CONFIG);

  expect(toConfig(state).motion).toEqual(DEFAULT_CONFIG.motion);
});

test('a config carrying only some motion keys keeps them and fills the rest', () => {
  const partial = {
    ...DEFAULT_CONFIG,
    motion: { speed: 42 } as typeof DEFAULT_CONFIG.motion,
  };

  expect(toConfig(fromConfig(partial)).motion).toEqual({
    ...DEFAULT_CONFIG.motion,
    speed: 42,
  });
});
