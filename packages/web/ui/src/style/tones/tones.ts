// The tone vocabulary, and nothing that resolves it.
//
// A component names the rung it wants where it builds the class
// (`bg-${tone}-3`), so there is no longer a `toneClasses()` resolver, a `STEP`
// rung table, or a `TONES` table of finished strings between the two. The
// rungs are the documented ladder — 1-2 page backgrounds, 3-5 component fills,
// 6-8 borders, 9-10 solid fills, 11-12 text — which holds on every scale and
// is drawn on the Colors page.
export {
  HUE_TONES,
  ROLE_TONES,
  TONE_NAMES,
  TONE_RAMP,
  type HueTone,
  type RoleTone,
  type Tone,
} from '../../generated/tones';
