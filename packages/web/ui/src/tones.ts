export {
  HUE_TONES,
  TONE_NAMES,
  TONES,
  type HueTone,
  type Tone,
  type ToneEmphasis,
} from './tones.generated';
import { TONES, type Tone, type ToneEmphasis } from './tones.generated';

// The one resolver every component uses. Never build tone classes by hand.
export function toneClasses(tone: Tone, emphasis: ToneEmphasis = 'subtle'): string {
  return TONES[tone][emphasis];
}
