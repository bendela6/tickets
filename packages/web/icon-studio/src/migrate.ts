import {
  BARE_REACH, DEFAULT_DOC, type Element, type IconDoc, type Ink, type MotionConfig,
} from './doc';

/**
 * Reads whatever is in `icons.config.json` and returns a document.
 *
 * Forgiving on read, strict on write — the same posture the motion block uses.
 * A file predating elements still opens, and the studio writes the new shape on
 * the next Generate. Anything it cannot make sense of falls back to the default
 * document whole, rather than producing a half-built one that would render as an
 * empty icon and then be written back over the real file.
 */

const STICK_IDS = ['top', 'mid', 'low'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function triple(value: unknown): [unknown, unknown, unknown] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [a, b, c] = value;
  return [a, b, c];
}

function hexTriple(value: unknown): [string, string, string] | null {
  const parts = triple(value);
  if (!parts) return null;
  if (!parts.every((p) => typeof p === 'string')) return null;
  const [a, b, c] = parts as [string, string, string];
  return [a, b, c];
}

function numberTriple(value: unknown): [number, number, number] | null {
  const parts = triple(value);
  if (!parts) return null;
  if (!parts.every((p) => typeof p === 'number' && Number.isFinite(p))) return null;
  const [a, b, c] = parts as [number, number, number];
  return [a, b, c];
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function motionOf(value: unknown): MotionConfig {
  if (!isRecord(value)) return { ...DEFAULT_DOC.motion };
  const { speed, restSpread, ramp, restPose } = value;
  return {
    speed: positive(speed) ?? DEFAULT_DOC.motion.speed,
    restSpread:
      typeof restSpread === 'number' && Number.isFinite(restSpread) && restSpread >= 0
        ? restSpread
        : DEFAULT_DOC.motion.restSpread,
    ramp:
      typeof ramp === 'number' && Number.isFinite(ramp) && ramp >= 0
        ? ramp
        : DEFAULT_DOC.motion.ramp,
    restPose: restPose === 'fan' ? 'fan' : 'logo',
  };
}

/** Already a document? Recognised by the two fields the old shape never had. */
function isDoc(value: unknown): value is IconDoc {
  return isRecord(value) && Array.isArray(value.elements) && isRecord(value.inks);
}

export function toDoc(value: unknown): IconDoc {
  if (isDoc(value)) return value;
  if (!isRecord(value)) return structuredClone(DEFAULT_DOC);

  const light = hexTriple(value.light);
  const dark = hexTriple(value.dark);
  const angles = numberTriple(value.angles);
  const weight = positive(value.bareWeight);
  const chipReach = positive(value.chipReach);
  const chip = typeof value.chip === 'string' ? value.chip : null;

  if (!light || !dark || !angles || weight === null || chipReach === null || !chip) {
    return structuredClone(DEFAULT_DOC);
  }

  const inks: Record<string, Ink> = {
    field: { light: chip, dark: chip },
  };
  STICK_IDS.forEach((id, i) => {
    inks[id] = { light: light[i] ?? '#000000', dark: dark[i] ?? '#000000' };
  });

  const elements: Element[] = STICK_IDS.map((id, i) => ({
    id,
    type: 'stick',
    ink: id,
    spin: true,
    angle: angles[i] ?? 0,
    reach: BARE_REACH,
    weight,
  }));

  return {
    inks,
    elements,
    variants: {
      favicon: { inks: 'theme', scale: 1 },
      mono: { inks: 'black', scale: 1 },
      // chipWeight is deliberately not read: one scale derives it, which is what
      // stops the ratio drifting.
      chip: { inks: 'dark', scale: chipReach / BARE_REACH, field: { ink: 'field', radius: 11 } },
    },
    motion: motionOf(value.motion),
  };
}
