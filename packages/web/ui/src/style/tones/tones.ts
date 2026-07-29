export {
  HUE_TONES,
  ROLE_TONES,
  STEP,
  TONE_NAMES,
  TONE_SCALE,
  TONES,
  type HueTone,
  type RoleTone,
  type Tone,
  type ToneEmphasis,
} from './tones.generated';
import { TONES, type Tone, type ToneEmphasis } from './tones.generated';

// The one resolver every component uses. Never build tone classes by hand.
export function toneClasses(tone: Tone, emphasis: ToneEmphasis = 'subtle'): string {
  return TONES[tone][emphasis];
}
