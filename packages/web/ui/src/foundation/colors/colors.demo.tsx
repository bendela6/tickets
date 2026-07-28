import { type ReactNode } from 'react';
import { useTheme } from '../view';
import {
  HUES,
  STEPS,
  STEP_JOBS,
  SEMANTIC_SCALES,
  SURFACES,
  checkPairings,
  colorOf,
  type Pairing,
  type Severity,
  type Step,
  type Theme,
} from './colors';

export const meta = {
  title: 'Colors',
  group: 'Foundation',
  order: 1,
  size: 'full',
  // The component is a `.ts` data + contrast module, so the convention
  // (colors.demo.tsx -> colors.tsx) cannot find it.
  impl: './colors.ts',
};

// Swatches paint from the token JSON through inline styles rather than utility
// classes, so this page reads correctly before the numbered tokens land in
// tokens.css — and keeps working after.
//
// A hairline ring on the ramp, not on each swatch: several steps sit within a
// hex or two of whatever surface they are drawn on — gray-3 against a raised
// card, gray-1 against the page — and without it the ramp looks like it has
// holes in it. Neutral at low alpha so it reads on both themes without
// tinting the colours it frames.
const RING = { boxShadow: 'inset 0 0 0 1px rgba(128,120,100,.35)' } as const;

function Ramp({ theme, scale, height = 40 }: { theme: Theme; scale: string; height?: number }) {
  return (
    <div className="flex w-full">
      <div className="flex min-w-0 flex-1 overflow-hidden rounded-sm" style={RING}>
        {STEPS.map((step) => (
          <div
            key={step}
            title={`${scale}-${step} · ${colorOf(theme, scale, step)} · ${STEP_JOBS[step]}`}
            className="flex-1"
            style={{ background: colorOf(theme, scale, step), height }}
          />
        ))}
      </div>
      <div
        title={`${scale}-contrast · ${colorOf(theme, scale, 'contrast')}`}
        className="ml-2 w-6 shrink-0 rounded-sm"
        style={{ background: colorOf(theme, scale, 'contrast'), height, ...RING }}
      />
    </div>
  );
}

function StepHeader() {
  return (
    <div className="flex w-full font-mono text-10 text-gray-9">
      {STEPS.map((step) => (
        <span key={step} className="flex-1 text-center">
          {step}
        </span>
      ))}
      <span className="ml-2 w-6 text-center">ct</span>
    </div>
  );
}

function Palette() {
  const [theme, ref] = useTheme();
  return (
    <div ref={ref} className="flex w-full flex-col gap-4">
      <StepHeader />
      {HUES.map((scale) => (
        <div key={scale} className="flex flex-col gap-1">
          <span className="font-mono text-meta font-500 text-gray-12">{scale}</span>
          <Ramp theme={theme} scale={scale} />
        </div>
      ))}
    </div>
  );
}

function Verdict({
  what,
  ratio,
  min,
  passes,
  severity = 'required',
}: Pick<Pairing, 'ratio' | 'min' | 'passes'> & { what: string; severity?: Severity }) {
  // An advisory shortfall is amber, not red: it is below target but is
  // decoration, so it is information rather than a defect.
  const style = passes
    ? { background: '#dff0e2', color: '#225331', mark: '✓' }
    : severity === 'advisory'
      ? { background: '#fae7da', color: '#803d10', mark: '~' }
      : { background: '#f8e7e5', color: '#a82f26', mark: '✕' };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 font-mono text-10 font-500"
      style={{ background: style.background, color: style.color }}
    >
      <span className="opacity-70">{what}</span>
      {style.mark} {ratio.toFixed(2)}
      <span className="opacity-60">/ {min}</span>
    </span>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="font-mono text-10 uppercase tracking-widest text-gray-9">
        {children}
      </span>
      <span className="h-px flex-1 bg-gray-6" />
    </div>
  );
}

/**
 * One step, rendered doing the job its number promises — a surface is painted,
 * a border is drawn around the page colour, a solid carries its contrast text,
 * a text step is set on the page. Reading a row left to right is the argument
 * for numbering: the same position means the same thing on every scale.
 */
function StepSpecimen({ theme, scale, step }: { theme: Theme; scale: string; step: Step }) {
  const c = colorOf(theme, scale, step);
  const page = colorOf(theme, 'gray', 1);
  const box = 'flex h-8 w-full items-center justify-center rounded-sm font-sans text-meta';

  if (step <= 5) {
    return <div className={box} style={{ background: c, ...RING }} title={c} />;
  }
  if (step <= 8) {
    return (
      <div
        className={box}
        style={{ background: page, border: `1.5px solid ${c}` }}
        title={c}
      />
    );
  }
  if (step <= 10) {
    return (
      <div
        className={`${box} font-500`}
        style={{ background: c, color: colorOf(theme, scale, 'contrast') }}
        title={c}
      >
        Aa
      </div>
    );
  }
  return (
    <div className={box} style={{ background: page, color: c, ...RING }} title={c}>
      Aa
    </div>
  );
}

