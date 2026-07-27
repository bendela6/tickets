import { FONT_FAMILIES, FONT_WEIGHTS, TEXT_SIZES, TRACKING } from '../spec';
import { DriftView, Sheet, SpecHeader, SpecRow } from '../view';

export const meta = {
  title: 'Typography',
  group: 'Foundation',
  order: 2,
  size: 'full',
  impl: ['./foundation.ts', './foundation-view.tsx'],
};

// Two lines, not one: a size is easy to judge on its own, leading only becomes
// visible when a line wraps under another. Real copy rather than a pangram so
// the specimens read at the density the app actually sets text in.
const COPY =
  'Gateway returned 504 after three retries. The run was marked failed and the queue drained.';

const SANS = FONT_FAMILIES.find((f) => f.name === 'font-sans')!.value;
const MONO = FONT_FAMILIES.find((f) => f.name === 'font-mono')!.value;

function Scale() {
  return (
    <Sheet>
      <SpecHeader specimen="specimen" />
      {TEXT_SIZES.map((size) => (
        <SpecRow
          key={size.name}
          name={size.name}
          value={size.value}
          note={size.lineHeight ? `line-height ${size.lineHeight}` : undefined}
          align="start"
        >
          <p
            className="max-w-160 text-ink"
            style={{
              fontFamily: SANS,
              fontSize: size.value,
              lineHeight: size.lineHeight,
              letterSpacing: size.letterSpacing,
            }}
          >
            {COPY}
          </p>
        </SpecRow>
      ))}
    </Sheet>
  );
}

function WeightAndFamily() {
  return (
    <Sheet>
      <SpecHeader specimen="sans · mono" />
      {FONT_WEIGHTS.map((weight) => (
        <SpecRow key={weight.name} name={weight.name} value={weight.value}>
          <div className="flex flex-wrap items-baseline gap-6 text-ink">
            <span style={{ fontFamily: SANS, fontWeight: weight.value, fontSize: '14px' }}>
              Deploy blocked by review
            </span>
            <span style={{ fontFamily: MONO, fontWeight: weight.value, fontSize: '13px' }}>
              TIX-214 · 04:12
            </span>
          </div>
        </SpecRow>
      ))}
      {FONT_FAMILIES.map((family) => (
        <SpecRow key={family.name} name={family.name} value={family.value.split(',')[0]!}>
          <span className="text-ink" style={{ fontFamily: family.value, fontSize: '14px' }}>
            0123456789 · Illustrate — rn m {'{}'} ()
          </span>
        </SpecRow>
      ))}
    </Sheet>
  );
}

function Tracking() {
  return (
    <Sheet>
      <SpecHeader specimen="uppercase label · 11px" />
      {TRACKING.map((track) => (
        <SpecRow key={track.name} name={track.name} value={track.value}>
          {/* Tracking only earns its keep on uppercase runs, which is the one
              place these three are used — captions, section headers, and the
              mono key labels on an item row. */}
          <span
            className="uppercase text-ink"
            style={{
              fontFamily: track.name === 'tracking-mono-label' ? MONO : SANS,
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: track.value,
            }}
          >
            Attachments · 4 linked items
          </span>
        </SpecRow>
      ))}
    </Sheet>
  );
}

export const states = [
  { name: 'Scale', render: () => <Scale /> },
  { name: 'Weight & family', render: () => <WeightAndFamily /> },
  { name: 'Tracking', render: () => <Tracking /> },
  {
    name: 'Drift',
    render: () => <DriftView families={['text', 'font', 'font-weight', 'tracking']} />,
  },
];
