import { adjust, NEUTRAL, type Adjust } from './color';
import {
  DEFAULT_CONFIG, DEFAULT_MOTION, PRESETS, RATIO,
  type MarkConfig, type MotionConfig, type PresetName,
} from './config';

type Triple = [string, string, string];
type Mode = 'light' | 'dark';
type NumberKey = 'bareWeight' | 'chipReach' | 'chipWeight';

/**
 * `base` is what presets and pickers set; the two `adj` layers sit on top. The
 * derived colours are recomputed from base every time, so dragging a slider can
 * never compound.
 */
export interface StudioState {
  base: { light: Triple; dark: Triple };
  chip: string;
  adjLight: Adjust;
  adjDark: Adjust;
  angles: [number, number, number];
  bareWeight: number;
  chipReach: number;
  chipWeight: number;
  motion: MotionConfig;
}

export function fromConfig(config: MarkConfig): StudioState {
  return {
    base: { light: [...config.light] as Triple, dark: [...config.dark] as Triple },
    chip: config.chip,
    adjLight: { ...NEUTRAL },
    adjDark: { ...NEUTRAL },
    angles: [...config.angles] as [number, number, number],
    bareWeight: config.bareWeight,
    chipReach: config.chipReach,
    chipWeight: config.chipWeight,
    // A committed config written before the motion block existed still opens:
    // the defaults fill in, they are visible in the panel rather than silently
    // applied, and the next Generate writes them into the file. Spreading over
    // the defaults also means a config carrying only some of the four keys
    // keeps whatever it does carry.
    motion: { ...DEFAULT_MOTION, ...(config.motion ?? {}) },
  };
}

export const INITIAL_STATE: StudioState = fromConfig(DEFAULT_CONFIG);

export function toConfig(state: StudioState): MarkConfig {
  const apply = (triple: Triple, a: Adjust) => triple.map((hex) => adjust(hex, a)) as Triple;
  return {
    light: apply(state.base.light, state.adjLight),
    dark: apply(state.base.dark, state.adjDark),
    chip: state.chip,
    angles: [...state.angles] as [number, number, number],
    bareWeight: state.bareWeight,
    chipReach: state.chipReach,
    chipWeight: state.chipWeight,
    motion: { ...state.motion },
  };
}

export type StudioAction =
  | { type: 'setBase'; mode: Mode; index: number; hex: string }
  | { type: 'setChip'; hex: string }
  | { type: 'setAdjust'; mode: Mode; patch: Partial<Adjust> }
  | { type: 'resetAdjust' }
  | { type: 'applyPreset'; name: PresetName }
  | { type: 'setAngle'; index: number; degrees: number }
  | { type: 'setNumber'; key: NumberKey; value: number }
  | { type: 'matchRatio' }
  | { type: 'setMotion'; patch: Partial<MotionConfig> }
  | { type: 'resetMotion' }
  | { type: 'loadConfig'; config: MarkConfig };

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'setBase': {
      const triple = [...state.base[action.mode]] as Triple;
      triple[action.index] = action.hex;
      return { ...state, base: { ...state.base, [action.mode]: triple } };
    }
    case 'setChip':
      return { ...state, chip: action.hex };
    case 'setAdjust': {
      const key = action.mode === 'light' ? 'adjLight' : 'adjDark';
      return { ...state, [key]: { ...state[key], ...action.patch } };
    }
    case 'resetAdjust':
      return { ...state, adjLight: { ...NEUTRAL }, adjDark: { ...NEUTRAL } };
    case 'applyPreset': {
      const preset = PRESETS[action.name];
      return {
        ...state,
        base: { light: [...preset.light] as Triple, dark: [...preset.dark] as Triple },
        chip: preset.chip,
        adjLight: { ...NEUTRAL },
        adjDark: { ...NEUTRAL },
      };
    }
    case 'setAngle': {
      const angles = [...state.angles] as [number, number, number];
      angles[action.index] = action.degrees;
      return { ...state, angles };
    }
    case 'setNumber':
      return { ...state, [action.key]: action.value };
    case 'matchRatio':
      // Round to one decimal so the written config stays readable.
      return { ...state, chipWeight: Math.round(state.chipReach * RATIO * 10) / 10 };
    case 'setMotion':
      return { ...state, motion: { ...state.motion, ...action.patch } };
    case 'resetMotion':
      return { ...state, motion: { ...DEFAULT_MOTION } };
    case 'loadConfig':
      return fromConfig(action.config);
  }
}