function StepsInUseRow({
  theme,
  scale,
  label,
  note,
}: {
  theme: Theme;
  scale: string;
  label: string;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex w-28 shrink-0 flex-col pt-1 font-mono text-meta">
        <span className="font-500 text-gray-12">{label}</span>
        {note ? <span className="text-10 text-gray-9">{note}</span> : null}
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-12 gap-1">
        {STEPS.map((step) => (
          <StepSpecimen key={step} theme={theme} scale={scale} step={step} />
        ))}
      </div>
    </div>
  );
}

function StepsInUse() {
  const [theme, ref] = useTheme();
  const rows = [
    ...Object.entries(SEMANTIC_SCALES).map(([role, scale]) => ({
      key: role,
      scale,
      label: role,
      note: `→ ${scale}`,
    })),
    ...HUES.map((scale) => ({ key: `hue-${scale}`, scale, label: scale, note: undefined })),
  ];
  return (
    <div ref={ref} className="flex w-full flex-col gap-3">
      <div className="flex items-start gap-4">
        <span className="w-28 shrink-0" />
        <div className="grid min-w-0 flex-1 grid-cols-12 gap-1 font-mono text-9 leading-tight text-gray-9">
          {STEPS.map((step) => (
            <span key={step} className="flex flex-col gap-0.5">
              <span className="text-gray-11">{step}</span>
              <span>{STEP_JOBS[step]}</span>
            </span>
          ))}
        </div>
      </div>
      {rows.map((row, i) => (
        <div key={row.key} className="flex flex-col gap-3">
          {i === 0 ? <GroupLabel>Roles</GroupLabel> : null}
          {row.key === `hue-${HUES[0]}` ? <GroupLabel>Palette</GroupLabel> : null}
          <StepsInUseRow theme={theme} scale={row.scale} label={row.label} note={row.note} />
        </div>
      ))}
    </div>
  );
}

/** Roles, as a list — each with the full ramp it resolves to. */
function Roles() {
  const [theme, ref] = useTheme();
  const surfaces = Object.entries(SURFACES).filter(
    (entry): entry is [string, Record<Theme, string>] => entry[1] != null,
  );
  const name = 'flex w-40 shrink-0 items-baseline gap-1.5 font-mono text-meta';
  return (
    <div ref={ref} className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-40 shrink-0" />
        <div className="min-w-0 flex-1">
          <StepHeader />
        </div>
      </div>
      {Object.entries(SEMANTIC_SCALES).map(([role, scale]) => (
        <div key={role} className="flex items-center gap-3">
          <span className={name}>
            <span className="text-gray-12">{role}</span>
            <span className="text-gray-9">→</span>
            <span className="text-gray-11">{scale}</span>
          </span>
          <div className="min-w-0 flex-1">
            <Ramp theme={theme} scale={scale} height={28} />
          </div>
        </div>
      ))}
      {surfaces.map(([surface, value]) => (
        <div key={surface} className="flex items-center gap-3">
          <span className={name}>
            <span className="text-gray-12">surface-{surface}</span>
            <span className="text-gray-9">→</span>
            <span className="text-gray-9 italic">fixed</span>
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="h-7 w-full rounded-sm"
              title={`--color-surface-${surface} · ${value[theme]}`}
              style={{ background: value[theme], ...RING }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Report() {
  const all = checkPairings();
  const required = all.filter((p) => p.severity === 'required');
  const failing = required.filter((p) => !p.passes);
  const advisory = all.filter((p) => p.severity === 'advisory' && !p.passes);
  const cell = 'border-b border-gray-6 py-1.5 pr-4';
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="font-sans text-meta text-gray-11">
        {failing.length === 0
          ? `All ${required.length} required pairings meet their target.`
          : `${failing.length} of ${required.length} required pairings fall short.`}{' '}
        <span className="text-gray-9">
          {advisory.length} decorative border{advisory.length === 1 ? '' : 's'} below 3:1 —
          reported, not enforced.
        </span>
      </p>
      {failing.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-140 border-collapse font-mono text-meta">
            <thead>
              <tr className="text-left text-gray-9">
                <th className={`${cell} font-500`}>emphasis</th>
                <th className={`${cell} font-500`}>scale</th>
                <th className={`${cell} font-500`}>theme</th>
                <th className={`${cell} font-500`}>pair</th>
                <th className="border-b border-gray-6 py-1.5 font-500">ratio</th>
              </tr>
            </thead>
            <tbody>
              {failing.map((f) => (
                <tr key={`${f.emphasis}-${f.scale}-${f.theme}`} className="text-gray-12">
                  <td className={cell}>{f.emphasis}</td>
                  <td className={cell}>{f.scale}</td>
                  <td className={`${cell} text-gray-9`}>{f.theme}</td>
                  <td className={`${cell} text-gray-9`}>
                    {f.fgLabel} on {f.bgLabel}
                  </td>
                  <td className="border-b border-gray-6 py-1.5">
                    <Verdict what={f.what} ratio={f.ratio} min={f.min} passes={false} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const states = [
  { name: 'Palette', render: () => <Palette /> },
  { name: 'In use', render: () => <StepsInUse /> },
  { name: 'Roles', render: () => <Roles /> },
  { name: 'Contrast report', render: () => <Report /> },
];
